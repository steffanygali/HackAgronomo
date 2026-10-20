import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Search,
  Sprout,
  Wheat,
  X,
} from 'lucide-react';
import {
  BarleyParcel,
  FinancialSimulationParams,
  ModelInsightsPayload,
  StateName,
} from './types/agro';
import {
  downloadOfficialAnexoCsv,
  exportPredictionsCsv,
  fetchBarleyParcels,
  fetchModelInsights,
} from './services/api';
import { INITIAL_MODEL_INSIGHTS } from './data/mockBarleyDataset';
import { MapColorMode, ParcelMap } from './components/ParcelMap';
import { EvaluationTimeline } from './components/EvaluationTimeline';
import { FarmerView } from './components/FarmerView';
import { AnalystView } from './components/AnalystView';
import { Button, FilterChip, IconButton, SegmentedButton } from './components/ui';

export function App() {
  const [allParcels, setAllParcels] = useState<BarleyParcel[]>([]);
  const [dataSource, setDataSource] = useState<'backend' | 'local-dataset'>('local-dataset');
  const [modelInsights, setModelInsights] = useState<ModelInsightsPayload>(INITIAL_MODEL_INSIGHTS);

  // Modo de usuario: 'farmer' (Agricultor) | 'analyst' (Analista / Evaluador del Hack FIRA)
  const [viewMode, setViewMode] = useState<'farmer' | 'analyst'>('farmer');

  // Filtros geográficos y de búsqueda
  const [stateFilter, setStateFilter] = useState<'ALL' | StateName>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Parcela activa, sub-lote activo e índice de fecha de evaluación satelital (0..5)
  const [selectedParcelId, setSelectedParcelId] = useState<string>('AGC_003');
  const [selectedSubDivisionId, setSelectedSubDivisionId] = useState<string | null>(null);
  const [evalIndex, setEvalIndex] = useState<number>(3); // Por defecto en Espigado y Floración (Ago 10)
  const [mapColorMode, setMapColorMode] = useState<MapColorMode>('yield');

  // Parámetros compartidos del simulador financiero
  const [financialParams, setFinancialParams] = useState<FinancialSimulationParams>({
    barleyPricePerTonMxn: 7650,
    productionCostPerHaMxn: 16800,
    climateShockPct: 0,
    firaGuaranteeCoveragePct: 70,
    annualInterestRatePct: 11.5,
  });

  const [isScrolled, setIsScrolled] = useState(false);

  const loadData = async () => {
    const [{ parcels, source }, insights] = await Promise.all([
      fetchBarleyParcels(),
      fetchModelInsights(),
    ]);
    setAllParcels(parcels);
    setDataSource(source);
    setModelInsights(insights);
    if (parcels.length > 0 && !parcels.some((p) => p.id === selectedParcelId)) {
      setSelectedParcelId(parcels[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Detectar scroll para aplicar sombra M3 en top app bar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 4);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filtrar parcelas por Estado y Búsqueda
  const filteredParcels = useMemo(() => {
    return allParcels.filter((p) => {
      const matchesState = stateFilter === 'ALL' || p.state === stateFilter;
      if (!matchesState) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.producerName.toLowerCase().includes(q) ||
        p.municipality.toLowerCase().includes(q)
      );
    });
  }, [allParcels, stateFilter, searchQuery]);

  // Si el usuario filtra por estado y la parcela activa no pertenece a ese estado, seleccionar la primera del filtro
  useEffect(() => {
    if (
      filteredParcels.length > 0 &&
      !filteredParcels.some((p) => p.id === selectedParcelId)
    ) {
      setSelectedParcelId(filteredParcels[0].id);
      setSelectedSubDivisionId(null);
    }
  }, [stateFilter, filteredParcels, selectedParcelId]);

  const selectedParcel = useMemo(() => {
    return (
      filteredParcels.find((p) => p.id === selectedParcelId) ||
      allParcels.find((p) => p.id === selectedParcelId) ||
      filteredParcels[0] ||
      allParcels[0]
    );
  }, [allParcels, filteredParcels, selectedParcelId]);

  const handleSelectParcel = (parcel: BarleyParcel) => {
    setSelectedParcelId(parcel.id);
    setSelectedSubDivisionId(parcel.subDivisions[0]?.id ?? null);
  };

  const handlePrevNextParcel = (dir: -1 | 1) => {
    if (filteredParcels.length === 0 || !selectedParcel) return;
    const idx = filteredParcels.findIndex((p) => p.id === selectedParcel.id);
    const nextIdx = (idx + dir + filteredParcels.length) % filteredParcels.length;
    handleSelectParcel(filteredParcels[nextIdx]);
  };

  if (!selectedParcel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-m3-surface text-m3-on-surface gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-m3-primary-container border-t-m3-primary animate-spin" />
        <div className="text-body-l text-m3-on-surface">Cargando parcelas…</div>
      </div>
    );
  }

  const stateCounts = {
    ALL: allParcels.length,
    Hidalgo: allParcels.filter((p) => p.state === 'Hidalgo').length,
    Tlaxcala: allParcels.filter((p) => p.state === 'Tlaxcala').length,
    Puebla: allParcels.filter((p) => p.state === 'Puebla').length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-m3-surface text-m3-on-surface overflow-x-hidden">
      {/* TOP APP BAR (64px sticky, bg-m3-surface-container, sin wrapping en 1280-1920) */}
      <header
        className={`sticky top-0 z-30 h-16 bg-m3-surface-container transition-shadow duration-200 ${
          isScrolled ? 'shadow-m3-2' : ''
        }`}
      >
        <div className="max-w-[1760px] mx-auto h-full px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3">
          {/* Logo + Título */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-m3-md bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center shrink-0">
              <Wheat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-title-m sm:text-title-l font-normal text-m3-on-surface leading-tight truncate">
                AgroCebada<span className="hidden sm:inline"> FIRA 2026</span>
              </h1>
            </div>
          </div>

          {/* Lado derecho: Buscador + SegmentedButton */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Buscador Desktop (md+) */}
            <div className="hidden md:flex relative items-center h-10 w-44 lg:w-60 xl:w-72 bg-m3-surface-container-highest rounded-full px-3 text-m3-on-surface shrink-0">
              <Search className="w-4 h-4 text-m3-on-surface-variant shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ID, municipio, productor..."
                className="bg-transparent border-none outline-none w-full text-body-m placeholder:text-m3-on-surface-variant/70 min-w-0"
              />
              {searchQuery && (
                <IconButton
                  variant="standard"
                  icon={<X className="w-3.5 h-3.5" />}
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSearchQuery('')}
                  className="w-6 h-6 shrink-0 -mr-1"
                />
              )}
            </div>

            {/* Botón de búsqueda colapsado para móvil (< md) */}
            <div className="md:hidden">
              <IconButton
                variant="standard"
                icon={<Search className="w-5 h-5" />}
                aria-label="Buscar parcela"
                onClick={() => setShowMobileSearch(!showMobileSearch)}
                className="w-9 h-9"
              />
            </div>

            {/* Conmutador de modo: Agricultor / Analista */}
            <SegmentedButton
              options={[
                {
                  value: 'farmer',
                  label: <span className="hidden sm:inline">Agricultor</span>,
                  icon: <Sprout className="w-4 h-4" />,
                },
                {
                  value: 'analyst',
                  label: <span className="hidden sm:inline">Analista</span>,
                  icon: <BarChart3 className="w-4 h-4" />,
                },
              ]}
              value={viewMode}
              onChange={setViewMode}
              size="md"
              ariaLabel="Modo de vista"
              className="shrink-0 min-w-0 sm:min-w-[280px] [&_button]:px-2 sm:[&_button]:px-4"
            />

          </div>
        </div>

        {/* Campo de búsqueda móvil expandible */}
        {showMobileSearch && (
          <div className="md:hidden px-3 sm:px-4 py-2 bg-m3-surface-container border-t border-m3-outline-variant/40 flex items-center gap-2">
            <div className="relative flex-1 flex items-center h-10 bg-m3-surface-container-highest rounded-full px-3 text-m3-on-surface">
              <Search className="w-4 h-4 text-m3-on-surface-variant shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ID, ejido..."
                autoFocus
                className="bg-transparent border-none outline-none w-full text-body-m placeholder:text-m3-on-surface-variant/70"
              />
              {searchQuery && (
                <IconButton
                  variant="standard"
                  icon={<X className="w-3.5 h-3.5" />}
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSearchQuery('')}
                  className="w-6 h-6 shrink-0 -mr-1"
                />
              )}
            </div>
            <IconButton
              variant="standard"
              icon={<X className="w-5 h-5" />}
              aria-label="Cerrar búsqueda"
              onClick={() => setShowMobileSearch(false)}
            />
          </div>
        )}
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-[1760px] w-full mx-auto p-3 sm:p-4 flex flex-col">
        {/* FILA DE CONTEXTO (No sticky) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
          {/* Chips de filtro por Estado */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center py-1 shrink-0">
            {(['ALL', 'Hidalgo', 'Tlaxcala', 'Puebla'] as const).map((st) => (
              <FilterChip
                key={st}
                label={st === 'ALL' ? 'Todos' : st}
                selected={stateFilter === st}
                onClick={() => setStateFilter(st)}
                count={stateCounts[st]}
              />
            ))}
          </div>

          {/* Selector de parcelas / Feedback vacío / Descargar CSV */}
          {filteredParcels.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-body-m text-m3-on-surface-variant">
                Sin parcelas para “{searchQuery}”
              </span>
              <Button variant="text" size="sm" onClick={() => setSearchQuery('')}>
                Limpiar búsqueda
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3">
              <span className="text-body-s text-m3-on-surface-variant hidden xl:inline">
                Mostrando {filteredParcels.length} parcelas
              </span>

              {/* Selector de parcela anterior / select / siguiente */}
              <div className="flex items-center gap-1 flex-1 sm:flex-none justify-between sm:justify-start">
                <IconButton
                  variant="standard"
                  icon={<ChevronLeft className="w-4 h-4" />}
                  aria-label="Parcela anterior"
                  onClick={() => handlePrevNextParcel(-1)}
                  disabled={filteredParcels.length <= 1}
                  className="w-8 h-8 sm:w-9 sm:h-9"
                />
                <select
                  value={selectedParcel.id}
                  onChange={(e) => {
                    const found = allParcels.find((p) => p.id === e.target.value);
                    if (found) handleSelectParcel(found);
                  }}
                  className="h-10 rounded-m3-xs border border-m3-outline bg-transparent px-2.5 sm:px-3 text-body-m text-m3-on-surface font-mono focus:outline-none focus:border-m3-primary flex-1 sm:flex-none max-w-[210px] sm:max-w-xs truncate"
                >
                  {filteredParcels.map((p) => (
                    <option key={p.id} value={p.id} className="bg-m3-surface text-m3-on-surface">
                      {p.id} — {p.municipality.split(' ')[0]}, {p.state}
                    </option>
                  ))}
                </select>
                <IconButton
                  variant="standard"
                  icon={<ChevronRight className="w-4 h-4" />}
                  aria-label="Siguiente parcela"
                  onClick={() => handlePrevNextParcel(1)}
                  disabled={filteredParcels.length <= 1}
                  className="w-8 h-8 sm:w-9 sm:h-9"
                />
              </div>

              {/* Descargar CSV */}
              <Button
                variant="tonal"
                size="md"
                icon={<Download className="w-4 h-4" />}
                onClick={() =>
                  dataSource === 'backend'
                    ? downloadOfficialAnexoCsv()
                    : exportPredictionsCsv(allParcels, true)
                }
                className="shrink-0 text-label-m sm:text-label-l"
              >
                Descargar CSV
              </Button>
            </div>
          )}
        </div>

        {/* LAYOUT: GRID DE DOS COLUMNAS (MAPA + TIMELINE IZQUIERDA, SHEET DERECHA) */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_min(520px,40vw)] gap-4 flex-1">
          {/* Panel Izquierdo: Fijo en viewport en Desktop, scrollable en mobile */}
          <section className="lg:sticky lg:top-[80px] lg:h-[calc(100vh-96px)] flex flex-col gap-3 min-h-0">
            {/* Mapa de parcelas */}
            <div className="h-[58vh] min-h-[360px] lg:h-auto lg:flex-1 lg:min-h-0">
              <ParcelMap
                parcels={filteredParcels}
                selectedParcel={selectedParcel}
                selectedSubDivisionId={selectedSubDivisionId}
                evalIndex={evalIndex}
                colorMode={mapColorMode}
                onColorModeChange={setMapColorMode}
                onSelectParcel={handleSelectParcel}
                onSelectSubDivision={setSelectedSubDivisionId}
              />
            </div>

            {/* Línea de tiempo de evaluaciones */}
            <div className="shrink-0">
              <EvaluationTimeline
                evaluations={selectedParcel.evaluations}
                activeIndex={evalIndex}
                onChangeIndex={setEvalIndex}
              />
            </div>
          </section>

          {/* Panel Derecho: Side sheet con contenido contextual */}
          <section className="bg-m3-surface-container-low rounded-m3-xl p-4 md:p-5 flex flex-col gap-4">
            {/* Encabezado compacto del sheet */}
            <div className="pb-3 border-b border-m3-outline-variant/40">
              <div className="flex items-center gap-2">
                <h2 className="text-title-m font-medium text-m3-on-surface">
                  {viewMode === 'farmer' ? 'Mi parcela' : 'Consola de análisis'}
                </h2>
                <span
                  className="cursor-help text-m3-on-surface-variant hover:text-m3-primary transition-colors inline-flex items-center"
                  title={
                    viewMode === 'farmer'
                      ? 'Monitoreo de salud vegetal por sub-lote, rendimiento y crédito'
                      : 'Evaluación del ensamble, variables de impacto y simulación financiera'
                  }
                  aria-label={
                    viewMode === 'farmer'
                      ? 'Información sobre mi parcela'
                      : 'Información sobre la consola de análisis'
                  }
                >
                  <Info className="w-4 h-4" />
                </span>
              </div>
            </div>

            {/* Vista dinámica: Agricultor o Analista */}
            <div>
              {viewMode === 'farmer' ? (
                <FarmerView
                  parcel={selectedParcel}
                  allParcels={allParcels}
                  evalIndex={evalIndex}
                  selectedSubDivisionId={selectedSubDivisionId}
                  onSelectSubDivision={setSelectedSubDivisionId}
                  financialParams={financialParams}
                  onUpdateFinancialParams={setFinancialParams}
                />
              ) : (
                <AnalystView
                  parcels={filteredParcels}
                  selectedParcel={selectedParcel}
                  onSelectParcel={handleSelectParcel}
                  financialParams={financialParams}
                  onUpdateFinancialParams={setFinancialParams}
                  modelInsights={modelInsights}
                />
              )}
            </div>
          </section>
        </div>
      </main>

    </div>
  );
}

export default App;
