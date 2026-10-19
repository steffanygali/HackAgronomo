"""Punto de entrada de la aplicación FastAPI.

Incluye todos los routers de la API bajo el prefijo ``/api/v1`` y configura
CORS restringido para el frontend (agrocebada-dashboard).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.endpoints import (
    anexo_router,
    meta_router,
    municipios_router,
    modelos_router,
    parcelas_router,
)
from app.core.config import settings
from app.core.exceptions import error_404_handler, error_500_handler

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend FastAPI para HackAgronomo / AgroCebada sin base de datos.",
    version="0.1.0",
    contact={"name": "HackAgronomo"},
    license_info={"name": "MIT"},
    # En producción (DEBUG=False) se ocultan /docs, /redoc y /openapi.json
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Añade cabeceras de seguridad básicas a todas las respuestas."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers[
            "Content-Security-Policy"
        ] = "default-src 'self'; script-src 'self'; object-src 'none';"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# CORS restringido: solo los orígenes del frontend (ajustar en producción)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["Content-Type", "Accept"],
)

# Manejadores centralizados de excepciones (no exponen detalles internos)
app.add_exception_handler(500, error_500_handler)
app.add_exception_handler(404, error_404_handler)

# Routers de la API bajo /api/v1
app.include_router(meta_router, prefix=settings.API_V1_STR)
app.include_router(parcelas_router, prefix=settings.API_V1_STR)
app.include_router(municipios_router, prefix=settings.API_V1_STR)
app.include_router(modelos_router, prefix=settings.API_V1_STR)
app.include_router(anexo_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["root"])
async def read_root():
    """Endpoint raíz de bienvenida."""
    return {
        "mensaje": "Bienvenido al Back HackAgronomo",
        "estado": "activo",
        "api_base": settings.API_V1_STR,
        "documentacion": "/docs" if settings.DEBUG else "deshabilitado en produccion",
    }


@app.get("/health", tags=["health"])
async def health():
    """Healthcheck del servicio."""
    return {"status": "ok"}
