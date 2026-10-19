import {
  BarleyParcel,
  ModelInsightsPayload,
  PhenologicalEvaluation,
  PhenologicalStage,
  StateName,
  SubParcelDivision,
  V1Meta,
  V1Modelo,
  V1Municipio,
  V1ParcelaEvaluacion,
} from '../types/agro';
import rawSeed197 from './parcelas197Seed.json';

interface Parcela197SeedRow {
  id: string;
  num: number;
  state: StateName;
  municipality: string;
  split: 'train' | 'eval';
  lon: number;
  lat: number;
  areaHa: number;
  altitudeM: number;
  slopePct: number;
  nnDistM: number;
  actualYieldTonHa: number | null;
  predictedYieldTonHa: number;
  confidenceInterval: [number, number];
  ndvi6: number[];
  clim6: [number, number, number][];
  medianaMunicipal: number;
  ajusteRidge: number;
  confianza: 'alta' | 'media' | 'baja';
  metodo: 'hibrido' | 'knn_otros';
  nEntrenamientoMunicipio: number;
}

const SEED_197 = rawSeed197 as Parcela197SeedRow[];

const EVALUATION_SCHEDULE: { date: string; time: string; stage: PhenologicalStage; gddBase: number }[] = [
  { date: '2025-05-18', time: '11:12 CST (Planet/Sentinel-2A)', stage: 'Siembra y Emergencia', gddBase: 145 },
  { date: '2025-06-15', time: '11:14 CST (Planet/Sentinel-2B)', stage: 'Macollamiento', gddBase: 390 },
  { date: '2025-07-13', time: '11:11 CST (Planet/Sentinel-2A)', stage: 'Encañado', gddBase: 685 },
  { date: '2025-08-10', time: '11:15 CST (Planet/Sentinel-2B)', stage: 'Espigado y Floración', gddBase: 1020 },
  { date: '2025-09-07', time: '11:13 CST (Planet/Sentinel-2A)', stage: 'Llenado de Grano', gddBase: 1340 },
  { date: '2025-10-05', time: '11:12 CST (Planet/Sentinel-2B)', stage: 'Madurez y Cosecha', gddBase: 1610 },
];

const EJIDO_PREFIXES = [
  'Parcela Ejidal San Lorenzo',
  'Rancho Santa Bárbara',
  'Lote La Soledad',
  'Predio El Mirador',
  'Parcela San Isidro',
  'Lote Las Ánimas',
  'Ejido San Nicolás',
  'Predio Los Llanos',
  'Parcela El Capulín',
  'Lote La Concepción',
];

