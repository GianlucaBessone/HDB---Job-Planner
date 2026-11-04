import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categoriaLabel } from '@/lib/viajes';
import { gastoSchema } from '@/lib/viajesSchemas';
import { prepararGasto, puedeCargarGastos } from '@/lib/viajesGastos';
import {
    cargarViaje, errorValidacion, getActor, noEncontrado, puedeVer, registrarHistorial, serializarViaje,
} from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        const viaje = await cargarViaje(id);
        if (!viaje || !puedeVer(viaje, actor)) return noEncontrado();
        const bloqueo = puedeCargarGastos(viaje, actor);
        if (bloqueo) return bloqueo;

        const parsed = gastoSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);

        const prep = await prepararGasto(viaje, actor, parsed.data);
        if ('error' in prep) return NextResponse.json({ error: prep.error }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            const gasto = await tx.viajeGasto.create({
                data: {
                    ...prep.data,
                    viajeId: id,
                    registradoPorId: actor.userId,
                    registradoPorNombre: actor.nombre,
                    afectados: { create: prep.afectados.map(participanteId => ({ participanteId })) },
                },
            });
            if (prep.comprobanteIds.length > 0) {
                await tx.viajeComprobante.updateMany({ where: { id: { in: prep.comprobanteIds } }, data: { gastoId: gasto.id, viajeId: id } });
            }
            await registrarHistorial(tx, id, actor, 'gasto_registrado',
                `${categoriaLabel(gasto.categoria)} $${gasto.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}${gasto.medioPago === 'propio' ? ' (medios propios)' : ''}`);
        });

        const actualizado = await cargarViaje(id);
        return NextResponse.json(serializarViaje(actualizado!, actor), { status: 201 });
    } catch (error) {
        console.error('[VIAJE_GASTO_POST]', error);
        return NextResponse.json({ error: 'Error al registrar el gasto.' }, { status: 500 });
    }
}
