import React, { useId } from 'react';
import { cn } from './cn';

export interface SliderMark {
  value: number;
  label: string;
}

export interface SliderProps {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  marks?: SliderMark[];
  tone?: 'primary' | 'tertiary';
  className?: string;
  disabled?: boolean;
}

export function Slider({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  marks,
  tone = 'primary',
  className,
  disabled = false,
}: SliderProps): JSX.Element {
  const inputId = useId();
  const range = max - min;
  const pct = range > 0 ? Math.min(100, Math.max(0, ((value - min) / range) * 100)) : 0;

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-body-m text-m3-on-surface-variant select-none">
          {label}
        </label>
        <span className="text-title-s tabular-nums text-m3-on-surface font-medium">
          {valueLabel}
        </span>
      </div>

      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-tone={tone}
        aria-valuetext={valueLabel}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        className="m3-slider w-full"
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      {marks && marks.length > 0 && (
        <div className="relative h-4 mt-1 w-full select-none" aria-hidden="true">
          {marks.map((mark, idx) => {
            const markPct =
              range > 0 ? Math.min(100, Math.max(0, ((mark.value - min) / range) * 100)) : 0;
            const isFirst = idx === 0;
            const isLast = idx === marks.length - 1;

            return (
              <span
                key={`${mark.value}-${idx}`}
                className={cn(
                  'absolute top-0 text-body-s text-m3-on-surface-variant whitespace-nowrap',
                  isFirst
                    ? 'left-0 text-left'
                    : isLast
                    ? 'right-0 text-right'
                    : '-translate-x-1/2 text-center'
                )}
                style={isFirst ? undefined : isLast ? undefined : { left: `${markPct}%` }}
              >
                {mark.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
