"""Modelo Pydantic de una parcela con predicción de rendimiento de cebada.

Contrato del frontend (ver docs/openapi.yaml del dashboard):
cada parcela tiene id, municipio, coordenadas, predicción con intervalo del 90 %,
nivel de confianza y método usado.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Desglose(BaseModel):
    """Desglose opcional de la predicción (puede ser null)."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    mediana_municipal: float = Field(
        ..., allow_inf_nan=False, description="Mediana municipal de referencia"
    )
    ajuste_ridge: float = Field(
        ..., allow_inf_nan=False, description="Ajuste del modelo ridge aplicado"
    )


class Parcela(BaseModel):
    """Parcela con su predicción de rendimiento (ton/ha) e intervalo de confianza."""

    # Seguridad (OWASP API3:2023): filtra cualquier campo extra no perteneciente al contrato.
    model_config = ConfigDict(extra="ignore", frozen=True)

    id: str = Field(..., min_length=1, max_length=64, description="Identificador de la parcela")
    municipio: str = Field(..., min_length=1, max_length=100, description="Municipio de la parcela")
    # Nota: se conserva intacta la precisión decimal de lat/lon para MapLibre GL y GeoJSON.
    lat: float = Field(..., ge=-90.0, le=90.0, allow_inf_nan=False, description="Latitud")
    lon: float = Field(..., ge=-180.0, le=180.0, allow_inf_nan=False, description="Longitud")
    prediccion_ton_ha: float = Field(
        ..., allow_inf_nan=False, description="Rendimiento predicho en toneladas por hectárea"
    )
    limite_inferior_90: float = Field(
        ..., allow_inf_nan=False, description="Límite inferior del intervalo al 90 %"
    )
    limite_superior_90: float = Field(
        ..., allow_inf_nan=False, description="Límite superior del intervalo al 90 %"
    )
    n_entrenamiento_municipio: int = Field(
        ..., ge=0, description="Número de parcelas de entrenamiento en el municipio"
    )
    confianza: Literal["alta", "media", "baja"] = Field(
        ..., description="Nivel de confianza de la predicción"
    )
    metodo: Literal["hibrido", "knn_otros"] = Field(..., description="Método usado para predecir")
    desglose: Desglose | None = Field(
        None, description="Desglose de la predicción (null si no aplica)"
    )


class FiltrosParcelas(BaseModel):
    """Filtros opcionales para listar parcelas."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    # Seguridad (B1): límites de longitud para prevenir entradas abusivas.
    municipio: str | None = Field(None, max_length=100, description="Filtrar por municipio exacto")
    q: str | None = Field(
        None,
        max_length=100,
        description="Buscar por ID de parcela o nombre de municipio",
    )
