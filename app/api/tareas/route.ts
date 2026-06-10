import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';

// ── GET — List tareas with filters ─────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const estado = url.searchParams.get('estado');
        const prioridad = url.searchParams.get('prioridad');
        const projectId = url.searchParams.get('projectId');
        const involucradoId = url.searchParams.get('involucradoId');
        const creadorId = url.searchParams.get('creadorId');
        const userId = url.searchParams.get('userId');
        const role = url.searchParams.get('role');

        const where: any = {};
        if (estado) where.estado = estado;
        if (prioridad) where.prioridad = prioridad;
        if (projectId) where.projectId = projectId;
        if (creadorId) where.creadorId = creadorId;
        if (involucradoId) {
            where.involucrados = { some: { operatorId: involucradoId } };
        }

        // Restricción de visualización: solo ver tareas propias o en las que se es involucrado
        if (role !== 'admin' && userId) {
            where.OR = [
                { creadorId: userId },
                { involucrados: { some: { operatorId: userId } } }
            ];
        } else if (role !== 'admin' && !userId) {
            // Si no hay usuario y no es admin, no devolvemos tareas
            return NextResponse.json([]);
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

        return NextResponse.json(tareas);
    } catch (error) {
        console.error('[TAREAS_GET]', error);
        return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 });
    }
}

// ── POST — Create new tarea ────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
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
            creadorId,
            creadorNombre,
            involucrados = [], // [{ operatorId, rol }]
            notas,
        } = body;

        if (!titulo || !creadorId || !creadorNombre) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (titulo, creadorId, creadorNombre)' }, { status: 400 });
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
            // Push Notification via OneSignal
            await sendPushNotification({
                userIds,
                title: 'Nueva Tarea Asignada',
                message: `${creadorNombre} te ha involucrado en la tarea: "${titulo}"`,
                data: {
                    type: 'NUEVA_TAREA',
                    tareaId: tarea.id,
                },
            });

            // Internal DB Notifications
            const notifPromises = userIds.map((opId: string) =>
                prisma.notification.create({
                    data: {
                        operatorId: opId,
                        title: 'Nueva Tarea Asignada',
                        message: `${creadorNombre} te ha involucrado en la tarea: "${titulo}"`,
                        type: 'NUEVA_TAREA',
                        relatedId: tarea.id,
                        metadata: {
                            tareaId: tarea.id,
                            tareaTitulo: titulo,
                        },
                    },
                })
            );
            await Promise.allSettled(notifPromises);
        }

        return NextResponse.json(tarea);
    } catch (error) {
        console.error('[TAREAS_POST]', error);
        return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 });
    }
}

// ── PUT — Update tarea ─────────────────────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, involucrados, actorId, actorName, ...data } = body;

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

        // Parse dates if provided
        if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
        if (data.fechaVencimiento) data.fechaVencimiento = new Date(data.fechaVencimiento);
        if (data.fechaCompletada) data.fechaCompletada = new Date(data.fechaCompletada);
        
        // Handle empty strings for optional relations
        if (data.projectId === '') data.projectId = null;

        // If completing, set the completion date automatically
        if (data.estado === 'completada' && !data.fechaCompletada) {
            data.fechaCompletada = new Date();
        }

        // Update involucrados if provided (delete-recreate strategy)
        if (involucrados) {
            await prisma.tareaInvolucrado.deleteMany({ where: { tareaId: id } });
            await prisma.tareaInvolucrado.createMany({
                data: involucrados.map((inv: any) => ({
                    tareaId: id,
                    operatorId: inv.operatorId,
                    rol: inv.rol || 'responsable',
                })),
            });
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
        const actingUserId = actorId || 'unknown';
        const actingUserName = actorName || 'Sistema';

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
                try { await sendPushNotification({ userIds: targetIds, title: 'Cambio de Estado', message: msg, data: { url: `/tareas?id=${tarea.id}` } }); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(targetIds.map(opId => prisma.notification.create({
                    data: { operatorId: opId, title: 'Cambio de Estado', message: msg, type: 'TAREA_ACTUALIZADA', relatedId: tarea.id }
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
                try { await sendPushNotification({ userIds: targetIds, title: 'Tarea Actualizada', message: msg, data: { url: `/tareas?id=${tarea.id}` } }); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(targetIds.map(opId => prisma.notification.create({
                    data: { operatorId: opId, title: 'Tarea Actualizada', message: msg, type: 'TAREA_ACTUALIZADA', relatedId: tarea.id }
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
                try { await sendPushNotification({ userIds: removedIds, title: 'Removido de Tarea', message: msg }); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(removedIds.map(opId => prisma.notification.create({
                    data: { operatorId: opId, title: 'Removido de Tarea', message: msg, type: 'TAREA_REMOVIDA', relatedId: tarea.id }
                })));
            }
            if (addedIds.length > 0) {
                const msg = `${actingUserName} te ha asignado a la tarea "${tarea.titulo}".`;
                try { await sendPushNotification({ userIds: addedIds, title: 'Nueva Asignación', message: msg, data: { url: `/tareas?id=${tarea.id}` } }); } catch (e) { console.error('[ONESIGNAL]', e); }
                await Promise.allSettled(addedIds.map(opId => prisma.notification.create({
                    data: { operatorId: opId, title: 'Nueva Asignación', message: msg, type: 'NUEVA_TAREA', relatedId: tarea.id }
                })));
            }
        }

        return NextResponse.json(tarea);
    } catch (error) {
        console.error('[TAREAS_PUT]', error);
        return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 });
    }
}

// ── DELETE — Delete tarea ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        const actorId = url.searchParams.get('actorId');
        const actorName = url.searchParams.get('actorName');

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
        const actingUserId = actorId || 'unknown';
        const actingUserName = actorName || 'Sistema';

        const targetIds = oldTarea.involucrados.map(i => i.operatorId).filter(id => id !== actingUserId);
        
        if (targetIds.length > 0) {
            const msg = `${actingUserName} ha eliminado la tarea "${oldTarea.titulo}".`;
            try { await sendPushNotification({ userIds: targetIds, title: 'Tarea Eliminada', message: msg }); } catch (e) { console.error('[ONESIGNAL]', e); }
            await Promise.allSettled(targetIds.map(opId => prisma.notification.create({
                data: { operatorId: opId, title: 'Tarea Eliminada', message: msg, type: 'TAREA_REMOVIDA', relatedId: oldTarea.id }
            })));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[TAREAS_DELETE]', error);
        return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 });
    }
}
