import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { calcularResumen, fromISODate, generarCodigoViaje, redondear, toISODate, VIAJE_ESTADOS } from '@/lib/viajes';
import { viajeConfigSchema } from '@/lib/viajesSchemas';
import { errorValidacion, getActor, notificarViaje, prohibido, registrarHistorial } from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const actor = await getActor(req);
        if (!actor.userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

        const url = new URL(req.url);
        const mios = url.searchParams.get('mios') === '1';
        const estado = url.searchParams.get('estado');
        const q = url.searchParams.get('q')?.trim();

        if (!mios && !actor.esGestor) return prohibido();

        const where: Prisma.ViajeWhereInput = {};
        if (mios) {
            where.OR = [
                { responsableId: actor.userId },
                { participantes: { some: { operatorId: actor.userId } } },
            ];
        }
        if (estado && (VIAJE_ESTADOS as readonly string[]).includes(estado)) where.estado = estado;
        if (q) {
            where.AND = [{
                OR: [
                    { codigo: { contains: q, mode: 'insensitive' } },
                    { motivo: { contains: q, mode: 'insensitive' } },
                    { origen: { contains: q, mode: 'insensitive' } },
                    { destino: { contains: q, mode: 'insensitive' } },
                    { responsable: { nombreCompleto: { contains: q, mode: 'insensitive' } } },
                ],
            }];
        }

        const viajes = await prisma.viaje.findMany({
            where,
            orderBy: [{ fechaInicio: 'desc' }, { createdAt: 'desc' }],
            take: 300,
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                project: { select: { id: true, nombre: true, codigoProyecto: true } },
                participantes: { select: { id: true, nombre: true, operatorId: true } },
                costos: { select: { categoria: true, base: true, monto: true } },
                gastos: {
                    select: {
                        monto: true, medioPago: true, alcance: true, categoria: true,
                        estadoVerificacion: true, montoAprobado: true,
                        afectados: { select: { participanteId: true } },
                    },
                },
            },
        });

        return NextResponse.json(viajes.map(v => {
            const resumen = calcularResumen({ ...v, gastos: v.gastos });
            return {
                id: v.id,
                codigo: v.codigo,
                motivo: v.motivo,
                origen: v.origen,
                destino: v.destino,
                fechaInicio: toISODate(v.fechaInicio),
                fechaFin: toISODate(v.fechaFin),
                fechaFinOriginal: toISODate(v.fechaFinOriginal),
                estado: v.estado,
                modalidadFondos: v.modalidadFondos,
                montoAnticipo: v.montoAnticipo,
                responsable: v.responsable,
                project: v.project,
                esResponsable: v.responsableId === actor.userId,
                cantidadGastos: v.gastos.length,
                resumen: {
                    dias: resumen.dias,
                    personas: resumen.personas,
                    estimado: resumen.estimado,
                    gastado: resumen.gastado,
                    saldoFondos: resumen.saldoFondos,
                    disponible: resumen.disponible,
                    porcentajeConsumo: resumen.porcentajeConsumo,
                    pendientes: resumen.pendientes,
                    gastadoPropio: resumen.gastadoPropio,
                },
                updatedAt: v.updatedAt,
            };
        }));
    } catch (error) {
        console.error('[VIAJES_GET]', error);
        return NextResponse.json({ error: 'Error al obtener los viajes.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const actor = await getActor(req);
        if (!actor.userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
        if (!actor.esGestor) return prohibido('Solo administración puede crear viajes.');

        const parsed = viajeConfigSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);
        const d = parsed.data;

        const responsable = await prisma.operator.findUnique({ where: { id: d.responsableId }, select: { id: true, nombreCompleto: true, activo: true } });
        if (!responsable || !responsable.activo) {
            return NextResponse.json({ error: 'El responsable elegido no existe o está inactivo.' }, { status: 400 });
        }

        // El responsable siempre viaja: si no está en la lista, se agrega primero.
        const participantes = [...d.participantes];
        if (!participantes.some(p => p.operatorId === responsable.id)) {
            participantes.unshift({ operatorId: responsable.id, nombre: responsable.nombreCompleto });
        }
        const operatorIds = participantes.map(p => p.operatorId).filter(Boolean) as string[];
        if (new Set(operatorIds).size !== operatorIds.length) {
            return NextResponse.json({ error: 'Hay participantes repetidos.' }, { status: 400 });
        }

        const viaje = await prisma.$transaction(async (tx) => {
            const year = Number(d.fechaInicio.slice(0, 4)) || new Date().getFullYear();
            const counter = await tx.viajeCounter.upsert({
                where: { year },
                create: { year, currentNumber: 1 },
                update: { currentNumber: { increment: 1 } },
            });

            const creado = await tx.viaje.create({
                data: {
                    codigo: generarCodigoViaje(year, counter.currentNumber),
                    motivo: d.motivo,
                    descripcion: d.descripcion,
                    origen: d.origen,
                    destino: d.destino,
                    fechaInicio: fromISODate(d.fechaInicio),
                    fechaFin: fromISODate(d.fechaFin),
                    fechaFinOriginal: fromISODate(d.fechaFin),
                    modalidadFondos: d.modalidadFondos,
                    montoAnticipo: d.modalidadFondos === 'anticipo' ? redondear(d.montoAnticipo) : 0,
                    responsableId: responsable.id,
                    creadoPorId: actor.userId,
                    projectId: d.projectId,
                    medioTransporte: d.medioTransporte,
                    kmIda: d.kmIda,
                    idaYVuelta: d.idaYVuelta,
                    tarifaId: d.tarifaId,
                    participantes: {
                        create: participantes.map((p, i) => ({ operatorId: p.operatorId || null, nombre: p.nombre, orden: i })),
                    },
                    costos: {
                        create: d.costos.map((c, i) => ({ ...c, monto: redondear(c.monto), orden: i })),
                    },
                },
            });
            await registrarHistorial(tx, creado.id, actor, 'creado', `Responsable: ${responsable.nombreCompleto}`);
            return creado;
        });

        await logAudit({ userId: actor.userId, userName: actor.nombre, action: 'CREATE', entity: 'Viaje', entityId: viaje.id, newValue: { codigo: viaje.codigo, motivo: viaje.motivo } });

        await notificarViaje(viaje, actor, 'creado');

        return NextResponse.json(viaje, { status: 201 });
    } catch (error) {
        console.error('[VIAJES_POST]', error);
        return NextResponse.json({ error: 'Error al crear el viaje.' }, { status: 500 });
    }
}
