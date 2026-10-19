"""Routers de los endpoints de la API."""

from app.api.endpoints.anexo import router as anexo_router
from app.api.endpoints.meta import router as meta_router
from app.api.endpoints.municipios import router as municipios_router
from app.api.endpoints.modelos import router as modelos_router
from app.api.endpoints.parcelas import router as parcelas_router

__all__ = [
    "meta_router",
    "parcelas_router",
    "municipios_router",
    "modelos_router",
    "anexo_router",
]
