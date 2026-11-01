import type { BadgeTone } from '@/components/ui';

const ESTADOS: Record<string, { label: string; tone: BadgeTone }> = {
    VIGENTE: { label: 'Vigente', tone: 'info' },
    VENCIDA: { label: 'Vencida', tone: 'warning' },
    APROBADA: { label: 'Aprobada', tone: 'brand' },
    CONVERTIDA: { label: 'Convertida en venta', tone: 'success' },
    RECHAZADA: { label: 'Rechazada', tone: 'danger' },
    ANULADA: { label: 'Anulada', tone: 'neutral' },
};

/** Estado visible de una cotización: una vigente con fecha pasada se muestra como vencida. */
export function estadoCotizacion(cot: { estado?: string; estaVencida?: boolean; fechaVencimiento?: string | Date | null }) {
    const vencida =
        cot.estado === 'VIGENTE' &&
        (cot.estaVencida || (cot.fechaVencimiento ? new Date(cot.fechaVencimiento) < new Date() : false));
    const key = vencida ? 'VENCIDA' : cot.estado || 'VIGENTE';
    return ESTADOS[key] || { label: key, tone: 'neutral' as BadgeTone };
}
