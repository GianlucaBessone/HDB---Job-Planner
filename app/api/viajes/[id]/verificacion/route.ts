import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { redondear, VERIFICACION_LABEL, type VerificacionEstado } from '@/lib/viajes';
import { verificacionSchema } from '@/lib/viajesSchemas';
import {
    cargarViaje, errorValidacion, getActor, noEncontrado, prohibido, registrarHistorial, serializarViaje,
} from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

/** Rendición: verifica uno o varios gastos (checklist). Solo con el viaje por rendir. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.esGestor) return prohibido('Solo administración rinde los viajes.');

        const viaje = await cargarViaje(id);
        if (!viaje) return noEncontrado();
        if (viaje.estado !== 'finalizado') {
            return NextResponse.json({ error: 'Los gastos se verifican cuando el responsable concluye el viaje.' }, { status: 409 });
        }

        const parsed = verificacionSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);

        const gastos = new Map(viaje.gastos.map(g => [g.id, g]));
        for (const item of parsed.data.items) {
            const g = gastos.get(item.gastoId);
            if (!g) return NextResponse.json({ error: 'Algún gasto no pertenece a este viaje.' }, { status: 400 });
            if (item.estado === 'observado') {
                if (item.montoAprobado == null) {
                    return NextResponse.json({ error: 'Un gasto observado necesita el monto que se aprueba.' }, { status: 400 });
                }
                if (item.montoAprobado > g.monto) {
                    return NextResponse.json({ error: 'El monto aprobado no puede superar el monto del gasto.' }, { status: 400 });
                }
            }
            if ((item.estado === 'observado' || item.estado === 'rechazado') && !item.observacion?.trim()) {
                return NextResponse.json({ error: `Indicá el motivo (${VERIFICACION_LABEL[item.estado]}).` }, { status: 400 });
            }
        }

        const ahora = new Date();
        await prisma.$transaction(async (tx) => {
            for (const item of parsed.data.items) {
                const g = gastos.get(item.gastoId)!;
                const pendiente = item.estado === 'pendiente';
                await tx.viajeGasto.update({
                    where: { id: item.gastoId },
                    data: {
                        estadoVerificacion: item.estado,
                        montoAprobado: pendiente ? null
                            : item.estado === 'rechazado' ? 0
                                : item.estado === 'observado' ? redondear(item.montoAprobado!)
                                    : g.monto,
                        observacion: item.observacion?.trim() || null,
                        verificadoPorId: pendiente ? null : actor.userId,
                        verificadoPorNombre: pendiente ? null : actor.nombre,
                        verificadoEn: pendiente ? null : ahora,
                    },
                });
            }
            const conteo = parsed.data.items.reduce<Record<string, number>>((acc, i) => {
                acc[i.estado] = (acc[i.estado] || 0) + 1;
                return acc;
            }, {});
            const detalle = Object.entries(conteo)
                .map(([estado, n]) => `${n} ${VERIFICACION_LABEL[estado as VerificacionEstado].toLowerCase()}${n === 1 ? '' : 's'}`)
                .join(' · ');
            await registrarHistorial(tx, id, actor, 'verificado', detalle);
        });

        await logAudit({ userId: actor.userId || undefined, userName: actor.nombre, action: 'APPROVE', entity: 'ViajeGasto', entityId: id, newValue: parsed.data.items });

        const actualizado = await cargarViaje(id);
        return NextResponse.json(serializarViaje(actualizado!, actor));
    } catch (error) {
        console.error('[VIAJE_VERIFICACION]', error);
        return NextResponse.json({ error: 'Error al verificar los gastos.' }, { status: 500 });
    }
}
