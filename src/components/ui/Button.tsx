import React from 'react';
import { cn } from './cn';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export function Button({
  variant = 'filled',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const isText = variant === 'text';

  const sizeClasses = size === 'sm'
    ? (isText ? 'h-8 px-3' : 'h-8 px-4')
    : (isText ? 'h-10 px-3' : 'h-10 px-6');

  const variantClasses: Record<ButtonVariant, string> = {
    filled: 'bg-m3-primary text-m3-on-primary',
    tonal: 'bg-m3-secondary-container text-m3-on-secondary-container',
    outlined: 'border border-m3-outline text-m3-primary bg-transparent',
    text: 'text-m3-primary bg-transparent',
    elevated: 'bg-m3-surface-container-low shadow-m3-1 text-m3-primary',
  };

  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-full text-label-l state-layer transition-all duration-200 ease-m3 disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer shrink-0',
        sizeClasses,
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {icon && (
        <span className="w-[18px] h-[18px] shrink-0 inline-flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
