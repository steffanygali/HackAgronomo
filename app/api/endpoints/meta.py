"""Endpoint de metadatos globales del modelo.

GET /api/v1/meta

Devuelve los metadatos y métricas globales del modelo de rendimiento de
cebada: total de parcelas, entrenamiento, predicción, métricas (RMSE, MAE,
R²), semiancho al 90 %, modelo usado y fecha de generación.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.data.loader import cargar_meta
from app.models.error import ErrorResponse
from app.models.meta import Meta

router = APIRouter()


@router.get(
    "/meta",
    response_model=Meta,
    responses={400: {"model": ErrorResponse}},
    tags=["meta"],
    summary="Metadatos y métricas globales del modelo",
)
def get_meta():
    """Retorna los metadatos globales del modelo (contracto: Meta).

    Lee el archivo estático ``data/meta.json`` y lo devuelve tal cual.
    No requiere base de datos.
    """
    try:
        datos = cargar_meta()
        return Meta(**datos)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error={"code": "error_interno", "message": str(exc)}
            ).model_dump(),
        )
