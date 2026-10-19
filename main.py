"""Punto de entrada de la aplicación FastAPI.

Incluye todos los routers de la API bajo el prefijo ``/api/v1`` y configura
CORS para permitir el consumo desde el frontend (agrocebada-dashboard).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import (
    anexo_router,
    meta_router,
    municipios_router,
    modelos_router,
    parcelas_router,
)
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend FastAPI para HackAgronomo / AgroCebada sin base de datos.",
    version="0.1.0",
    contact={"name": "HackAgronomo"},
    license_info={"name": "MIT"},
)

# CORS: permite que el frontend (en otro puerto) consuma esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción restringir a los orígenes del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        "documentacion": "/docs",
    }


@app.get("/health", tags=["health"])
async def health():
    """Healthcheck del servicio."""
    return {"status": "ok"}
