"""Excepciones de dominio y manejadores globales de errores.

Garantiza que todas las respuestas de error respeten el contrato esperado por el
frontend ``{ error: { code, message } }`` sin filtrar trazas internas, rutas del
sistema de archivos ni entradas no confiables del cliente (OWASP A05:2021 / ASVS V7.4.1).
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.middleware import API_CSP, BASE_SECURITY_HEADERS
from app.models.error import ErrorDetail, ErrorResponse

logger = logging.getLogger("app.errors")

MENSAJE_INTERNO = "Error interno del servidor."
_CODIGOS_HTTP: dict[int, str] = {
    400: "solicitud_invalida",
    404: "no_encontrada",
    405: "metodo_no_permitido",
    413: "payload_demasiado_grande",
    422: "validacion",
    429: "demasiadas_solicitudes",
}


class AppError(Exception):
    """Excepción controlada de la aplicación con código semántico y estado HTTP."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class NotFoundError(AppError):
    """Excepción para recursos inexistentes (HTTP 404)."""

    def __init__(self, message: str = "El recurso solicitado no existe.") -> None:
        super().__init__(status_code=404, code="no_encontrada", message=message)


def error_response(
    status_code: int,
    code: str,
    message: str,
    request_id: str | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Construye un JSONResponse con el sobre ErrorResponse y cabeceras de seguridad."""
    body = ErrorResponse(error=ErrorDetail(code=code, message=message)).model_dump()
    merged_headers: dict[str, str] = {
        **BASE_SECURITY_HEADERS,
        "Content-Security-Policy": API_CSP,
        **(headers or {}),
    }
    if request_id:
        merged_headers["X-Request-ID"] = request_id
    return JSONResponse(status_code=status_code, content=body, headers=merged_headers)


def register_exception_handlers(app: FastAPI) -> None:
    """Registra manejadores globales para errores de negocio, validación, HTTP y 500."""

    @app.exception_handler(AppError)
    async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        return error_response(exc.status_code, exc.code, exc.message, request_id=req_id)

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        request: Request,
        _: RequestValidationError,
    ) -> JSONResponse:
        # Seguridad (M1/B2): no reflejar el input inválido ni estructura interna de Pydantic.
        req_id = getattr(request.state, "request_id", None)
        return error_response(
            422,
            "validacion",
            "Parámetros de la solicitud inválidos.",
            request_id=req_id,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_error(
        request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        code = _CODIGOS_HTTP.get(exc.status_code, "error_http")
        message = str(exc.detail) if exc.status_code < 500 else MENSAJE_INTERNO
        return error_response(
            exc.status_code,
            code,
            message,
            request_id=req_id,
            headers=dict(exc.headers) if exc.headers else None,
        )

    @app.exception_handler(Exception)
    async def _handle_unhandled_error(request: Request, _: Exception) -> JSONResponse:
        # Seguridad (M1): la traza completa queda solo en el log del servidor con request_id.
        req_id = getattr(request.state, "request_id", "-")
        logger.exception("Excepción no controlada request_id=%s", req_id)
        return error_response(
            500,
            "error_interno",
            MENSAJE_INTERNO,
            request_id=req_id if req_id != "-" else None,
        )
