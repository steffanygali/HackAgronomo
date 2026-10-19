"""Endpoints de descarga del anexo CSV de evaluación FIRA.

Rutas soportadas:
- GET /api/v1/export/anexo.csv  (contrato original del dashboard)
- GET /api/anexo-fira.csv       (alias directo para evaluadores / scripts)
- GET /api/export-eval-csv      (alias directo para evaluadores / scripts)

Devuelve el archivo CSV con las 59 predicciones de rendimiento (cabecera:
ID_parcela,rendimiento_predicho_ton_ha) con MIME ``text/csv; charset=utf-8`` y
cabecera ``Content-Disposition: attachment; filename="predicciones_evaluacion_30_fira.csv"``.
"""

from fastapi import APIRouter, Response

from app.api.deps import ERROR_RESPONSES, DatosDep

router = APIRouter()
alias_router = APIRouter()

CSV_FILENAME = "predicciones_evaluacion_30_fira.csv"
CSV_MEDIA_TYPE = "text/csv; charset=utf-8"
CSV_HEADERS = {
    "Content-Disposition": f'attachment; filename="{CSV_FILENAME}"',
}


def _build_csv_response(csv_content: str) -> Response:
    return Response(
        content=csv_content,
        media_type=CSV_MEDIA_TYPE,
        headers=CSV_HEADERS,
    )


@router.get(
    "/export/anexo.csv",
    response_class=Response,
    responses={
        200: {"content": {"text/csv": {"schema": {"type": "string"}}}},
        **ERROR_RESPONSES,
    },
    tags=["export"],
    summary="Anexo descargable con las 59 predicciones",
)
def get_anexo_csv(datos: DatosDep) -> Response:
    """Retorna el CSV oficial de predicciones de evaluación (contrato: text/csv)."""
    return _build_csv_response(datos.anexo_csv)


@alias_router.get(
    "/anexo-fira.csv",
    response_class=Response,
    responses={
        200: {"content": {"text/csv": {"schema": {"type": "string"}}}},
        **ERROR_RESPONSES,
    },
    tags=["export"],
    summary="Alias directo de descarga del anexo FIRA (CSV)",
)
@alias_router.get(
    "/export-eval-csv",
    response_class=Response,
    responses={
        200: {"content": {"text/csv": {"schema": {"type": "string"}}}},
        **ERROR_RESPONSES,
    },
    tags=["export"],
    summary="Alias de exportación de las 59 predicciones de evaluación (CSV)",
)
def get_anexo_fira_alias(datos: DatosDep) -> Response:
    """Permite descargar las 59 predicciones en /api/anexo-fira.csv o /api/export-eval-csv."""
    return _build_csv_response(datos.anexo_csv)
