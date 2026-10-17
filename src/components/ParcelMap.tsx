import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  ChevronUp,
  Grid,
  Layers,
  LocateFixed,
  X,
} from 'lucide-react';
import { BarleyParcel, SubParcelDivision } from '../types/agro';
import { Button, FilterChip, IconButton, SegmentedButton } from './ui';

export type MapColorMode = 'yield' | 'ndvi' | 'ndwi' | 'split';

interface ParcelMapProps {
  parcels: BarleyParcel[];
  selectedParcel: BarleyParcel;
  selectedSubDivisionId: string | null;
  evalIndex: number;
  colorMode: MapColorMode;
  onColorModeChange: (mode: MapColorMode) => void;
  onSelectParcel: (parcel: BarleyParcel) => void;
  onSelectSubDivision: (subId: string | null) => void;
}

const REGION_PRESETS: { label: string; center: [number, number]; zoom: number }[] = [
  { label: 'Altiplano', center: [-98.32, 19.56], zoom: 8.35 },
  { label: 'Apan, Hgo.', center: [-98.47, 19.71], zoom: 11.4 },
  { label: 'Calpulalpan, Tlax.', center: [-98.54, 19.54], zoom: 11.4 },
  { label: 'Oriental, Pue.', center: [-97.62, 19.46], zoom: 11.2 },
];

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function colorExpression(mode: MapColorMode): any {
  if (mode === 'yield') {
    return [
      'interpolate',
      ['linear'],
      ['get', 'predictedYield'],
      2.2, '#A33A28',
      3.5, '#C98A2E',
      4.3, '#6E8B5A',
      5.2, '#3F5A34',
    ];
  }
  if (mode === 'ndvi') {
    return [
      'interpolate',
      ['linear'],
      ['get', 'ndvi'],
      0.2, '#A98A5B',
      0.45, '#CBB457',
      0.65, '#6E8B5A',
      0.85, '#3F5A34',
    ];
  }
  if (mode === 'ndwi') {
    return [
      'interpolate',
      ['linear'],
      ['get', 'ndwi'],
      -0.05, '#A33A28',
      0.15, '#C98A2E',
      0.35, '#5E8FA8',
      0.52, '#3E6A7A',
    ];
  }
  // mode === 'split'
  return [
    'case',
    ['==', ['get', 'split'], 'eval'],
    '#C98A2E',
    '#4F6144',
  ];
}

