import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { formatARS } from '@/lib/formatCurrency';
import { formatFechaCorta, fromISODate, MODALIDAD_LABEL, redondear, toISODate, viajeConfigurable } from '@/lib/viajes';
import { viajeConfigSchema } from '@/lib/viajesSchemas';
import {
    cargarViaje, errorValidacion, getActor, noEncontrado, notificarViaje, prohibido, puedeVer, registrarHistorial, serializarViaje,
} from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        const viaje = await cargarViaje(id);
        // 404 también cuando no tiene acceso, para no revelar que existe.
        if (!viaje || !puedeVer(viaje, actor)) return noEncontrado();
        return NextResponse.json(serializarViaje(viaje, actor));
    } catch (error) {
        console.error('[VIAJE_GET]', error);
        return NextResponse.json({ error: 'Error al obtener el viaje.' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.esGestor) return prohibido('Solo administración puede editar el viaje.');

        const actual = await cargarViaje(id);
        if (!actual) return noEncontrado();
        if (!viajeConfigurable(actual.estado)) {
            return NextResponse.json({ error: 'El viaje está cerrado o cancelado: ya no se puede editar.' }, { status: 409 });
        }

        const parsed = viajeConfigSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);
        const d = parsed.data;

        const responsable = await prisma.operator.findUnique({ where: { id: d.responsableId }, select: { id: true, nombreCompleto: true, activo: true } });
        if (!responsable || (!responsable.activo && responsable.id !== actual.responsableId)) {
            return NextResponse.json({ error: 'El responsable elegido no existe o está inactivo.' }, { status: 400 });
        }

        const participantes = [...d.participantes];
        if (!participantes.some(p => p.operatorId === responsable.id)) {
            participantes.unshift({ operatorId: responsable.id, nombre: responsable.nombreCompleto });
        }
        const operatorIds = participantes.map(p => p.operatorId).filter(Boolean) as string[];
        if (new Set(operatorIds).size !== operatorIds.length) {
            return NextResponse.json({ error: 'Hay participantes repetidos.' }, { status: 400 });
        }

        // No se puede quitar a alguien que tiene gastos individuales asignados.
        const idsConservados = new Set(participantes.map(p => p.id).filter(Boolean));
        const quitados = actual.participantes.filter(p => !idsConservados.has(p.id));
        if (quitados.length > 0) {
            const conGastos = await prisma.viajeGastoAfectado.findMany({
                where: { participanteId: { in: quitados.map(p => p.id) } },
                select: { participante: { select: { nombre: true } } },
                distinct: ['participanteId'],
            });
            if (conGastos.length > 0) {
                return NextResponse.json({
                    error: `No se puede quitar a ${conGastos.map(c => c.participante.nombre).join(', ')}: tiene gastos individuales cargados.`,
                }, { status: 409 });
            }
        }

        const cambios: string[] = [];
        if (actual.responsableId !== responsable.id) cambios.push(`responsable: ${responsable.nombreCompleto}`);
        if (toISODate(actual.fechaInicio) !== d.fechaInicio || toISODate(actual.fechaFin) !== d.fechaFin) {
            cambios.push(`fechas: ${formatFechaCorta(d.fechaInicio)} – ${formatFechaCorta(d.fechaFin)}`);
        }
        const anticipoNuevo = d.modalidadFondos === 'anticipo' ? redondear(d.montoAnticipo) : 0;
        if (actual.modalidadFondos !== d.modalidadFondos) cambios.push(`modalidad: ${MODALIDAD_LABEL[d.modalidadFondos]}`);
        if (actual.montoAnticipo !== anticipoNuevo) cambios.push(`anticipo: ${formatARS(actual.montoAnticipo)} → ${formatARS(anticipoNuevo)}`);

        await prisma.$transaction(async (tx) => {
            await tx.viaje.update({
                where: { id },
                data: {
                    motivo: d.motivo,
                    descripcion: d.descripcion,
                    origen: d.origen,
                    destino: d.destino,
                    fechaInicio: fromISODate(d.fechaInicio),
                    fechaFin: fromISODate(d.fechaFin),
                    // Mientras no empezó, la fecha original sigue a la planificada.
                    ...(actual.estado === 'planificado' && actual.extensiones.length === 0 ? { fechaFinOriginal: fromISODate(d.fechaFin) } : {}),
                    modalidadFondos: d.modalidadFondos,
                    montoAnticipo: anticipoNuevo,
                    responsableId: responsable.id,
                    projectId: d.projectId,
                    medioTransporte: d.medioTransporte,
                    kmIda: d.kmIda,
                    idaYVuelta: d.idaYVuelta,
                    tarifaId: d.tarifaId,
                },
            });

            if (quitados.length > 0) {
                await tx.viajeParticipante.deleteMany({ where: { id: { in: quitados.map(p => p.id) } } });
            }
            for (let i = 0; i < participantes.length; i++) {
                const p = participantes[i];
                const existente = p.id ? actual.participantes.find(x => x.id === p.id) : undefined;
                if (existente) {
                    await tx.viajeParticipante.update({ where: { id: existente.id }, data: { nombre: p.nombre, operatorId: p.operatorId || null, orden: i } });
                } else {
                    await tx.viajeParticipante.create({ data: { viajeId: id, nombre: p.nombre, operatorId: p.operatorId || null, orden: i } });
                }
            }

            await tx.viajeCostoEstimado.deleteMany({ where: { viajeId: id } });
            if (d.costos.length > 0) {
                await tx.viajeCostoEstimado.createMany({
                    data: d.costos.map((c, i) => ({ ...c, viajeId: id, monto: redondear(c.monto), orden: i })),
                });
            }

            await registrarHistorial(tx, id, actor, 'editado', cambios.length ? cambios.join(' · ') : 'Configuración actualizada');
        });

        await logAudit({ userId: actor.userId || undefined, userName: actor.nombre, action: 'UPDATE', entity: 'Viaje', entityId: id, newValue: d, oldValue: { estado: actual.estado } });

        if (actual.responsableId !== responsable.id) {
            await notificarViaje({ ...actual, origen: d.origen, destino: d.destino, responsableId: responsable.id }, actor, 'reasignado');
        }

        const viaje = await cargarViaje(id);
        return NextResponse.json(serializarViaje(viaje!, actor));
    } catch (error) {
        console.error('[VIAJE_PATCH]', error);
        return NextResponse.json({ error: 'Error al actualizar el viaje.' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.esGestor) return prohibido('Solo administración puede eliminar viajes.');

        const viaje = await prisma.viaje.findUnique({ where: { id }, select: { id: true, codigo: true, estado: true, _count: { select: { gastos: true } } } });
        if (!viaje) return noEncontrado();
        if (viaje.estado !== 'planificado' || viaje._count.gastos > 0) {
            return NextResponse.json({ error: 'Solo se eliminan viajes planificados y sin gastos. Para el resto, cancelalo.' }, { status: 409 });
        }

        await prisma.viaje.delete({ where: { id } });
        await logAudit({ userId: actor.userId || undefined, userName: actor.nombre, action: 'DELETE', entity: 'Viaje', entityId: id, oldValue: { codigo: viaje.codigo } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[VIAJE_DELETE]', error);
        return NextResponse.json({ error: 'Error al eliminar el viaje.' }, { status: 500 });
    }
}
