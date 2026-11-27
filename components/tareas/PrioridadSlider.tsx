'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';
import { PRIORIDADES } from './tipos';

/**
 * Prioridad con un deslizante de 4 pasos (Baja → Urgente). Se mueve con el
 * mouse, con las flechas del teclado o tocando el rótulo de cada paso.
 */
export default function PrioridadSlider({
    value,
    onChange,
    disabled,
    compact,
    className,
}: {
    value: string;
    onChange: (prioridad: string) => void;
    disabled?: boolean;
    /** Versión angosta para la barra de alta rápida. */
    compact?: boolean;
    className?: string;
}) {
    const id = useId();
    const idx = Math.max(0, PRIORIDADES.findIndex(p => p.value === value));
    const actual = PRIORIDADES[idx];

    return (
        <div className={cn('min-w-0', compact ? 'w-full sm:w-56' : 'w-full', className)}>
            {!compact && (
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor={id} className="field-label mb-0">Prioridad</label>
                    <span className={cn('text-[13px] font-semibold', actual.text)}>{actual.label}</span>
                </div>
            )}
            <div className={cn('flex items-center gap-2', compact && 'h-9')}>
                {compact && (
                    <label htmlFor={id} className={cn('text-xs font-semibold w-14 shrink-0', actual.text)}>{actual.label}</label>
                )}
                <input
                    id={id}
                    type="range"
                    min={0}
                    max={PRIORIDADES.length - 1}
                    step={1}
                    value={idx}
                    disabled={disabled}
                    onChange={e => onChange(PRIORIDADES[Number(e.target.value)].value)}
                    aria-valuetext={actual.label}
                    aria-label={compact ? 'Prioridad' : undefined}
                    className={cn('w-full h-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60', actual.accent)}
                />
            </div>
            {!compact && (
                <div className="flex justify-between mt-1" aria-hidden="true">
                    {PRIORIDADES.map((p, i) => (
                        <button
                            key={p.value}
                            type="button"
                            tabIndex={-1}
                            disabled={disabled}
                            onClick={() => onChange(p.value)}
                            className={cn(
                                'text-xs py-0.5 rounded transition-colors',
                                i === idx ? cn('font-semibold', p.text) : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
