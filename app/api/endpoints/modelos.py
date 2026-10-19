"""Endpoint de comparación de modelos.

GET /api/v1/modelos

Devuelve la comparación de modelos por validación cruzada repetida: RMSE, MAE,
R² y cuál fue el modelo elegido.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.data.loader import cargar_modelos
from app.models.error import ErrorResponse
from app.models.modelo import Modelo

router = APIRouter()


@router.get(
    "/modelos",
    response_model=list[Modelo],
    responses={400: {"model": ErrorResponse}},
    tags=["modelos"],
    summary="Comparación de modelos por validación cruzada",
)
def get_modelos():
    """Retorna la comparación de modelos (contracto: Modelo[]).

    Lee el archivo estático ``data/modelos.json`` y lo devuelve tal cual.
    No requiere base de datos.
    """
    try:
        modelos = cargar_modelos()
        return [Modelo(**m) for m in modelos]
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error={"code": "error_interno", "message": str(exc)}
            ).model_dump(),
        )
