"""Modelos Pydantic v2 estrictos e inmutables para el dataset y predicciones FIRA.

Mapeo exacto con los contratos de TypeScript de frontend:src/types/agro.ts y
frontend:src/services/api.ts.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# --- Tipos literales fundamentales ---

StateName = Literal["Hidalgo", "Tlaxcala", "Puebla"]
DatasetSplit = Literal["train", "eval"]
PhenologicalStage = Literal[
    "Siembra y Emergencia",
    "Macollamiento",
    "Encañado",
    "Espigado y Floración",
    "Llenado de Grano",
    "Madurez y Cosecha",
]
SoilType = Literal["Franco-Arcilloso", "Franco-Limoso", "Franco-Arenoso"]
MoistureStatus = Literal["Óptimo", "Vigilancia", "Estrés Hídrico"]
BarleyVariety = Literal[
    "Esperanza (Maltera)",
    "Esmeralda (Maltera)",
    "Adabella (Maltera)",
    "Doña Josefa (Forrajera)",
]
WaterRegime = Literal["Temporal", "Riego Auxiliar"]
RiskLevel = Literal["Bajo", "Moderado", "Alto"]
ShapCategory = Literal["vegetacion", "clima", "terreno"]


class FiraStrictBaseModel(BaseModel):
    """Modelo base estricto e inmutable para todas las entidades FIRA."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class PhenologicalEvaluation(FiraStrictBaseModel):
    """Evaluación fenológica temporal capturada por satélite."""

    index: int
    date: str
    captureTime: str
    satellite: str
    stage: PhenologicalStage
    ndvi: float
    evi: float
    ndwi: float
    savi: float
    precipMm: float
    tempMaxC: float
    tempMinC: float
    gdd: int
    soilMoisturePct: int


class SubParcelDivision(FiraStrictBaseModel):
    """Subdivisión intra-parcelaria (Lote A, Lote B, Lote C) con polígono cerrado."""

    id: str
    code: str
    name: str
    areaHa: float
    soilType: SoilType
    slopePct: float
    ndviByEval: list[float]
    ndwiByEval: list[float]
    predictedYieldTonHa: float
    moistureStatus: MoistureStatus
    agronomicAction: str
    polygon: list[tuple[float, float]]
    additionalPolygons: list[list[tuple[float, float]]] = Field(default_factory=list)
    labelCenter: tuple[float, float] | None = None


class ShapContribution(FiraStrictBaseModel):
    """Contribución SHAP local a la predicción de rendimiento."""

    feature: str
    valueLabel: str
    impactTonHa: float
    category: ShapCategory


class BarleyParcel(FiraStrictBaseModel):
    """Parcela cebadera georreferenciada del Altiplano Mexicano (Hidalgo, Tlaxcala, Puebla)."""

    id: str
    parcelNumber: int
    name: str
    producerName: str = Field(..., min_length=1, description="Nombre seudonimizado del productor")
    state: StateName
    municipality: str
    split: DatasetSplit
    center: tuple[float, float]
    polygon: list[tuple[float, float]]
    subDivisions: list[SubParcelDivision]
    areaHa: float
    altitudeM: float
    variety: BarleyVariety
    regime: WaterRegime
    actualYieldTonHa: float | None = None
    predictedYieldTonHa: float
    confidenceInterval: tuple[float, float]
    evaluations: list[PhenologicalEvaluation]
    shapContributions: list[ShapContribution]
    riskLevel: RiskLevel
    firaCreditScore: int = Field(..., ge=0, le=100)

    @field_validator("producerName")
    @classmethod
    def validate_producer_name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("producerName cannot be empty or whitespace")
        return v.strip()


class ModelMetricComparison(FiraStrictBaseModel):
    """Comparación de métricas de modelos candidatos en validación cruzada."""

    modelName: str
    rmse: float
    mae: float
    r2: float
    mapePct: float
    cvFolds: int
    isSelected: bool


class VegetationIndexInsight(FiraStrictBaseModel):
    """Análisis e importancia SHAP de un índice espectral de vegetación."""

    indexName: str
    fullName: str
    formula: str
    shapImportancePct: float
    pearsonR: float
    criticalStage: PhenologicalStage
    interpretation: str


class ClimateVariableInsight(FiraStrictBaseModel):
    """Análisis e impacto agronómico de una variable agroclimática."""

    variableName: str
    shapImportancePct: float
    optimalRange: str
    impactDescription: str


class FeatureCombinationInsight(FiraStrictBaseModel):
    """Evaluación de combinaciones de variables espectrales y agroclimáticas."""

    combinationName: str
    featuresIncluded: str
    rmse: float
    mae: float
    r2: float
    gainVsBaselinePct: float
    isWinner: bool


class ModelInsightsPayload(FiraStrictBaseModel):
    """Payload completo con métricas de modelos y respuestas a preguntas guía FIRA."""

    metrics: list[ModelMetricComparison]
    guideQuestion1_VegetationIndices: list[VegetationIndexInsight]
    guideQuestion2_ClimateVariables: list[ClimateVariableInsight]
    guideQuestion3_FeatureCombinations: list[FeatureCombinationInsight]


class LivePredictionInput(FiraStrictBaseModel):
    """Parámetros de entrada para inferencia agronómica en vivo."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    parcelId: str | None = Field(None, max_length=64)
    state: StateName
    altitudeM: float = Field(..., ge=0.0, le=5000.0, allow_inf_nan=False)
    regime: WaterRegime
    ndviEspigado: float = Field(..., ge=-1.0, le=1.0, allow_inf_nan=False)
    ndwiLlenado: float = Field(..., ge=-1.0, le=1.0, allow_inf_nan=False)
    eviEncanado: float = Field(..., ge=-1.0, le=2.5, allow_inf_nan=False)
    precipJulAgoMm: float = Field(..., ge=0.0, le=2500.0, allow_inf_nan=False)
    tempMinSepC: float = Field(..., ge=-25.0, le=45.0, allow_inf_nan=False)
    gddTotal: float = Field(..., ge=0.0, le=5000.0, allow_inf_nan=False)


class LivePredictionResponse(FiraStrictBaseModel):
    """Resultado de la predicción en vivo de rendimiento y score crediticio FIRA."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    predictedYieldTonHa: float
    confidenceInterval: tuple[float, float]
    firaCreditScore: int = Field(..., ge=0, le=100)
    riskLevel: RiskLevel
    source: Literal["backend"] = "backend"


class FinancialSimulationParams(FiraStrictBaseModel):
    """Parámetros para simulación financiera y análisis de cobertura de crédito."""

    barleyPricePerTonMxn: float
    productionCostPerHaMxn: float
    climateShockPct: float
    firaGuaranteeCoveragePct: float
    annualInterestRatePct: float


__all__ = [
    "BarleyParcel",
    "BarleyVariety",
    "ClimateVariableInsight",
    "DatasetSplit",
    "FeatureCombinationInsight",
    "FinancialSimulationParams",
    "FiraStrictBaseModel",
    "LivePredictionInput",
    "LivePredictionResponse",
    "ModelInsightsPayload",
    "ModelMetricComparison",
    "MoistureStatus",
    "PhenologicalEvaluation",
    "PhenologicalStage",
    "RiskLevel",
    "ShapCategory",
    "ShapContribution",
    "SoilType",
    "StateName",
    "SubParcelDivision",
    "VegetationIndexInsight",
    "WaterRegime",
]
