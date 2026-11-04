// Viajes: validación de gastos compartida por las rutas de gastos.
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { fromISODate, redondear, viajeEditablePorResponsable } from '@/lib/viajes';
import type { gastoSchema } from '@/lib/viajesSchemas';
import { esResponsable, prohibido, type ViajeActor, type ViajeCompleto } from '@/lib/viajesServer';

export type GastoInput = z.infer<typeof gastoSchema>;

/** Valida lo que depende del viaje y devuelve los datos listos para guardar, o un error. */
export async function prepararGasto(viaje: ViajeCompleto, actor: ViajeActor, d: GastoInput, gastoId?: string) {
    const idsParticipantes = new Set(viaje.participantes.map(p => p.id));
    const afectados = d.alcance === 'individual' ? Array.from(new Set(d.afectados)) : [];
    if (afectados.some(a => !idsParticipantes.has(a))) {
        return { error: 'Alguno de los participantes elegidos no pertenece al viaje.' };
    }

    // Solo comprobantes que subió esta persona y que están sueltos o ya son de este gasto.
    const comprobanteIds = Array.from(new Set(d.comprobantes));
    if (comprobanteIds.length > 0) {
        const validos = await prisma.viajeComprobante.count({
            where: {
                id: { in: comprobanteIds },
                OR: [
                    { gastoId: null, subidoPorId: actor.userId || '__' },
                    ...(gastoId ? [{ gastoId }] : []),
                ],
            },
        });
        if (validos !== comprobanteIds.length) return { error: 'Algún comprobante no es válido. Volvé a subirlo.' };
    }

    return {
        data: {
            fecha: fromISODate(d.fecha),
            categoria: d.categoria,
            monto: redondear(d.monto),
            descripcion: d.descripcion,
            comercio: d.comercio,
            numeroComprobante: d.numeroComprobante,
            alcance: d.alcance,
            // Contra rendición no hay fondos entregados: todo se paga con medios propios.
            medioPago: viaje.modalidadFondos === 'rendicion' ? 'propio' : d.medioPago,
        },
        afectados,
        comprobanteIds,
    };
}

export function puedeCargarGastos(viaje: ViajeCompleto, actor: ViajeActor) {
    if (!esResponsable(viaje, actor)) return prohibido('Solo el responsable del viaje registra gastos.');
    if (!viajeEditablePorResponsable(viaje.estado)) {
        return NextResponse.json({ error: 'El viaje ya fue concluido: no se pueden cargar ni modificar gastos.' }, { status: 409 });
    }
    return null;
}
