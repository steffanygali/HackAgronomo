export type StateName = 'Hidalgo' | 'Tlaxcala' | 'Puebla';

export type DatasetSplit = 'train' | 'eval'; // 70% train (con rendimiento real), 30% eval (reto FIRA)

export type PhenologicalStage =
  | 'Siembra y Emergencia'
  | 'Macollamiento'
  | 'Encañado'
  | 'Espigado y Floración'
  | 'Llenado de Grano'
  | 'Madurez y Cosecha';

export interface PhenologicalEvaluation {
  index: number;
  date: string;          // Fecha de toma satelital YYYY-MM-DD
  captureTime: string;   // Hora UTC/Local del pase Sentinel-2 / Landsat
  satellite: string;     // Ej. Sentinel-2A MSI L2A
  stage: PhenologicalStage;
  ndvi: number;          // Índice de Vegetación de Diferencia Normalizada
  evi: number;           // Índice de Vegetación Mejorado
  ndwi: number;          // Índice Diferencial de Agua Normalizado (estrés hídrico)
  savi: number;          // Índice de Vegetación Ajustado al Suelo
  precipMm: number;      // Precipitación acumulada de la ventana (mm)
  tempMaxC: number;      // Temperatura máxima media (°C)
  tempMinC: number;      // Temperatura mínima media (°C)
  gdd: number;           // Grados-Día de Desarrollo acumulados (GDD)
  soilMoisturePct: number;
}

export interface SubParcelDivision {
  id: string;
  code: string;
  name: string;          // Ej. "Sección A - Norte", "Sección B - Centro", "Sección C - Sur"
  areaHa: number;
  soilType: 'Franco-Arcilloso' | 'Franco-Limoso' | 'Franco-Arenoso';
  slopePct: number;
  ndviByEval: number[];  // Valor NDVI en cada una de las 6 fechas de evaluación
  ndwiByEval: number[];  // Valor NDWI en cada una de las 6 fechas
  predictedYieldTonHa: number;
  moistureStatus: 'Óptimo' | 'Vigilancia' | 'Estrés Hídrico';
  agronomicAction: string;
  polygon: [number, number][]; // Polígono GeoJSON [lng, lat][] de la subdivisión
  additionalPolygons?: [number, number][][]; // Fragmentos separados por el lindero
  labelCenter?: [number, number]; // Punto interior para colocar la etiqueta
}

export interface ShapContribution {
  feature: string;
  valueLabel: string;
  impactTonHa: number; // + o - toneladas/ha sobre la media base
  category: 'vegetacion' | 'clima' | 'terreno';
}

export interface BarleyParcel {
  id: string;
  parcelNumber: number; // 1..197
  name: string;
  producerName: string;
  state: StateName;
  municipality: string;
  split: DatasetSplit;  // 'train' (70% = 138 parcelas) | 'eval' (30% = 59 parcelas)
  center: [number, number]; // [lng, lat]
  polygon: [number, number][]; // Polígono exterior de la parcela
  subDivisions: SubParcelDivision[]; // Parcela dividida en sub-lotes
  areaHa: number;
  altitudeM: number;
  variety: 'Esperanza (Maltera)' | 'Esmeralda (Maltera)' | 'Adabella (Maltera)' | 'Doña Josefa (Forrajera)';
  regime: 'Temporal' | 'Riego Auxiliar';
  actualYieldTonHa: number | null; // Conocido para el 70%, null para el 30% de evaluación
  predictedYieldTonHa: number;     // Estimado por el modelo predictivo
  confidenceInterval: [number, number];
  evaluations: PhenologicalEvaluation[]; // Historial temporal de evaluaciones
  shapContributions: ShapContribution[];
  riskLevel: 'Bajo' | 'Moderado' | 'Alto';
  firaCreditScore: number; // 0 - 100
}

export interface FinancialSimulationParams {
  barleyPricePerTonMxn: number;     // Precio por tonelada MXN (ej. $7,650 MXN maltera)
  productionCostPerHaMxn: number;   // Costo por hectárea MXN (ej. $16,800 MXN)
  climateShockPct: number;          // Variación simulada de precipitación/clima (-30% a +30%)
  firaGuaranteeCoveragePct: number; // Cobertura de garantía FEGA/FIRA (ej. 50% - 80%)
  annualInterestRatePct: number;    // Tasa anual de crédito refaccionario/avío (ej. 11.5%)
}

export interface ModelInsightsPayload {
  metrics: {
    modelName: string;
    rmse: number;
    mae: number;
    r2: number;
    mapePct: number;
    cvFolds: number;
    isSelected: boolean;
  }[];
  guideQuestion1_VegetationIndices: {
    indexName: string;
    fullName: string;
    formula: string;
    shapImportancePct: number;
    pearsonR: number;
    criticalStage: PhenologicalStage;
    interpretation: string;
  }[];
  guideQuestion2_ClimateVariables: {
    variableName: string;
    shapImportancePct: number;
    optimalRange: string;
    impactDescription: string;
  }[];
  guideQuestion3_FeatureCombinations: {
    combinationName: string;
    featuresIncluded: string;
    rmse: number;
    mae: number;
    r2: number;
    gainVsBaselinePct: number;
    isWinner: boolean;
  }[];
}

// --- Contratos adicionales del Backend FastAPI (/api/v1/*) ---

export interface V1Metricas {
  rmse: number;
  mae: number;
  r2: number;
}

export interface V1NotaPermutaciones {
  max_correlacion: number;
  umbral: number;
  fuente: string;
}

export interface V1Meta {
  n_parcelas_total: number;
  n_entrenamiento: number;
  n_prediccion: number;
  metricas: V1Metricas;
  semiancho_global_90: number;
  modelo: string;
  generado_en: string;
  nota_permutaciones?: V1NotaPermutaciones | null;
  versiones?: Record<string, string | number> | null;
}

export interface V1Modelo {
  modelo: string;
  rmse: number;
  rmse_sd: number;
  mae: number;
  r2: number;
  elegido: boolean;
}

export type V1NivelConfianza = 'alta' | 'media' | 'baja';
export type V1MetodoPrediccion = 'hibrido' | 'knn_otros';

export interface V1Municipio {
  municipio: string;
  n_prediccion: number;
  n_entrenamiento: number;
  rendimiento_medio_predicho: number;
  semiancho_90: number;
  confianza: V1NivelConfianza;
}

export interface V1DesgloseParcela {
  mediana_municipal: number;
  ajuste_ridge: number;
}

export interface V1ParcelaEvaluacion {
  id: string;
  municipio: string;
  lat: number;
  lon: number;
  prediccion_ton_ha: number;
  limite_inferior_90: number;
  limite_superior_90: number;
  n_entrenamiento_municipio: number;
  confianza: V1NivelConfianza;
  metodo: V1MetodoPrediccion;
  desglose: V1DesgloseParcela | null;
}

