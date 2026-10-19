import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  ChevronDown,
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
  { label: 'Altiplano (197)', center: [-98.406, 19.755], zoom: 9.35 },
  { label: 'Chignahuapan, Pue.', center: [-98.252, 19.865], zoom: 12.1 },
  { label: 'Calpulalpan, Tlax.', center: [-98.549, 19.570], zoom: 11.8 },
  { label: 'Singuilucan, Hgo.', center: [-98.398, 19.961], zoom: 12.1 },
  { label: 'Almoloya, Hgo.', center: [-98.305, 19.782], zoom: 11.7 },
  { label: 'Cuautepec, Hgo.', center: [-98.282, 19.923], zoom: 12.7 },
];

const COLOR_MODE_LABELS: Record<MapColorMode, string> = {
  yield: 'Rendimiento',
  ndvi: 'NDVI',
  ndwi: 'NDWI',
  split: 'Partición',
};

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
      2.2, '#BA1A1A',
      3.5, '#E2A529',
      4.3, '#5FA463',
      5.2, '#1F5B2C',
    ];
  }
  if (mode === 'ndvi') {
    return [
      'interpolate',
      ['linear'],
      ['get', 'ndvi'],
      0.2, '#B9822B',
      0.45, '#D8C04A',
      0.65, '#6DB56F',
      0.85, '#1F5B2C',
    ];
  }
  if (mode === 'ndwi') {
    return [
      'interpolate',
      ['linear'],
      ['get', 'ndwi'],
      -0.05, '#BA1A1A',
      0.15, '#E2A529',
      0.35, '#4BA3D9',
      0.52, '#00639B',
    ];
  }
  // mode === 'split'
  return [
    'case',
    ['==', ['get', 'split'], 'eval'],
    '#E2A529',
    '#2F6A3A',
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
  // Ambos dropdowns del mapa inician siempre cerrados por defecto
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isSubLotsPanelOpen, setIsSubLotsPanelOpen] = useState(false);

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
            altitudeM: p.altitudeM,
            variety: p.variety,
            regime: p.regime,
            firaCreditScore: p.firaCreditScore,
            riskLevel: p.riskLevel,
            predictedYield: p.predictedYieldTonHa,
            actualYield: p.actualYieldTonHa ?? -1,
            ciLow: p.confidenceInterval[0],
            ciHigh: p.confidenceInterval[1],
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
            altitudeM: p.altitudeM,
            variety: p.variety,
            regime: p.regime,
            firaCreditScore: p.firaCreditScore,
            riskLevel: p.riskLevel,
            predictedYield: p.predictedYieldTonHa,
            actualYield: p.actualYieldTonHa ?? -1,
            ciLow: p.confidenceInterval[0],
            ciHigh: p.confidenceInterval[1],
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
            label: `${sub.code}: ${sub.predictedYieldTonHa} t/ha\nNDVI ${currentNdvi.toFixed(2)}`,
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
          // Borde de las 197 parcelas: selected #FFFFFF w3, eval #E2A529 w1.8, train rgba(255,255,255,0.65) w1.2
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
                '#FFDEA4',
                'rgba(255,255,255,0.65)',
              ],
              'line-width': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                3,
                ['==', ['get', 'split'], 'eval'],
                1.8,
                1.2,
              ],
            },
          },
          // Halo exterior para destacar siempre la parcela seleccionada en cualquier nivel de zoom
          {
            id: 'parcels-selected-halo',
            type: 'circle',
            source: 'barley-parcel-centers',
            filter: ['==', ['get', 'isSelected'], 1],
            maxzoom: 14.5,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, 10,
                10, 14,
                13, 18,
              ],
              'circle-color': 'rgba(255, 222, 164, 0.22)',
              'circle-stroke-color': '#FFDEA4',
              'circle-stroke-width': 2.5,
            },
          },
          // Capa de puntos para vista macro y media (con transición suave hacia los polígonos reales)
          {
            id: 'parcels-MacroCircle',
            type: 'circle',
            source: 'barley-parcel-centers',
            maxzoom: 14.6,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, ['case', ['==', ['get', 'isSelected'], 1], 7, 4.5],
                10, ['case', ['==', ['get', 'isSelected'], 1], 9.5, 6.8],
                12.5, ['case', ['==', ['get', 'isSelected'], 1], 11, 8.2],
                14.5, 4,
              ],
              'circle-color': colorExpression(colorModeRef.current),
              'circle-stroke-color': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                '#FFFFFF',
                ['==', ['get', 'split'], 'eval'],
                '#FFDEA4',
                '#FFFFFF',
              ],
              'circle-stroke-width': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                3,
                ['==', ['get', 'split'], 'eval'],
                1.8,
                1.2,
              ],
              'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, 0.94,
                12.8, 0.9,
                14.4, 0.18,
              ],
            },
          },
          // Etiquetas con el ID oficial FIRA (AGC_001..AGC_197) al acercarse a los clústeres
          {
            id: 'parcels-id-label',
            type: 'symbol',
            source: 'barley-parcel-centers',
            minzoom: 11.8,
            maxzoom: 15.2,
            layout: {
              'text-field': ['get', 'id'],
              'text-font': ['Noto Sans Regular'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11.8, 10,
                14, 11.5,
              ],
              'text-offset': [0, -1.2],
              'text-anchor': 'bottom',
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': [
                'case',
                ['==', ['get', 'isSelected'], 1],
                '#FFDEA4',
                '#FFFFFF',
              ],
              'text-halo-color': '#181D18',
              'text-halo-width': 1.6,
            },
          },
          // Relleno de las subdivisiones internas (Lote A, B, C)
          {
            id: 'subdivisions-fill',
            type: 'fill',
            source: 'parcel-subdivisions',
            paint: {
              'fill-color': colorExpression(
                colorModeRef.current === 'split' ? 'ndvi' : colorModeRef.current
              ),
              'fill-opacity': [
                'case',
                ['==', ['get', 'isSelectedSub'], 1],
                0.88,
                0.68,
              ],
            },
          },
          // Líneas divisorias internas de la parcela: seleccionada #FFDEA4 w3, normal blanca dashed w1.8
          {
            id: 'subdivisions-line',
            type: 'line',
            source: 'parcel-subdivisions',
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'isSelectedSub'], 1],
                '#FFDEA4',
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
              'text-halo-color': '#181D18',
              'text-halo-width': 1.8,
            },
          },
        ],
      },
      attributionControl: false,
      center: [-98.406, 19.755],
      zoom: 9.35,
      pitch: 24,
      bearing: -3,
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
          ? `<span style="background:#FFDEA4;color:#261900;border-radius:8px;padding:2px 8px;font-size:12px;font-weight:500;">Evaluación 30%</span>`
          : `<span style="background:#B3F1B6;color:#00210A;border-radius:8px;padding:2px 8px;font-size:12px;font-weight:500;">Entrenamiento 70%</span>`;

      const actualInfo =
        Number(props.actualYield) >= 0
          ? `Real: ${Number(props.actualYield).toFixed(2)} t/ha`
          : `IC 90%: [${Number(props.ciLow).toFixed(2)} – ${Number(props.ciHigh).toFixed(2)}]`;

      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="min-width:236px;font-family:'Roboto Flex',Roboto,sans-serif;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-family:'Roboto Mono',monospace;font-size:12px;font-weight:600;color:#EEF2E9;">${escapeHtml(props.id)}</span>
              ${splitPill}
            </div>
            <div style="font-size:14px;font-weight:500;color:#EEF2E9;margin-bottom:2px;">${escapeHtml(props.name)}</div>
            <div style="font-size:12px;color:#EEF2E9;opacity:0.85;margin-bottom:2px;">${escapeHtml(props.municipality)}, ${escapeHtml(props.state)} · ${escapeHtml(props.areaHa)} ha · ${escapeHtml(props.altitudeM)} msnm</div>
            <div style="font-size:11px;color:#FFDEA4;opacity:0.92;margin-bottom:8px;font-variant-numeric:tabular-nums;">${escapeHtml(actualInfo)} · ${escapeHtml(props.regime)}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;border-top:1px solid rgba(238,242,233,0.15);padding-top:8px;">
              <div>
                <div style="font-size:11px;color:#EEF2E9;opacity:0.7;">Predicción</div>
                <div style="font-size:15px;font-weight:500;color:#98D59C;font-variant-numeric:tabular-nums;">${Number(props.predictedYield).toFixed(2)} t/ha</div>
              </div>
              <div>
                <div style="font-size:11px;color:#EEF2E9;opacity:0.7;">NDVI</div>
                <div style="font-size:15px;font-weight:500;color:#EEF2E9;font-variant-numeric:tabular-nums;">${Number(props.ndvi).toFixed(2)}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#EEF2E9;opacity:0.7;">Score FIRA</div>
                <div style="font-size:15px;font-weight:500;color:#FFDEA4;font-variant-numeric:tabular-nums;">${escapeHtml(props.firaCreditScore)}/100</div>
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
    if (map.getLayer('subdivisions-fill')) {
      map.setPaintProperty(
        'subdivisions-fill',
        'fill-color',
        colorExpression(colorMode === 'split' ? 'ndvi' : colorMode)
      );
    }
  }, [mapLoaded, colorMode]);

  // Volar automáticamente a la parcela seleccionada cuando cambia desde el buscador, botones Anterior/Siguiente o tablas
  const prevSelectedIdRef = useRef<string>(selectedParcel.id);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (prevSelectedIdRef.current === selectedParcel.id) return;
    prevSelectedIdRef.current = selectedParcel.id;

    map.flyTo({
      center: selectedParcel.center,
      zoom: Math.max(map.getZoom(), 14.6),
      pitch: 34,
      duration: 950,
    });
  }, [mapLoaded, selectedParcel.id, selectedParcel.center]);

  // Ajustar encuadre (fitBounds) cuando el usuario cambia el filtro de estado (Todos / Hidalgo / Tlaxcala / Puebla)
  const prevParcelCountRef = useRef<number>(parcels.length);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || parcels.length === 0) return;
    if (prevParcelCountRef.current === parcels.length) return;
    prevParcelCountRef.current = parcels.length;

    const bounds = new maplibregl.LngLatBounds();
    for (const p of parcels) {
      bounds.extend(p.center);
    }
    map.fitBounds(bounds, {
      padding: { top: 68, bottom: 52, left: 48, right: 48 },
      maxZoom: 12.4,
      duration: 900,
    });
  }, [mapLoaded, parcels]);

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

      {/* Barra superior izquierda: Presets de región y botón directo para enfocar la parcela activa */}
      <div className="absolute top-3 left-3 max-w-[calc(100%-64px)] z-10 flex items-center gap-1 p-1 bg-m3-surface/95 backdrop-blur rounded-m3-lg shadow-m3-2 border border-m3-outline-variant/30 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={handleFlyToParcel}
          title={`Acercar cámara a la parcela ${selectedParcel.id}`}
          className="h-8 px-2.5 rounded-m3-sm text-label-l font-medium bg-m3-secondary-container text-m3-on-secondary-container hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <LocateFixed className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono">{selectedParcel.id}</span>
        </button>
        <div className="w-[1px] h-5 bg-m3-outline-variant/50 shrink-0 mx-0.5" />
        {REGION_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handleFlyToRegion(preset.center, preset.zoom)}
            className="h-8 px-2.5 rounded-m3-sm text-label-l font-medium text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container-high transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Contenedor flotante de dropdowns del mapa (inician siempre cerrados) */}
      <div className="absolute top-16 left-3 z-10 flex items-start gap-2 max-w-[calc(100%-24px)] pointer-events-none">
        {/* Dropdown 1: Capa del Mapa */}
        <div className="pointer-events-auto shrink-0">
          {!isLayerPanelOpen ? (
            <button
              type="button"
              aria-label="Abrir capas del mapa"
              aria-expanded={false}
              onClick={() => {
                setIsLayerPanelOpen(true);
                setIsSubLotsPanelOpen(false);
              }}
              className="h-9 px-3 rounded-full shadow-m3-2 border border-m3-outline-variant/40 bg-m3-surface/95 backdrop-blur text-m3-on-surface text-label-m font-medium inline-flex items-center gap-1.5 state-layer cursor-pointer"
            >
              <Layers className="w-4 h-4 text-m3-primary shrink-0" />
              <span>Capas: {COLOR_MODE_LABELS[colorMode]}</span>
              <ChevronDown className="w-4 h-4 text-m3-on-surface-variant shrink-0" />
            </button>
          ) : (
            <div className="w-[264px] bg-m3-surface/95 backdrop-blur rounded-m3-lg shadow-m3-2 border border-m3-outline-variant/30 p-3 text-m3-on-surface">
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
                  className="w-7 h-7"
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
                  label="NDVI"
                  selected={colorMode === 'ndvi'}
                  onClick={() => onColorModeChange('ndvi')}
                  className="w-full justify-center px-1.5 text-label-s"
                />
                <FilterChip
                  label="NDWI"
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
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#BA1A1A] via-[#E2A529] via-[#5FA463] to-[#1F5B2C]" />
                  <div className="flex justify-between text-body-s text-m3-on-surface-variant mt-1">
                    <span>2 t/ha</span>
                    <span>3.8</span>
                    <span>5.5+</span>
                  </div>
                </div>
              )}
              {colorMode === 'ndvi' && (
                <div>
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#B9822B] via-[#D8C04A] via-[#6DB56F] to-[#1F5B2C]" />
                  <div className="flex justify-between text-body-s text-m3-on-surface-variant mt-1">
                    <span>0.2</span>
                    <span>0.55</span>
                    <span>0.85</span>
                  </div>
                </div>
              )}
              {colorMode === 'ndwi' && (
                <div>
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#BA1A1A] via-[#E2A529] via-[#4BA3D9] to-[#00639B]" />
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
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E2A529] shrink-0" />
                    Evaluación {evalCount}
                  </span>
                </div>
              )}

              {/* Footer de la parcela activa */}
              <div className="mt-2.5 pt-2 border-t border-m3-outline-variant/40 text-body-s text-m3-on-surface-variant">
                Parcela {selectedParcel.id} · {selectedParcel.variety}
              </div>
            </div>
          )}
        </div>

        {/* Dropdown 2: Sub-lotes de la parcela */}
        <div className="pointer-events-auto shrink-0">
          {!isSubLotsPanelOpen ? (
            <button
              type="button"
              aria-label="Abrir sub-lotes"
              aria-expanded={false}
              onClick={() => {
                setIsSubLotsPanelOpen(true);
                setIsLayerPanelOpen(false);
              }}
              className="h-9 px-3 rounded-full shadow-m3-2 border border-m3-outline-variant/40 bg-m3-surface/95 backdrop-blur text-m3-on-surface text-label-m font-medium inline-flex items-center gap-1.5 state-layer cursor-pointer"
            >
              <Grid className="w-4 h-4 text-m3-primary shrink-0" />
              <span>Sub-lotes ({selectedParcel.subDivisions.length})</span>
              <ChevronDown className="w-4 h-4 text-m3-on-surface-variant shrink-0" />
            </button>
          ) : (
            <div className="w-[268px] bg-m3-surface/95 backdrop-blur rounded-m3-lg shadow-m3-2 border border-m3-outline-variant/30 p-3 text-m3-on-surface">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-title-s font-medium text-m3-on-surface">
                  <Grid className="w-4 h-4 text-m3-primary" />
                  Sub-lotes de {selectedParcel.id}
                </div>
                <IconButton
                  variant="standard"
                  icon={<X className="w-4 h-4" />}
                  aria-label="Cerrar sub-lotes"
                  onClick={() => setIsSubLotsPanelOpen(false)}
                  className="w-7 h-7"
                />
              </div>

              <Button
                variant="tonal"
                size="sm"
                icon={<LocateFixed className="w-3.5 h-3.5" />}
                onClick={handleFlyToParcel}
                className="w-full justify-center mb-2.5 text-label-s h-7"
              >
                Enfocar parcela en mapa
              </Button>

              <div className="flex flex-col gap-1.5">
                {selectedParcel.subDivisions.map((sub) => {
                  const isSelected = sub.id === selectedSubDivisionId;
                  const currentNdvi = sub.ndviByEval[evalIndex] ?? sub.ndviByEval[3] ?? sub.ndviByEval[0];
                  const currentNdwi = sub.ndwiByEval[evalIndex] ?? sub.ndwiByEval[3] ?? sub.ndwiByEval[0];
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => onSelectSubDivision(sub.id)}
                      className={`w-full text-left p-2 rounded-m3-sm border transition-all flex items-center justify-between gap-2 text-body-s cursor-pointer ${
                        isSelected
                          ? 'bg-m3-primary-container text-m3-on-primary-container border-m3-primary font-medium shadow-sm'
                          : 'bg-m3-surface-container-low/80 hover:bg-m3-surface-container border-m3-outline-variant/40 text-m3-on-surface'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-label-m font-medium truncate">
                          {sub.code} · {sub.name}
                        </div>
                        <div className="text-[11px] opacity-80 truncate">
                          {sub.soilType} · Pend. {sub.slopePct}%
                        </div>
                        <div className="text-[11px] opacity-75 tabular-nums">
                          NDVI {currentNdvi.toFixed(2)} · NDWI {currentNdwi.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-label-m font-medium">{sub.predictedYieldTonHa} t/ha</div>
                        <div className="text-[11px] opacity-75">{sub.areaHa} ha</div>
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
          size="sm"
          ariaLabel="Estilo del mapa base"
          className="w-[190px] [&_button]:px-2"
        />
      </div>
    </div>
  );
};
