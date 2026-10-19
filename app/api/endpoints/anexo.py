"""Endpoint de descarga del anexo CSV.

GET /api/v1/export/anexo.csv

Devuelve el archivo CSV con las 59 predicciones de rendimiento (cabecera:
ID_parcela,rendimiento_predicho_ton_ha) para descarga directa.
"""

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.data.loader import cargar_anexo_csv

router = APIRouter()


@router.get(
    "/export/anexo.csv",
    response_class=PlainTextResponse,
    tags=["export"],
    summary="Anexo descargable con las 59 predicciones",
)
def get_anexo_csv():
    """Retorna el CSV del anexo de predicciones (contracto: texto CSV).

    Cabecera: ``ID_parcela,rendimiento_predicho_ton_ha``.
    Lee el archivo estático ``data/anexo.csv`` y devuelve su contenido como
    texto plano con MIME ``text/csv``.
    """
    try:
        return cargar_anexo_csv()
    except Exception:  # noqa: BLE001
        return PlainTextResponse(
            status_code=500,
            content="Error interno del servidor",
        )
