"""Dependencias compartidas de la API."""

from typing import Annotated

from fastapi import Depends

from app.core.config import settings


def get_settings():
    """Devuelve la configuración de la aplicación."""
    return settings


SettingsDep = Annotated[object, Depends(get_settings)]
