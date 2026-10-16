import React from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface FilterChipProps {
  label: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  count?: number;
  className?: string;
  disabled?: boolean;
}

export function FilterChip({
  label,
  selected = false,
  onClick,
  icon,
  count,
  className,
  disabled = false,
}: FilterChipProps): JSX.Element {
  const leadingIcon = icon ? (
    <span className="w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]" aria-hidden="true">
      {icon}
    </span>
  ) : selected ? (
    <Check className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
  ) : null;

  return (
    <button
      type="button"
      role="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 h-8 rounded-m3-sm px-3 text-label-l font-medium select-none state-layer transition-all duration-200 ease-m3 cursor-pointer shrink-0 disabled:opacity-40 disabled:pointer-events-none',
        selected
          ? 'bg-m3-secondary-container text-m3-on-secondary-container border border-transparent'
          : 'border border-m3-outline-variant bg-transparent text-m3-on-surface-variant hover:text-m3-on-surface',
        className
      )}
    >
      {leadingIcon}
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className="text-body-s tabular-nums opacity-75 shrink-0">{count}</span>
      )}
    </button>
  );
}

export type TagTone = 'primary' | 'secondary' | 'tertiary' | 'error' | 'info' | 'neutral';

export interface TagProps {
  tone?: TagTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function Tag({
  tone = 'neutral',
  children,
  icon,
  className,
}: TagProps): JSX.Element {
  const toneClasses: Record<TagTone, string> = {
    primary: 'bg-m3-primary-container text-m3-on-primary-container',
    secondary: 'bg-m3-secondary-container text-m3-on-secondary-container',
    tertiary: 'bg-m3-tertiary-container text-m3-on-tertiary-container',
    error: 'bg-m3-error-container text-m3-on-error-container',
    info: 'bg-m3-info-container text-m3-on-info-container',
    neutral: 'bg-m3-surface-container-high text-m3-on-surface-variant',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-m3-sm text-label-m font-medium select-none shrink-0',
        toneClasses[tone],
        className
      )}
    >
      {icon && (
        <span className="w-3.5 h-3.5 shrink-0 inline-flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}
