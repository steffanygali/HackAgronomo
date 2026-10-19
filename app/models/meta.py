"""Modelo Pydantic de metadatos globales del modelo."""

from pydantic import BaseModel, ConfigDict, Field


class Metricas(BaseModel):
    """Métricas globales del modelo seleccionado."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    rmse: float = Field(..., allow_inf_nan=False, description="RMSE global")
    mae: float = Field(..., allow_inf_nan=False, description="MAE global")
    r2: float = Field(..., allow_inf_nan=False, description="R^2 global")


class NotaPermutaciones(BaseModel):
    """Nota opcional de pruebas de permutaciones."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    max_correlacion: float = Field(
        ..., allow_inf_nan=False, description="Máxima correlación encontrada"
    )
    umbral: float = Field(..., allow_inf_nan=False, description="Umbral de significancia")
    fuente: str = Field(..., min_length=1, description="Fuente de la nota")


class Meta(BaseModel):
    """Metadatos y métricas globales del modelo de rendimiento de cebada."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    n_parcelas_total: int = Field(..., gt=0, description="Total de parcelas")
    n_entrenamiento: int = Field(..., gt=0, description="Parcelas de entrenamiento")
    n_prediccion: int = Field(..., gt=0, description="Parcelas a predecir")
    metricas: Metricas = Field(..., description="Métricas del modelo")
    semiancho_global_90: float = Field(
        ..., gt=0, allow_inf_nan=False, description="Semiancho global al 90 %"
    )
    modelo: str = Field(..., min_length=1, description="Nombre del modelo usado")
    generado_en: str = Field(..., min_length=1, description="Fecha de generación (ISO 8601)")
    nota_permutaciones: NotaPermutaciones | None = Field(
        None, description="Nota opcional de permutaciones"
    )
    versiones: dict[str, object] | None = Field(
        None, description="Versiones de librerías usadas (reproducibilidad)"
    )
