'use client';

import React from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PLIEGO_ESTADO_LABEL, PLIEGO_ESTADO_TONE, type PliegoEstado } from '@/lib/pliegos';

/** fetch + JSON con el mensaje de error de la API. */
export async function apiJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers || {}) } : init?.headers,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    if (!res.ok) throw new Error(data?.error || 'No se pudo completar la operación.');
    return data as T;
}

export const formatFechaHora = (iso: string | Date) =>
    new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });

export function EstadoPliegoBadge({ estado, className }: { estado: string; className?: string }) {
    const e = estado as PliegoEstado;
    return <Badge tone={PLIEGO_ESTADO_TONE[e] || 'neutral'} dot className={className}>{PLIEGO_ESTADO_LABEL[e] || estado}</Badge>;
}

/** Origen del ítem: del pliego (con su referencia) o propuesto por la IA. */
export function OrigenBadge({ origen, referencia, className }: { origen: string; referencia?: string | null; className?: string }) {
    if (origen === 'PLIEGO') {
        return (
            <Badge tone="info" className={cn('max-w-full', className)}>
                <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Pliego{referencia ? ` · ${referencia}` : ''}</span>
            </Badge>
        );
    }
    return (
        <Badge tone="neutral" className={cn('text-violet-700 dark:text-violet-300', className)}>
            <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
            IA
        </Badge>
    );
}

/** Tarjeta de un ítem de lista (material, herramienta, personal, H&S). Pensada para lectura en celular. */
export function ItemCard({
    titulo,
    detalle,
    meta,
    badges,
    className,
}: {
    titulo: React.ReactNode;
    detalle?: React.ReactNode;
    meta?: React.ReactNode;
    badges?: React.ReactNode;
    className?: string;
}) {
    return (
        <li className={cn('surface p-3.5', className)}>
            <div className="flex items-start justify-between gap-3">
                <p className="text-body font-medium text-foreground min-w-0 break-words">{titulo}</p>
                {meta && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{meta}</span>}
            </div>
            {detalle && <p className="text-body text-muted-foreground mt-1 whitespace-pre-line break-words">{detalle}</p>}
            {badges && <div className="flex flex-wrap items-center gap-1.5 mt-2">{badges}</div>}
        </li>
    );
}

export function SeccionTitulo({ children, count }: { children: React.ReactNode; count?: number }) {
    return (
        <h2 className="eyebrow flex items-center gap-2 mt-6 mb-2 first:mt-0">
            {children}
            {typeof count === 'number' && <span className="tabular-nums normal-case">({count})</span>}
        </h2>
    );
}
