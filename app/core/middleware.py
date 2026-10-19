"""Middleware HTTP de seguridad, límite de tamaño de payload, rate limit y auditoría."""

from __future__ import annotations

import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.core.config import Settings
from app.core.rate_limit import SlidingWindowRateLimiter

access_logger = logging.getLogger("app.access")

# Seguridad (M4 - OWASP A05:2021 / ASVS V14.4): cabeceras de defensa en profundidad.
BASE_SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}
# CSP restrictiva para respuestas de datos (se omite en /docs y /redoc para no romper Swagger UI).
API_CSP = "default-src 'none'; frame-ancestors 'none'"
_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")
_REQUEST_ID_RE = re.compile(r"[A-Za-z0-9\-]{1,64}")


def _build_early_error(
    status_code: int,
    code: str,
    message: str,
    request_id: str,
    extra_headers: dict[str, str] | None = None,
) -> JSONResponse:
    headers = {
        **BASE_SECURITY_HEADERS,
        "Content-Security-Policy": API_CSP,
        "X-Request-ID": request_id,
        **(extra_headers or {}),
    }
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


def register_security_middleware(
    app: FastAPI,
    settings: Settings,
    limiter: SlidingWindowRateLimiter,
) -> None:
    """Registra el middleware HTTP de cabeceras de seguridad, límites y log de acceso."""

    @app.middleware("http")
    async def security_and_audit(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        incoming_id = request.headers.get("X-Request-ID", "")
        # Seguridad (M2 - OWASP A09:2021): valida el formato del X-Request-ID para evitar log injection.
        request_id = incoming_id if _REQUEST_ID_RE.fullmatch(incoming_id) else uuid.uuid4().hex
        request.state.request_id = request_id
        client_ip = request.client.host if request.client else "unknown"
        start = time.perf_counter()

        # Seguridad (M3 - OWASP API4:2023): validación temprana de tamaño de payload (Content-Length).
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > settings.MAX_BODY_BYTES:
                    return _build_early_error(
                        413,
                        "payload_demasiado_grande",
                        "El cuerpo de la solicitud excede el límite permitido.",
                        request_id,
                    )
            except ValueError:
                return _build_early_error(
                    400,
                    "solicitud_invalida",
                    "Cabecera Content-Length inválida.",
                    request_id,
                )

        # Seguridad (M3 - OWASP API4:2023): rate limiting por IP (general y estricto en /api/predict).
        is_predict = request.url.path.rstrip("/").endswith("/predict")
        if not limiter.allow_request(client_ip, is_predict=is_predict):
            return _build_early_error(
                429,
                "demasiadas_solicitudes",
                "Límite de solicitudes excedido. Intente más tarde.",
                request_id,
                extra_headers={"Retry-After": "60"},
            )

        response = await call_next(request)

        for header_name, header_value in BASE_SECURITY_HEADERS.items():
            response.headers.setdefault(header_name, header_value)
        if not request.url.path.startswith(_DOCS_PATHS):
            response.headers.setdefault("Content-Security-Policy", API_CSP)
        if settings.HSTS_ENABLED:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        response.headers["X-Request-ID"] = request_id

        duration_ms = (time.perf_counter() - start) * 1000
        # Seguridad (M2): %r escapa secuencias CR/LF en la ruta para evitar inyección de logs.
        access_logger.info(
            "request_id=%s method=%s path=%r status=%d duration_ms=%.2f ip=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            client_ip,
        )
        return response
