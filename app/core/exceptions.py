"""Módulo compatible de manejadores de excepciones HTTP (integrado con app.core.errors).

Conserva las funciones ``error_500_handler`` y ``error_404_handler`` introducidas
en ``origin/back`` (``a68558d``), delegando en ``app.core.errors.error_response``
para incluir cabeceras de seguridad HTTP, ``X-Request-ID`` y registro de auditoría.
"""

from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.errors import MENSAJE_INTERNO, error_response

logger = logging.getLogger("app.errors")


async def error_500_handler(request: Request, exc: Exception) -> JSONResponse:
    """Devuelve un error 500 genérico con cabeceras de seguridad y registra el fallo."""
    req_id = getattr(request.state, "request_id", "-")
    logger.exception("Error interno capturado request_id=%s", req_id, exc_info=exc)
    return error_response(
        status_code=500,
        code="error_interno",
        message=MENSAJE_INTERNO,
        request_id=req_id if req_id != "-" else None,
    )


async def error_404_handler(request: Request, exc: Exception) -> JSONResponse:
    """Devuelve un error 404 con el contrato { error: { code, message } }."""
    req_id = getattr(request.state, "request_id", None)
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict) and "error" in detail:
        err = detail["error"]
        return error_response(
            status_code=404,
            code=str(err.get("code", "no_encontrada")),
            message=str(err.get("message", "Recurso no encontrado")),
            request_id=req_id,
        )
    message = (
        str(detail)
        if isinstance(detail, str) and detail and detail != "Not Found"
        else "Recurso no encontrado"
    )
    return error_response(
        status_code=404,
        code="no_encontrada",
        message=message,
        request_id=req_id,
    )
