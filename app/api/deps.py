"""Dependencias compartidas e inyección de estado para los endpoints de la API."""

from typing import Annotated

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.models.error import ErrorResponse
from app.repositories.datos_estaticos import DatosEstaticos, obtener_datos_cache


def get_datos(request: Request) -> DatosEstaticos:
    """Devuelve el repositorio de datos cargado en memoria durante el lifespan."""
    datos: DatosEstaticos | None = getattr(request.app.state, "datos", None)
    if datos is None:
        datos = obtener_datos_cache()
        request.app.state.datos = datos
    return datos


DatosDep = Annotated[DatosEstaticos, Depends(get_datos)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    400: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
    500: {"model": ErrorResponse},
}
