"""Modelo Pydantic de un municipio con estadísticas de predicción."""

from typing import Literal

from pydantic import BaseModel, Field


class Municipio(BaseModel):
    """Resumen de rendimiento esperado e incertidumbre por municipio."""

    municipio: str = Field(..., min_length=1, description="Nombre del municipio")
    n_prediccion: int = Field(..., ge=0, description="Número de parcelas predicidas")
    n_entrenamiento: int = Field(..., ge=0, description="Número de parcelas de entrenamiento")
    rendimiento_medio_predicho: float = Field(
        ..., description="Rendimiento medio predicho (ton/ha)"
    )
    semiancho_90: float = Field(..., description="Semiancho del intervalo al 90 %")
    confianza: Literal["alta", "media", "baja"] = Field(
        ..., description="Nivel de confianza agregado del municipio"
    )
