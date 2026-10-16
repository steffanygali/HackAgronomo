import React from 'react';
import { cn } from './cn';

export type MetricSize = 'sm' | 'md' | 'lg';
export type MetricTone = 'default' | 'primary' | 'error' | 'tertiary';

export interface MetricProps {
  label: string;
  value: React.ReactNode;
  supporting?: React.ReactNode;
  size?: MetricSize;
  tone?: MetricTone;
  className?: string;
}

export function Metric({
  label,
  value,
  supporting,
  size = 'md',
  tone = 'default',
  className,
}: MetricProps): JSX.Element {
  const labelSizeClasses: Record<MetricSize, string> = {
    sm: 'text-body-s',
    md: 'text-body-m',
    lg: 'text-body-m',
  };

  const valueSizeClasses: Record<MetricSize, string> = {
    sm: 'text-title-m font-medium',
    md: 'text-title-l font-medium',
    lg: 'text-headline-s font-normal',
  };

  const toneClasses: Record<MetricTone, string> = {
    default: 'text-m3-on-surface',
    primary: 'text-m3-primary',
    error: 'text-m3-error',
    tertiary: 'text-m3-tertiary',
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <span className={cn('text-m3-on-surface-variant select-none', labelSizeClasses[size])}>
        {label}
      </span>
      <div className={cn('tabular-nums tracking-tight', valueSizeClasses[size], toneClasses[tone])}>
        {value}
      </div>
      {supporting && (
        <span className="text-body-s text-m3-on-surface-variant mt-0.5">
          {supporting}
        </span>
      )}
    </div>
  );
}
