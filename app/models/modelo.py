"""Modelo Pydantic de comparación de modelos por validación cruzada."""

from pydantic import BaseModel, Field


class Modelo(BaseModel):
    """Metrica de un modelo candidato comparado mediante validación cruzada repetida."""

    modelo: str = Field(..., min_length=1, description="Nombre del modelo")
    rmse: float = Field(..., description="Error cuadrático medio raíz")
    rmse_sd: float = Field(..., description="Desviación estándar del RMSE")
    mae: float = Field(..., description="Error absoluto medio")
    r2: float = Field(..., description="Coeficiente de determinación")
    elegido: bool = Field(..., description="Indica si es el modelo elegido")
