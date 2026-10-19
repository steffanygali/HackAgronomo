"""Modelo Pydantic de un municipio con estadísticas de predicción."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Municipio(BaseModel):
    """Resumen de rendimiento esperado e incertidumbre por municipio."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    municipio: str = Field(..., min_length=1, description="Nombre del municipio")
    n_prediccion: int = Field(..., ge=0, description="Número de parcelas predichas")
    n_entrenamiento: int = Field(..., ge=0, description="Número de parcelas de entrenamiento")
    rendimiento_medio_predicho: float = Field(
        ..., allow_inf_nan=False, description="Rendimiento medio predicho (ton/ha)"
    )
    semiancho_90: float = Field(
        ..., allow_inf_nan=False, description="Semiancho del intervalo al 90 %"
    )
    confianza: Literal["alta", "media", "baja"] = Field(
        ..., description="Nivel de confianza agregado del municipio"
    )
