"""Endpoint de ranking de municipios.

GET /api/v1/municipios

Devuelve el ranking de municipios con rendimiento esperado e incertidumbre:
número de parcelas predicidas, de entrenamiento, rendimiento medio predicho,
semiancho al 90 % y nivel de confianza.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.data.loader import cargar_municipios
from app.models.error import ErrorResponse
from app.models.municipio import Municipio

router = APIRouter()


@router.get(
    "/municipios",
    response_model=list[Municipio],
    responses={400: {"model": ErrorResponse}},
    tags=["municipios"],
    summary="Ranking de municipios (rendimiento esperado e incertidumbre)",
)
def get_municipios():
    """Retorna el ranking de municipios (contracto: Municipio[]).

    Lee el archivo estático ``data/municipios.json`` y lo devuelve tal cual.
    No requiere base de datos.
    """
    try:
        municipios = cargar_municipios()
        return [Municipio(**m) for m in municipios]
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error={"code": "error_interno", "message": str(exc)}
            ).model_dump(),
        )
