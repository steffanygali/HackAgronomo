import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Grid,
  Info,
  MapPin,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  BarleyParcel,
  FinancialSimulationParams,
  SubParcelDivision,
} from '../types/agro';
import { calculateParcelFinancials } from '../services/api';
import { Card, CardHeader, Metric, Tag, cn } from './ui';

export interface FarmerViewProps {
  parcel: BarleyParcel;
  allParcels: BarleyParcel[];
  evalIndex: number;
  selectedSubDivisionId: string | null;
  onSelectSubDivision: (id: string | null) => void;
  financialParams: FinancialSimulationParams;
  onUpdateFinancialParams: (next: FinancialSimulationParams) => void;
}

/**
 * Interpola el color de rampa NDVI según la especificación M3:
 * 0.20 -> #B9822B
 * 0.45 -> #D8C04A
 * 0.65 -> #6DB56F
 * 0.85 -> #1F5B2C
 */
function getNdviColor(ndvi: number): string {
  const stops = [
    { t: 0.2, r: 185, g: 130, b: 43 },
    { t: 0.45, r: 216, g: 192, b: 74 },
    { t: 0.65, r: 109, g: 181, b: 111 },
    { t: 0.85, r: 31, g: 91, b: 44 },
  ];

  if (ndvi <= stops[0].t) {
    return `rgb(${stops[0].r}, ${stops[0].g}, ${stops[0].b})`;
  }
  if (ndvi >= stops[stops.length - 1].t) {
    const last = stops[stops.length - 1];
    return `rgb(${last.r}, ${last.g}, ${last.b})`;
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (ndvi >= s0.t && ndvi <= s1.t) {
      const factor = (ndvi - s0.t) / (s1.t - s0.t);
      const r = Math.round(s0.r + (s1.r - s0.r) * factor);
      const g = Math.round(s0.g + (s1.g - s0.g) * factor);
      const b = Math.round(s0.b + (s1.b - s0.b) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return '#6DB56F';
}

export const FarmerView: React.FC<FarmerViewProps> = ({
  parcel,
  allParcels,
  evalIndex,
  selectedSubDivisionId,
  onSelectSubDivision,
  financialParams,
  onUpdateFinancialParams: _onUpdateFinancialParams,
}) => {
  // Comparación contra el promedio del municipio
  const municipalityStats = useMemo(() => {
    const peers = allParcels.filter((p) => p.municipality === parcel.municipality);
    const avgYield =
      peers.reduce((acc, p) => acc + p.predictedYieldTonHa, 0) / (peers.length || 1);
    const diffPct = ((parcel.predictedYieldTonHa - avgYield) / avgYield) * 100;
    return {
      avgYield: Math.round(avgYield * 100) / 100,
      diffPct: Math.round(diffPct * 10) / 10,
      peerCount: peers.length,
    };
  }, [allParcels, parcel]);

  const financials = useMemo(
    () => calculateParcelFinancials(parcel, financialParams),
    [parcel, financialParams]
  );

  const activeSubDivision: SubParcelDivision | undefined = useMemo(
    () =>
      parcel.subDivisions.find((s) => s.id === selectedSubDivisionId) ||
      parcel.subDivisions[0],
    [parcel.subDivisions, selectedSubDivisionId]
  );

  const shortMunicipality = parcel.municipality.split(' ')[0].replace(/,/g, '');
  const diffPct = municipalityStats.diffPct;

  return (
    <div className="space-y-3">
      {/* 1. Identidad de la Parcela (simplificada para el productor) */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-label-m bg-m3-surface-container-highest text-m3-on-surface rounded-m3-sm px-2 h-6 inline-flex items-center font-medium select-none">
            {parcel.id}
          </span>
          <Tag tone="secondary">{parcel.regime}</Tag>
        </div>

        <h2 className="text-title-l text-m3-on-surface font-normal">
          {parcel.name}
        </h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-m text-m3-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-m3-primary shrink-0" aria-hidden="true" />
            <span>{parcel.municipality}, {parcel.state}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Grid className="w-4 h-4 text-m3-primary shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{parcel.areaHa} ha · {parcel.subDivisions.length} lotes</span>
          </span>
        </div>
      </div>

      {/* 2. Pronóstico y ganancia esperada */}
      <Card variant="tonal-primary" className="p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <span className="text-label-l text-m3-on-primary-container block select-none">
              Cosecha esperada
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-display-s font-normal tabular-nums text-m3-on-primary-container">
                {financials.adjustedYieldTonHa.toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-title-m font-medium text-m3-on-primary-container/85">
                t/ha
              </span>
            </div>
            <p className="text-body-m text-m3-on-primary-container/80 mt-1 tabular-nums">
              Entre {parcel.confidenceInterval[0].toLocaleString('es-MX')} y{' '}
              {parcel.confidenceInterval[1].toLocaleString('es-MX')} t/ha
            </p>
          </div>

          <div className="sm:text-right flex items-center sm:justify-end gap-1.5 self-start sm:mt-1">
            {diffPct >= 0 ? (
              <TrendingUp className="w-5 h-5 text-m3-primary shrink-0" aria-hidden="true" />
            ) : (
              <TrendingDown className="w-5 h-5 text-m3-error shrink-0" aria-hidden="true" />
            )}
            <span className="text-body-m font-medium text-m3-on-primary-container">
              {diffPct >= 0 ? `+${diffPct}% arriba` : `${Math.abs(diffPct)}% abajo`} del promedio en{' '}
              {shortMunicipality}
            </span>
          </div>
        </div>

        <div className="border-t border-m3-on-primary-container/15 my-3 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Metric
              label="Producción total"
              value={`${financials.totalProductionTons.toLocaleString('es-MX', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })} t`}
              supporting={`En ${parcel.areaHa} ha`}
              size="md"
            />
            <Metric
              label="Ganancia libre estimada"
              value={`$${financials.netProfitMxn.toLocaleString('es-MX')} MXN`}
              supporting={`Precio ref. $${financialParams.barleyPricePerTonMxn.toLocaleString('es-MX')}/t`}
              tone={financials.netProfitMxn < 0 ? 'error' : 'default'}
              size="md"
            />
          </div>
        </div>
      </Card>

      {/* 3. Lotes de tu parcela */}
      <Card variant="outlined" className="p-4">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <span>Estado por lote</span>
              <span
                title="Toca una sección de tu parcela para ver qué hacer."
                className="inline-flex cursor-help text-m3-on-surface-variant/70 hover:text-m3-on-surface transition-colors"
              >
                <Info
                  className="w-4 h-4"
                  aria-label="Toca una sección de tu parcela para ver qué hacer."
                />
              </span>
            </span>
          }
          action={<Tag tone="neutral">{parcel.subDivisions.length} lotes</Tag>}
        />

        <div className="flex flex-row gap-2.5 mb-3 overflow-x-auto pb-2 pt-0.5 snap-x snap-mandatory overscroll-x-contain" role="list">
          {parcel.subDivisions.map((sub) => {
            const isSelected = activeSubDivision?.id === sub.id;
            const currentSubNdvi = sub.ndviByEval[evalIndex] ?? sub.ndviByEval[3] ?? 0.5;
            const swatchColor = getNdviColor(currentSubNdvi);

            let statusTone: 'primary' | 'tertiary' | 'error' = 'primary';
            if (sub.moistureStatus === 'Vigilancia') {
              statusTone = 'tertiary';
            } else if (sub.moistureStatus === 'Estrés Hídrico') {
              statusTone = 'error';
            }

            return (
              <button
                key={sub.id}
                type="button"
                role="button"
                aria-pressed={isSelected}
                onClick={() => onSelectSubDivision(sub.id)}
                className={cn(
                  'shrink-0 w-[184px] sm:w-[196px] snap-start rounded-m3-md p-3 state-layer transition-colors duration-200 ease-m3 text-left flex flex-col justify-between gap-2.5 cursor-pointer border',
                  isSelected
                    ? 'bg-m3-secondary-container text-m3-on-secondary-container border-m3-primary/40'
                    : 'bg-m3-surface-container-low hover:bg-m3-surface-container text-m3-on-surface border-m3-outline-variant/50'
                )}
              >
                {/* Fila superior: swatch NDVI + Tag estado */}
                <div className="flex items-center justify-between gap-2 w-full">
                  <div
                    className="w-9 h-9 rounded-m3-sm shrink-0 flex items-center justify-center border border-black/10 shadow-xs"
                    style={{ backgroundColor: swatchColor }}
                    aria-hidden="true"
                    title={`NDVI: ${currentSubNdvi.toFixed(2)}`}
                  >
                    <span className="text-[10px] font-medium text-white select-none tabular-nums drop-shadow-xs">
                      {currentSubNdvi.toFixed(2)}
                    </span>
                  </div>
                  <Tag tone={statusTone}>
                    {sub.moistureStatus}
                  </Tag>
                </div>

                {/* Zona central: Código y nombre del lote */}
                <div className="min-w-0 w-full">
                  <div className="text-title-s font-medium truncate">
                    {sub.code}
                  </div>
                  <div
                    className={cn(
                      'text-body-s truncate',
                      isSelected ? 'text-m3-on-secondary-container/80' : 'text-m3-on-surface-variant'
                    )}
                  >
                    {sub.name}
                  </div>
                </div>

                {/* Fila inferior: Rendimiento predicho y hectáreas */}
                <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-current/10 w-full">
                  <span className="text-title-s font-medium tabular-nums">
                    {sub.predictedYieldTonHa.toFixed(2)} t/ha
                  </span>
                  <span
                    className={cn(
                      'text-body-s tabular-nums',
                      isSelected ? 'text-m3-on-secondary-container/80' : 'text-m3-on-surface-variant'
                    )}
                  >
                    {sub.areaHa} ha
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recomendación agronómica para el lote seleccionado */}
        {activeSubDivision && (
          <div className="bg-m3-surface-container rounded-m3-md p-3 flex items-start gap-3">
            {activeSubDivision.moistureStatus === 'Óptimo' ? (
              <CheckCircle2 className="w-5 h-5 text-m3-primary shrink-0 mt-0.5" aria-hidden="true" />
            ) : activeSubDivision.moistureStatus === 'Vigilancia' ? (
              <AlertTriangle className="w-5 h-5 text-m3-tertiary shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-m3-error shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-title-s font-medium text-m3-on-surface">
                Recomendación para {activeSubDivision.code}
              </div>
              <p className="text-body-m text-m3-on-surface-variant mt-1">
                {activeSubDivision.agronomicAction}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
