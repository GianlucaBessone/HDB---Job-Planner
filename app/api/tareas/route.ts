import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';
import { exigirAcceso } from '@/lib/permisosServer';
import { nivelSobreTarea } from '@/lib/tareas/acceso';

/** Campos que un colaborador puede cambiar. */
const CAMPOS_COLABORADOR = ['estado', 'fechaCompletada'];

// ── GET — List tareas with filters ─────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const url = new URL(req.url);
        const estado = url.searchParams.get('estado');
        const prioridad = url.searchParams.get('prioridad');
        const projectId = url.searchParams.get('projectId');
        const involucradoId = url.searchParams.get('involucradoId');
        const creadorId = url.searchParams.get('creadorId');

        const where: any = {};
        if (estado) where.estado = estado;
        if (prioridad) where.prioridad = prioridad;
        if (projectId) where.projectId = projectId;
        if (creadorId) where.creadorId = creadorId;
        if (involucradoId) {
            where.involucrados = { some: { operatorId: involucradoId } };
        }

        // Restricción de visualización: sin "tareas.ver_todas", solo las tareas propias
        // o en las que se es involucrado. El usuario sale de la sesión (se ignoran ?userId y ?role).
        if (!acceso.puede('tareas.ver_todas')) {
            where.OR = [
                { creadorId: acceso.userId },
                { involucrados: { some: { operatorId: acceso.userId } } }
            ];
        }

        const tareas = await prisma.tarea.findMany({
            where,
            include: {
                involucrados: {
                    include: { operator: { select: { id: true, nombreCompleto: true, role: true } } }
                },
                recordatorios: true,
                project: { select: { id: true, nombre: true, codigoProyecto: true } },
            },
            orderBy: [
                { fechaVencimiento: 'asc' },
                { prioridad: 'asc' },
                { createdAt: 'desc' },
            ],
        });

        const tareasMapped = tareas.map(t => ({
            ...t,
            creadoEn: t.createdAt,
            actualizadoEn: t.updatedAt
        }));

        return NextResponse.json(tareasMapped);
    } catch (error) {
        console.error('[TAREAS_GET]', error);
        return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 });
    }
}

// ── POST — Create new tarea ────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const body = await req.json();
        const {
            titulo,
            descripcion,
            estado = 'pendiente',
            prioridad = 'media',
            categoria,
            fechaInicio,
            fechaVencimiento,
            projectId,
            involucrados = [], // [{ operatorId, rol }]
            notas,
        } = body;

        // El creador es siempre el usuario de la sesión.
        const creadorId = acceso.userId;
        const creadorNombre = acceso.nombre;

        if (!titulo) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (titulo)' }, { status: 400 });
        }

        const tarea = await prisma.tarea.create({
            data: {
                titulo,
                descripcion: descripcion || null,
                estado,
                prioridad,
                categoria: categoria || null,
                fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
                fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
                projectId: projectId || null,
                creadorId,
                creadorNombre,
                notas: notas || null,
                involucrados: {
                    create: involucrados.map((inv: any) => ({
                        operatorId: inv.operatorId,
                        rol: inv.rol || 'responsable',
                    })),
                },
            },
            include: {
                involucrados: {
                    include: { operator: { select: { id: true, nombreCompleto: true, role: true } } }
                },
                recordatorios: true,
                project: { select: { id: true, nombre: true, codigoProyecto: true } },
            },
        });

        // ── Enviar notificaciones a involucrados ──
        const userIds = tarea.involucrados
            .map((inv: any) => inv.operator.id)
            .filter((id: string) => id !== creadorId); // No notificar al creador

        if (userIds.length > 0) {
            // Push Notification via OneSignal (Fire and Forget)
            sendPushNotification({
                userIds,
                title: 'Nueva Tarea Asignada',
                message: `${creadorNombre} te ha involucrado en la tarea: "${titulo}"`,
                data: {
                    type: 'NUEVA_TAREA',
                    tareaId: tarea.id,
                },
            }).catch(e => console.error('[ONESIGNAL_ERROR]', e));

            // Internal DB Notifications
            const notifPromises = userIds.map((opId: string) =>
                prisma.activity.create({
                    data: {
                        type: 'TASK_ASSIGNED',
                        priority: 'NORMAL',
                        category: 'Work Orders',
                        title: 'Nueva Tarea Asignada',
                        message: `${creadorNombre} te ha involucrado en la tarea: "${titulo}"`,
                        entityType: 'tarea',
                        entityId: tarea.id,
                        metadata: {
                            tareaId: tarea.id,
                            tareaTitulo: titulo,
                        },
                        recipients: { create: [{ operatorId: opId }] }
                    },
                })
            );
            await Promise.allSettled(notifPromises);
        }

        const tareaMapped = {
            ...tarea,
            creadoEn: tarea.createdAt,
            actualizadoEn: tarea.updatedAt
        };

        return NextResponse.json(tareaMapped);
    } catch (error) {
        console.error('[TAREAS_POST]', error);
        return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 });
    }
}

