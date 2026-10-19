import React, { useEffect, useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { PhenologicalEvaluation } from '../types/agro';
import { Card, IconButton, Metric, Tag } from './ui';

interface EvaluationTimelineProps {
  evaluations: PhenologicalEvaluation[];
  activeIndex: number;
  onChangeIndex: (idx: number) => void;
}

export const EvaluationTimeline: React.FC<EvaluationTimelineProps> = ({
  evaluations,
  activeIndex,
  onChangeIndex,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const intervalTime = prefersReducedMotion ? 2500 : 1700;

    const timer = setInterval(() => {
      onChangeIndex((activeIndex + 1) % evaluations.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, activeIndex, evaluations.length, onChangeIndex]);

  const currentEval = evaluations[activeIndex] || evaluations[3] || evaluations[0];

  const formatDateLong = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d
        .toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        .replace(/\./g, '');
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d
        .toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
        })
        .replace(/\./g, '');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card
      variant="filled"
      className="rounded-m3-lg p-3 md:p-4 bg-m3-surface-container-low border border-m3-outline-variant/30"
    >
      {/* Encabezado: Controles de reproducción + Etapa y Fecha + Métricas clave */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 mb-3 border-b border-m3-outline-variant/30">
        <div className="flex items-center gap-3">
          <IconButton
            variant="tonal"
            icon={
              isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )
            }
            aria-label={isPlaying ? 'Pausar' : 'Reproducir evolución'}
            onClick={() => setIsPlaying(!isPlaying)}
          />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-title-s font-medium text-m3-on-surface">
                {currentEval.stage}
              </span>
              <Tag tone="neutral" className="text-label-s h-5 px-2">
                {currentEval.satellite}
              </Tag>
            </div>
            <div className="text-body-s text-m3-on-surface-variant">
              Toma {activeIndex + 1} de {evaluations.length} ·{' '}
              {formatDateLong(currentEval.date)} · {currentEval.captureTime}
            </div>
          </div>
        </div>

        {/* Métricas completas de la evaluación satelital */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-4 bg-m3-surface-container/60 p-2 md:p-0 rounded-m3-sm md:bg-transparent">
          <Metric
            label="NDVI"
            value={currentEval.ndvi.toFixed(3)}
            size="sm"
            tone="primary"
          />
          <Metric
            label="NDWI (hum.)"
            value={`${currentEval.ndwi.toFixed(2)} (${currentEval.soilMoisturePct}%)`}
            size="sm"
          />
          <Metric
            label="EVI / SAVI"
            value={`${currentEval.evi.toFixed(2)} / ${currentEval.savi.toFixed(2)}`}
            size="sm"
          />
          <Metric
            label="Lluvia"
            value={`${currentEval.precipMm} mm`}
            size="sm"
          />
          <Metric
            label="Temp máx/mín"
            value={`${currentEval.tempMaxC}°/${currentEval.tempMinC}°C`}
            size="sm"
          />
          <Metric
            label="GDD acum."
            value={`${currentEval.gdd}°D`}
            size="sm"
          />
        </div>
      </div>

      {/* Stepper de las 6 evaluaciones */}
      <div className="overflow-x-auto no-scrollbar py-1">
        <div className="min-w-[560px] flex items-start justify-between">
          {evaluations.map((ev, idx) => {
            const isActive = idx === activeIndex;
            const isCompleted = idx < activeIndex;
            const isPeak = idx === 3; // Espigado y Floración

            return (
              <button
                key={ev.date}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  onChangeIndex(idx);
                }}
                className="flex-1 flex flex-col items-center group cursor-pointer focus-visible:outline-none"
              >
                {/* Badge encima del nodo (index 3 = Pico) */}
                <div className="h-6 flex items-center justify-center mb-1">
                  {isPeak ? (
                    <Tag tone="tertiary" className="text-label-s px-1.5 h-5">
                      Pico
                    </Tag>
                  ) : (
                    <div className="h-5" />
                  )}
                </div>

                {/* Fila con línea de conexión y círculo de 24px */}
                <div className="relative w-full flex items-center justify-center my-0.5">
                  {/* Línea izquierda */}
                  <div
                    className={`flex-1 h-0.5 ${
                      idx === 0
                        ? 'opacity-0'
                        : idx <= activeIndex
                        ? 'bg-m3-primary'
                        : 'bg-m3-outline-variant'
                    }`}
                  />

                  {/* Círculo de 24px */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-200 select-none ${
                      isCompleted
                        ? 'bg-m3-primary text-m3-on-primary'
                        : isActive
                        ? 'bg-m3-primary text-m3-on-primary ring-4 ring-m3-primary-container'
                        : 'border-2 border-m3-outline bg-m3-surface text-transparent'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    )}
                  </div>

                  {/* Línea derecha */}
                  <div
                    className={`flex-1 h-0.5 ${
                      idx === evaluations.length - 1
                        ? 'opacity-0'
                        : idx < activeIndex
                        ? 'bg-m3-primary'
                        : 'bg-m3-outline-variant'
                    }`}
                  />
                </div>

                {/* Información debajo del nodo */}
                <div className="flex flex-col items-center mt-1.5 text-center px-1 max-w-[90px]">
                  <span
                    className={`text-label-m font-medium tabular-nums ${
                      isActive
                        ? 'text-m3-primary font-semibold'
                        : 'text-m3-on-surface'
                    }`}
                  >
                    {formatDateShort(ev.date)}
                  </span>
                  <span className="text-body-s text-m3-on-surface-variant truncate w-full hidden sm:block">
                    {ev.stage}
                  </span>
                  <span className="text-label-s tabular-nums text-m3-on-surface-variant mt-0.5">
                    {ev.ndvi.toFixed(2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
