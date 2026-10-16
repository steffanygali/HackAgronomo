import React from 'react';
import { cn } from './cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: TabsProps<T>): JSX.Element {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = (index + 1) % tabs.length;
      onChange(tabs[nextIdx].value);
      tabRefs.current[nextIdx]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = (index - 1 + tabs.length) % tabs.length;
      onChange(tabs[prevIdx].value);
      tabRefs.current[prevIdx]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(tabs[0].value);
      tabRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(tabs[tabs.length - 1].value);
      tabRefs.current[tabs.length - 1]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-stretch border-b border-m3-outline-variant overflow-x-auto no-scrollbar',
        className
      )}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.value === value;

        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative h-12 flex-1 min-w-max px-4 inline-flex items-center justify-center text-title-s font-medium state-layer transition-colors duration-200 cursor-pointer select-none',
              isActive
                ? 'text-m3-primary font-semibold'
                : 'text-m3-on-surface-variant hover:text-m3-on-surface'
            )}
          >
            <div className="relative inline-flex items-center justify-center gap-2 h-full px-2 min-w-[24px]">
              {tab.icon && (
                <span
                  className="w-5 h-5 shrink-0 inline-flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5"
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 inset-x-0 h-[3px] bg-m3-primary rounded-t-full min-w-[24px]"
                  aria-hidden="true"
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
