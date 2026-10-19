"""Endpoint de metadatos globales del modelo.

GET /api/v1/meta

Devuelve los metadatos y métricas globales del modelo de rendimiento de
cebada: total de parcelas, entrenamiento, predicción, métricas (RMSE, MAE,
R²), semiancho al 90 %, modelo usado y fecha de generación.
"""

from fastapi import APIRouter

from app.api.deps import ERROR_RESPONSES, DatosDep
from app.models.meta import Meta

router = APIRouter()


@router.get(
    "/meta",
    response_model=Meta,
    responses=ERROR_RESPONSES,
    tags=["meta"],
    summary="Metadatos y métricas globales del modelo",
)
def get_meta(datos: DatosDep) -> Meta:
    """Retorna los metadatos globales del modelo desde memoria (contrato: Meta)."""
    return datos.meta
