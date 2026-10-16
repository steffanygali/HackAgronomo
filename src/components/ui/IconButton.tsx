import React from 'react';
import { cn } from './cn';

export type IconButtonVariant = 'standard' | 'tonal' | 'filled' | 'outlined';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  icon: React.ReactNode;
  'aria-label': string;
  selected?: boolean;
}

export function IconButton({
  variant = 'standard',
  icon,
  'aria-label': ariaLabel,
  selected = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps): JSX.Element {
  const variantClasses: Record<IconButtonVariant, string> = {
    standard: selected
      ? 'bg-m3-secondary-container text-m3-primary'
      : 'bg-transparent text-m3-on-surface-variant hover:text-m3-on-surface',
    tonal: 'bg-m3-secondary-container text-m3-on-secondary-container',
    filled: 'bg-m3-primary text-m3-on-primary',
    outlined: 'border border-m3-outline-variant bg-transparent text-m3-on-surface-variant',
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-full state-layer transition-all duration-200 ease-m3 disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer shrink-0',
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
