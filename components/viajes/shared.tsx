'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatARS } from '@/lib/formatCurrency';
import {
    toneConsumo, VERIFICACION_LABEL, VERIFICACION_TONE, VIAJE_ESTADO_LABEL, VIAJE_ESTADO_TONE,
    type VerificacionEstado, type ViajeEstado,
} from '@/lib/viajes';

export const money = (n: number | null | undefined) => formatARS(n ?? 0);

/** fetch + JSON con el mensaje de error de la API. */
export async function apiJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json', ...(init?.headers || {}) } : init?.headers,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    if (!res.ok) throw new Error(data?.error || 'No se pudo completar la operación.');
    return data as T;
}

export function EstadoViajeBadge({ estado, className }: { estado: string; className?: string }) {
    const e = estado as ViajeEstado;
    return <Badge tone={VIAJE_ESTADO_TONE[e] || 'neutral'} dot className={className}>{VIAJE_ESTADO_LABEL[e] || estado}</Badge>;
}

export function VerificacionBadge({ estado }: { estado: string }) {
    const e = (estado || 'pendiente') as VerificacionEstado;
    return <Badge tone={VERIFICACION_TONE[e] || 'neutral'}>{VERIFICACION_LABEL[e] || estado}</Badge>;
}

export function Ruta({ origen, destino, className }: { origen: string; destino: string; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
            <span className="truncate">{origen}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{destino}</span>
        </span>
    );
}

/** Barra de gasto contra estimado. */
export function BarraConsumo({
    porcentaje,
    className,
    grosor = 'h-1.5',
    label,
}: {
    porcentaje: number;
    className?: string;
    grosor?: string;
    label?: string;
}) {
    const tone = toneConsumo(porcentaje);
    const color = { success: 'bg-success-500', warning: 'bg-warning-500', danger: 'bg-danger-500' }[tone];
    return (
        <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, porcentaje)}
            aria-label={label || `Consumo del estimado: ${porcentaje}%`}
            className={cn('w-full rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden', grosor, className)}
        >
            <div className={cn('h-full rounded-full transition-[width] duration-200', color)} style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }} />
        </div>
    );
}

/** Fila etiqueta / valor para resúmenes. */
export function Dato({ label, value, tone, strong }: { label: React.ReactNode; value: React.ReactNode; tone?: 'success' | 'danger' | 'warning'; strong?: boolean }) {
    const toneClass = tone === 'success' ? 'text-success-700 dark:text-success-300'
        : tone === 'danger' ? 'text-danger-700 dark:text-danger-300'
            : tone === 'warning' ? 'text-warning-700 dark:text-warning-300'
                : 'text-slate-900 dark:text-slate-100';
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-[13px] text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className={cn('text-[13px] tabular-nums text-right', strong && 'font-semibold', toneClass)}>{value}</dd>
        </div>
    );
}

/** Texto del resultado de la liquidación. */
export function textoResultado(resultado: number): { label: string; tone: 'success' | 'warning'; monto: number } {
    if (resultado > 0) return { label: 'Devuelve el responsable', tone: 'warning', monto: resultado };
    if (resultado < 0) return { label: 'Reintegra la empresa', tone: 'warning', monto: -resultado };
    return { label: 'Sin saldo pendiente', tone: 'success', monto: 0 };
}

/** Grupo de opciones grandes (radio) para formularios táctiles. */
export function OpcionesGrandes<T extends string>({
    options,
    value,
    onChange,
    label,
    columns = 2,
    className,
}: {
    options: { value: T; label: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }[];
    value: T;
    onChange: (v: T) => void;
    label: string;
    columns?: 2 | 3;
    className?: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2', className)}>
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
                            'flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg border text-left transition-colors [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0',
                            active
                                ? 'border-primary bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100 dark:border-brand-400'
                                : 'border-border bg-card text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                        )}
                    >
                        {opt.icon}
                        <span className="min-w-0">
                            <span className="block text-[13px] font-medium leading-tight">{opt.label}</span>
                            {opt.hint && <span className="block text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{opt.hint}</span>}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
