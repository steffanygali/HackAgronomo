"""Modelo Pydantic de comparación de modelos por validación cruzada."""

from pydantic import BaseModel, ConfigDict, Field


class Modelo(BaseModel):
    """Métrica de un modelo candidato comparado mediante validación cruzada repetida."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    modelo: str = Field(..., min_length=1, description="Nombre del modelo")
    rmse: float = Field(..., allow_inf_nan=False, description="Error cuadrático medio raíz")
    rmse_sd: float = Field(..., allow_inf_nan=False, description="Desviación estándar del RMSE")
    mae: float = Field(..., allow_inf_nan=False, description="Error absoluto medio")
    r2: float = Field(..., allow_inf_nan=False, description="Coeficiente de determinación")
    elegido: bool = Field(..., description="Indica si es el modelo elegido")