export const ParcelMap: React.FC<ParcelMapProps> = ({
  parcels,
  selectedParcel,
  selectedSubDivisionId,
  evalIndex,
  colorMode,
  onColorModeChange,
  onSelectParcel,
  onSelectSubDivision,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemapStyle, setBasemapStyle] = useState<'satellite' | 'topo'>('satellite');
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(true);
  const [isSubLotsPanelOpen, setIsSubLotsPanelOpen] = useState(false);

  // Auto-collapse on small screens (< 768px) on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsLayerPanelOpen(false);
    }
  }, []);

  // Construir GeoJSON para las parcelas según el índice temporal seleccionado
  const parcelsGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: parcels.map((p) => {
        const ev = p.evaluations[evalIndex] || p.evaluations[3] || p.evaluations[0];
        return {
          type: 'Feature' as const,
          id: p.parcelNumber,
          properties: {
            id: p.id,
            name: p.name,
            producerName: p.producerName,
            state: p.state,
            municipality: p.municipality,
            split: p.split,
            areaHa: p.areaHa,
            predictedYield: p.predictedYieldTonHa,
            actualYield: p.actualYieldTonHa ?? -1,
            ndvi: ev.ndvi,
            ndwi: ev.ndwi,
            precipMm: ev.precipMm,
            stage: ev.stage,
            date: ev.date,
            isSelected: p.id === selectedParcel.id ? 1 : 0,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [p.polygon],
          },
        };
      }),
    };
  }, [parcels, evalIndex, selectedParcel.id]);

  // Centroides de las parcelas para la capa de círculos Macro (MapLibre requiere geometría Point para circle layers)
  const parcelCentersGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: parcels.map((p) => {
        const ev = p.evaluations[evalIndex] || p.evaluations[3] || p.evaluations[0];
        return {
          type: 'Feature' as const,
          id: p.parcelNumber,
          properties: {
            id: p.id,
            name: p.name,
            producerName: p.producerName,
            state: p.state,
            municipality: p.municipality,
            split: p.split,
            areaHa: p.areaHa,
            predictedYield: p.predictedYieldTonHa,
            actualYield: p.actualYieldTonHa ?? -1,
            ndvi: ev.ndvi,
            ndwi: ev.ndwi,
            precipMm: ev.precipMm,
            stage: ev.stage,
            date: ev.date,
            isSelected: p.id === selectedParcel.id ? 1 : 0,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: p.center,
          },
        };
      }),
    };
  }, [parcels, evalIndex, selectedParcel.id]);

  // Construir GeoJSON de las divisiones internas (Sub-lotes A, B, C) de la parcela activa
  const subDivisionsGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: selectedParcel.subDivisions.map((sub: SubParcelDivision) => {
        const currentNdvi = sub.ndviByEval[evalIndex] ?? sub.ndviByEval[3] ?? sub.ndviByEval[0];
        const currentNdwi = sub.ndwiByEval[evalIndex] ?? sub.ndwiByEval[3] ?? sub.ndwiByEval[0];
        return {
          type: 'Feature' as const,
          properties: {
            id: sub.id,
            code: sub.code,
            name: sub.name,
            areaHa: sub.areaHa,
            soilType: sub.soilType,
            predictedYield: sub.predictedYieldTonHa,
            ndvi: currentNdvi,
            ndwi: currentNdwi,
            moistureStatus: sub.moistureStatus,
            isSelectedSub: sub.id === selectedSubDivisionId ? 1 : 0,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [sub.polygon],
          },
        };
      }),
    };
  }, [selectedParcel, evalIndex, selectedSubDivisionId]);

  // Centros de los sub-lotes para etiquetas en el mapa
  const subLabelsGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: selectedParcel.subDivisions.map((sub) => {
        const lngs = sub.polygon.map((c) => c[0]);
        const lats = sub.polygon.map((c) => c[1]);
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const currentNdvi = sub.ndviByEval[evalIndex] ?? sub.ndviByEval[3] ?? sub.ndviByEval[0];
        return {
          type: 'Feature' as const,
          properties: {
            id: sub.id,
            label: `${sub.code}: ${sub.predictedYieldTonHa} t/ha\nVerdor ${currentNdvi.toFixed(2)}`,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [centerLng, centerLat],
          },
        };
      }),
    };
  }, [selectedParcel, evalIndex]);

  // Refs para capturar siempre la versión más reciente en callbacks asíncronos
  const parcelsRef = useRef(parcelsGeoJson);
  parcelsRef.current = parcelsGeoJson;
  const parcelCentersRef = useRef(parcelCentersGeoJson);
  parcelCentersRef.current = parcelCentersGeoJson;
  const subDivisionsRef = useRef(subDivisionsGeoJson);
  subDivisionsRef.current = subDivisionsGeoJson;
  const subLabelsRef = useRef(subLabelsGeoJson);
  subLabelsRef.current = subLabelsGeoJson;
  const colorModeRef = useRef(colorMode);
  colorModeRef.current = colorMode;

  // CartoCDN API Key con query param ?key=... para eliminar watermark de basemaps
  const CARTO_API_KEY = import.meta.env.VITE_MAP_API_KEY || '';
  const cartoQuery = CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : '';

  // Inicializar MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '© Esri, Maxar, Earthstar Geographics — Sentinel-2 / FIRA Reto AgroCebada',
          },
          'carto-topo': {
            type: 'raster',
            tiles: [
              `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${cartoQuery}`,
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors © CARTO',
          },
          'carto-labels': {
            type: 'raster',
            tiles: [
              `https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png${cartoQuery}`,
            ],
            tileSize: 256,
          },
          'barley-parcels': {
            type: 'geojson',
            data: parcelsRef.current as any,
          },
          'barley-parcel-centers': {
            type: 'geojson',
            data: parcelCentersRef.current as any,
          },
          'parcel-subdivisions': {
            type: 'geojson',
            data: subDivisionsRef.current as any,
          },
          'parcel-sublabels': {
            type: 'geojson',
            data: subLabelsRef.current as any,
          },
        },
        layers: [
          {
            id: 'basemap-satellite',
            type: 'raster',
            source: 'esri-satellite',
            layout: { visibility: 'visible' },
            paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.08 },
          },
          {
            id: 'basemap-topo',
            type: 'raster',
            source: 'carto-topo',
            layout: { visibility: 'none' },
          },
          {
            id: 'basemap-labels',
            type: 'raster',
            source: 'carto-labels',
            layout: { visibility: 'visible' },
            paint: { 'raster-opacity': 0.85 },
          },
          // Relleno de polígonos de las 197 parcelas (renderizado instantáneo desde memoria)
          {
            id: 'parcels-fill',
            type: 'fill',
            source: 'barley-parcels',
            paint: {
              'fill-color': colorExpression(colorModeRef.current),
              'fill-opacity': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                0.18,
                0.74,
              ],
            },
          },
          // Borde de las 197 parcelas: selected #FFFFFF w3, eval #C98A2E w1.5, train rgba(255,255,255,0.55) w1
          {
            id: 'parcels-outline',
            type: 'line',
            source: 'barley-parcels',
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                '#FFFFFF',
                ['==', ['get', 'split'], 'eval'],
                '#C98A2E',
                'rgba(255,255,255,0.55)',
              ],
              'line-width': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                3,
                ['==', ['get', 'split'], 'eval'],
                1.5,
                1,
              ],
            },
          },
          // Capa de puntos para vista macro
          {
            id: 'parcels-MacroCircle',
            type: 'circle',
            source: 'barley-parcel-centers',
            maxzoom: 13.5,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, 4.5,
                10, 7.5,
                12, 10,
              ],
              'circle-color': colorExpression(colorModeRef.current),
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                3,
                1.5,
              ],
              'circle-opacity': 0.92,
            },
          },
          // Relleno de las subdivisiones internas (usa rampa NDVI de M3)
          {
            id: 'subdivisions-fill',
            type: 'fill',
            source: 'parcel-subdivisions',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'ndvi'],
                0.2, '#A98A5B',
                0.45, '#CBB457',
                0.65, '#6E8B5A',
                0.85, '#3F5A34',
              ],
              'fill-opacity': [
                'case',
                ['==', ['get', 'isSelectedSub'], 1],
                0.88,
                0.68,
              ],
            },
          },
          // Líneas divisorias internas de la parcela: seleccionada #F3DFB4 w3, normal blanca dashed w1.8
          {
            id: 'subdivisions-line',
            type: 'line',
            source: 'parcel-subdivisions',
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'isSelectedSub'], 1],
                '#F3DFB4',
                '#FFFFFF',
              ],
              'line-width': [
                'case',
                ['==', ['get', 'isSelectedSub'], 1],
                3,
                1.8,
              ],
              'line-dasharray': [2, 1.5],
            },
          },
          // Etiquetas de los sub-lotes internos con glifo Noto Sans Regular
          {
            id: 'subdivisions-label',
            type: 'symbol',
            source: 'parcel-sublabels',
            minzoom: 12.5,
            layout: {
              'text-field': ['get', 'label'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
              'text-anchor': 'center',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#FFFFFF',
              'text-halo-color': '#22201A',
              'text-halo-width': 1.8,
            },
          },
        ],
      },
      attributionControl: false,
      center: [-98.32, 19.56],
      zoom: 8.35,
      pitch: 28,
      bearing: -4,
      maxZoom: 17.5,
      minZoom: 6.5,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('error', (e) => console.warn('[map]', e.error?.message));

    // Popup flotante al pasar el cursor
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });
    popupRef.current = popup;

    const showParcelTooltip = (e: any) => {
      if (!e.features || e.features.length === 0) return;
      map.getCanvas().style.cursor = 'pointer';
      const props = e.features[0].properties;
      const splitPill =
        props.split === 'eval'
          ? `<span style="background:#F3DFB4;color:#3A2B04;border-radius:8px;padding:2px 8px;font-size:12px;font-weight:600;">Evaluación 30%</span>`
          : `<span style="background:#DCE4CF;color:#2E3A24;border-radius:8px;padding:2px 8px;font-size:12px;font-weight:600;">Entrenamiento 70%</span>`;

      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="min-width:210px;font-family:'Source Sans 3','Source Sans Pro',sans-serif;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-family:'Roboto Mono',monospace;font-size:12px;font-weight:500;color:#F2ECDF;">${escapeHtml(props.id)}</span>
              ${splitPill}
            </div>
            <div style="font-size:14px;font-weight:600;color:#F2ECDF;margin-bottom:2px;">${escapeHtml(props.name)}</div>
            <div style="font-size:12px;color:#F2ECDF;opacity:0.8;margin-bottom:8px;">${escapeHtml(props.municipality)}, ${escapeHtml(props.state)} — ${escapeHtml(props.areaHa)} ha</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid rgba(242,236,223,0.15);padding-top:8px;">
              <div>
                <div style="font-size:11px;color:#F2ECDF;opacity:0.7;">Predicción</div>
                <div style="font-size:16px;font-weight:600;color:#B7C6A3;font-variant-numeric:tabular-nums;">${Number(props.predictedYield).toFixed(2)} t/ha</div>
              </div>
              <div>
                <div style="font-size:11px;color:#F2ECDF;opacity:0.7;">Vegetación ${escapeHtml(props.date)}</div>
                <div style="font-size:16px;font-weight:600;color:#F2ECDF;font-variant-numeric:tabular-nums;">${Number(props.ndvi).toFixed(3)}</div>
              </div>
            </div>
          </div>`
        )
        .addTo(map);
    };

    map.on('mousemove', 'parcels-fill', showParcelTooltip);
    map.on('mousemove', 'parcels-MacroCircle', showParcelTooltip);

    map.on('mouseleave', 'parcels-fill', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });
    map.on('mouseleave', 'parcels-MacroCircle', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    // Activar mapLoaded en styledata y load para renderizado instantáneo
    let isReady = false;
    const markMapReady = () => {
      if (isReady) return;
      isReady = true;
      setMapLoaded(true);
      map.resize();
    };

    map.once('styledata', markMapReady);
    map.on('load', markMapReady);

    mapRef.current = map;

    // ResizeObserver para adaptar el mapa a cambios de tamaño del contenedor
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Manejadores de clic actualizados con las referencias actuales de parcels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const handleParcelClick = (e: any) => {
      // Guard: si el clic cayó sobre subdivisions-fill, ignorar
      const subFeatures = map.queryRenderedFeatures(e.point, { layers: ['subdivisions-fill'] });
      if (subFeatures && subFeatures.length > 0) {
        return;
      }

      if (!e.features || e.features.length === 0) return;
      const clickedId = e.features[0].properties?.id;
      const found = parcels.find((p) => p.id === clickedId);
      if (found) {
        onSelectParcel(found);
        onSelectSubDivision(null);
        map.flyTo({
          center: found.center,
          zoom: 14.7,
          pitch: 36,
          duration: 1100,
        });
      }
    };

    const handleSubClick = (e: any) => {
      if (!e.features || e.features.length === 0) return;
      const subId = e.features[0].properties?.id;
      if (subId) {
        e.originalEvent?.stopPropagation?.();
        onSelectSubDivision(subId);
      }
    };

    map.on('click', 'parcels-fill', handleParcelClick);
    map.on('click', 'parcels-MacroCircle', handleParcelClick);
    map.on('click', 'subdivisions-fill', handleSubClick);

    return () => {
      map.off('click', 'parcels-fill', handleParcelClick);
      map.off('click', 'parcels-MacroCircle', handleParcelClick);
      map.off('click', 'subdivisions-fill', handleSubClick);
    };
  }, [mapLoaded, parcels, onSelectParcel, onSelectSubDivision]);

  // Actualizar datos GeoJSON cuando cambia la fecha de evaluación o la parcela seleccionada
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const parcelSource = map.getSource('barley-parcels') as maplibregl.GeoJSONSource | undefined;
    if (parcelSource) {
      parcelSource.setData(parcelsGeoJson as any);
    }

    const centerSource = map.getSource('barley-parcel-centers') as maplibregl.GeoJSONSource | undefined;
    if (centerSource) {
      centerSource.setData(parcelCentersGeoJson as any);
    }

    const subSource = map.getSource('parcel-subdivisions') as maplibregl.GeoJSONSource | undefined;
    if (subSource) {
      subSource.setData(subDivisionsGeoJson as any);
    }

    const subLabelSource = map.getSource('parcel-sublabels') as maplibregl.GeoJSONSource | undefined;
    if (subLabelSource) {
      subLabelSource.setData(subLabelsGeoJson as any);
    }
  }, [mapLoaded, parcelsGeoJson, parcelCentersGeoJson, subDivisionsGeoJson, subLabelsGeoJson]);

  // Actualizar escala de colores según el modo de capa seleccionado
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const expr = colorExpression(colorMode);
    if (map.getLayer('parcels-fill')) {
      map.setPaintProperty('parcels-fill', 'fill-color', expr);
    }
    if (map.getLayer('parcels-MacroCircle')) {
      map.setPaintProperty('parcels-MacroCircle', 'circle-color', expr);
    }
  }, [mapLoaded, colorMode]);

  // Cambiar mapa base Satélite vs Topográfico
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (basemapStyle === 'satellite') {
      map.setLayoutProperty('basemap-satellite', 'visibility', 'visible');
      map.setLayoutProperty('basemap-topo', 'visibility', 'none');
      map.setLayoutProperty('basemap-labels', 'visibility', 'visible');
    } else {
      map.setLayoutProperty('basemap-satellite', 'visibility', 'none');
      map.setLayoutProperty('basemap-topo', 'visibility', 'visible');
      map.setLayoutProperty('basemap-labels', 'visibility', 'none');
    }
  }, [mapLoaded, basemapStyle]);

  const handleFlyToParcel = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: selectedParcel.center,
      zoom: 15.1,
      pitch: 38,
      duration: 1000,
    });
  };

  const handleFlyToRegion = (center: [number, number], zoom: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center,
      zoom,
      pitch: zoom > 10 ? 30 : 18,
      duration: 1100,
    });
  };

  const trainCount = useMemo(() => parcels.filter((p) => p.split === 'train').length, [parcels]);
  const evalCount = useMemo(() => parcels.filter((p) => p.split === 'eval').length, [parcels]);

  return (
    <div className="relative w-full h-full rounded-m3-lg overflow-hidden bg-m3-surface-container-highest">
      {/* Contenedor WebGL de MapLibre */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Barra superior izquierda: Presets de región y botón 'Ver sub-lotes' (No-scrollbar horizontal) */}
      <div className="absolute top-3 left-3 max-w-[calc(100%-64px)] z-10 flex items-center gap-1.5 p-1 bg-m3-surface/95 backdrop-blur rounded-m3-lg shadow-m3-2 border border-m3-outline-variant/30 overflow-x-auto no-scrollbar">
        {REGION_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handleFlyToRegion(preset.center, preset.zoom)}
            className="h-12 px-3 rounded-m3-sm text-label-l font-medium text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container-high transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Contenedor flotante de paneles: Capa del mapa y Sub-lotes (top-16 con espacio cómodo) */}
      <div className="absolute top-16 left-3 z-10 flex items-start gap-2 max-w-[calc(100%-24px)] pointer-events-none">
        {/* Panel o botón de Capa del Mapa */}
        <div className="pointer-events-auto shrink-0">
          {!isLayerPanelOpen ? (
            <IconButton
              variant="tonal"
              icon={<Layers className="w-5 h-5" />}
              aria-label="Abrir capas del mapa"
              title="Capa del mapa"
              onClick={() => {
                setIsLayerPanelOpen(true);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setIsSubLotsPanelOpen(false);
                }
              }}
              className="shadow-m3-2 border border-m3-outline-variant/30 bg-m3-surface/95 backdrop-blur"
            />
          ) : (
            <div className="w-[256px] bg-m3-surface/95 backdrop-blur rounded-m3-lg shadow-m3-2 border border-m3-outline-variant/30 p-3 text-m3-on-surface">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-title-s font-medium text-m3-on-surface">
                  <Layers className="w-4 h-4 text-m3-primary" />
                  Capa del mapa
                </div>
                <IconButton
                  variant="standard"
                  icon={<ChevronUp className="w-4 h-4" />}
                  aria-label="Ocultar capas"
                  onClick={() => setIsLayerPanelOpen(false)}
                  className="w-12 h-12"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                <FilterChip
                  label="Rendimiento"
                  selected={colorMode === 'yield'}
                  onClick={() => onColorModeChange('yield')}
                  className="w-full justify-center px-1.5 text-label-s"
                />
                <FilterChip
                  label="Verdor"
                  selected={colorMode === 'ndvi'}
                  onClick={() => onColorModeChange('ndvi')}
                  className="w-full justify-center px-1.5 text-label-s"
                />
                <FilterChip
                  label="Humedad"
                  selected={colorMode === 'ndwi'}
                  onClick={() => onColorModeChange('ndwi')}
                  className="w-full justify-center px-1.5 text-label-s"
                />
                <FilterChip
                  label="Partición"
                  selected={colorMode === 'split'}
                  onClick={() => onColorModeChange('split')}
                  className="w-full justify-center px-1.5 text-label-s"
                />
              </div>

              {/* Leyenda cartográfica con barra de gradiente y 3 etiquetas */}
              {colorMode === 'yield' && (
                <div>
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#A33A28] via-[#C98A2E] via-[#6E8B5A] to-[#3F5A34]" />
                  <div className="flex justify-between text-body-s text-m3-on-surface-variant mt-1">
                    <span>2 t/ha</span>
                    <span>3.8</span>
                    <span>5.5+</span>
                  </div>
                </div>
              )}
              {colorMode === 'ndvi' && (
                <div>
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#A98A5B] via-[#CBB457] via-[#6E8B5A] to-[#3F5A34]" />
                  <div className="flex justify-between text-body-s text-m3-on-surface-variant mt-1">
                    <span>0.2</span>
                    <span>0.55</span>
                    <span>0.85</span>
                  </div>
                </div>
              )}
              {colorMode === 'ndwi' && (
                <div>
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#A33A28] via-[#C98A2E] via-[#5E8FA8] to-[#3E6A7A]" />
                  <div className="flex justify-between text-body-s text-m3-on-surface-variant mt-1">
                    <span>−0.05</span>
                    <span>0.2</span>
                    <span>0.5</span>
                  </div>
                </div>
              )}
              {colorMode === 'split' && (
                <div className="flex items-center justify-between text-body-s text-m3-on-surface-variant pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-m3-primary shrink-0" />
                    Entrenamiento {trainCount}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C98A2E] shrink-0" />
                    Evaluación {evalCount}
                  </span>
                </div>
              )}

              {/* Footer de la parcela activa */}
              <div className="mt-2.5 pt-2 border-t border-m3-outline-variant/40 text-body-s text-m3-on-surface-variant">
                Parcela {selectedParcel.id}, 3 sub-lotes
              </div>
            </div>
          )}
        </div>

        {/* Panel o botón de Sub-lotes de la parcela */}
        <div className="pointer-events-auto shrink-0">
          {!isSubLotsPanelOpen ? (
            <IconButton
              variant="tonal"
              icon={<Grid className="w-5 h-5" />}
              aria-label="Abrir sub-lotes"
              title="Sub-lotes de la parcela"
              onClick={() => {
                setIsSubLotsPanelOpen(true);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setIsLayerPanelOpen(false);
                }
              }}
              className="shadow-m3-2 border border-m3-outline-variant/30 bg-m3-surface/95 backdrop-blur"
            />
          ) : (
            <div className="w-[250px] bg-m3-surface/95 backdrop-blur rounded-m3-lg shadow-m3-2 border border-m3-outline-variant/30 p-3 text-m3-on-surface">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-title-s font-medium text-m3-on-surface">
                  <Grid className="w-4 h-4 text-m3-primary" />
                  Sub-lotes de la parcela
                </div>
                <IconButton
                  variant="standard"
                  icon={<X className="w-4 h-4" />}
                  aria-label="Cerrar sub-lotes"
                  onClick={() => setIsSubLotsPanelOpen(false)}
                  className="w-12 h-12"
                />
              </div>

              <Button
                variant="tonal"
                size="sm"
                icon={<LocateFixed className="w-3.5 h-3.5" />}
                onClick={handleFlyToParcel}
                className="w-full justify-center mb-2.5 text-label-s h-7"
              >
                Enfocar en mapa
              </Button>

              <div className="flex flex-col gap-1.5">
                {selectedParcel.subDivisions.map((sub) => {
                  const isSelected = sub.id === selectedSubDivisionId;
                  const currentNdvi = sub.ndviByEval[evalIndex] ?? sub.ndviByEval[3] ?? sub.ndviByEval[0];
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => onSelectSubDivision(sub.id)}
                      className={`w-full text-left p-2 rounded-m3-sm border transition-all flex items-center justify-between text-body-s cursor-pointer ${
                        isSelected
                          ? 'bg-m3-primary-container text-m3-on-primary-container border-m3-primary font-medium shadow-sm'
                          : 'bg-m3-surface-container-low/80 hover:bg-m3-surface-container border-m3-outline-variant/40 text-m3-on-surface'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-label-m font-medium truncate">{sub.name || sub.code}</div>
                        <div className="text-[11px] opacity-75">Verdor {currentNdvi.toFixed(2)}</div>
                      </div>
                      <div className="text-right shrink-0 font-mono text-label-s">
                        {sub.predictedYieldTonHa} t/ha
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conmutador flotante Mapa Base (Satélite vs Mapa) en la esquina inferior izquierda */}
      <div className="absolute bottom-3 left-3 z-10 bg-m3-surface/95 backdrop-blur rounded-full shadow-m3-2 p-0.5">
        <SegmentedButton
          options={[
            { value: 'satellite', label: 'Satélite' },
            { value: 'topo', label: 'Mapa' },
          ]}
          value={basemapStyle}
          onChange={(v) => setBasemapStyle(v as 'satellite' | 'topo')}
          size="md"
          ariaLabel="Estilo del mapa base"
          className="w-[200px] [&_button]:px-2"
        />
      </div>
    </div>
  );
};
