"""Modelo Pydantic de respuesta de error del API.

Contrato esperado por el frontend: { error: { code, message } }.
"""

from pydantic import BaseModel, ConfigDict, Field


class ErrorDetail(BaseModel):
    """Detalle de un error de la API."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    code: str = Field(..., min_length=1, description="Código de error")
    message: str = Field(..., min_length=1, description="Mensaje legible del error")


class ErrorResponse(BaseModel):
    """Envelope de respuesta de error."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    error: ErrorDetail = Field(..., description="Detalle del error")
