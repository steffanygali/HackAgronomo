import { generate197BarleyParcels, INITIAL_MODEL_INSIGHTS } from '../data/mockBarleyDataset';
import { BarleyParcel, FinancialSimulationParams, ModelInsightsPayload } from '../types/agro';

/**
 * Capa de integración con el Backend (FastAPI / Flask / Node).
 * Si configuras la URL de tu backend (por defecto http://localhost:8000 o vía el modal de conexión),
 * el frontend consumirá tus endpoints reales. Si el backend aún no está corriendo,
 * utiliza automáticamente el dataset georreferenciado de las 197 parcelas FIRA.
 */

const STORAGE_KEY_API_URL = 'agrocebada_backend_url';

export function getBackendUrl(): string {
  return localStorage.getItem(STORAGE_KEY_API_URL) || import.meta.env.VITE_API_URL || '';
}

export function setBackendUrl(url: string): void {
  if (!url.trim()) {
    localStorage.removeItem(STORAGE_KEY_API_URL);
  } else {
    localStorage.setItem(STORAGE_KEY_API_URL, url.trim().replace(/\/+$/, ''));
  }
}

export async function fetchBarleyParcels(): Promise<{
  parcels: BarleyParcel[];
  source: 'backend' | 'local-dataset';
}> {
  const baseUrl = getBackendUrl();
  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/api/parcels`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return { parcels: data, source: 'backend' };
        }
        if (data?.parcels && Array.isArray(data.parcels)) {
          return { parcels: data.parcels, source: 'backend' };
        }
      }
    } catch (err) {
      console.warn('Backend no disponible en', baseUrl, '- usando dataset local de 197 parcelas.', err);
    }
  }

  return {
    parcels: generate197BarleyParcels(),
    source: 'local-dataset',
  };
}

export async function fetchModelInsights(): Promise<ModelInsightsPayload> {
  const baseUrl = getBackendUrl();
  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/api/model-insights`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback a insights precalculados
    }
  }
  return INITIAL_MODEL_INSIGHTS;
}

export interface LivePredictionInput {
  parcelId?: string;
  state: 'Hidalgo' | 'Tlaxcala' | 'Puebla';
  altitudeM: number;
  regime: 'Temporal' | 'Riego Auxiliar';
  ndviEspigado: number;
  ndwiLlenado: number;
  eviEncanado: number;
  precipJulAgoMm: number;
  tempMinSepC: number;
  gddTotal: number;
}

export interface LivePredictionResponse {
  predictedYieldTonHa: number;
  confidenceInterval: [number, number];
  firaCreditScore: number;
  riskLevel: 'Bajo' | 'Moderado' | 'Alto';
  source: 'backend' | 'client-model';
}

export async function runLivePrediction(input: LivePredictionInput): Promise<LivePredictionResponse> {
  const baseUrl = getBackendUrl();
  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const data = await res.json();
        return { ...data, source: 'backend' };
      }
    } catch {
      // Fallback a ecuación surrogada del ensamble en cliente
    }
  }

  // Ecuación calibrada del ensamble para inferencia interactiva instantánea
  const stateBase =
    input.state === 'Puebla' ? 1.72 : input.state === 'Tlaxcala' ? 1.68 : 1.62;
  const ndviTerm = input.ndviEspigado * 2.85;
  const ndwiTerm = input.ndwiLlenado * 1.15;
  const eviTerm = (input.eviEncanado - 0.5) * 0.65;
  const precipTerm = (input.precipJulAgoMm - 220) * 0.0028;
  const frostPenalty = input.tempMinSepC < 4.5 ? (4.5 - input.tempMinSepC) * -0.22 : 0.08;
  const regimeBonus = input.regime === 'Riego Auxiliar' ? 0.42 : 0;

  const rawYield =
    stateBase + ndviTerm + ndwiTerm + eviTerm + precipTerm + frostPenalty + regimeBonus;
  const predictedYieldTonHa = Math.round(Math.min(6.6, Math.max(1.5, rawYield)) * 100) / 100;

  const firaCreditScore = Math.round(
    Math.min(98, Math.max(45, 40 + predictedYieldTonHa * 11.4 + (input.regime === 'Riego Auxiliar' ? 6 : 0)))
  );
  const riskLevel: LivePredictionResponse['riskLevel'] =
    firaCreditScore >= 78 ? 'Bajo' : firaCreditScore >= 64 ? 'Moderado' : 'Alto';

  return {
    predictedYieldTonHa,
    confidenceInterval: [
      Math.round(Math.max(1.1, predictedYieldTonHa - 0.24) * 100) / 100,
      Math.round((predictedYieldTonHa + 0.24) * 100) / 100,
    ],
    firaCreditScore,
    riskLevel,
    source: 'client-model',
  };
}

