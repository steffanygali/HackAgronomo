import React from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface SegmentedButtonOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegmentedButtonProps<T extends string> {
  options: SegmentedButtonOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}

export function SegmentedButton<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: SegmentedButtonProps<T>): JSX.Element {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-stretch rounded-m3-md border border-m3-outline overflow-hidden select-none',
        size === 'sm' ? 'h-10' : 'h-12',
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        const iconElement = opt.icon ? (
          <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
            {opt.icon}
          </span>
        ) : isSelected ? (
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
        ) : null;

        return (
          <button
            key={opt.value}
            type="button"
            role="button"
            aria-pressed={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 min-w-[48px] px-3 sm:px-4 inline-flex items-center justify-center gap-2 text-label-l font-semibold border-r border-m3-outline last:border-r-0 state-layer transition-colors duration-150 ease-m3 cursor-pointer focus-visible:z-10',
              isSelected
                ? 'bg-m3-secondary-container text-m3-on-secondary-container font-semibold'
                : 'bg-transparent text-m3-on-surface-variant hover:text-m3-on-surface'
            )}
          >
            {iconElement}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