// ── PUT — Update tarea ─────────────────────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const body = await req.json();
        // actorId / actorName del cuerpo se ignoran; el creador no se reasigna desde acá.
        const { id, involucrados, actorId: _actorId, actorName: _actorName, creadorId: _creadorId, creadorNombre: _creadorNombre, ...data } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        const oldTarea = await prisma.tarea.findUnique({
            where: { id },
            include: { involucrados: true }
        });

        if (!oldTarea) {
            return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
        }

        const nivel = nivelSobreTarea(acceso, oldTarea);
        if (nivel === 'ninguno' || nivel === 'lectura') {
            return NextResponse.json({ error: 'No tenés permiso para modificar esta tarea' }, { status: 403 });
        }
        if (nivel === 'estado' && (involucrados !== undefined || Object.keys(data).some(k => !CAMPOS_COLABORADOR.includes(k)))) {
            return NextResponse.json({ error: 'Como colaborador solo podés cambiar el estado de la tarea' }, { status: 403 });
        }

        // Parse dates if provided
        if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
        else if (data.fechaInicio === '') data.fechaInicio = null;
        
        if (data.fechaVencimiento) data.fechaVencimiento = new Date(data.fechaVencimiento);
        else if (data.fechaVencimiento === '') data.fechaVencimiento = null;
        
        if (data.fechaCompletada) data.fechaCompletada = new Date(data.fechaCompletada);
        else if (data.fechaCompletada === '') data.fechaCompletada = null;
        
        // Handle empty strings for optional relations
        if (data.projectId === '') data.projectId = null;

        // If completing, set the completion date automatically
        if (data.estado === 'completada' && !data.fechaCompletada) {
            data.fechaCompletada = new Date();
        }

        // Update involucrados if provided (Diff strategy)
        if (involucrados) {
            const existing = await prisma.tareaInvolucrado.findMany({ where: { tareaId: id } });
            const existingIds = existing.map(e => e.operatorId);
            const newIds = involucrados.map((i: any) => i.operatorId);
            
            const toDelete = existingIds.filter(id => !newIds.includes(id));
            const toCreate = involucrados.filter((i: any) => !existingIds.includes(i.operatorId));
            
            if (toDelete.length > 0) {
                await prisma.tareaInvolucrado.deleteMany({
                    where: { tareaId: id, operatorId: { in: toDelete } }
                });
            }
            if (toCreate.length > 0) {
                await prisma.tareaInvolucrado.createMany({
                    data: toCreate.map((inv: any) => ({
                        tareaId: id,
                        operatorId: inv.operatorId,
                        rol: inv.rol || 'responsable',
                    }))
                });
            }
        }

        const tarea = await prisma.tarea.update({
            where: { id },
            data,
            include: {
                involucrados: {
                    include: { operator: { select: { id: true, nombreCompleto: true, role: true } } }
                },
                recordatorios: true,
                project: { select: { id: true, nombre: true, codigoProyecto: true } },
            },
        });

        // ── Notifications Logic ──
        const actingUserId = acceso.userId;
        const actingUserName = acceso.nombre;

        const keysChanged = Object.keys(data);
        const isPureStatusChange = keysChanged.length === 1 && keysChanged[0] === 'estado';

        if (isPureStatusChange && oldTarea.estado !== data.estado) {
            const statusLabels: Record<string, string> = { pendiente: 'Pendiente', en_progreso: 'En Progreso', completada: 'Completada', cancelada: 'Cancelada' };
            const label = statusLabels[data.estado as string] || data.estado;
            
            const targetIds = tarea.involucrados.map(i => i.operatorId).filter(id => id !== actingUserId);
            if (tarea.creadorId && tarea.creadorId !== actingUserId && !targetIds.includes(tarea.creadorId)) {
                targetIds.push(tarea.creadorId);
            }

            if (targetIds.length > 0) {
                const msg = `${actingUserName} ha cambiado el estado de "${tarea.titulo}" a ${label}.`;
                try { sendPushNotification({ userIds: targetIds, title: 'Cambio de Estado', message: msg, data: { url: `/tareas?id=${tarea.id}` } }).catch(e => console.error(e)); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(targetIds.map(opId => prisma.activity.create({
                    data: { type: 'TASK_UPDATED', priority: 'NORMAL', category: 'Work Orders', title: 'Cambio de Estado', message: msg, entityType: 'tarea', entityId: tarea.id, recipients: { create: [{ operatorId: opId }] } }
                })));
            }
        } else if (keysChanged.length > 0) {
            // General Update
            const targetIds = tarea.involucrados.map(i => i.operatorId).filter(id => id !== actingUserId);
            if (tarea.creadorId && tarea.creadorId !== actingUserId && !targetIds.includes(tarea.creadorId)) {
                targetIds.push(tarea.creadorId);
            }

            if (targetIds.length > 0) {
                const msg = `${actingUserName} ha actualizado la tarea "${tarea.titulo}".`;
                try { sendPushNotification({ userIds: targetIds, title: 'Tarea Actualizada', message: msg, data: { url: `/tareas?id=${tarea.id}` } }).catch(e => console.error(e)); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(targetIds.map(opId => prisma.activity.create({
                    data: { type: 'TASK_UPDATED', priority: 'NORMAL', category: 'Work Orders', title: 'Tarea Actualizada', message: msg, entityType: 'tarea', entityId: tarea.id, recipients: { create: [{ operatorId: opId }] } }
                })));
            }
        }

        if (involucrados) {
            const oldIds = oldTarea.involucrados.map(i => i.operatorId);
            const newIds = involucrados.map((i: any) => i.operatorId);
            
            const removedIds = oldIds.filter(id => !newIds.includes(id) && id !== actingUserId);
            const addedIds = newIds.filter(id => !oldIds.includes(id) && id !== actingUserId);

            if (removedIds.length > 0) {
                const msg = `${actingUserName} te ha removido de la tarea "${oldTarea.titulo}".`;
                try { sendPushNotification({ userIds: removedIds, title: 'Removido de Tarea', message: msg }).catch(e => console.error(e)); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(removedIds.map(opId => prisma.activity.create({
                    data: { type: 'TASK_UPDATED', priority: 'LOW', category: 'Work Orders', title: 'Removido de Tarea', message: msg, entityType: 'tarea', entityId: tarea.id, recipients: { create: [{ operatorId: opId }] } }
                })));
            }
            if (addedIds.length > 0) {
                const msg = `${actingUserName} te ha asignado a la tarea "${tarea.titulo}".`;
                try { sendPushNotification({ userIds: addedIds, title: 'Nueva Asignación', message: msg, data: { url: `/tareas?id=${tarea.id}` } }).catch(e => console.error(e)); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(addedIds.map(opId => prisma.activity.create({
                    data: { type: 'TASK_ASSIGNED', priority: 'NORMAL', category: 'Work Orders', title: 'Nueva Asignación', message: msg, entityType: 'tarea', entityId: tarea.id, recipients: { create: [{ operatorId: opId }] } }
                })));
            }
        }

        const tareaMapped = {
            ...tarea,
            creadoEn: tarea.createdAt,
            actualizadoEn: tarea.updatedAt
        };

        return NextResponse.json(tareaMapped);
    } catch (error) {
        console.error('[TAREAS_PUT]', error);
        return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 });
    }
}

