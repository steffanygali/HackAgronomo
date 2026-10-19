"""Modelo Pydantic de una parcela con predicción de rendimiento de cebada.

Contracto del frontend (ver docs/openapi.yaml del dashboard):
cada parcela tiene id, municipio, coordenadas, predicción con intervalo del 90 %,
nivel de confianza y método usado.
"""

from typing import Literal

from pydantic import BaseModel, Field


class Desglose(BaseModel):
    """Desglose opcional de la predicción (puede ser null)."""

    mediana_municipal: float = Field(..., description="Mediana municipal de referencia")
    ajuste_ridge: float = Field(..., description="Ajuste del modelo ridge aplicado")


class Parcela(BaseModel):
    """Parcela con su predicción de rendimiento (ton/ha) e intervalo de confianza."""

    id: str = Field(..., min_length=1, description="Identificador de la parcela")
    municipio: str = Field(..., min_length=1, description="Municipio de la parcela")
    lat: float = Field(..., description="Latitud")
    lon: float = Field(..., description="Longitud")
    prediccion_ton_ha: float = Field(..., description="Rendimiento predicho en toneladas por hectárea")
    limite_inferior_90: float = Field(..., description="Límite inferior del intervalo al 90 %")
    limite_superior_90: float = Field(..., description="Límite superior del intervalo al 90 %")
    n_entrenamiento_municipio: int = Field(
        ..., ge=0, description="Número de parcelas de entrenamiento en el municipio"
    )
    confianza: Literal["alta", "media", "baja"] = Field(
        ..., description="Nivel de confianza de la predicción"
    )
    metodo: Literal["hibrido", "knn_otros"] = Field(
        ..., description="Método usado para predecir"
    )
    desglose: Desglose | None = Field(
        None, description="Desglose de la predicción (null si no aplica)"
    )


class FiltrosParcelas(BaseModel):
    """Filtros opcionales para listar parcelas."""

    municipio: str | None = Field(None, description="Filtrar por municipio exacto")
    q: str | None = Field(None, description="Buscar por ID de parcela o nombre de municipio")
