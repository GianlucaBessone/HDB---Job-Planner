import { estadoComun } from '@/lib/estados';
import type { BadgeTone } from '@/components/ui';

// Nombres y colores del vocabulario común (lib/estados.ts); "vigente" espera la respuesta del cliente
const ESTADOS: Record<string, { label: string; tone: BadgeTone }> = {
    VIGENTE: estadoComun('en_revision', { genero: 'f', etiqueta: 'Vigente' }),
    VENCIDA: estadoComun('vencido', { genero: 'f' }),
    APROBADA: estadoComun('aprobado', { genero: 'f' }),
    CONVERTIDA: estadoComun('cerrado', { genero: 'f', etiqueta: 'Convertida en venta' }),
    RECHAZADA: estadoComun('rechazado', { genero: 'f' }),
    ANULADA: estadoComun('cancelado', { genero: 'f', etiqueta: 'Anulada' }),
};

/** Estado visible de una cotización: una vigente con fecha pasada se muestra como vencida. */
export function estadoCotizacion(cot: { estado?: string; estaVencida?: boolean; fechaVencimiento?: string | Date | null }) {
    const vencida =
        cot.estado === 'VIGENTE' &&
        (cot.estaVencida || (cot.fechaVencimiento ? new Date(cot.fechaVencimiento) < new Date() : false));
    const key = vencida ? 'VENCIDA' : cot.estado || 'VIGENTE';
    return ESTADOS[key] || { label: key, tone: 'neutral' as BadgeTone };
}
