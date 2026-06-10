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

        const where: any = {};
        if (estado) where.estado = estado;
        if (prioridad) where.prioridad = prioridad;
        if (projectId) where.projectId = projectId;
        if (creadorId) where.creadorId = creadorId;
        if (involucradoId) {
            where.involucrados = { some: { operatorId: involucradoId } };
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
                title: '📋 Nueva Tarea Asignada',
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
                        title: '📋 Nueva Tarea Asignada',
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
        const { id, involucrados, ...data } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
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

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[TAREAS_DELETE]', error);
        return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 });
    }
}