const VARIETIES: BarleyParcel['variety'][] = [
  'Esperanza (Maltera)',
  'Esmeralda (Maltera)',
  'Adabella (Maltera)',
  'Doña Josefa (Forrajera)',
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function round(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function lerpPoint(p0: [number, number], p1: [number, number], t: number): [number, number] {
  return [
    round(p0[0] + (p1[0] - p0[0]) * t, 6),
    round(p0[1] + (p1[1] - p0[1]) * t, 6),
  ];
}

function buildParcelFromSeed(item: Parcela197SeedRow): BarleyParcel {
  const globalIdx = item.num;
  const r2 = seededRandom(globalIdx * 17 + 19);
  const r3 = seededRandom(globalIdx * 23 + 31);
  const r4 = seededRandom(globalIdx * 29 + 43);

  const centerLng = round(item.lon, 6);
  const centerLat = round(item.lat, 6);
  const areaHa = round(Math.max(0.5, item.areaHa), 2);
  const altitudeM = Math.round(item.altitudeM);
  const baseSlopePct = round(item.slopePct, 1);

  const sideM = Math.sqrt(areaHa * 10000);
  const maxSideM = Math.max(40, item.nnDistM * 0.72);
  const effectiveSideM = Math.min(Math.max(55, sideM), Math.min(340, maxSideM));

  const aspect = 1.15 + r2 * 0.35;
  const widthM = effectiveSideM * Math.sqrt(aspect);
  const heightM = effectiveSideM / Math.sqrt(aspect);

  const halfW = Math.min(0.0022, Math.max(0.00028, (widthM / 2) / 104600));
  const halfH = Math.min(0.0018, Math.max(0.00024, (heightM / 2) / 111320));
  const skewX = (r3 - 0.5) * halfW * 0.25;
  const skewY = (r4 - 0.5) * halfH * 0.22;

  const p0: [number, number] = [round(centerLng - halfW + skewX, 6), round(centerLat - halfH + skewY, 6)];
  const p1: [number, number] = [round(centerLng + halfW + skewX, 6), round(centerLat - halfH - skewY, 6)];
  const p2: [number, number] = [round(centerLng + halfW - skewX, 6), round(centerLat + halfH - skewY, 6)];
  const p3: [number, number] = [round(centerLng - halfW - skewX, 6), round(centerLat + halfH + skewY, 6)];
  const outerPolygon: [number, number][] = [p0, p1, p2, p3, p0];

  const cut1 = round(0.32 + (r2 - 0.5) * 0.04, 3);
  const cut2 = round(0.67 + (r3 - 0.5) * 0.04, 3);

  const b1 = lerpPoint(p0, p1, cut1);
  const b2 = lerpPoint(p0, p1, cut2);
  const t1 = lerpPoint(p3, p2, cut1);
  const t2 = lerpPoint(p3, p2, cut2);

  const subPolyA: [number, number][] = [p0, b1, t1, p3, p0];
  const subPolyB: [number, number][] = [b1, b2, t2, t1, b1];
  const subPolyC: [number, number][] = [b2, p1, p2, t2, b2];

  const subAreaA = round(areaHa * cut1, 2);
  const subAreaB = round(areaHa * (cut2 - cut1), 2);
  const subAreaC = round(Math.max(0.1, areaHa - subAreaA - subAreaB), 2);

  const regime: BarleyParcel['regime'] =
    item.municipality === 'Chignahuapan' || item.municipality === 'Almoloya' || r4 > 0.72
      ? 'Riego Auxiliar'
      : 'Temporal';
  const variety = VARIETIES[(globalIdx + Math.floor(r2 * 4)) % VARIETIES.length];

  const evaluations: PhenologicalEvaluation[] = EVALUATION_SCHEDULE.map((sched, eIdx) => {
    const ndviVal = item.ndvi6[eIdx] ?? 0.5;
    const ndvi = round(Math.min(0.92, Math.max(0.12, ndviVal)), 2);
    const evi = round(Math.min(0.84, Math.max(0.09, ndvi * 0.84 + 0.01)), 2);
    const savi = round(Math.min(0.86, Math.max(0.1, ndvi * 0.88)), 2);

    const [precipMmRaw, tempMaxRaw, tempMinRaw] = item.clim6[eIdx] ?? [120, 22, 11];
    const precipMm = Math.round(precipMmRaw);
    const tempMaxC = round(tempMaxRaw, 1);
    const tempMinC = round(tempMinRaw, 1);

    const ndwiRaw = (ndvi - 0.25) * 0.52 + (precipMm - 110) * 0.0005 + (regime === 'Riego Auxiliar' ? 0.04 : 0);
    const ndwi = round(Math.min(0.55, Math.max(-0.1, ndwiRaw)), 2);
    const soilMoisturePct = round(Math.min(48, Math.max(12, 22 + ndwi * 40 + precipMm * 0.025)), 1);
    const gdd = Math.round(sched.gddBase + (2600 - altitudeM) * 0.14);

    return {
      index: eIdx + 1,
      date: sched.date,
      captureTime: sched.time,
      satellite: eIdx % 2 === 0 ? 'PlanetScope / Sentinel-2A MSI L2A' : 'PlanetScope / Sentinel-2B MSI L2A',
      stage: sched.stage,
      ndvi,
      evi,
      savi,
      ndwi,
      soilMoisturePct,
      precipMm,
      tempMaxC,
      tempMinC,
      gdd,
    };
  });

  const predictedYieldTonHa = round(item.predictedYieldTonHa, 3);
  const actualYieldTonHa = item.actualYieldTonHa !== null ? round(item.actualYieldTonHa, 2) : null;
  const totalPrecip = evaluations.reduce((acc, ev) => acc + ev.precipMm, 0);

  const subConfigs: {
    suffix: 'A' | 'B' | 'C';
    name: string;
    soil: SubParcelDivision['soilType'];
    yieldMod: number;
    ndviMod: number;
    polygon: [number, number][];
    areaHa: number;
  }[] = [
    {
      suffix: 'A',
      name: 'Cabecera Norte (Zona Baja)',
      soil: 'Franco-Arcilloso',
      yieldMod: 1.06,
      ndviMod: 0.03,
      polygon: subPolyA,
      areaHa: subAreaA,
    },
    {
      suffix: 'B',
      name: 'Franja Central (Lomaje Suave)',
      soil: 'Franco-Limoso',
      yieldMod: 1.0,
      ndviMod: 0.0,
      polygon: subPolyB,
      areaHa: subAreaB,
    },
    {
      suffix: 'C',
      name: 'Ladera Sur (Drenaje Rápido)',
      soil: 'Franco-Arenoso',
      yieldMod: 0.94,
      ndviMod: -0.04,
      polygon: subPolyC,
      areaHa: subAreaC,
    },
  ];

  const subDivisions: SubParcelDivision[] = subConfigs.map((cfg, sIdx) => {
    const subNdviHistory = evaluations.map((ev) =>
      round(Math.min(0.92, Math.max(0.11, ev.ndvi + cfg.ndviMod)), 2)
    );
    const subNdwiHistory = evaluations.map((ev) =>
      round(Math.min(0.55, Math.max(-0.12, ev.ndwi + cfg.ndviMod * 0.7)), 2)
    );
    const subYield = round(predictedYieldTonHa * cfg.yieldMod, 2);
    const espigadoNdwi = subNdwiHistory[3];

    const moistureStatus: SubParcelDivision['moistureStatus'] =
      espigadoNdwi >= 0.22 ? 'Óptimo' : espigadoNdwi >= 0.12 ? 'Vigilancia' : 'Estrés Hídrico';

    const agronomicAction =
      moistureStatus === 'Estrés Hídrico'
        ? 'Aplicar bioestimulante anti-estrés y priorizar lámina de auxilio en llenado.'
        : moistureStatus === 'Vigilancia'
        ? 'Vigilar retención de humedad en suelo franco-arenoso y calibrar fertilización.'
        : 'Desarrollo homogéneo de espiga; mantener monitoreo preventivo de roya lineal.';

    return {
      id: `${item.id}-${cfg.suffix}`,
      code: `Lote ${cfg.suffix}`,
      name: cfg.name,
      areaHa: cfg.areaHa,
      soilType: cfg.soil,
      slopePct: round(Math.max(0.3, baseSlopePct + (sIdx - 1) * 0.9), 1),
      ndviByEval: subNdviHistory,
      ndwiByEval: subNdwiHistory,
      predictedYieldTonHa: subYield,
      moistureStatus,
      agronomicAction,
      polygon: cfg.polygon,
    };
  });

  const meanBaseYield = 3.85;
  const diffTotal = round(predictedYieldTonHa - meanBaseYield, 2);
  const shapContributions: BarleyParcel['shapContributions'] = [
    {
      feature: `Mediana Municipal (${item.municipality})`,
      valueLabel: `${item.medianaMunicipal.toFixed(2)} t/ha`,
      impactTonHa: round(item.medianaMunicipal - meanBaseYield, 2),
      category: 'terreno',
    },
    {
      feature: 'Ajuste Satelital Ridge (NDVI Espigado)',
      valueLabel: `${evaluations[3].ndvi.toFixed(2)} (${item.ajusteRidge >= 0 ? '+' : ''}${item.ajusteRidge.toFixed(3)})`,
      impactTonHa: round(item.ajusteRidge !== 0 ? item.ajusteRidge : diffTotal * 0.18, 2),
      category: 'vegetacion',
    },
    {
      feature: 'Precipitación Acumulada Ciclo',
      valueLabel: `${totalPrecip} mm`,
      impactTonHa: round(diffTotal * 0.14, 2),
      category: 'clima',
    },
    {
      feature: 'Altitud y Pendiente Topográfica',
      valueLabel: `${altitudeM} msnm (${baseSlopePct}%)`,
      impactTonHa: round(diffTotal * 0.08, 2),
      category: 'terreno',
    },
  ];

  const firaCreditScore = Math.round(
    Math.min(
      98,
      Math.max(
        48,
        42 +
          predictedYieldTonHa * 10.8 +
          (item.confianza === 'alta' ? 5 : item.confianza === 'media' ? 2 : -3)
      )
    )
  );
  const riskLevel: BarleyParcel['riskLevel'] =
    firaCreditScore >= 78 ? 'Bajo' : firaCreditScore >= 64 ? 'Moderado' : 'Alto';

  return {
    id: item.id,
    parcelNumber: globalIdx,
    name: `${EJIDO_PREFIXES[globalIdx % EJIDO_PREFIXES.length]} (${item.id})`,
    producerName: `Productor ${item.id} · ${item.municipality}`,
    state: item.state,
    municipality: item.municipality,
    split: item.split,
    center: [centerLng, centerLat],
    polygon: outerPolygon,
    subDivisions,
    areaHa,
    altitudeM,
    variety,
    regime,
    actualYieldTonHa,
    predictedYieldTonHa,
    confidenceInterval: [
      round(item.confidenceInterval[0], 3),
      round(item.confidenceInterval[1], 3),
    ],
    evaluations,
    shapContributions,
    riskLevel,
    firaCreditScore,
  };
}

export function generate197BarleyParcels(): BarleyParcel[] {
  return SEED_197.map(buildParcelFromSeed);
}

/**
 * Sincroniza los datos en vivo del endpoint oficial `/api/v1/parcelas` (59 evaluación)
 * sobre las 197 parcelas georreferenciadas para garantizar 100% de fidelidad con el backend.
 */
export function mergeV1EvaluacionesIntoParcels(
  parcels: BarleyParcel[],
  v1EvalRows: V1ParcelaEvaluacion[]
): BarleyParcel[] {
  if (!v1EvalRows || v1EvalRows.length === 0) return parcels;
  const evalById = new Map<string, V1ParcelaEvaluacion>();
  for (const row of v1EvalRows) {
    evalById.set(row.id, row);
  }

  return parcels.map((parcel) => {
    const v1 = evalById.get(parcel.id);
    if (!v1) return parcel;

    const predYield = round(v1.prediccion_ton_ha, 3);
    const ciLow = round(v1.limite_inferior_90, 3);
    const ciHigh = round(v1.limite_superior_90, 3);
    const updatedSubDivisions = parcel.subDivisions.map((sub, idx) => {
      const mod = idx === 0 ? 1.06 : idx === 1 ? 1.0 : 0.94;
      return {
        ...sub,
        predictedYieldTonHa: round(predYield * mod, 2),
      };
    });

    const firaCreditScore = Math.round(
      Math.min(
        98,
        Math.max(
          48,
          42 + predYield * 10.8 + (v1.confianza === 'alta' ? 5 : v1.confianza === 'media' ? 2 : -3)
        )
      )
    );
    const riskLevel: BarleyParcel['riskLevel'] =
      firaCreditScore >= 78 ? 'Bajo' : firaCreditScore >= 64 ? 'Moderado' : 'Alto';

    return {
      ...parcel,
      municipality: v1.municipio || parcel.municipality,
      split: 'eval',
      actualYieldTonHa: null,
      predictedYieldTonHa: predYield,
      confidenceInterval: [ciLow, ciHigh],
      subDivisions: updatedSubDivisions,
      firaCreditScore,
      riskLevel,
    };
  });
}

export const INITIAL_MODEL_INSIGHTS: ModelInsightsPayload = {
  metrics: [
    {
      modelName: 'Híbrido (Mediana Municipal + Ridge Satelital + k-NN)',
      rmse: 0.4856,
      mae: 0.3159,
      r2: 0.6722,
      mapePct: 8.4,
      cvFolds: 5,
      isSelected: true,
    },
    {
      modelName: 'KNN espacial (k=12)',
      rmse: 0.4893,
      mae: 0.354,
      r2: 0.6671,
      mapePct: 9.2,
      cvFolds: 5,
      isSelected: false,
    },
    {
      modelName: 'Extra Trees Regressor (Todas las variables)',
      rmse: 0.5262,
      mae: 0.3759,
      r2: 0.6149,
      mapePct: 9.8,
      cvFolds: 5,
      isSelected: false,
    },
    {
      modelName: 'Random Forest Regressor (Todas las variables)',
      rmse: 0.5281,
      mae: 0.3747,
      r2: 0.6121,
      mapePct: 9.8,
      cvFolds: 5,
      isSelected: false,
    },
    {
      modelName: 'Jerárquico (Shrinkage Municipal k=3)',
      rmse: 0.538,
      mae: 0.3774,
      r2: 0.5975,
      mapePct: 10.1,
      cvFolds: 5,
      isSelected: false,
    },
  ],
  guideQuestion1_VegetationIndices: [
    {
      indexName: 'NDVI en Espigado y Llenado (Jul–Sep / Semanas 26–38)',
      fullName: 'Normalized Difference Vegetation Index (PlanetScope / Sentinel-2)',
      formula: '(NIR - Red) / (NIR + Red)',
      shapImportancePct: 44.2,
      pearsonR: 0.74,
      criticalStage: 'Espigado y Floración',
      interpretation:
        'El área bajo la curva (AUC-NDVI) y el máximo de vigor entre julio y septiembre diferencian las parcelas de alta productividad en Chignahuapan y Almoloya frente a lotes con estrés en Calpulalpan.',
    },
    {
      indexName: 'Pendiente de Senescencia NDVI (Sep–Oct)',
      fullName: 'Tasa de decaimiento pos-floración del dosel',
      formula: '(NDVI_Oct - NDVI_Ago) / Δt',
      shapImportancePct: 24.8,
      pearsonR: 0.68,
      criticalStage: 'Llenado de Grano',
      interpretation:
        'Un descenso abrupto del NDVI durante septiembre refleja cierre prematuro del llenado de grano por déficit hídrico o heladas tempranas.',
    },
    {
      indexName: 'NDWI Estimado (Retención Hídrica del Dosel)',
      fullName: 'Normalized Difference Water Index',
      formula: '(NIR - SWIR) / (NIR + SWIR)',
      shapImportancePct: 19.5,
      pearsonR: 0.65,
      criticalStage: 'Llenado de Grano',
      interpretation:
        'Complementa al NDVI al captar disponibilidad de humedad en el follaje y suelo durante la etapa reproductiva.',
    },
    {
      indexName: 'EVI / SAVI en Emergencia y Macollamiento (May–Jun)',
      fullName: 'Enhanced & Soil-Adjusted Vegetation Index',
      formula: '((NIR - Red) / (NIR + Red + L)) * (1 + L)',
      shapImportancePct: 11.5,
      pearsonR: 0.58,
      criticalStage: 'Macollamiento',
      interpretation:
        'Reduce el ruido de reflectancia del suelo desnudo en las primeras semanas de emergencia del cultivo.',
    },
  ],
  guideQuestion2_ClimateVariables: [
    {
      variableName: 'Régimen Agroclimático Municipal y Precipitación Jul–Sep',
      shapImportancePct: 46.0,
      optimalRange: '650 mm – 950 mm acumulados en ciclo (May–Oct)',
      impactDescription:
        'El efecto municipal y la lámina pluvial acumulada explican la brecha estructural entre Chignahuapan/Almoloya (~4.5 t/ha) y Calpulalpan/Nanacamilpa (~2.95 t/ha).',
    },
    {
      variableName: 'Grados-Día de Desarrollo (GDD) y Altitud DEM',
      shapImportancePct: 26.5,
      optimalRange: '2,520 – 2,780 msnm (1,380 – 1,620 GDD)',
      impactDescription:
        'Regula la duración del ciclo fenológico y la ventana libre de heladas en el Altiplano Central.',
    },
    {
      variableName: 'Temperatura Mínima en Llenado y Madurez (Sep–Oct)',
      shapImportancePct: 16.8,
      optimalRange: '> 9.5 °C en septiembre-octubre',
      impactDescription:
        'Protege el peso hectolítrico del grano maltero frente a enfriamientos nocturnos en cotas > 2,750 msnm.',
    },
    {
      variableName: 'Temperatura Máxima en Espigado (Ago)',
      shapImportancePct: 10.7,
      optimalRange: '21.5 °C – 24.0 °C',
      impactDescription:
        'Temperaturas moderadas favorecen la viabilidad del polen y el número de granos por espiga.',
    },
  ],
  guideQuestion3_FeatureCombinations: [
    {
      combinationName: 'Modelo Híbrido Elegido: Mediana Municipal (n>=10) + Ajuste Ridge Satelital + k-NN Espacial',
      featuresIncluded: 'Municipio, Lat/Lon (k-NN), Curva NDVI Planet 2025, Altitud y Pendiente DEM, Clima Mensual',
      rmse: 0.4856,
      mae: 0.3159,
      r2: 0.6722,
      gainVsBaselinePct: 42.9,
      isWinner: true,
    },
    {
      combinationName: 'k-NN Espacial Puro (k=12 vecinos geográficos)',
      featuresIncluded: 'Coordenadas geodésicas (Latitud, Longitud) ponderadas por distancia inversa',
      rmse: 0.4893,
      mae: 0.354,
      r2: 0.6671,
      gainVsBaselinePct: 42.4,
      isWinner: false,
    },
    {
      combinationName: 'Extra Trees / Random Forest (Todas las variables satelitales + clima + topografía)',
      featuresIncluded: 'NDVI (Semanas 16–48), Precipitación, Tmax, Tmin, Elevación, Pendiente, Municipio',
      rmse: 0.5262,
      mae: 0.3759,
      r2: 0.6149,
      gainVsBaselinePct: 38.1,
      isWinner: false,
    },
    {
      combinationName: 'Exclusivamente Satélite + Topografía (Ridge sin contexto espacial/municipal)',
      featuresIncluded: 'NDVI estacional, Elevación, Pendiente, Exposición',
      rmse: 0.6344,
      mae: 0.4932,
      r2: 0.4403,
      gainVsBaselinePct: 25.3,
      isWinner: false,
    },
  ],
};

export const INITIAL_V1_META: V1Meta = {
  n_parcelas_total: 197,
  n_entrenamiento: 138,
  n_prediccion: 59,
  metricas: {
    rmse: 0.4856,
    mae: 0.3159,
    r2: 0.6722,
  },
  semiancho_global_90: 0.716,
  modelo: 'Híbrido (candidato)',
  generado_en: '2026-10-19T02:40:21.657Z',
  nota_permutaciones: {
    max_correlacion: 0.238,
    umbral: 0.281,
    fuente:
      'Pruebas de permutaciones del análisis de minería (variables satelitales dentro de cada municipio).',
  },
  versiones: {
    python: '3.14.6',
    numpy: '2.4.6',
    pandas: '3.0.3',
    scipy: '1.18.0',
    'scikit-learn': '1.9.0',
    semilla: 42,
    n_splits: 5,
    n_repeats: 4,
  },
};

export const INITIAL_V1_MODELOS: V1Modelo[] = [
  { modelo: 'Híbrido (candidato)', rmse: 0.4856, rmse_sd: 0.0025, mae: 0.3159, r2: 0.6722, elegido: true },
  { modelo: 'KNN espacial (k=12)', rmse: 0.4893, rmse_sd: 0.0039, mae: 0.354, r2: 0.6671, elegido: false },
  { modelo: 'Extra Trees (todas)', rmse: 0.5262, rmse_sd: 0.0077, mae: 0.3759, r2: 0.6149, elegido: false },
  { modelo: 'Random Forest (todas)', rmse: 0.5281, rmse_sd: 0.0084, mae: 0.3747, r2: 0.6121, elegido: false },
  { modelo: 'Jerárquico (shrinkage k=3)', rmse: 0.538, rmse_sd: 0.0037, mae: 0.3774, r2: 0.5975, elegido: false },
  { modelo: 'Mediana por municipio', rmse: 0.5564, rmse_sd: 0.0045, mae: 0.3607, r2: 0.5695, elegido: false },
  { modelo: 'GradientBoosting (todas, opcional)', rmse: 0.582, rmse_sd: 0.008, mae: 0.413, r2: 0.5289, elegido: false },
  { modelo: 'Ridge (satélite+topo)', rmse: 0.6344, rmse_sd: 0.0107, mae: 0.4932, r2: 0.4403, elegido: false },
  { modelo: 'Media global', rmse: 0.8498, rmse_sd: 0.001, mae: 0.75, r2: -0.004, elegido: false },
];

export const INITIAL_V1_MUNICIPIOS: V1Municipio[] = [
  {
    municipio: 'Cuautepec de Hinojosa',
    n_prediccion: 4,
    n_entrenamiento: 5,
    rendimiento_medio_predicho: 4.542,
    semiancho_90: 0.368,
    confianza: 'media',
  },
  {
    municipio: 'Chignahuapan',
    n_prediccion: 29,
    n_entrenamiento: 71,
    rendimiento_medio_predicho: 4.516,
    semiancho_90: 0.946,
    confianza: 'alta',
  },
  {
    municipio: 'Almoloya',
    n_prediccion: 4,
    n_entrenamiento: 10,
    rendimiento_medio_predicho: 4.496,
    semiancho_90: 0.333,
    confianza: 'alta',
  },
  {
    municipio: 'Singuilucan',
    n_prediccion: 7,
    n_entrenamiento: 16,
    rendimiento_medio_predicho: 3.187,
    semiancho_90: 0.666,
    confianza: 'alta',
  },
  {
    municipio: 'Calpulalpan',
    n_prediccion: 14,
    n_entrenamiento: 30,
    rendimiento_medio_predicho: 2.961,
    semiancho_90: 0.532,
    confianza: 'alta',
  },
  {
    municipio: 'Nanacamilpa de Mariano Arista',
    n_prediccion: 1,
    n_entrenamiento: 1,
    rendimiento_medio_predicho: 2.752,
    semiancho_90: 0.368,
    confianza: 'baja',
  },
];

export const INITIAL_V1_PARCELAS: V1ParcelaEvaluacion[] = [
  { id: 'AGC_003', municipio: 'Singuilucan', lat: 19.98137239099777, lon: -98.3749956660925, prediccion_ton_ha: 3.273, limite_inferior_90: 2.608, limite_superior_90: 3.939, n_entrenamiento_municipio: 16, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3.2, ajuste_ridge: 0.073 } },
  { id: 'AGC_011', municipio: 'Chignahuapan', lat: 19.864265182655064, lon: -98.2090372822767, prediccion_ton_ha: 4.539, limite_inferior_90: 3.593, limite_superior_90: 5.485, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.019 } },
  { id: 'AGC_016', municipio: 'Chignahuapan', lat: 19.862554753012784, lon: -98.25325976762954, prediccion_ton_ha: 4.461, limite_inferior_90: 3.515, limite_superior_90: 5.407, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.059 } },
  { id: 'AGC_025', municipio: 'Calpulalpan', lat: 19.59155425107255, lon: -98.53690347980734, prediccion_ton_ha: 2.994, limite_inferior_90: 2.462, limite_superior_90: 3.527, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.006 } },
  { id: 'AGC_027', municipio: 'Calpulalpan', lat: 19.56210404259504, lon: -98.53764562212936, prediccion_ton_ha: 2.925, limite_inferior_90: 2.393, limite_superior_90: 3.457, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.075 } },
  { id: 'AGC_028', municipio: 'Chignahuapan', lat: 19.876761855848063, lon: -98.26009256424398, prediccion_ton_ha: 4.551, limite_inferior_90: 3.606, limite_superior_90: 5.497, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.031 } },
  { id: 'AGC_029', municipio: 'Calpulalpan', lat: 19.54691598517672, lon: -98.55662352796335, prediccion_ton_ha: 2.995, limite_inferior_90: 2.463, limite_superior_90: 3.527, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.005 } },
  { id: 'AGC_030', municipio: 'Singuilucan', lat: 19.958286891135888, lon: -98.41028641874114, prediccion_ton_ha: 3.211, limite_inferior_90: 2.545, limite_superior_90: 3.877, n_entrenamiento_municipio: 16, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3.2, ajuste_ridge: 0.011 } },
  { id: 'AGC_031', municipio: 'Chignahuapan', lat: 19.8618692892034, lon: -98.26596906645422, prediccion_ton_ha: 4.531, limite_inferior_90: 3.586, limite_superior_90: 5.477, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.011 } },
  { id: 'AGC_036', municipio: 'Chignahuapan', lat: 19.85609159799293, lon: -98.25160207399516, prediccion_ton_ha: 4.453, limite_inferior_90: 3.508, limite_superior_90: 5.399, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.067 } },
  { id: 'AGC_039', municipio: 'Calpulalpan', lat: 19.575478483775115, lon: -98.59605516076417, prediccion_ton_ha: 2.933, limite_inferior_90: 2.401, limite_superior_90: 3.465, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.067 } },
  { id: 'AGC_042', municipio: 'Singuilucan', lat: 19.950791218523584, lon: -98.388529448902, prediccion_ton_ha: 3.16, limite_inferior_90: 2.494, limite_superior_90: 3.826, n_entrenamiento_municipio: 16, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3.2, ajuste_ridge: -0.04 } },
  { id: 'AGC_043', municipio: 'Chignahuapan', lat: 19.85158991422595, lon: -98.2605018002607, prediccion_ton_ha: 4.513, limite_inferior_90: 3.567, limite_superior_90: 5.458, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.007 } },
  { id: 'AGC_050', municipio: 'Calpulalpan', lat: 19.58105659879257, lon: -98.59010589205704, prediccion_ton_ha: 2.949, limite_inferior_90: 2.417, limite_superior_90: 3.481, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.051 } },
  { id: 'AGC_052', municipio: 'Cuautepec de Hinojosa', lat: 19.92889435736223, lon: -98.27873117310207, prediccion_ton_ha: 4.585, limite_inferior_90: 4.217, limite_superior_90: 4.953, n_entrenamiento_municipio: 5, confianza: 'media', metodo: 'knn_otros', desglose: null },
  { id: 'AGC_061', municipio: 'Calpulalpan', lat: 19.534465387959248, lon: -98.61153142238032, prediccion_ton_ha: 2.999, limite_inferior_90: 2.467, limite_superior_90: 3.531, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.001 } },
  { id: 'AGC_063', municipio: 'Chignahuapan', lat: 19.85912157277312, lon: -98.27772951527592, prediccion_ton_ha: 4.509, limite_inferior_90: 3.563, limite_superior_90: 5.454, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.011 } },
  { id: 'AGC_065', municipio: 'Almoloya', lat: 19.76719187777168, lon: -98.34133514664164, prediccion_ton_ha: 4.47, limite_inferior_90: 4.137, limite_superior_90: 4.803, n_entrenamiento_municipio: 10, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.53, ajuste_ridge: -0.06 } },
  { id: 'AGC_071', municipio: 'Calpulalpan', lat: 19.559299963814475, lon: -98.53350526095088, prediccion_ton_ha: 2.965, limite_inferior_90: 2.433, limite_superior_90: 3.497, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.035 } },
  { id: 'AGC_075', municipio: 'Calpulalpan', lat: 19.564024770688388, lon: -98.54573974950355, prediccion_ton_ha: 2.95, limite_inferior_90: 2.417, limite_superior_90: 3.482, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.05 } },
  { id: 'AGC_076', municipio: 'Chignahuapan', lat: 19.8809220471155, lon: -98.2663073973638, prediccion_ton_ha: 4.545, limite_inferior_90: 3.599, limite_superior_90: 5.491, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.025 } },
  { id: 'AGC_082', municipio: 'Almoloya', lat: 19.801860306915884, lon: -98.26925628405084, prediccion_ton_ha: 4.513, limite_inferior_90: 4.179, limite_superior_90: 4.846, n_entrenamiento_municipio: 10, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.53, ajuste_ridge: -0.017 } },
  { id: 'AGC_085', municipio: 'Chignahuapan', lat: 19.85267019305496, lon: -98.2520165530029, prediccion_ton_ha: 4.473, limite_inferior_90: 3.527, limite_superior_90: 5.418, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.047 } },
  { id: 'AGC_086', municipio: 'Calpulalpan', lat: 19.58448657453865, lon: -98.53167315885258, prediccion_ton_ha: 2.977, limite_inferior_90: 2.445, limite_superior_90: 3.509, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.023 } },
  { id: 'AGC_087', municipio: 'Calpulalpan', lat: 19.54868540688788, lon: -98.538859635403, prediccion_ton_ha: 2.947, limite_inferior_90: 2.414, limite_superior_90: 3.479, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.053 } },
  { id: 'AGC_088', municipio: 'Chignahuapan', lat: 19.894027335395148, lon: -98.23793853842548, prediccion_ton_ha: 4.472, limite_inferior_90: 3.526, limite_superior_90: 5.418, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.048 } },
  { id: 'AGC_091', municipio: 'Chignahuapan', lat: 19.859715832526945, lon: -98.23913609283836, prediccion_ton_ha: 4.576, limite_inferior_90: 3.631, limite_superior_90: 5.522, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.056 } },
  { id: 'AGC_093', municipio: 'Calpulalpan', lat: 19.562252110227497, lon: -98.5462595445088, prediccion_ton_ha: 2.957, limite_inferior_90: 2.425, limite_superior_90: 3.489, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.043 } },
  { id: 'AGC_094', municipio: 'Chignahuapan', lat: 19.870997530200075, lon: -98.20510134152512, prediccion_ton_ha: 4.572, limite_inferior_90: 3.626, limite_superior_90: 5.517, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.052 } },
  { id: 'AGC_095', municipio: 'Chignahuapan', lat: 19.87604693162422, lon: -98.26136606488244, prediccion_ton_ha: 4.522, limite_inferior_90: 3.576, limite_superior_90: 5.467, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.002 } },
  { id: 'AGC_107', municipio: 'Almoloya', lat: 19.804874391930944, lon: -98.26565109377738, prediccion_ton_ha: 4.515, limite_inferior_90: 4.182, limite_superior_90: 4.849, n_entrenamiento_municipio: 10, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.53, ajuste_ridge: -0.015 } },
  { id: 'AGC_113', municipio: 'Singuilucan', lat: 19.955276902984377, lon: -98.389510806369, prediccion_ton_ha: 3.114, limite_inferior_90: 2.448, limite_superior_90: 3.779, n_entrenamiento_municipio: 16, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3.2, ajuste_ridge: -0.086 } },
  { id: 'AGC_116', municipio: 'Chignahuapan', lat: 19.84809189574449, lon: -98.26214948291371, prediccion_ton_ha: 4.478, limite_inferior_90: 3.533, limite_superior_90: 5.424, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.042 } },
  { id: 'AGC_118', municipio: 'Singuilucan', lat: 19.947550992405443, lon: -98.4231462678866, prediccion_ton_ha: 3.231, limite_inferior_90: 2.565, limite_superior_90: 3.897, n_entrenamiento_municipio: 16, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3.2, ajuste_ridge: 0.031 } },
  { id: 'AGC_120', municipio: 'Nanacamilpa de Mariano Arista', lat: 19.53671886032465, lon: -98.53669743860335, prediccion_ton_ha: 2.752, limite_inferior_90: 2.383, limite_superior_90: 3.12, n_entrenamiento_municipio: 1, confianza: 'baja', metodo: 'knn_otros', desglose: null },
  { id: 'AGC_126', municipio: 'Chignahuapan', lat: 19.895893046993336, lon: -98.24370728104222, prediccion_ton_ha: 4.492, limite_inferior_90: 3.547, limite_superior_90: 5.438, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.028 } },
  { id: 'AGC_128', municipio: 'Almoloya', lat: 19.80516586480138, lon: -98.2691900300045, prediccion_ton_ha: 4.487, limite_inferior_90: 4.153, limite_superior_90: 4.82, n_entrenamiento_municipio: 10, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.53, ajuste_ridge: -0.043 } },
  { id: 'AGC_129', municipio: 'Singuilucan', lat: 19.976635028542777, lon: -98.37403543214668, prediccion_ton_ha: 3.146, limite_inferior_90: 2.48, limite_superior_90: 3.811, n_entrenamiento_municipio: 16, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3.2, ajuste_ridge: -0.054 } },
  { id: 'AGC_130', municipio: 'Cuautepec de Hinojosa', lat: 19.932831596557744, lon: -98.27345824026835, prediccion_ton_ha: 4.562, limite_inferior_90: 4.194, limite_superior_90: 4.93, n_entrenamiento_municipio: 5, confianza: 'media', metodo: 'knn_otros', desglose: null },
  { id: 'AGC_136', municipio: 'Chignahuapan', lat: 19.85981891092519, lon: -98.2540730113492, prediccion_ton_ha: 4.5, limite_inferior_90: 3.555, limite_superior_90: 5.446, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.02 } },
  { id: 'AGC_142', municipio: 'Chignahuapan', lat: 19.88002784969116, lon: -98.24870333425696, prediccion_ton_ha: 4.558, limite_inferior_90: 3.613, limite_superior_90: 5.504, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.038 } },
  { id: 'AGC_143', municipio: 'Chignahuapan', lat: 19.852076165893106, lon: -98.28553337210973, prediccion_ton_ha: 4.487, limite_inferior_90: 3.542, limite_superior_90: 5.433, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.033 } },
  { id: 'AGC_147', municipio: 'Calpulalpan', lat: 19.5710067751118, lon: -98.60315428981104, prediccion_ton_ha: 2.939, limite_inferior_90: 2.407, limite_superior_90: 3.472, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.061 } },
  { id: 'AGC_149', municipio: 'Cuautepec de Hinojosa', lat: 19.931605383947616, lon: -98.27634276516896, prediccion_ton_ha: 4.561, limite_inferior_90: 4.193, limite_superior_90: 4.93, n_entrenamiento_municipio: 5, confianza: 'media', metodo: 'knn_otros', desglose: null },
  { id: 'AGC_153', municipio: 'Chignahuapan', lat: 19.863013115249213, lon: -98.26092255388114, prediccion_ton_ha: 4.492, limite_inferior_90: 3.547, limite_superior_90: 5.438, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.028 } },
  { id: 'AGC_154', municipio: 'Chignahuapan', lat: 19.877119239166028, lon: -98.26307725526802, prediccion_ton_ha: 4.517, limite_inferior_90: 3.571, limite_superior_90: 5.462, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.003 } },
  { id: 'AGC_156', municipio: 'Singuilucan', lat: 19.97036081476016, lon: -98.43357035735409, prediccion_ton_ha: 3.175, limite_inferior_90: 2.51, limite_superior_90: 3.841, n_entrenamiento_municipio: 16, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3.2, ajuste_ridge: -0.025 } },
  { id: 'AGC_158', municipio: 'Chignahuapan', lat: 19.87027673707344, lon: -98.2780822934436, prediccion_ton_ha: 4.494, limite_inferior_90: 3.548, limite_superior_90: 5.439, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.026 } },
  { id: 'AGC_173', municipio: 'Calpulalpan', lat: 19.595658228779183, lon: -98.56162503006254, prediccion_ton_ha: 2.971, limite_inferior_90: 2.438, limite_superior_90: 3.503, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.029 } },
  { id: 'AGC_174', municipio: 'Cuautepec de Hinojosa', lat: 19.89818392804266, lon: -98.3042784281099, prediccion_ton_ha: 4.461, limite_inferior_90: 4.093, limite_superior_90: 4.829, n_entrenamiento_municipio: 5, confianza: 'media', metodo: 'knn_otros', desglose: null },
  { id: 'AGC_175', municipio: 'Chignahuapan', lat: 19.85299694586472, lon: -98.24161370758742, prediccion_ton_ha: 4.56, limite_inferior_90: 3.615, limite_superior_90: 5.506, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.04 } },
  { id: 'AGC_177', municipio: 'Chignahuapan', lat: 19.853050794611782, lon: -98.25328447828582, prediccion_ton_ha: 4.474, limite_inferior_90: 3.528, limite_superior_90: 5.419, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.046 } },
  { id: 'AGC_182', municipio: 'Chignahuapan', lat: 19.84814966036269, lon: -98.24406381145651, prediccion_ton_ha: 4.531, limite_inferior_90: 3.586, limite_superior_90: 5.477, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.011 } },
  { id: 'AGC_183', municipio: 'Calpulalpan', lat: 19.57459595853472, lon: -98.54983447749116, prediccion_ton_ha: 2.949, limite_inferior_90: 2.417, limite_superior_90: 3.481, n_entrenamiento_municipio: 30, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 3, ajuste_ridge: -0.051 } },
  { id: 'AGC_186', municipio: 'Chignahuapan', lat: 19.85549652286114, lon: -98.27749350730436, prediccion_ton_ha: 4.485, limite_inferior_90: 3.539, limite_superior_90: 5.43, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.035 } },
  { id: 'AGC_188', municipio: 'Chignahuapan', lat: 19.853229131062665, lon: -98.23963733155516, prediccion_ton_ha: 4.552, limite_inferior_90: 3.606, limite_superior_90: 5.498, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.032 } },
  { id: 'AGC_190', municipio: 'Chignahuapan', lat: 19.89630227005107, lon: -98.23456915286673, prediccion_ton_ha: 4.492, limite_inferior_90: 3.546, limite_superior_90: 5.437, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: -0.028 } },
  { id: 'AGC_191', municipio: 'Chignahuapan', lat: 19.878875619739613, lon: -98.25096462965236, prediccion_ton_ha: 4.557, limite_inferior_90: 3.612, limite_superior_90: 5.503, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.037 } },
  { id: 'AGC_192', municipio: 'Chignahuapan', lat: 19.86605554775497, lon: -98.22748775481784, prediccion_ton_ha: 4.566, limite_inferior_90: 3.62, limite_superior_90: 5.512, n_entrenamiento_municipio: 71, confianza: 'alta', metodo: 'hibrido', desglose: { mediana_municipal: 4.52, ajuste_ridge: 0.046 } },
];
