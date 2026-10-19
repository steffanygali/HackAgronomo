"""Endpoint de comparación de modelos.

GET /api/v1/modelos

Devuelve la comparación de modelos por validación cruzada repetida: RMSE, MAE,
R² y cuál fue el modelo elegido.
"""

from fastapi import APIRouter

from app.api.deps import ERROR_RESPONSES, DatosDep
from app.models.modelo import Modelo

router = APIRouter()


@router.get(
    "/modelos",
    response_model=list[Modelo],
    responses=ERROR_RESPONSES,
    tags=["modelos"],
    summary="Comparación de modelos por validación cruzada",
)
def get_modelos(datos: DatosDep) -> list[Modelo]:
    """Retorna la comparación de modelos desde memoria (contrato: Modelo[])."""
    return list(datos.modelos)
