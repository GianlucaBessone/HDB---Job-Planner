'use client';

/**
 * Helpers de pantalla para presupuestos de servicio y el wizard de proyectos.
 * Las escrituras usan fetch directo (sin cola offline): son documentos comerciales
 * y no deben quedar pendientes de enviar sin que el usuario lo sepa.
 */
import { Badge } from '@/components/ui';
import { ESTADOS_PRESUPUESTO, ESTADOS_VERSION, type EstadoPresupuesto, type EstadoVersion } from '@/lib/presupuestosServicio/calculos';

export class ErrorApi extends Error {
    constructor(message: string, public status: number, public campo?: string | null) {
        super(message);
    }
}

export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, ...rest } = init;
    const opciones: RequestInit = { cache: 'no-store', ...rest };
    if (json !== undefined) {
        opciones.body = JSON.stringify(json);
        opciones.headers = { 'Content-Type': 'application/json', ...(rest.headers || {}) };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine && (opciones.method || 'GET') !== 'GET') {
        throw new ErrorApi('Sin conexión: esta acción necesita internet. Probá de nuevo cuando vuelva la señal.', 0);
    }
    let res: Response;
    try {
        res = await fetch(url, opciones);
    } catch {
        throw new ErrorApi('No se pudo conectar con el servidor. Revisá la conexión.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ErrorApi(data?.error || `Error ${res.status}`, res.status, data?.campo);
    return data as T;
}

export function pesos(n: number | null | undefined, decimales = 2): string {
    const v = Number(n) || 0;
    return `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`;
}

export function horasTxt(n: number | null | undefined): string {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return `${v.toLocaleString('es-AR')} h`;
}

export function fechaCorta(f: string | null | undefined): string {
    if (!f) return '—';
    const s = f.slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : '—';
}

export function fechaHora(f: string | Date | null | undefined): string {
    if (!f) return '—';
    const d = new Date(f);
    return isNaN(d.getTime())
        ? '—'
        : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });
}

export function EstadoPresupuestoBadge({ estado }: { estado: string }) {
    const cfg = ESTADOS_PRESUPUESTO[estado as EstadoPresupuesto] || { label: estado, tone: 'neutral' as const };
    return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function EstadoVersionBadge({ estado }: { estado: string }) {
    const cfg = ESTADOS_VERSION[estado as EstadoVersion] || { label: estado, tone: 'neutral' as const };
    return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
