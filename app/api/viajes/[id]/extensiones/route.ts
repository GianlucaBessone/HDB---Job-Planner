import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { formatFechaCorta, fromISODate, toISODate, viajeEditablePorResponsable } from '@/lib/viajes';
import { extensionSchema } from '@/lib/viajesSchemas';
import {
    cargarViaje, errorValidacion, esResponsable, getActor, noEncontrado, notificarViaje, prohibido, puedeVer, registrarHistorial, serializarViaje,
} from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        const viaje = await cargarViaje(id);
        if (!viaje || !puedeVer(viaje, actor)) return noEncontrado();
        if (!esResponsable(viaje, actor) && !actor.esGestor) return prohibido('Solo el responsable puede extender la estadía.');
        if (!viajeEditablePorResponsable(viaje.estado)) {
            return NextResponse.json({ error: 'Solo se extiende un viaje planificado o en curso.' }, { status: 409 });
        }

        const parsed = extensionSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);
        const { fechaFinNueva, motivo } = parsed.data;

        const finActual = toISODate(viaje.fechaFin);
        if (fechaFinNueva <= finActual) {
            return NextResponse.json({ error: `La nueva fecha tiene que ser posterior al ${formatFechaCorta(finActual)}.` }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.viajeExtension.create({
                data: {
                    viajeId: id,
                    fechaFinAnterior: viaje.fechaFin,
                    fechaFinNueva: fromISODate(fechaFinNueva),
                    motivo,
                    usuarioId: actor.userId,
                    usuarioNombre: actor.nombre,
                },
            });
            await tx.viaje.update({ where: { id }, data: { fechaFin: fromISODate(fechaFinNueva) } });
            await registrarHistorial(tx, id, actor, 'extendido', `${formatFechaCorta(finActual)} → ${formatFechaCorta(fechaFinNueva)} · ${motivo}`);
        });

        await logAudit({ userId: actor.userId || undefined, userName: actor.nombre, action: 'UPDATE', entity: 'Viaje', entityId: id, oldValue: { fechaFin: finActual }, newValue: { fechaFin: fechaFinNueva, motivo } });

        await notificarViaje(viaje, actor, 'extendido', `Hasta el ${formatFechaCorta(fechaFinNueva)}: ${motivo}`);

        const actualizado = await cargarViaje(id);
        return NextResponse.json(serializarViaje(actualizado!, actor), { status: 201 });
    } catch (error) {
        console.error('[VIAJE_EXTENSION]', error);
        return NextResponse.json({ error: 'Error al extender la estadía.' }, { status: 500 });
    }
}
