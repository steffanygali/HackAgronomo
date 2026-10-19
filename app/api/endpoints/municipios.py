"""Endpoint de ranking de municipios.

GET /api/v1/municipios

Devuelve el ranking de municipios con rendimiento esperado e incertidumbre:
número de parcelas predichas, de entrenamiento, rendimiento medio predicho,
semiancho al 90 % y nivel de confianza.
"""

from fastapi import APIRouter

from app.api.deps import ERROR_RESPONSES, DatosDep
from app.models.municipio import Municipio

router = APIRouter()


@router.get(
    "/municipios",
    response_model=list[Municipio],
    responses=ERROR_RESPONSES,
    tags=["municipios"],
    summary="Ranking de municipios (rendimiento esperado e incertidumbre)",
)
def get_municipios(datos: DatosDep) -> list[Municipio]:
    """Retorna el ranking de municipios desde memoria (contrato: Municipio[])."""
    return list(datos.municipios)
