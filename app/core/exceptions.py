"""Manejadores centralizados de excepciones para evitar exponer detalles internos."""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.models.error import ErrorResponse


async def error_500_handler(request: Request, exc: Exception):
    """Devuelve un error 500 genérico sin exponer detalles internos del servidor."""
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error={"code": "error_interno", "message": "Error interno del servidor"}
        ).model_dump(),
    )


async def error_404_handler(request: Request, exc: Exception):
    """Devuelve un error 404 genérico sin exponer rutas internas."""
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(
            error={"code": "no_encontrada", "message": "Recurso no encontrado"}
        ).model_dump(),
    )
