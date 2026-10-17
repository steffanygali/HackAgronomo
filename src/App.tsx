import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Search,
  Server,
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
  exportPredictionsCsv,
  fetchBarleyParcels,
  fetchModelInsights,
} from './services/api';
import { INITIAL_MODEL_INSIGHTS } from './data/mockBarleyDataset';
import { MapColorMode, ParcelMap } from './components/ParcelMap';
import { EvaluationTimeline } from './components/EvaluationTimeline';
import { FarmerView } from './components/FarmerView';
import { AnalystView } from './components/AnalystView';
import { BackendConnectModal } from './components/BackendConnectModal';
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
  const [selectedParcelId, setSelectedParcelId] = useState<string>('P-HGO-001');
  const [selectedSubDivisionId, setSelectedSubDivisionId] = useState<string | null>(null);
  const [evalIndex, setEvalIndex] = useState<number>(3); // Por defecto en Espigado y Floración (Ago 09)
  const [mapColorMode, setMapColorMode] = useState<MapColorMode>('yield');

  // Parámetros compartidos del simulador financiero
  const [financialParams, setFinancialParams] = useState<FinancialSimulationParams>({
    barleyPricePerTonMxn: 7650,
    productionCostPerHaMxn: 16800,
    climateShockPct: 0,
    firaGuaranteeCoveragePct: 70,
    annualInterestRatePct: 11.5,
  });

  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
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

  const handleUploadCustomJson = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed) ? parsed : parsed.parcels;
      if (Array.isArray(list) && list.length > 0) {
        setAllParcels(list);
        setSelectedParcelId(list[0].id);
      }
    } catch (err) {
      console.error('Error al parsear JSON:', err);
    }
  };

  if (!selectedParcel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-m3-surface text-m3-on-surface gap-4 px-6 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-m3-primary-container border-t-m3-primary animate-spin" />
        <div>
          <p className="text-title-m text-m3-on-surface">Estamos preparando tu parcela…</p>
          <p className="text-body-m text-m3-on-surface-variant mt-1">
            Un momento, estamos reuniendo los datos del satélite.
          </p>
        </div>
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

          {/* Lado derecho: Buscador + SegmentedButton + Conexión Backend */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Buscador Desktop (lg+) */}
            <div className="hidden lg:flex relative items-center h-12 w-52 xl:w-64 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-md px-3 text-m3-on-surface shrink-0">
              <Search className="w-4 h-4 text-m3-on-surface-variant shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ID, ejido..."
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

            {/* Botón de búsqueda colapsado para móvil/tablet (< lg) */}
            <div className="lg:hidden">
              <IconButton
                variant="standard"
                icon={<Search className="w-5 h-5" />}
                aria-label="Buscar parcela"
                onClick={() => setShowMobileSearch(!showMobileSearch)}
              />
            </div>

            {/* Conmutador de modo: Agricultor / Analista (oculto en móvil, ver barra dedicada) */}
            <SegmentedButton
              options={[
                {
                  value: 'farmer',
                  label: 'Agricultor',
                  icon: <Sprout className="w-4 h-4" />,
                },
                {
                  value: 'analyst',
                  label: 'Analista',
                  icon: <BarChart3 className="w-4 h-4" />,
                },
              ]}
              value={viewMode}
              onChange={setViewMode}
              size="md"
              ariaLabel="Modo de vista"
              className="hidden lg:inline-flex shrink-0 [&_button]:px-4"
            />

            {/* Botón de conexión backend con punto de estado de 8px */}
            <div className="relative shrink-0">
              <IconButton
                variant="standard"
                icon={<Server className="w-5 h-5" />}
                aria-label="Conexión con backend"
                onClick={() => setIsBackendModalOpen(true)}
              />
              <span
                className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 rounded-full pointer-events-none ring-2 ring-m3-surface-container ${
                  dataSource === 'backend' ? 'bg-m3-primary' : 'bg-m3-outline'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Campo de búsqueda móvil expandible */}
        {showMobileSearch && (
          <div className="lg:hidden px-3 sm:px-4 py-2 bg-m3-surface-container border-t border-m3-outline-variant/40 flex items-center gap-2">
            <div className="relative flex-1 flex items-center h-12 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-m3-md px-3 text-m3-on-surface">
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
        {/* Selector de modo para móvil y tablet (obvio y a ancho completo) */}
        <div className="lg:hidden mb-3">
          <p className="text-label-m text-m3-on-surface-variant mb-1.5 select-none">
            ¿Qué vista quieres ver?
          </p>
          <SegmentedButton
            options={[
              {
                value: 'farmer',
                label: 'Agricultor',
                icon: <Sprout className="w-4 h-4" />,
              },
              {
                value: 'analyst',
                label: 'Analista',
                icon: <BarChart3 className="w-4 h-4" />,
              },
            ]}
            value={viewMode}
            onChange={setViewMode}
            size="md"
            ariaLabel="Modo de vista"
            className="w-full"
          />
        </div>

        {/* FILA DE CONTEXTO (No sticky) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
          {/* Chips de filtro por Estado */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center py-1 min-w-0">
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
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 min-w-0 shrink-0">
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
                  className="w-11 h-11 sm:w-12 sm:h-12"
                />
                <select
                  value={selectedParcel.id}
                  onChange={(e) => {
                    const found = allParcels.find((p) => p.id === e.target.value);
                    if (found) handleSelectParcel(found);
                  }}
                  className="h-12 rounded-m3-sm border border-m3-outline bg-m3-surface-container-lowest px-2.5 sm:px-3 text-body-m text-m3-on-surface font-mono focus:outline-none focus:border-m3-primary flex-1 sm:flex-none max-w-[210px] sm:max-w-xs truncate"
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
                  className="w-11 h-11 sm:w-12 sm:h-12"
                />
              </div>

              {/* Descargar CSV */}
              <Button
                variant="tonal"
                size="md"
                icon={<Download className="w-4 h-4" />}
                onClick={() => exportPredictionsCsv(allParcels, true)}
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
          <section className="lg:sticky lg:top-[80px] lg:h-[calc(100vh-64px-16px)] flex flex-col gap-3 min-h-0">
            {/* Mapa de parcelas */}
            <div className="h-[50vh] min-h-[320px] lg:h-auto lg:flex-1 lg:min-h-0">
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

      {/* Modal de Conexión con Backend */}
      <BackendConnectModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        dataSource={dataSource}
        onReconnect={loadData}
        onUploadCustomJson={handleUploadCustomJson}
      />
    </div>
  );
}

export default App;