export function calculateParcelFinancials(
  parcel: BarleyParcel,
  params: FinancialSimulationParams
) {
  // Ajuste de rendimiento por choque climático simulado (sensibilidad según régimen)
  const sensitivity = parcel.regime === 'Temporal' ? 0.0085 : 0.004;
  const shockMultiplier = Math.max(0.45, 1 + params.climateShockPct * sensitivity);
  const adjustedYieldTonHa = Math.round(parcel.predictedYieldTonHa * shockMultiplier * 100) / 100;

  const totalProductionTons = Math.round(adjustedYieldTonHa * parcel.areaHa * 100) / 100;
  const grossIncomeMxn = Math.round(totalProductionTons * params.barleyPricePerTonMxn);
  const baseProductionCostMxn = Math.round(parcel.areaHa * params.productionCostPerHaMxn);
  const financialCostMxn = Math.round(baseProductionCostMxn * (params.annualInterestRatePct / 100) * 0.58); // Ciclo ~7 meses
  const totalCostMxn = baseProductionCostMxn + financialCostMxn;
  const netProfitMxn = grossIncomeMxn - totalCostMxn;
  const roiPct = totalCostMxn > 0 ? Math.round((netProfitMxn / totalCostMxn) * 1000) / 10 : 0;

  // Cobertura de deuda (DSCR) = Ingreso Neto Operativo / Servicio de Deuda
  const debtServiceCoverageRatio =
    totalCostMxn > 0 ? Math.round((grossIncomeMxn / totalCostMxn) * 100) / 100 : 0;

  const breakEvenYieldTonHa =
    params.barleyPricePerTonMxn > 0
      ? Math.round(((totalCostMxn / parcel.areaHa) / params.barleyPricePerTonMxn) * 100) / 100
      : 0;

  const creditEligible = debtServiceCoverageRatio >= 1.25 && adjustedYieldTonHa >= breakEvenYieldTonHa;

  return {
    adjustedYieldTonHa,
    totalProductionTons,
    grossIncomeMxn,
    totalCostMxn,
    financialCostMxn,
    netProfitMxn,
    roiPct,
    debtServiceCoverageRatio,
    breakEvenYieldTonHa,
    creditEligible,
    firaGuaranteedAmountMxn: Math.round(baseProductionCostMxn * (params.firaGuaranteeCoveragePct / 100)),
  };
}

export function exportPredictionsCsv(parcels: BarleyParcel[], onlyEval30Pct = true): void {
  const target = onlyEval30Pct ? parcels.filter((p) => p.split === 'eval') : parcels;
  const headers = [
    'id_parcela',
    'estado',
    'municipio',
    'particion_reto',
    'latitud',
    'longitud',
    'superficie_ha',
    'altitud_msnm',
    'regimen_hidrico',
    'ndvi_espigado',
    'ndwi_llenado',
    'precipitacion_acumulada_mm',
    'rendimiento_real_ton_ha',
    'rendimiento_predicho_ton_ha',
    'intervalo_inf_ton_ha',
    'intervalo_sup_ton_ha',
    'score_credito_fira',
  ];

  const rows = target.map((p) => {
    const totalPrecip = p.evaluations.reduce((s, e) => s + e.precipMm, 0);
    return [
      p.id,
      p.state,
      `"${p.municipality}"`,
      p.split === 'eval' ? '30_EVALUACION' : '70_ENTRENAMIENTO',
      p.center[1],
      p.center[0],
      p.areaHa,
      p.altitudeM,
      `"${p.regime}"`,
      p.evaluations[3]?.ndvi ?? 0,
      p.evaluations[4]?.ndwi ?? 0,
      totalPrecip,
      p.actualYieldTonHa !== null ? p.actualYieldTonHa : 'POR_ESTIMAR_FIRA',
      p.predictedYieldTonHa,
      p.confidenceInterval[0],
      p.confidenceInterval[1],
      p.firaCreditScore,
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    onlyEval30Pct
      ? 'FIRA_AgroCebada2026_Predicciones_30pct_Evaluacion.csv'
      : 'FIRA_AgroCebada2026_Dataset_Completo_197_Parcelas.csv'
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
