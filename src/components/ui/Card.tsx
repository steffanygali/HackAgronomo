import React from 'react';
import { cn } from './cn';

export type CardVariant =
  | 'filled'
  | 'outlined'
  | 'elevated'
  | 'tonal-primary'
  | 'tonal-secondary'
  | 'tonal-tertiary';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export function Card({
  variant = 'filled',
  className,
  children,
  ...rest
}: CardProps): JSX.Element {
  const variantClasses: Record<CardVariant, string> = {
    filled: 'bg-m3-surface-container-low text-m3-on-surface',
    outlined: 'bg-m3-surface-container-lowest border border-m3-outline-variant text-m3-on-surface',
    elevated: 'bg-m3-surface-container-low shadow-m3-1 text-m3-on-surface',
    'tonal-primary': 'bg-m3-primary-container text-m3-on-primary-container',
    'tonal-secondary': 'bg-m3-secondary-container text-m3-on-secondary-container',
    'tonal-tertiary': 'bg-m3-tertiary-container text-m3-on-tertiary-container',
  };

  return (
    <div
      className={cn(
        'rounded-m3-md p-4 transition-colors',
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: CardHeaderProps): JSX.Element {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-3', className)}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && (
          <div className="w-10 h-10 rounded-full bg-m3-surface-container-high flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5 text-m3-on-surface-variant">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-title-m font-medium truncate">{title}</div>
          {subtitle && (
            <div className="text-body-m text-m3-on-surface-variant mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      {action && <div className="shrink-0 flex items-center">{action}</div>}
    </div>
  );
}
