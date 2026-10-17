import React, { useMemo, useState } from 'react';
import {
  Award,
  Calculator,
  Cpu,
  Download,
  FileSpreadsheet,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  Table,
} from 'lucide-react';
import {
  BarleyParcel,
  FinancialSimulationParams,
  ModelInsightsPayload,
  StateName,
} from '../types/agro';
import {
  calculateParcelFinancials,
  exportPredictionsCsv,
  LivePredictionInput,
  LivePredictionResponse,
  runLivePrediction,
} from '../services/api';
import {
  Button,
  Card,
  CardHeader,
  FilterChip,
  Metric,
  SegmentedButton,
  Slider,
  Tabs,
  Tag,
  cn,
} from './ui';

export interface AnalystViewProps {
  parcels: BarleyParcel[];
  selectedParcel: BarleyParcel;
  onSelectParcel: (parcel: BarleyParcel) => void;
  financialParams: FinancialSimulationParams;
  onUpdateFinancialParams: (next: FinancialSimulationParams) => void;
  modelInsights: ModelInsightsPayload;
}

type AnalystTab = 'simulator' | 'questions' | 'live-model' | 'dataset-table';

export const AnalystView: React.FC<AnalystViewProps> = ({
  parcels,
  selectedParcel,
  onSelectParcel,
  financialParams,
  onUpdateFinancialParams,
  modelInsights,
}) => {
  const [activeTab, setActiveTab] = useState<AnalystTab>('simulator');
  const [tableSplitFilter, setTableSplitFilter] = useState<'all' | 'eval' | 'train'>('all');

  // Estado para el laboratorio de predicción en vivo (POST /api/predict)
  const [liveInput, setLiveInput] = useState<LivePredictionInput>({
    parcelId: selectedParcel.id,
    state: selectedParcel.state,
    altitudeM: selectedParcel.altitudeM,
    regime: selectedParcel.regime,
    ndviEspigado: selectedParcel.evaluations[3]?.ndvi ?? 0.72,
    ndwiLlenado: selectedParcel.evaluations[4]?.ndwi ?? 0.31,
    eviEncanado: selectedParcel.evaluations[2]?.evi ?? 0.56,
    precipJulAgoMm:
      (selectedParcel.evaluations[2]?.precipMm ?? 120) +
      (selectedParcel.evaluations[3]?.precipMm ?? 135),
    tempMinSepC: selectedParcel.evaluations[4]?.tempMinC ?? 7.4,
    gddTotal: selectedParcel.evaluations[5]?.gdd ?? 1580,
  });
  const [liveResult, setLiveResult] = useState<LivePredictionResponse | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // Simulación financiera agregada sobre las parcelas
  const regionalSimulation = useMemo(() => {
    let totalHa = 0;
    let totalTons = 0;
    let totalGrossIncome = 0;
    let totalCost = 0;
    let totalNetProfit = 0;
    let totalFiraGuarantee = 0;
    let creditEligibleCount = 0;

    const byState: Record<
      string,
      { count: number; ha: number; tons: number; grossMxn: number; netMxn: number; avgYield: number }
    > = {
      Hidalgo: { count: 0, ha: 0, tons: 0, grossMxn: 0, netMxn: 0, avgYield: 0 },
      Tlaxcala: { count: 0, ha: 0, tons: 0, grossMxn: 0, netMxn: 0, avgYield: 0 },
      Puebla: { count: 0, ha: 0, tons: 0, grossMxn: 0, netMxn: 0, avgYield: 0 },
    };

    for (const p of parcels) {
      const fin = calculateParcelFinancials(p, financialParams);
      totalHa += p.areaHa;
      totalTons += fin.totalProductionTons;
      totalGrossIncome += fin.grossIncomeMxn;
      totalCost += fin.totalCostMxn;
      totalNetProfit += fin.netProfitMxn;
      totalFiraGuarantee += fin.firaGuaranteedAmountMxn;
      if (fin.creditEligible) creditEligibleCount++;

      const st = byState[p.state];
      if (st) {
        st.count += 1;
        st.ha += p.areaHa;
        st.tons += fin.totalProductionTons;
        st.grossMxn += fin.grossIncomeMxn;
        st.netMxn += fin.netProfitMxn;
        st.avgYield += fin.adjustedYieldTonHa;
      }
    }

    Object.values(byState).forEach((st) => {
      if (st.count > 0) {
        st.avgYield = Math.round((st.avgYield / st.count) * 100) / 100;
        st.ha = Math.round(st.ha * 10) / 10;
        st.tons = Math.round(st.tons * 10) / 10;
      }
    });

    const selectedParcelFin = calculateParcelFinancials(selectedParcel, financialParams);

    return {
      parcelCount: parcels.length,
      totalHa: Math.round(totalHa * 10) / 10,
      totalTons: Math.round(totalTons * 10) / 10,
      totalGrossIncome,
      totalCost,
      totalNetProfit,
      totalFiraGuarantee,
      creditEligibleCount,
      creditEligiblePct: Math.round((creditEligibleCount / (parcels.length || 1)) * 100),
      byState,
      selectedParcelFin,
    };
  }, [parcels, financialParams, selectedParcel]);

  const filteredTableParcels = useMemo(() => {
    if (tableSplitFilter === 'all') return parcels;
    return parcels.filter((p) => p.split === tableSplitFilter);
  }, [parcels, tableSplitFilter]);

  const handleLoadSelectedIntoLive = () => {
    setLiveInput({
      parcelId: selectedParcel.id,
      state: selectedParcel.state,
      altitudeM: selectedParcel.altitudeM,
      regime: selectedParcel.regime,
      ndviEspigado: selectedParcel.evaluations[3]?.ndvi ?? 0.72,
      ndwiLlenado: selectedParcel.evaluations[4]?.ndwi ?? 0.31,
      eviEncanado: selectedParcel.evaluations[2]?.evi ?? 0.56,
      precipJulAgoMm:
        (selectedParcel.evaluations[2]?.precipMm ?? 120) +
        (selectedParcel.evaluations[3]?.precipMm ?? 135),
      tempMinSepC: selectedParcel.evaluations[4]?.tempMinC ?? 7.4,
      gddTotal: selectedParcel.evaluations[5]?.gdd ?? 1580,
    });
  };

  const handleExecuteLivePrediction = async () => {
    setIsPredicting(true);
    try {
      const res = await runLivePrediction(liveInput);
      setLiveResult(res);
    } finally {
      setIsPredicting(false);
    }
  };

  const TABS: { value: AnalystTab; label: string; icon: React.ReactNode }[] = [
    { value: 'simulator', label: 'Simulador', icon: <Calculator /> },
    { value: 'questions', label: 'Modelo', icon: <Award /> },
    { value: 'live-model', label: 'Predicción', icon: <Cpu /> },
    { value: 'dataset-table', label: 'Parcelas', icon: <Table /> },
  ];

  return (
    <div className="space-y-4">
      {/* Primary M3 Tabs Navigation */}
      <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      {/* TAB 1: SIMULADOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-4">
          {/* Controls card */}
          <div className="bg-m3-surface-container rounded-m3-lg p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div
                className="flex items-center gap-1.5 cursor-help"
                title={`${regionalSimulation.parcelCount} parcelas evaluadas (${Math.round(regionalSimulation.totalHa)} ha)`}
              >
                <h3 className="text-title-m font-medium text-m3-on-surface">Escenario</h3>
                <Info
                  className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                  aria-label={`${regionalSimulation.parcelCount} parcelas evaluadas (${Math.round(regionalSimulation.totalHa)} ha)`}
                />
              </div>
              <Button
                variant="text"
                size="sm"
                icon={<RotateCcw />}
                onClick={() =>
                  onUpdateFinancialParams({
                    barleyPricePerTonMxn: 7650,
                    productionCostPerHaMxn: 16800,
                    climateShockPct: 0,
                    firaGuaranteeCoveragePct: 70,
                    annualInterestRatePct: 11.5,
                  })
                }
              >
                Restablecer
              </Button>
            </div>

            <div className="space-y-4">
              {/* Slider 1: Precio */}
              <Slider
                label="Precio cebada"
                valueLabel={`$${financialParams.barleyPricePerTonMxn.toLocaleString('es-MX')} por t`}
                min={5500}
                max={9800}
                step={100}
                value={financialParams.barleyPricePerTonMxn}
                onChange={(v) =>
                  onUpdateFinancialParams({
                    ...financialParams,
                    barleyPricePerTonMxn: v,
                  })
                }
                marks={[
                  { value: 5500, label: '$5.5k' },
                  { value: 7650, label: '$7.65k contrato' },
                  { value: 9800, label: '$9.8k' },
                ]}
              />

              {/* Slider 2: Costo */}
              <Slider
                tone="tertiary"
                label="Costo de producción"
                valueLabel={`$${financialParams.productionCostPerHaMxn.toLocaleString('es-MX')} por ha`}
                min={11500}
                max={25000}
                step={250}
                value={financialParams.productionCostPerHaMxn}
                onChange={(v) =>
                  onUpdateFinancialParams({
                    ...financialParams,
                    productionCostPerHaMxn: v,
                  })
                }
                marks={[
                  { value: 11500, label: '$11.5k' },
                  { value: 16800, label: '$16.8k FIRA' },
                  { value: 25000, label: '$25k' },
                ]}
              />

              {/* Slider 3: Clima */}
              <Slider
                label="Escenario climático"
                valueLabel={
                  financialParams.climateShockPct > 0
                    ? `+${financialParams.climateShockPct} %`
                    : financialParams.climateShockPct < 0
                    ? `−${Math.abs(financialParams.climateShockPct)} %`
                    : '0 %'
                }
                min={-30}
                max={25}
                step={5}
                value={financialParams.climateShockPct}
                onChange={(v) =>
                  onUpdateFinancialParams({
                    ...financialParams,
                    climateShockPct: v,
                  })
                }
                marks={[
                  { value: -30, label: '−30 % sequía' },
                  { value: 0, label: '0' },
                  { value: 25, label: '+25 %' },
                ]}
              />

              {/* Slider 4: Garantía FEGA */}
              <Slider
                label="Garantía FEGA"
                valueLabel={`${financialParams.firaGuaranteeCoveragePct} % de cobertura`}
                min={40}
                max={85}
                step={5}
                value={financialParams.firaGuaranteeCoveragePct}
                onChange={(v) =>
                  onUpdateFinancialParams({
                    ...financialParams,
                    firaGuaranteeCoveragePct: v,
                  })
                }
                marks={[
                  { value: 40, label: '40 %' },
                  { value: 70, label: '70 %' },
                  { value: 85, label: '85 %' },
                ]}
              />

              <div className="text-body-s text-m3-on-surface-variant pt-1">
                Tasa de avío {financialParams.annualInterestRatePct} % anual
              </div>
            </div>
          </div>

          {/* KPI grid 2x2 */}
          <div className="grid grid-cols-2 gap-2.5">
            <Card variant="tonal-primary">
              <Metric
                label="Ingreso bruto"
                value={`$${(regionalSimulation.totalGrossIncome / 1_000_000).toFixed(2)} M`}
                supporting={`${regionalSimulation.totalTons.toLocaleString('es-MX')} t`}
              />
            </Card>
            <Card variant="outlined">
              <Metric
                label="Utilidad neta"
                value={`$${(regionalSimulation.totalNetProfit / 1_000_000).toFixed(2)} M`}
                tone={regionalSimulation.totalNetProfit >= 0 ? 'default' : 'error'}
                supporting={`Costo $${(regionalSimulation.totalCost / 1_000_000).toFixed(2)} M`}
              />
            </Card>
            <Card variant="outlined">
              <Metric
                label="Parcelas elegibles a crédito"
                value={`${regionalSimulation.creditEligibleCount} de ${regionalSimulation.parcelCount}`}
                supporting={`${regionalSimulation.creditEligiblePct} % con cobertura de deuda ≥ 1.25`}
              />
            </Card>
            <Card variant="outlined">
              <Metric
                label="Garantía FEGA"
                value={`$${(regionalSimulation.totalFiraGuarantee / 1_000_000).toFixed(2)} M`}
                tone="tertiary"
                supporting={`Cobertura ${financialParams.firaGuaranteeCoveragePct} %`}
              />
            </Card>
          </div>

          {/* Por estado */}
          <Card variant="outlined">
            <CardHeader
              title={
                <span
                  className="inline-flex items-center gap-1.5 cursor-help"
                  title="Distribución de superficie, rendimiento e ingresos por estado"
                >
                  <span>Por estado</span>
                  <Info
                    className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                    aria-label="Distribución por estado"
                  />
                </span>
              }
            />
            <div className="divide-y divide-m3-outline-variant/30 -mx-4 -mb-4">
              {(['Hidalgo', 'Tlaxcala', 'Puebla'] as const).map((stName) => {
                const row = regionalSimulation.byState[stName];
                if (!row || row.count === 0) return null;
                const sharePct =
                  regionalSimulation.totalGrossIncome > 0
                    ? Math.round((row.grossMxn / regionalSimulation.totalGrossIncome) * 100)
                    : 0;

                return (
                  <div
                    key={stName}
                    className="p-4 space-y-1.5 hover:bg-m3-surface-container-low transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-title-s font-medium text-m3-on-surface">
                          {stName}
                        </div>
                        <div className="text-body-s text-m3-on-surface-variant">
                          {row.count} parcelas, {row.ha} ha, {row.avgYield.toFixed(2)} t/ha
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-body-m font-normal text-m3-on-surface tabular-nums">
                          ${row.grossMxn.toLocaleString('es-MX')}
                        </div>
                        <div
                          className={cn(
                            'text-title-s font-medium tabular-nums',
                            row.netMxn >= 0 ? 'text-m3-primary' : 'text-m3-error'
                          )}
                        >
                          ${row.netMxn.toLocaleString('es-MX')}
                        </div>
                      </div>
                    </div>
                    {/* Share bar */}
                    <div
                      className="h-1.5 w-full rounded-full bg-m3-surface-container overflow-hidden"
                      title={`${sharePct} % del ingreso total`}
                    >
                      <div
                        className="h-full rounded-full bg-m3-primary transition-all duration-300"
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Selected parcel audit */}
          <Card variant="outlined">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-m3-outline-variant/30">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-body-s font-medium px-2 py-0.5 rounded-m3-xs bg-m3-surface-container-high text-m3-on-surface shrink-0">
                  {selectedParcel.id}
                </span>
                <span className="text-title-s font-medium text-m3-on-surface truncate">
                  {selectedParcel.name}
                </span>
              </div>
              {selectedParcel.split === 'eval' ? (
                <Tag tone="tertiary">Evaluación 30%</Tag>
              ) : (
                <Tag tone="primary">
                  {`Entrenamiento 70%, real ${selectedParcel.actualYieldTonHa ?? 'N/D'} t/ha`}
                </Tag>
              )}
            </div>

            <div className="divide-y divide-m3-outline-variant/20 text-body-m">
              <div className="flex items-center justify-between py-2">
                <span className="text-m3-on-surface-variant">Rendimiento ajustado</span>
                <span className="text-title-s font-medium text-m3-on-surface tabular-nums">
                  {regionalSimulation.selectedParcelFin.adjustedYieldTonHa} t/ha (
                  {regionalSimulation.selectedParcelFin.totalProductionTons} t)
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-m3-on-surface-variant">Ingreso bruto</span>
                <span className="text-title-s font-medium text-m3-on-surface tabular-nums">
                  ${regionalSimulation.selectedParcelFin.grossIncomeMxn.toLocaleString('es-MX')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-m3-on-surface-variant">Costo avío y financiero</span>
                <span className="text-title-s font-medium text-m3-on-surface tabular-nums">
                  ${regionalSimulation.selectedParcelFin.totalCostMxn.toLocaleString('es-MX')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-m3-on-surface-variant">Utilidad neta</span>
                <span
                  className={cn(
                    'text-title-s font-medium tabular-nums',
                    regionalSimulation.selectedParcelFin.netProfitMxn >= 0
                      ? 'text-m3-primary'
                      : 'text-m3-error'
                  )}
                >
                  ${regionalSimulation.selectedParcelFin.netProfitMxn.toLocaleString('es-MX')} (
                  {regionalSimulation.selectedParcelFin.roiPct} % ROI)
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-m3-on-surface-variant">Cobertura de deuda (DSCR)</span>
                <span className="text-title-s font-medium text-m3-on-surface tabular-nums">
                  {regionalSimulation.selectedParcelFin.debtServiceCoverageRatio}x
                </span>
              </div>
            </div>

            {/* SHAP Diverging Bar Chart */}
            <div className="mt-4 pt-3 border-t border-m3-outline-variant/30">
              <div
                className="inline-flex items-center gap-1.5 text-title-s font-medium text-m3-on-surface mb-2 cursor-help"
                title={`Base del modelo 3.95 t/ha, predicción ${selectedParcel.predictedYieldTonHa} t/ha`}
              >
                <span>Por qué esta predicción</span>
                <Info
                  className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                  aria-label="Explicabilidad SHAP"
                />
              </div>
              <div className="space-y-3">
                {(() => {
                  const maxImpact = Math.max(
                    ...selectedParcel.shapContributions.map((c) => Math.abs(c.impactTonHa)),
                    0.1
                  );
                  return selectedParcel.shapContributions.map((item) => {
                    const isPositive = item.impactTonHa >= 0;
                    const widthPct = Math.min(
                      100,
                      Math.round((Math.abs(item.impactTonHa) / maxImpact) * 100)
                    );

                    return (
                      <div key={item.feature} className="space-y-1">
                        <div className="flex items-center justify-between text-body-s">
                          <span className="text-m3-on-surface-variant truncate">
                            {item.feature} ({item.valueLabel})
                          </span>
                          <span
                            className={cn(
                              'text-label-l font-medium tabular-nums shrink-0 ml-2',
                              isPositive ? 'text-m3-primary' : 'text-m3-error'
                            )}
                          >
                            {isPositive ? `+${item.impactTonHa}` : `−${Math.abs(item.impactTonHa)}`} t/ha
                          </span>
                        </div>
                        {/* Diverging bar */}
                        <div className="relative h-2 w-full bg-m3-surface-container rounded-full overflow-hidden flex items-center">
                          <div className="w-1/2 h-full flex justify-end">
                            {!isPositive && (
                              <div
                                className="h-full bg-m3-error rounded-l-full transition-all duration-300"
                                style={{ width: `${widthPct}%` }}
                              />
                            )}
                          </div>
                          <div className="w-[1px] h-full bg-m3-outline shrink-0 z-10" />
                          <div className="w-1/2 h-full flex justify-start">
                            {isPositive && (
                              <div
                                className="h-full bg-m3-primary rounded-r-full transition-all duration-300"
                                style={{ width: `${widthPct}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <p className="text-body-s text-m3-on-surface-variant mt-3">
                Base del modelo 3.95 t/ha, predicción {selectedParcel.predictedYieldTonHa} t/ha
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: MODELO */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Desempeño en validación cruzada */}
          <Card variant="outlined" className="space-y-3">
            <CardHeader
              title={
                <span
                  className="inline-flex items-center gap-1.5 cursor-help"
                  title="138 parcelas con rendimiento conocido, 5 particiones espaciales"
                >
                  <span>Desempeño en validación cruzada</span>
                  <Info
                    className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                    aria-label="138 parcelas con rendimiento conocido, 5 particiones espaciales"
                  />
                </span>
              }
            />
            <div className="space-y-2">
              {modelInsights.metrics.map((m) => {
                const minRmse = Math.min(...modelInsights.metrics.map((x) => x.rmse));
                const isBestRmse = m.rmse === minRmse;

                return (
                  <div
                    key={m.modelName}
                    className={cn(
                      'rounded-m3-sm p-3 transition-colors',
                      m.isSelected
                        ? 'bg-m3-secondary-container'
                        : 'bg-m3-surface-container-low hover:bg-m3-surface-container'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-title-s font-medium text-m3-on-surface">
                        {m.modelName}
                      </span>
                      {m.isSelected && <Tag tone="primary">Modelo activo</Tag>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Metric
                        size="sm"
                        label="RMSE"
                        value={`${m.rmse.toFixed(3)} t/ha`}
                        tone={isBestRmse ? 'primary' : 'default'}
                      />
                      <Metric
                        size="sm"
                        label="MAE"
                        value={`${m.mae.toFixed(3)} t/ha`}
                      />
                      <Metric
                        size="sm"
                        label="R²"
                        value={m.r2.toFixed(3)}
                        tone={m.isSelected ? 'primary' : 'default'}
                      />
                      <Metric
                        size="sm"
                        label="MAPE"
                        value={`${m.mapePct} %`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Pregunta Guía 1 */}
          <Card variant="outlined" className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag tone="tertiary">Pregunta 1</Tag>
              <h3
                className="text-title-m font-medium text-m3-on-surface inline-flex items-center gap-1.5 cursor-help"
                title="Importancia relativa calculada mediante valores SHAP sobre validación espacial"
              >
                <span>¿Qué índice de vegetación es más importante en la predicción?</span>
                <Info
                  className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                  aria-label="Información de índices de vegetación"
                />
              </h3>
            </div>
            <div className="space-y-2 mt-3">
              {(() => {
                const maxPct = Math.max(
                  ...modelInsights.guideQuestion1_VegetationIndices.map((i) => i.shapImportancePct),
                  1
                );
                return modelInsights.guideQuestion1_VegetationIndices.map((idxItem) => {
                  const widthPct = Math.round((idxItem.shapImportancePct / maxPct) * 100);

                  return (
                    <div
                      key={idxItem.indexName}
                      className="bg-m3-surface-container rounded-m3-md p-3 space-y-1.5 cursor-help"
                      title={idxItem.interpretation}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-title-s font-medium text-m3-on-surface">
                            {idxItem.indexName}
                          </span>
                          <span className="text-body-s text-m3-on-surface-variant font-sans">
                            [{idxItem.formula}]
                          </span>
                          <Info
                            className="w-3 h-3 text-m3-on-surface-variant/60 shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-body-s tabular-nums">
                          <span className="text-m3-on-surface-variant">r = {idxItem.pearsonR}</span>
                          <span className="text-title-s font-medium text-m3-primary">
                            {idxItem.shapImportancePct} %
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-m3-surface-container-high rounded-full overflow-hidden">
                        <div
                          className="h-full bg-m3-primary rounded-full transition-all duration-300"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>

          {/* Pregunta Guía 2 */}
          <Card variant="outlined" className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag tone="tertiary">Pregunta 2</Tag>
              <h3
                className="text-title-m font-medium text-m3-on-surface inline-flex items-center gap-1.5 cursor-help"
                title="Impacto SHAP de las variables meteorológicas críticas"
              >
                <span>¿Qué variable climática tiene mayor peso?</span>
                <Info
                  className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                  aria-label="Información de variables climáticas"
                />
              </h3>
            </div>
            <div className="space-y-2 mt-3">
              {modelInsights.guideQuestion2_ClimateVariables.map((clim) => (
                <div
                  key={clim.variableName}
                  className="bg-m3-surface-container rounded-m3-md p-3 space-y-1.5 cursor-help"
                  title={clim.impactDescription}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-title-s font-medium text-m3-on-surface">
                        {clim.variableName}
                      </span>
                      <Info
                        className="w-3 h-3 text-m3-on-surface-variant/60 shrink-0"
                        aria-hidden="true"
                      />
                    </div>
                    <Tag tone="tertiary">{clim.shapImportancePct} %</Tag>
                  </div>
                  <div className="text-body-s font-medium text-m3-primary bg-m3-surface-container-high rounded-m3-xs px-2.5 py-0.5 inline-block">
                    Rango óptimo: {clim.optimalRange}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Pregunta Guía 3 */}
          <Card variant="outlined" className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag tone="tertiary">Pregunta 3</Tag>
              <h3
                className="text-title-m font-medium text-m3-on-surface inline-flex items-center gap-1.5 cursor-help"
                title="Estudio de ablación comparando combinaciones de índices y clima"
              >
                <span>¿Qué combinación de variables funciona mejor?</span>
                <Info
                  className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                  aria-label="Información de combinaciones de variables"
                />
              </h3>
            </div>
            <div className="space-y-2 mt-3">
              {modelInsights.guideQuestion3_FeatureCombinations.map((combo) => {
                if (combo.isWinner) {
                  return (
                    <Card
                      key={combo.combinationName}
                      variant="tonal-primary"
                      className="space-y-1.5 cursor-help"
                      title={`Variables: ${combo.featuresIncluded}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-title-s font-medium flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-m3-primary shrink-0" aria-hidden="true" />
                          <span>{combo.combinationName}</span>
                          <Info
                            className="w-3 h-3 text-m3-primary/70 shrink-0"
                            aria-hidden="true"
                          />
                        </span>
                        <Tag tone="primary">−{combo.gainVsBaselinePct} % de error vs. base</Tag>
                      </div>
                      <div className="flex items-center gap-4 text-body-s tabular-nums">
                        <span>
                          RMSE: <strong className="font-medium">{combo.rmse}</strong>
                        </span>
                        <span>
                          R²: <strong className="font-medium">{combo.r2}</strong>
                        </span>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card
                    key={combo.combinationName}
                    variant="outlined"
                    className="space-y-1.5 cursor-help"
                    title={`Variables: ${combo.featuresIncluded}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-title-s font-medium text-m3-on-surface flex items-center gap-1.5">
                        <span>{combo.combinationName}</span>
                        <Info
                          className="w-3 h-3 text-m3-on-surface-variant/60 shrink-0"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-body-s font-medium text-m3-on-surface-variant tabular-nums">
                        −{combo.gainVsBaselinePct} % error
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-body-s tabular-nums text-m3-on-surface-variant">
                      <span>
                        RMSE: <strong className="font-medium text-m3-on-surface">{combo.rmse}</strong>
                      </span>
                      <span>
                        R²: <strong className="font-medium text-m3-on-surface">{combo.r2}</strong>
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: PREDICCIÓN */}
      {activeTab === 'live-model' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex items-center gap-1.5 cursor-help"
              title="Calcula el rendimiento y riesgo crediticio con nuevos valores a partir de datos de satélite y clima."
            >
              <h3 className="text-title-m font-medium text-m3-on-surface">Probar el modelo</h3>
              <Info
                className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                aria-label="Información de predicción interactiva"
              />
            </div>
            <Button
              variant="outlined"
              size="sm"
              onClick={handleLoadSelectedIntoLive}
            >
              Usar valores de {selectedParcel.id}
            </Button>
          </div>

          <Card variant="outlined" className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-body-s text-m3-on-surface-variant mb-1.5 block">
                  Estado
                </label>
                <SegmentedButton<StateName>
                  options={[
                    { value: 'Hidalgo', label: 'Hidalgo' },
                    { value: 'Tlaxcala', label: 'Tlaxcala' },
                    { value: 'Puebla', label: 'Puebla' },
                  ]}
                  value={liveInput.state}
                  onChange={(v) => setLiveInput({ ...liveInput, state: v })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-body-s text-m3-on-surface-variant mb-1.5 block">
                  Régimen hídrico
                </label>
                <SegmentedButton<'Temporal' | 'Riego Auxiliar'>
                  options={[
                    { value: 'Temporal', label: 'Temporal' },
                    { value: 'Riego Auxiliar', label: 'Riego' },
                  ]}
                  value={liveInput.regime}
                  onChange={(v) => setLiveInput({ ...liveInput, regime: v })}
                  className="w-full"
                />
              </div>

              <div>
                <label
                  htmlFor="altitude-input"
                  className="text-body-s text-m3-on-surface-variant mb-1.5 block"
                >
                  Altitud
                </label>
                <div className="relative flex items-center">
                  <input
                    id="altitude-input"
                    type="number"
                    min={2100}
                    max={3000}
                    value={liveInput.altitudeM}
                    onChange={(e) =>
                      setLiveInput({ ...liveInput, altitudeM: Number(e.target.value) })
                    }
                    className="h-12 w-full rounded-m3-xs border border-m3-outline bg-transparent px-3 pr-16 text-body-m font-sans tabular-nums text-m3-on-surface outline-none transition-colors focus:border-2 focus:border-m3-primary"
                  />
                  <span className="absolute right-3 text-body-s text-m3-on-surface-variant pointer-events-none">
                    msnm
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-m3-outline-variant/30">
              <Slider
                label="NDVI espigado"
                valueLabel={liveInput.ndviEspigado.toFixed(2)}
                min={0.3}
                max={0.9}
                step={0.01}
                value={liveInput.ndviEspigado}
                onChange={(v) => setLiveInput({ ...liveInput, ndviEspigado: v })}
                marks={[
                  { value: 0.3, label: '0.30' },
                  { value: 0.9, label: '0.90' },
                ]}
              />

              <Slider
                label="NDWI llenado"
                valueLabel={liveInput.ndwiLlenado.toFixed(2)}
                min={-0.1}
                max={0.6}
                step={0.01}
                value={liveInput.ndwiLlenado}
                onChange={(v) => setLiveInput({ ...liveInput, ndwiLlenado: v })}
                marks={[
                  { value: -0.1, label: '−0.10' },
                  { value: 0.6, label: '0.60' },
                ]}
              />

              <Slider
                label="EVI encañado"
                valueLabel={liveInput.eviEncanado.toFixed(2)}
                min={0.25}
                max={0.85}
                step={0.01}
                value={liveInput.eviEncanado}
                onChange={(v) => setLiveInput({ ...liveInput, eviEncanado: v })}
                marks={[
                  { value: 0.25, label: '0.25' },
                  { value: 0.85, label: '0.85' },
                ]}
              />

              <Slider
                tone="tertiary"
                label="Lluvia jul–ago"
                valueLabel={`${liveInput.precipJulAgoMm} mm`}
                min={80}
                max={420}
                step={5}
                value={liveInput.precipJulAgoMm}
                onChange={(v) => setLiveInput({ ...liveInput, precipJulAgoMm: v })}
                marks={[
                  { value: 80, label: '80 mm' },
                  { value: 420, label: '420 mm' },
                ]}
              />

              <Slider
                tone="tertiary"
                label="Temp. mínima sep"
                valueLabel={`${liveInput.tempMinSepC} °C`}
                min={-1}
                max={14}
                step={0.5}
                value={liveInput.tempMinSepC}
                onChange={(v) => setLiveInput({ ...liveInput, tempMinSepC: v })}
                marks={[
                  { value: -1, label: '−1 °C' },
                  { value: 14, label: '14 °C' },
                ]}
              />
            </div>

            <Button
              variant="filled"
              className="w-full"
              icon={<Play />}
              disabled={isPredicting}
              onClick={handleExecuteLivePrediction}
            >
              {isPredicting ? 'Calculando…' : 'Calcular predicción'}
            </Button>
          </Card>

          {liveResult && (
            <div aria-live="polite">
              <Card variant="tonal-primary" className="space-y-4">
                <Metric
                  size="lg"
                  label="Rendimiento estimado"
                  value={`${liveResult.predictedYieldTonHa.toFixed(2)} t/ha`}
                  supporting={`Intervalo 95 %: ${liveResult.confidenceInterval[0]}–${liveResult.confidenceInterval[1]} t/ha`}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-m3-on-primary-container/15">
                  <div className="flex flex-col">
                    <span className="text-body-m text-m3-on-primary-container/80 select-none">
                      Puntaje de crédito FIRA
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-title-l font-medium tabular-nums">
                        {liveResult.firaCreditScore}/100
                      </span>
                      <Tag
                        tone={
                          liveResult.riskLevel === 'Bajo'
                            ? 'primary'
                            : liveResult.riskLevel === 'Moderado'
                            ? 'tertiary'
                            : 'error'
                        }
                      >
                        {liveResult.riskLevel}
                      </Tag>
                    </div>
                  </div>

                  <Metric
                    label="Ingreso bruto por ha"
                    value={`$${Math.round(
                      liveResult.predictedYieldTonHa * financialParams.barleyPricePerTonMxn
                    ).toLocaleString('es-MX')}`}
                  />
                </div>

                <div className="text-body-s text-m3-on-primary-container/75 pt-1">
                  Calculado con:{' '}
                  {liveResult.source === 'backend' ? 'API del backend' : 'modelo local'}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PARCELAS */}
      {activeTab === 'dataset-table' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex items-center gap-1.5 cursor-help"
              title="138 parcelas de entrenamiento con rendimiento real y 59 de evaluación oficial para FIRA."
            >
              <h3 className="text-title-m font-medium text-m3-on-surface">Parcelas del reto</h3>
              <Info
                className="w-3.5 h-3.5 text-m3-on-surface-variant/70 shrink-0"
                aria-label="138 de entrenamiento con rendimiento real y 59 de evaluación oficial para FIRA"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="filled"
                size="sm"
                icon={<Download />}
                onClick={() => exportPredictionsCsv(parcels, true)}
              >
                Descargar CSV
              </Button>
              <Button
                variant="outlined"
                size="sm"
                icon={<FileSpreadsheet />}
                onClick={() => exportPredictionsCsv(parcels, false)}
              >
                Exportar todo
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <FilterChip
              label="Todas"
              count={parcels.length}
              selected={tableSplitFilter === 'all'}
              onClick={() => setTableSplitFilter('all')}
            />
            <FilterChip
              label="Evaluación 30%"
              count={parcels.filter((p) => p.split === 'eval').length}
              selected={tableSplitFilter === 'eval'}
              onClick={() => setTableSplitFilter('eval')}
            />
            <FilterChip
              label="Entrenamiento 70%"
              count={parcels.filter((p) => p.split === 'train').length}
              selected={tableSplitFilter === 'train'}
              onClick={() => setTableSplitFilter('train')}
            />
          </div>

          <div className="max-h-[420px] overflow-auto rounded-m3-md border border-m3-outline-variant relative">
            <table className="w-full text-left border-collapse text-body-m">
              <thead className="sticky top-0 bg-m3-surface-container z-20 text-body-s font-medium text-m3-on-surface-variant">
                <tr>
                  <th className="py-2.5 px-3 sticky left-0 bg-m3-surface-container z-30 border-r border-m3-outline-variant whitespace-nowrap">
                    ID
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Estado</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Conjunto</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">NDVI pico</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Real</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Predicho</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant/30">
                {filteredTableParcels.map((p) => {
                  const fin = calculateParcelFinancials(p, financialParams);
                  const isSel = p.id === selectedParcel.id;

                  return (
                    <tr
                      key={p.id}
                      role="row"
                      aria-selected={isSel}
                      tabIndex={0}
                      onClick={() => onSelectParcel(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectParcel(p);
                        }
                      }}
                      className={cn(
                        'h-11 transition-colors cursor-pointer select-none group focus:outline-none focus-visible:bg-m3-secondary-container/50',
                        isSel
                          ? 'bg-m3-secondary-container text-m3-on-secondary-container font-medium'
                          : 'hover:bg-m3-surface-container'
                      )}
                    >
                      <td
                        className={cn(
                          'py-2 px-3 font-mono sticky left-0 z-10 transition-colors border-r border-m3-outline-variant whitespace-nowrap',
                          isSel
                            ? 'bg-m3-secondary-container text-m3-on-secondary-container font-semibold'
                            : 'bg-m3-surface-container-lowest group-hover:bg-m3-surface-container text-m3-on-surface font-medium'
                        )}
                      >
                        {p.id}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {p.state}, {p.municipality.split(' ')[0]}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {p.split === 'eval' ? (
                          <Tag tone="tertiary">Evaluación 30%</Tag>
                        ) : (
                          <Tag tone="primary">Entrenamiento 70%</Tag>
                        )}
                      </td>
                      <td className="py-2 px-3 tabular-nums whitespace-nowrap">
                        {(p.evaluations[3]?.ndvi ?? 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 tabular-nums whitespace-nowrap">
                        {p.actualYieldTonHa !== null ? (
                          `${p.actualYieldTonHa.toFixed(2)} t/ha`
                        ) : (
                          <Tag tone="tertiary">Por estimar</Tag>
                        )}
                      </td>
                      <td className="py-2 px-3 tabular-nums whitespace-nowrap text-m3-primary font-medium">
                        {fin.adjustedYieldTonHa.toFixed(2)} t/ha
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                        ${fin.grossIncomeMxn.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
