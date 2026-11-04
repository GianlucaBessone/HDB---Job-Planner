import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categoriaLabel } from '@/lib/viajes';
import { gastoSchema } from '@/lib/viajesSchemas';
import { prepararGasto, puedeCargarGastos } from '@/lib/viajesGastos';
import {
    cargarViaje, errorValidacion, getActor, noEncontrado, puedeVer, registrarHistorial, serializarViaje,
} from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; gastoId: string }> };

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 });

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id, gastoId } = await params;
        const actor = await getActor(req);
        const viaje = await cargarViaje(id);
        if (!viaje || !puedeVer(viaje, actor)) return noEncontrado();
        const gasto = viaje.gastos.find(g => g.id === gastoId);
        if (!gasto) return NextResponse.json({ error: 'Gasto no encontrado.' }, { status: 404 });
        const bloqueo = puedeCargarGastos(viaje, actor);
        if (bloqueo) return bloqueo;

        const parsed = gastoSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);

        const prep = await prepararGasto(viaje, actor, parsed.data, gastoId);
        if ('error' in prep) return NextResponse.json({ error: prep.error }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await tx.viajeGasto.update({
                where: { id: gastoId },
                data: {
                    ...prep.data,
                    // Si se edita después de una devolución, vuelve a quedar para verificar.
                    estadoVerificacion: 'pendiente',
                    montoAprobado: null,
                    verificadoPorId: null,
                    verificadoPorNombre: null,
                    verificadoEn: null,
                },
            });
            await tx.viajeGastoAfectado.deleteMany({ where: { gastoId } });
            if (prep.afectados.length > 0) {
                await tx.viajeGastoAfectado.createMany({ data: prep.afectados.map(participanteId => ({ gastoId, participanteId })) });
            }
            // Los comprobantes que se quitaron se borran; los nuevos se vinculan.
            await tx.viajeComprobante.deleteMany({ where: { gastoId, id: { notIn: prep.comprobanteIds } } });
            if (prep.comprobanteIds.length > 0) {
                await tx.viajeComprobante.updateMany({ where: { id: { in: prep.comprobanteIds } }, data: { gastoId, viajeId: id } });
            }
            const cambioMonto = gasto.monto !== prep.data.monto ? ` ($${fmt(gasto.monto)} → $${fmt(prep.data.monto)})` : '';
            await registrarHistorial(tx, id, actor, 'gasto_editado', `${categoriaLabel(prep.data.categoria)}${cambioMonto}`);
        });

        const actualizado = await cargarViaje(id);
        return NextResponse.json(serializarViaje(actualizado!, actor));
    } catch (error) {
        console.error('[VIAJE_GASTO_PATCH]', error);
        return NextResponse.json({ error: 'Error al actualizar el gasto.' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { id, gastoId } = await params;
        const actor = await getActor(req);
        const viaje = await cargarViaje(id);
        if (!viaje || !puedeVer(viaje, actor)) return noEncontrado();
        const gasto = viaje.gastos.find(g => g.id === gastoId);
        if (!gasto) return NextResponse.json({ error: 'Gasto no encontrado.' }, { status: 404 });
        const bloqueo = puedeCargarGastos(viaje, actor);
        if (bloqueo) return bloqueo;

        await prisma.$transaction(async (tx) => {
            await tx.viajeGasto.delete({ where: { id: gastoId } });
            await registrarHistorial(tx, id, actor, 'gasto_eliminado', `${categoriaLabel(gasto.categoria)} $${fmt(gasto.monto)}`);
        });

        const actualizado = await cargarViaje(id);
        return NextResponse.json(serializarViaje(actualizado!, actor));
    } catch (error) {
        console.error('[VIAJE_GASTO_DELETE]', error);
        return NextResponse.json({ error: 'Error al eliminar el gasto.' }, { status: 500 });
    }
}
