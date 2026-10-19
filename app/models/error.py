"""Modelo Pydantic de respuesta de error del API.

Contracto esperado por el frontend: { error: { code, message } }.
"""

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Detalle de un error de la API."""

    code: str = Field(..., min_length=1, description="Código de error")
    message: str = Field(..., min_length=1, description="Mensaje legible del error")


class ErrorResponse(BaseModel):
    """Envelope de respuesta de error."""

    error: ErrorDetail = Field(..., description="Detalle del error")
