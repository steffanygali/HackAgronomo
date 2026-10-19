"""Endpoints de lista y detalle de parcelas con predicción.

GET /api/v1/parcelas
GET /api/v1/parcelas/{id}

Devuelve la lista de las 59 parcelas con su predicción de rendimiento y
intervalo de confianza al 90 %. Admite filtrado por municipio y búsqueda por
ID o nombre de municipio.
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.data.loader import buscar_parcela_por_id, cargar_parcelas, filtrar_parcelas
from app.models.error import ErrorResponse
from app.models.parcela import Parcela

router = APIRouter()


@router.get(
    "/parcelas",
    response_model=list[Parcela],
    responses={400: {"model": ErrorResponse}},
    tags=["parcelas"],
    summary="Lista de parcelas con predicción",
)
def get_parcelas(
    municipio: str | None = Query(
        None, description="Filtrar por municipio exacto"
    ),
    q: str | None = Query(
        None, description="Buscar por ID de parcela o nombre de municipio"
    ),
):
    """Retorna la lista de parcelas con predicción (contracto: Parcela[]).

    Filtros opcionales:
    - ``municipio``: filtra por municipio exacto.
    - ``q``: búsqueda por ID de parcela o nombre de municipio.

    Lee ``data/parcelas.json`` y aplica los filtros en memoria.
    """
    try:
        parcelas = cargar_parcelas()
        filtradas = filtrar_parcelas(parcelas, municipio=municipio, q=q)
        return [Parcela(**p) for p in filtradas]
    except Exception:  # noqa: BLE001
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error={"code": "error_interno", "message": "Error interno del servidor"}
            ).model_dump(),
        )


@router.get(
    "/parcelas/{parcela_id}",
    response_model=Parcela,
    responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}},
    tags=["parcelas"],
    summary="Una parcela por ID",
)
def get_parcela(parcela_id: str):
    """Retorna una parcela específica por su ID (contracto: Parcela).

    Busca la parcela en ``data/parcelas.json``. Si no se encuentra, devuelve
    un error 404 con formato ``{ error: { code, message } }``.
    """
    try:
        parcela = buscar_parcela_por_id(parcela_id)
        if parcela is None:
            return JSONResponse(
                status_code=404,
                content=ErrorResponse(
                    error={
                        "code": "no_encontrada",
                        "message": "No existe una parcela con el identificador solicitado.",
                    }
                ).model_dump(),
            )
        return Parcela(**parcela)
    except Exception:  # noqa: BLE001
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error={"code": "error_interno", "message": "Error interno del servidor"}
            ).model_dump(),
        )
