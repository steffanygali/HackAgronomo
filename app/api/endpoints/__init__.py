"""Routers de los endpoints de la API."""

from app.api.endpoints.anexo import alias_router as anexo_alias_router
from app.api.endpoints.anexo import router as anexo_router
from app.api.endpoints.fira_live import router as fira_live_router
from app.api.endpoints.meta import router as meta_router
from app.api.endpoints.modelos import router as modelos_router
from app.api.endpoints.municipios import router as municipios_router
from app.api.endpoints.parcelas import router as parcelas_router
from app.api.endpoints.root import router as root_router

__all__ = [
    "anexo_alias_router",
    "anexo_router",
    "fira_live_router",
    "meta_router",
    "modelos_router",
    "municipios_router",
    "parcelas_router",
    "root_router",
]
