// Viajes: helpers de servidor (API routes). No importar desde componentes cliente.
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import type { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';
import { calcularResumen, esGestorViajes, toISODate, VIAJE_GESTORES } from '@/lib/viajes';

export interface ViajeActor {
    userId: string | null;
    role: string;
    nombre: string;
    esGestor: boolean;
}

export async function getActor(req: NextRequest): Promise<ViajeActor> {
    const userId = req.headers.get('x-user-id') || null;
    const role = (req.headers.get('x-user-role') || 'operador').toLowerCase();
    let nombre = 'Usuario';
    if (userId) {
        const op = await prisma.operator.findUnique({ where: { id: userId }, select: { nombreCompleto: true } });
        if (op) nombre = op.nombreCompleto;
    }
    return { userId, role, nombre, esGestor: esGestorViajes(role) };
}

export function errorValidacion(error: ZodError) {
    return NextResponse.json(
        {
            error: error.issues[0]?.message || 'Datos inválidos',
            detalle: error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
        { status: 400 }
    );
}

export const noEncontrado = () => NextResponse.json({ error: 'Viaje no encontrado.' }, { status: 404 });
export const prohibido = (msg = 'No tenés permiso para esta acción.') => NextResponse.json({ error: msg }, { status: 403 });

export const VIAJE_INCLUDE = {
    responsable: { select: { id: true, nombreCompleto: true } },
    creadoPor: { select: { id: true, nombreCompleto: true } },
    project: { select: { id: true, nombre: true, codigoProyecto: true } },
    participantes: { orderBy: { orden: 'asc' }, select: { id: true, nombre: true, operatorId: true, orden: true } },
    costos: { orderBy: { orden: 'asc' } },
    gastos: {
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        include: {
            afectados: { select: { participanteId: true } },
            comprobantes: { select: { id: true, nombre: true, mime: true, size: true } },
        },
    },
    extensiones: { orderBy: { createdAt: 'desc' } },
    historial: { orderBy: { createdAt: 'desc' }, take: 100 },
} satisfies Prisma.ViajeInclude;

export type ViajeCompleto = Prisma.ViajeGetPayload<{ include: typeof VIAJE_INCLUDE }>;

export async function cargarViaje(id: string) {
    return prisma.viaje.findUnique({ where: { id }, include: VIAJE_INCLUDE });
}

export function esResponsable(viaje: { responsableId: string }, actor: ViajeActor) {
    return !!actor.userId && viaje.responsableId === actor.userId;
}

export function puedeVer(viaje: { responsableId: string; participantes: { operatorId: string | null }[] }, actor: ViajeActor) {
    if (actor.esGestor) return true;
    if (!actor.userId) return false;
    return viaje.responsableId === actor.userId || viaje.participantes.some(p => p.operatorId === actor.userId);
}

/** Fechas DATE como 'YYYY-MM-DD' y resumen financiero calculado. */
export function serializarViaje(v: ViajeCompleto, actor?: ViajeActor) {
    const resumen = calcularResumen({
        fechaInicio: v.fechaInicio,
        fechaFin: v.fechaFin,
        modalidadFondos: v.modalidadFondos,
        montoAnticipo: v.montoAnticipo,
        participantes: v.participantes,
        costos: v.costos,
        gastos: v.gastos,
    });
    return {
        ...v,
        fechaInicio: toISODate(v.fechaInicio),
        fechaFin: toISODate(v.fechaFin),
        fechaFinOriginal: toISODate(v.fechaFinOriginal),
        gastos: v.gastos.map(g => ({ ...g, fecha: toISODate(g.fecha) })),
        extensiones: v.extensiones.map(e => ({
            ...e,
            fechaFinAnterior: toISODate(e.fechaFinAnterior),
            fechaFinNueva: toISODate(e.fechaFinNueva),
        })),
        resumen,
        permisos: actor ? {
            esGestor: actor.esGestor,
            esResponsable: esResponsable(v, actor),
        } : undefined,
    };
}

export async function registrarHistorial(
    tx: Prisma.TransactionClient | typeof prisma,
    viajeId: string,
    actor: ViajeActor,
    accion: string,
    detalle?: string
) {
    await tx.viajeHistorial.create({
        data: { viajeId, accion, detalle: detalle || null, usuarioId: actor.userId, usuarioNombre: actor.nombre },
    });
}

/** Actividad interna + push. Nunca rompe la operación si falla. */
export async function notificar(params: {
    operatorIds?: string[];
    aGestores?: boolean;
    excluirId?: string | null;
    titulo: string;
    mensaje: string;
    viajeId: string;
    url: string;
    type: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
}) {
    try {
        let ids = [...(params.operatorIds || [])];
        if (params.aGestores) {
            const gestores = await prisma.operator.findMany({
                where: { activo: true, role: { in: VIAJE_GESTORES.filter(r => r !== 'qa') } },
                select: { id: true },
            });
            ids.push(...gestores.map(g => g.id));
        }
        ids = Array.from(new Set(ids)).filter(id => id && id !== params.excluirId);
        if (ids.length === 0) return;

        await prisma.activity.create({
            data: {
                type: params.type,
                priority: params.priority || 'NORMAL',
                category: 'Viajes',
                title: params.titulo,
                message: params.mensaje,
                entityType: 'viaje',
                entityId: params.viajeId,
                metadata: { viajeId: params.viajeId, url: params.url },
                recipients: { create: ids.map(operatorId => ({ operatorId })) },
            },
        });

        // Se espera el envío (con tope): en Vercel la función puede cerrarse antes
        // de que salga un pedido que quedó sin await.
        await Promise.race([
            sendPushNotification({
                userIds: ids,
                title: params.titulo,
                message: params.mensaje,
                data: { type: params.type, viajeId: params.viajeId, url: params.url },
            }),
            new Promise(resolve => setTimeout(resolve, 6000)),
        ]).catch(e => console.error('[VIAJES_PUSH]', e));
    } catch (e) {
        console.error('[VIAJES_NOTIFICAR]', e);
    }
}

export type EventoViaje = 'creado' | 'iniciado' | 'concluido' | 'cerrado' | 'devuelto' | 'cancelado' | 'extendido' | 'reasignado';

const EVENTO_TITULO: Record<EventoViaje, string> = {
    creado: 'Nuevo viaje asignado',
    reasignado: 'Nuevo viaje asignado',
    iniciado: 'Viaje iniciado',
    concluido: 'Viaje listo para rendir',
    cerrado: 'Rendición cerrada',
    devuelto: 'Viaje devuelto para corregir',
    cancelado: 'Viaje cancelado',
    extendido: 'Estadía extendida',
};

/**
 * Notifica un evento al creador y al responsable del viaje, sin incluir a quien hizo la acción.
 * Cada uno recibe el enlace a su vista: el responsable a Mis Viajes, el creador a la gestión.
 * Si el viaje no tiene creador (usuario eliminado), lo que necesita administración va a los gestores.
 */
export async function notificarViaje(
    viaje: { id: string; codigo: string; origen: string; destino: string; responsableId: string; creadoPorId: string | null },
    actor: ViajeActor,
    evento: EventoViaje,
    detalle?: string,
) {
    const ruta = `${viaje.origen} → ${viaje.destino}`;
    const mensajes: Record<EventoViaje, { responsable: string; creador: string }> = {
        creado: { responsable: `Sos responsable del viaje ${viaje.codigo}: ${ruta}.`, creador: `${viaje.codigo} creado: ${ruta}.` },
        reasignado: { responsable: `Sos responsable del viaje ${viaje.codigo}: ${ruta}.`, creador: `${viaje.codigo} cambió de responsable.` },
        iniciado: { responsable: `${actor.nombre} inició ${viaje.codigo} (${ruta}).`, creador: `${actor.nombre} inició el viaje ${viaje.codigo} (${ruta}).` },
        concluido: { responsable: `${viaje.codigo} quedó para rendir.`, creador: `${actor.nombre} concluyó ${viaje.codigo} (${viaje.destino}). Ya se puede rendir.` },
        cerrado: { responsable: `${viaje.codigo}: ${detalle || 'rendición cerrada'}`, creador: `${actor.nombre} cerró la rendición de ${viaje.codigo}. ${detalle || ''}`.trim() },
        devuelto: { responsable: `${viaje.codigo}: ${detalle || 'revisá los gastos'}`, creador: `${actor.nombre} devolvió ${viaje.codigo} al responsable.` },
        cancelado: { responsable: `${viaje.codigo} fue cancelado. ${detalle || ''}`.trim(), creador: `${actor.nombre} canceló ${viaje.codigo}. ${detalle || ''}`.trim() },
        extendido: { responsable: `${viaje.codigo} se extiende. ${detalle || ''}`.trim(), creador: `${actor.nombre} extendió ${viaje.codigo}. ${detalle || ''}`.trim() },
    };
    const m = mensajes[evento];
    const type = `VIAJE_${evento.toUpperCase()}`;
    const priority = evento === 'devuelto' ? 'HIGH' as const : 'NORMAL' as const;

    const tareas: Promise<void>[] = [];
    if (viaje.responsableId !== actor.userId) {
        tareas.push(notificar({
            operatorIds: [viaje.responsableId], titulo: EVENTO_TITULO[evento], mensaje: m.responsable,
            viajeId: viaje.id, url: `/mis-viajes/${viaje.id}`, type, priority,
        }));
    }
    const creador = viaje.creadoPorId;
    if (creador && creador !== actor.userId && creador !== viaje.responsableId) {
        tareas.push(notificar({
            operatorIds: [creador], titulo: EVENTO_TITULO[evento], mensaje: m.creador,
            viajeId: viaje.id, url: `/viajes/${viaje.id}`, type, priority,
        }));
    } else if (!creador && (evento === 'concluido' || evento === 'extendido')) {
        tareas.push(notificar({
            aGestores: true, excluirId: actor.userId, titulo: EVENTO_TITULO[evento], mensaje: m.creador,
            viajeId: viaje.id, url: `/viajes/${viaje.id}`, type, priority,
        }));
    }
    await Promise.all(tareas);
}
