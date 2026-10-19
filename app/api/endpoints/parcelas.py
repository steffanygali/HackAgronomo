"""Endpoints de lista y detalle de parcelas con predicción.

GET /api/v1/parcelas
GET /api/v1/parcelas/{id}

Devuelve la lista de las 59 parcelas con su predicción de rendimiento e
intervalo de confianza al 90 %. Admite filtrado por municipio y búsqueda por
ID o nombre de municipio.
"""

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.deps import ERROR_RESPONSES, DatosDep
from app.models.error import ErrorResponse
from app.models.parcela import FiltrosParcelas, Parcela
from app.services.parcelas import filtrar_parcelas_modelo, obtener_parcela_por_id

router = APIRouter()


@router.get(
    "/parcelas",
    response_model=list[Parcela],
    responses=ERROR_RESPONSES,
    tags=["parcelas"],
    summary="Lista de parcelas con predicción",
)
def get_parcelas(
    datos: DatosDep,
    municipio: Annotated[
        str | None,
        Query(max_length=100, description="Filtrar por municipio exacto"),
    ] = None,
    q: Annotated[
        str | None,
        Query(max_length=100, description="Buscar por ID de parcela o nombre de municipio"),
    ] = None,
) -> list[Parcela]:
    """Retorna la lista de parcelas con predicción desde memoria (contrato: Parcela[])."""
    # Corrige H2: pasa el modelo FiltrosParcelas al servicio que espera FiltrosParcelas.
    filtros = FiltrosParcelas(municipio=municipio, q=q)
    return filtrar_parcelas_modelo(datos.parcelas, filtros)


@router.get(
    "/parcelas/{parcela_id}",
    response_model=Parcela,
    responses={404: {"model": ErrorResponse}, **ERROR_RESPONSES},
    tags=["parcelas"],
    summary="Una parcela por ID",
)
def get_parcela(
    datos: DatosDep,
    parcela_id: Annotated[
        str,
        Path(min_length=1, max_length=64, description="Identificador de la parcela"),
    ],
) -> Parcela:
    """Retorna una parcela específica por su ID desde el índice O(1) en memoria."""
    return obtener_parcela_por_id(datos, parcela_id)
