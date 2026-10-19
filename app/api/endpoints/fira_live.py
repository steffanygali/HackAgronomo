"""Endpoints de integración directa con la interfaz FIRA (rama frontend).

- GET  /api/parcels         -> 197 parcelas georreferenciadas con 3 sub-lotes (A, B, C),
                               6 evaluaciones satelitales y productores seudonimizados (LFPDPPP).
- GET  /api/model-insights  -> Métricas CV, importancia SHAP y las 3 preguntas guía.
- POST /api/predict         -> Inferencia en vivo validando rangos agronómicos y rechazando
                               campos adicionales (extra="forbid").
"""

from fastapi import APIRouter

from app.api.deps import ERROR_RESPONSES, DatosDep
from app.models.fira import (
    BarleyParcel,
    LivePredictionInput,
    LivePredictionResponse,
    ModelInsightsPayload,
)
from app.services.fira_live import ejecutar_prediccion_en_vivo

router = APIRouter(tags=["fira-live"])


@router.get(
    "/parcels",
    response_model=list[BarleyParcel],
    responses=ERROR_RESPONSES,
    summary="197 parcelas FIRA con sub-lotes A/B/C y monitoreo satelital (productores seudonimizados)",
)
def get_fira_parcels(datos: DatosDep) -> list[BarleyParcel]:
    """Devuelve desde memoria las 197 parcelas con coordenadas intactas y PII seudonimizada."""
    return list(datos.fira_parcels)


@router.get(
    "/model-insights",
    response_model=ModelInsightsPayload,
    responses=ERROR_RESPONSES,
    summary="Desempeño del modelo e insights de las 3 preguntas guía FIRA",
)
def get_fira_model_insights(datos: DatosDep) -> ModelInsightsPayload:
    """Devuelve desde memoria las métricas de validación cruzada e importancia de variables."""
    return datos.fira_model_insights


@router.post(
    "/predict",
    response_model=LivePredictionResponse,
    responses=ERROR_RESPONSES,
    summary="Inferencia interactiva en vivo del rendimiento de cebada y score FIRA",
)
def post_live_prediction(payload: LivePredictionInput) -> LivePredictionResponse:
    """Calcula la predicción de rendimiento, intervalo de confianza y nivel de riesgo."""
    return ejecutar_prediccion_en_vivo(payload)
