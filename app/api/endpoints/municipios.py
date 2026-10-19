"""Endpoint de ranking de municipios.

GET /api/v1/municipios

Devuelve el ranking de municipios con rendimiento esperado e incertidumbre:
número de parcelas predicidas, de entrenamiento, rendimiento medio predicho,
semiancho al 90 % y nivel de confianza.
"""

from fastapi import APIRouter

from app.data.loader import cargar_municipios
from app.models.municipio import Municipio

router = APIRouter()


@router.get(
    "/municipios",
    response_model=list[Municipio],
    tags=["municipios"],
    summary="Ranking de municipios (rendimiento esperado e incertidumbre)",
)
def get_municipios():
    """Retorna el ranking de municipios (contracto: Municipio[]).

    Lee el archivo estático ``data/municipios.json`` y lo devuelve tal cual.
    No requiere base de datos.
    """
    municipios = cargar_municipios()
    return [Municipio(**m) for m in municipios]
