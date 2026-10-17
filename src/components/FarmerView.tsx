import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Grid,
  Leaf,
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
 * Traduce la salud del cultivo a lenguaje llano, sin tecnicismos.
 * Se apoya en el índice de vegetación en la fecha seleccionada.
 */
function getCropLook(ndvi: number): { label: string; tone: 'primary' | 'tertiary' | 'error' } {
  if (ndvi >= 0.6) return { label: 'Se ve sano', tone: 'primary' };
  if (ndvi >= 0.4) return { label: 'Se ve regular', tone: 'tertiary' };
  return { label: 'Se ve débil', tone: 'error' };
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

  // Etiqueta textual de rendimiento (no solo color)
  const statusLabel = diffPct >= 8 ? 'Óptimo' : diffPct >= -8 ? 'Normal' : 'Bajo';
  const statusTone: 'primary' | 'tertiary' | 'error' =
    statusLabel === 'Óptimo' ? 'primary' : statusLabel === 'Normal' ? 'tertiary' : 'error';

  return (
    <div className="space-y-4">
      {/* Identidad de la parcela (compacta) */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-label-m bg-m3-surface-container-highest text-m3-on-surface rounded-m3-sm px-2 h-6 inline-flex items-center font-medium select-none">
            {parcel.id}
          </span>
          <Tag tone="secondary">{parcel.regime}</Tag>
        </div>

        <h2 className="text-title-l text-m3-on-surface font-normal">{parcel.name}</h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-m text-m3-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-m3-primary shrink-0" aria-hidden="true" />
            <span>{parcel.municipality}, {parcel.state}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Grid className="w-4 h-4 text-m3-primary shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              {parcel.areaHa} hectáreas · {parcel.subDivisions.length} lotes
            </span>
          </span>
        </div>
      </div>

      {/* 1. Idea principal: cuánto vas a cosechar */}
      <Card variant="tonal-primary" className="p-5">
        <p className="text-label-l text-m3-on-primary-container/90 select-none">
          Cuánto vas a cosechar
        </p>

        <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-display-s font-normal tabular-nums text-m3-on-primary-container">
              {financials.adjustedYieldTonHa.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-title-s text-m3-on-primary-container/80">
              t/ha
            </span>
          </div>

          <Tag tone={statusTone} className="h-7 px-3 text-label-l">
            {statusLabel}
          </Tag>
        </div>

        <p className="text-body-m text-m3-on-primary-container/85 mt-2 tabular-nums">
          Podrías obtener entre {parcel.confidenceInterval[0].toLocaleString('es-MX')} y{' '}
          {parcel.confidenceInterval[1].toLocaleString('es-MX')} t/ha.
        </p>

        <div className="border-t border-m3-on-primary-container/20 mt-4 pt-3">
          <p className="text-body-m text-m3-on-primary-container inline-flex items-start gap-2">
            {diffPct >= 0 ? (
              <TrendingUp className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span>
              <strong>
                {diffPct >= 0 ? `Estás ${diffPct}% arriba` : `Estás ${Math.abs(diffPct)}% abajo`}
              </strong>{' '}
              del promedio de {shortMunicipality} ({municipalityStats.avgYield.toLocaleString('es-MX')} t/ha).
            </span>
          </p>
        </div>
      </Card>

      {/* 2. Cifras del ciclo: producción e ingreso estimado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card variant="outlined" className="p-4">
          <Metric
            label="Producción total"
            value={`${financials.totalProductionTons.toLocaleString('es-MX', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} toneladas`}
            supporting={`En tus ${parcel.areaHa} hectáreas`}
            size="md"
          />
        </Card>
        <Card variant="outlined" className="p-4">
          <Metric
            label="Ingreso estimado"
            value={`$${financials.netProfitMxn.toLocaleString('es-MX')} MXN`}
            supporting={`Con precio de referencia de $${financialParams.barleyPricePerTonMxn.toLocaleString('es-MX')} por tonelada`}
            tone={financials.netProfitMxn < 0 ? 'error' : 'default'}
            size="md"
          />
        </Card>
      </div>

      {/* 3. Lotes de la parcela y recomendaciones en lenguaje llano */}
      <Card variant="outlined" className="p-4">
        <CardHeader
          title="Qué hacer en cada lote"
          subtitle="Toca un lote para ver su recomendación."
          action={<Tag tone="neutral">{parcel.subDivisions.length} lotes</Tag>}
        />

        <div
          className="flex flex-row gap-3 mb-2 overflow-x-auto pb-2 pt-0.5 snap-x snap-mandatory overscroll-x-contain"
          role="list"
        >
          {parcel.subDivisions.map((sub) => {
            const isSelected = activeSubDivision?.id === sub.id;
            const currentSubNdvi = sub.ndviByEval[evalIndex] ?? sub.ndviByEval[3] ?? 0.5;
            const crop = getCropLook(currentSubNdvi);

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
                  'shrink-0 w-[208px] sm:w-[216px] snap-start rounded-m3-md p-3 state-layer transition-colors duration-150 ease-m3 text-left flex flex-col justify-between gap-3 cursor-pointer border min-h-[132px]',
                  isSelected
                    ? 'bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary'
                    : 'bg-m3-surface-container-lowest hover:bg-m3-surface-container text-m3-on-surface border-m3-outline-variant/60'
                )}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="inline-flex items-center gap-1.5 text-label-m min-w-0">
                    <Leaf
                      className={cn(
                        'w-4 h-4 shrink-0',
                        crop.tone === 'primary'
                          ? 'text-m3-primary'
                          : crop.tone === 'tertiary'
                          ? 'text-m3-tertiary'
                          : 'text-m3-error'
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{crop.label}</span>
                  </span>
                  <Tag tone={statusTone}>{sub.moistureStatus}</Tag>
                </div>

                <div className="min-w-0 w-full">
                  <div className="text-title-s font-medium truncate">{sub.code}</div>
                  <div
                    className={cn(
                      'text-body-s truncate',
                      isSelected ? 'text-m3-on-secondary-container/80' : 'text-m3-on-surface-variant'
                    )}
                  >
                    {sub.name}
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-current/10 w-full">
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

        <p className="text-body-s text-m3-on-surface-variant mb-3">
          El color del ícono indica qué tan verde y sano se ve el cultivo en la fecha elegida.
        </p>

        {/* Recomendación agronómica del lote seleccionado */}
        {activeSubDivision && (
          <div className="bg-m3-surface-container rounded-m3-md p-4 flex items-start gap-3 border border-m3-outline-variant/60">
            {activeSubDivision.moistureStatus === 'Óptimo' ? (
              <CheckCircle2 className="w-5 h-5 text-m3-primary shrink-0 mt-0.5" aria-hidden="true" />
            ) : activeSubDivision.moistureStatus === 'Vigilancia' ? (
              <AlertTriangle className="w-5 h-5 text-m3-tertiary shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-m3-error shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-title-s font-medium text-m3-on-surface">
                Qué hacer en {activeSubDivision.code}
              </div>
              <p className="text-body-m text-m3-on-surface-variant mt-1">
                {activeSubDivision.agronomicAction}
              </p>
              <p className="text-body-s text-m3-on-surface-variant mt-2 tabular-nums">
                Suelo {activeSubDivision.soilType} · Pendiente {activeSubDivision.slopePct}% · Humedad: {activeSubDivision.moistureStatus}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
