"""Punto de entrada de la aplicación FastAPI.

Incluye todos los routers de la API bajo ``/api/v1`` y ``/api``, carga y valida
los datasets en memoria durante el ``lifespan`` (< 2 MB, respuesta < 5 ms), y
aplica controles de seguridad HTTP (CORS por lista blanca, cabeceras de
seguridad, TrustedHost, límite de payload, rate limiting y manejo seguro de errores).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.endpoints import (
    anexo_alias_router,
    anexo_router,
    fira_live_router,
    meta_router,
    modelos_router,
    municipios_router,
    parcelas_router,
    root_router,
)
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import register_security_middleware
from app.core.rate_limit import SlidingWindowRateLimiter
from app.repositories.datos_estaticos import cargar_datos


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Carga y valida los datos estáticos en memoria una única vez al arrancar."""
    app.state.datos = cargar_datos()
    yield


def create_app(custom_settings: Settings | None = None) -> FastAPI:
    """Factoría de la aplicación FastAPI para producción y pruebas aisladas."""
    active_settings = custom_settings or get_settings()
    configure_logging(active_settings.LOG_LEVEL)
    docs_enabled = active_settings.DOCS_ENABLED

    app = FastAPI(
        title=active_settings.APP_NAME,
        description="Backend FastAPI para HackAgronomo / AgroCebada sin base de datos.",
        version="0.1.0",
        contact={"name": "HackAgronomo"},
        license_info={"name": "MIT"},
        # Seguridad (M1/B3): desactiva el traceback HTML interactivo de Starlette.
        debug=False,
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    limiter = SlidingWindowRateLimiter(
        default_per_minute=active_settings.RATE_LIMIT_PER_MINUTE,
        predict_per_minute=active_settings.PREDICT_RATE_LIMIT_PER_MINUTE,
        enabled=active_settings.RATE_LIMIT_ENABLED,
    )
    app.state.settings = active_settings
    app.state.limiter = limiter

    register_exception_handlers(app)
    register_security_middleware(app, active_settings, limiter)

    # Seguridad (H1 - OWASP A05:2021 / API8:2023): orígenes explícitos y sin credenciales.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Accept-Language", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Content-Disposition"],
        max_age=600,
    )

    # Seguridad (M5): valida el header Host contra Host Header Injection.
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=active_settings.ALLOWED_HOSTS,
    )

    # Routers del contrato /api/v1
    app.include_router(meta_router, prefix=active_settings.API_V1_STR)
    app.include_router(parcelas_router, prefix=active_settings.API_V1_STR)
    app.include_router(municipios_router, prefix=active_settings.API_V1_STR)
    app.include_router(modelos_router, prefix=active_settings.API_V1_STR)
    app.include_router(anexo_router, prefix=active_settings.API_V1_STR)
    app.include_router(root_router, prefix=active_settings.API_V1_STR)

    # Routers de descarga directa CSV (/api/anexo-fira.csv, /api/export-eval-csv)
    # y endpoints interactivos FIRA (/api/parcels, /api/model-insights, POST /api/predict)
    app.include_router(anexo_alias_router, prefix="/api")
    app.include_router(fira_live_router, prefix="/api")

    @app.get("/", tags=["root"])
    async def read_root() -> dict[str, str]:
        """Endpoint raíz de bienvenida."""
        return {
            "mensaje": "Bienvenido al Back HackAgronomo",
            "estado": "activo",
            "api_base": active_settings.API_V1_STR,
            "documentacion": "/docs",
        }

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        """Healthcheck del servicio."""
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    s = get_settings()
    uvicorn.run(
        "main:app",
        host=s.HOST,
        port=s.PORT,
        reload=s.is_development,
        server_header=False,
        proxy_headers=True,
        forwarded_allow_ips=s.FORWARDED_ALLOW_IPS,
    )