// ── DELETE — Delete tarea ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        const oldTarea = await prisma.tarea.findUnique({
            where: { id },
            include: { involucrados: true }
        });

        if (!oldTarea) {
            return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
        }

        if (nivelSobreTarea(acceso, oldTarea) !== 'total') {
            return NextResponse.json({ error: 'No tenés permiso para eliminar esta tarea' }, { status: 403 });
        }

        // First, delete any cron-job.org jobs for this task's reminders
        const recordatorios = await prisma.tareaRecordatorio.findMany({
            where: { tareaId: id, cronJobId: { not: null } },
        });

        for (const rec of recordatorios) {
            if (rec.cronJobId) {
                try {
                    await fetch(`https://api.cron-job.org/jobs/${rec.cronJobId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${process.env.CRONJOB_ORG_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                    });
                } catch (e) {
                    console.warn('[CRONJOB_DELETE_WARN]', e);
                }
            }
        }

        await prisma.tarea.delete({ where: { id } });

        // ── Notifications Logic ──
        const actingUserId = acceso.userId;
        const actingUserName = acceso.nombre;

        const targetIds = oldTarea.involucrados.map(i => i.operatorId).filter(id => id !== actingUserId);
        
        if (targetIds.length > 0) {
            const msg = `${actingUserName} ha eliminado la tarea "${oldTarea.titulo}".`;
            try { sendPushNotification({ userIds: targetIds, title: 'Tarea Eliminada', message: msg }).catch(e => console.error(e)); } catch (e) { console.error('[ONESIGNAL]', e); }
            await Promise.allSettled(targetIds.map(opId => prisma.activity.create({
                data: { type: 'TASK_DELETED', priority: 'LOW', category: 'Work Orders', title: 'Tarea Eliminada', message: msg, entityType: 'tarea', entityId: oldTarea.id, recipients: { create: [{ operatorId: opId }] } }
            })));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[TAREAS_DELETE]', error);
        return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 });
    }
}
