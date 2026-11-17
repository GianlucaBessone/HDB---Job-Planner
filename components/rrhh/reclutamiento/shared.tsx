'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, LayoutDashboard, Users } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import {
    ESTADOS_CANDIDATO, ESTADOS_VACANTE, etapaInfo, iniciales, nivelVeracidad, PRIORIDADES, RECOMENDACION, tonoPuntaje,
} from '@/lib/rrhh/reclutamiento';

// ── Cliente de la API ───────────────────────────────────────────────

export async function apiJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const esForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
    const res = await fetch(url, {
        ...init,
        headers: init?.body && !esForm ? { 'Content-Type': 'application/json', ...(init?.headers || {}) } : init?.headers,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    if (!res.ok) {
        if (res.status === 413) throw new Error('El archivo es demasiado grande para subirlo.');
        throw new Error(data?.error || 'No se pudo completar la operación.');
    }
    return data as T;
}

export const API = '/api/rrhh/reclutamiento';

export interface Permisos {
    gestionar: boolean;
    eliminar: boolean;
}

// ── Navegación del módulo ───────────────────────────────────────────

export type SeccionReclutamiento = 'tablero' | 'vacantes' | 'postulantes';

const RUTAS: Record<SeccionReclutamiento, string> = {
    tablero: '/rrhh/reclutamiento',
    vacantes: '/rrhh/reclutamiento/vacantes',
    postulantes: '/rrhh/reclutamiento/postulantes',
};

/** Nombre legible de una ruta para las migas de pan. */
export function useTituloRuta(url: string, titulo: string | null | undefined) {
    const setTitle = useHistoryStore(s => s.setTitle);
    useEffect(() => {
        if (!titulo) return;
        const t = setTimeout(() => setTitle(url, titulo), 0);
        return () => clearTimeout(t);
    }, [url, titulo, setTitle]);
}

/** Migas de pan base del módulo. */
export function useMigasReclutamiento() {
    useTituloRuta('/rrhh', 'Recursos Humanos');
    useTituloRuta(RUTAS.tablero, 'Reclutamiento');
    useTituloRuta(RUTAS.vacantes, 'Vacantes');
    useTituloRuta(RUTAS.postulantes, 'Base de talentos');
}

/** Pestañas del encabezado, compartidas por las tres vistas de reclutamiento. */
export function useNavReclutamiento(activa: SeccionReclutamiento, counts: Partial<Record<SeccionReclutamiento, number>> = {}) {
    const router = useRouter();
    useMigasReclutamiento();
    return {
        tabs: [
            { id: 'tablero', label: 'Tablero', icon: <LayoutDashboard /> },
            { id: 'vacantes', label: 'Vacantes', icon: <Briefcase />, count: counts.vacantes },
            { id: 'postulantes', label: 'Base de talentos', icon: <Users />, count: counts.postulantes },
        ],
        activeTabId: activa,
        onTabChange: (id: string) => router.push(RUTAS[id as SeccionReclutamiento] || RUTAS.tablero),
    };
}

// ── Insignias ───────────────────────────────────────────────────────

export function EtapaBadge({ etapa, className }: { etapa: string; className?: string }) {
    const e = etapaInfo(etapa);
    return <Badge tone={e.tone} dot className={className}>{e.singular}</Badge>;
}

export function EstadoCandidatoBadge({ estado }: { estado: string }) {
    const e = ESTADOS_CANDIDATO[estado as keyof typeof ESTADOS_CANDIDATO];
    return <Badge tone={e?.tone ?? 'neutral'} dot>{e?.label ?? estado}</Badge>;
}

export function EstadoVacanteBadge({ estado }: { estado: string }) {
    const e = ESTADOS_VACANTE[estado as keyof typeof ESTADOS_VACANTE];
    return <Badge tone={e?.tone ?? 'neutral'} dot>{e?.label ?? estado}</Badge>;
}

export function PrioridadBadge({ prioridad }: { prioridad: string }) {
    const p = PRIORIDADES[prioridad as keyof typeof PRIORIDADES];
    return <Badge tone={p?.tone ?? 'neutral'}>Prioridad {(p?.label ?? prioridad).toLowerCase()}</Badge>;
}

export function RecomendacionBadge({ valor }: { valor: string | null | undefined }) {
    if (!valor) return null;
    const r = RECOMENDACION[valor as keyof typeof RECOMENDACION];
    return r ? <Badge tone={r.tone}>{r.label}</Badge> : null;
}

/** Puntaje de compatibilidad con una vacante. */
export function MatchBadge({ puntaje, sinDato = '—' }: { puntaje: number | null | undefined; sinDato?: string }) {
    if (puntaje == null) return <span className="text-xs text-muted-foreground">{sinDato}</span>;
    return <Badge tone={tonoPuntaje(puntaje)} className="tabular-nums">{Math.round(puntaje)}% match</Badge>;
}

/** Índice de veracidad del CV (consistencia interna estimada por la IA). */
export function VeracidadBadge({ puntaje, conTexto = false }: { puntaje: number | null | undefined; conTexto?: boolean }) {
    if (puntaje == null) return <span className="text-xs text-muted-foreground">—</span>;
    return (
        <Badge tone={tonoPuntaje(puntaje)} className="tabular-nums">
            {Math.round(puntaje)}%{conTexto ? ` · ${nivelVeracidad(puntaje)}` : ''}
        </Badge>
    );
}

// ── Elementos visuales ──────────────────────────────────────────────

export function Avatar({ persona, size = 'md' }: { persona: { firstName: string; lastName: string }; size?: 'sm' | 'md' | 'lg' }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-flex items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200 font-semibold shrink-0',
                size === 'sm' && 'w-7 h-7 text-xs',
                size === 'md' && 'w-9 h-9 text-sm',
                size === 'lg' && 'w-14 h-14 text-heading',
            )}
        >
            {iniciales(persona)}
        </span>
    );
}

/** Barra de progreso de un puntaje 0–100 con el color de su tono. */
export function BarraPuntaje({ valor, className, label }: { valor: number; className?: string; label: string }) {
    const tono = tonoPuntaje(valor);
    const color = { success: 'bg-success-500', warning: 'bg-warning-500', danger: 'bg-danger-500', neutral: 'bg-slate-400', info: 'bg-info-500', brand: 'bg-primary' }[tono];
    return (
        <div
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(valor)}
            className={cn('h-2 w-full rounded-full bg-muted overflow-hidden', className)}
        >
            <div className={cn('h-full rounded-full transition-[width] duration-200', color)} style={{ width: `${Math.max(2, Math.min(100, valor))}%` }} />
        </div>
    );
}

export function Lista({ items, vacio = 'Sin datos.', tono }: { items: string[]; vacio?: string; tono: 'success' | 'warning' | 'danger' | 'neutral' }) {
    if (!items.length) return <p className="text-sm text-muted-foreground">{vacio}</p>;
    const punto = { success: 'bg-success-500', warning: 'bg-warning-500', danger: 'bg-danger-500', neutral: 'bg-slate-400' }[tono];
    return (
        <ul className="space-y-1.5">
            {items.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-body text-slate-700 dark:text-slate-300">
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-[7px] shrink-0', punto)} aria-hidden="true" />
                    <span>{t}</span>
                </li>
            ))}
        </ul>
    );
}

export const formatFecha = (iso: string | Date) =>
    new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

export const formatFechaHora = (iso: string | Date) =>
    new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });

export function haceCuanto(iso: string | Date) {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (min < 1) return 'recién';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
    return formatFecha(iso);
}
