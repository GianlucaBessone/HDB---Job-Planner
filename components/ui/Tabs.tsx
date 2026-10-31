'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
    id: string;
    label: React.ReactNode;
    icon?: React.ReactNode;
    count?: number;
}

/**
 * Pestañas con subrayado (navegación entre secciones de una misma vista).
 * Flechas, Inicio y Fin mueven la selección (patrón WAI-ARIA tabs).
 * Para alternar entre 2-3 modos de un mismo dato usá SegmentedControl.
 */
export function Tabs({
    tabs,
    value,
    onChange,
    label,
    className,
}: {
    tabs: TabItem[];
    value: string | undefined;
    onChange: (id: string) => void;
    label: string;
    className?: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (e: React.KeyboardEvent, index: number) => {
        const last = tabs.length - 1;
        const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        onChange(tabs[next].id);
        refs.current[next]?.focus();
    };

    return (
        <div role="tablist" aria-label={label} className={cn('w-full overflow-x-auto overflow-y-hidden hide-scrollbar border-b border-border', className)}>
            <div className="flex items-center gap-1 min-w-max">
                {tabs.map((tab, i) => {
                    const active = value === tab.id;
                    return (
                        <button
                            key={tab.id}
                            ref={el => { refs.current[i] = el; }}
                            role="tab"
                            type="button"
                            aria-selected={active}
                            tabIndex={active ? 0 : -1}
                            onClick={() => onChange(tab.id)}
                            onKeyDown={(e) => onKeyDown(e, i)}
                            className={cn(
                                'relative flex items-center gap-2 h-10 px-3 text-[13px] font-medium whitespace-nowrap transition-colors btn-icon-inline',
                                'after:absolute after:left-2 after:right-2 after:-bottom-px after:h-0.5 after:rounded-full',
                                active
                                    ? 'text-slate-900 dark:text-slate-50 after:bg-primary'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 after:bg-transparent'
                            )}
                        >
                            {tab.icon && <span className="[&>svg]:w-4 [&>svg]:h-4 shrink-0" aria-hidden="true">{tab.icon}</span>}
                            {tab.label}
                            {typeof tab.count === 'number' && (
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center justify-center tabular-nums">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Selector de 2 a 4 modos excluyentes (p. ej. Lista / Tablero). */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    label,
    className,
}: {
    options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
    value: T;
    onChange: (v: T) => void;
    label: string;
    className?: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-border', className)}>
            {options.map(opt => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(opt.value)}
                        className={cn(
                            'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium transition-colors btn-icon-inline [&>svg]:w-4 [&>svg]:h-4',
                            active
                                ? 'bg-card text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                        )}
                    >
                        {opt.icon}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
