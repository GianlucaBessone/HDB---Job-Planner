import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';

/**
 * Webhook called by cron-job.org when a reminder fires.
 * Sends push notifications to all involucrados of the tarea.
 */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const recordatorioId = url.searchParams.get('recordatorioId');

        if (!recordatorioId) {
            return NextResponse.json({ error: 'recordatorioId requerido' }, { status: 400 });
        }

        const recordatorio = await prisma.tareaRecordatorio.findUnique({
            where: { id: recordatorioId },
            include: {
                tarea: {
                    include: {
                        involucrados: {
                            include: { operator: { select: { id: true, nombreCompleto: true } } }
                        },
                    },
                },
            },
        });

        if (!recordatorio) {
            return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });
        }

        if (!recordatorio.tarea) {
            return NextResponse.json({ error: 'Tarea asociada no encontrada' }, { status: 404 });
        }

        // Skip if already fired (for "unico" type)
        if (recordatorio.tipo === 'unico' && recordatorio.disparado) {
            return NextResponse.json({ message: 'Recordatorio ya disparado', skipped: true });
        }

        // Skip if task is already completed or cancelled
        if (['completada', 'cancelada'].includes(recordatorio.tarea.estado)) {
            // Optionally disable the cron job
            if (recordatorio.cronJobId) {
                try {
                    await fetch(`https://api.cron-job.org/jobs/${recordatorio.cronJobId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${process.env.CRONJOB_ORG_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ job: { enabled: false } }),
                    });
                } catch (e) {
                    console.warn('[WEBHOOK_DISABLE_CRONJOB]', e);
                }
            }
            return NextResponse.json({ message: 'Tarea ya completada/cancelada, recordatorio desactivado', skipped: true });
        }

        // Collect user IDs for push notification
        const userIds = recordatorio.tarea.involucrados.map(inv => inv.operator.id);
        const userNames = recordatorio.tarea.involucrados.map(inv => inv.operator.nombreCompleto);

        const mensaje = recordatorio.mensaje || `Recordatorio: "${recordatorio.tarea.titulo}"`;

        // Determine urgency prefix
        let prefix = '⏰';
        if (recordatorio.tarea.prioridad === 'urgente') prefix = '🚨';
        else if (recordatorio.tarea.prioridad === 'alta') prefix = '⚠️';

        // Send push notification
        if (userIds.length > 0) {
            await sendPushNotification({
                userIds,
                title: `${prefix} Recordatorio de Tarea`,
                message: mensaje,
                data: {
                    type: 'TAREA_REMINDER',
                    tareaId: recordatorio.tarea.id,
                    recordatorioId: recordatorio.id,
                },
            });
        }

        // Also notify the creator if not in involucrados
        if (!userIds.includes(recordatorio.tarea.creadorId)) {
            await sendPushNotification({
                userIds: [recordatorio.tarea.creadorId],
                title: `${prefix} Recordatorio de Tarea`,
                message: mensaje,
                data: {
                    type: 'TAREA_REMINDER',
                    tareaId: recordatorio.tarea.id,
                },
            });
        }

        // Mark as fired
        await prisma.tareaRecordatorio.update({
            where: { id: recordatorioId },
            data: {
                disparado: true,
                fechaDisparado: new Date(),
            },
        });

        // For "unico" type, also disable the cron job
        if (recordatorio.tipo === 'unico' && recordatorio.cronJobId) {
            try {
                await fetch(`https://api.cron-job.org/jobs/${recordatorio.cronJobId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${process.env.CRONJOB_ORG_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ job: { enabled: false } }),
                });
            } catch (e) {
                console.warn('[WEBHOOK_DISABLE_UNIQUE]', e);
            }
        }

        // Create internal notification records for each involved operator
        const notifPromises = userIds.map(opId =>
            prisma.notification.create({
                data: {
                    operatorId: opId,
                    title: `${prefix} Recordatorio de Tarea`,
                    message: mensaje,
                    type: 'TAREA_REMINDER',
                    relatedId: recordatorio.tarea!.id,
                    metadata: {
                        tareaId: recordatorio.tarea!.id,
                        tareaTitulo: recordatorio.tarea!.titulo,
                        recordatorioId: recordatorio.id,
                    },
                },
            })
        );
        await Promise.allSettled(notifPromises);

        console.log('[REMINDER_WEBHOOK_OK]', {
            recordatorioId,
            tareaId: recordatorio.tarea.id,
            notifiedUsers: userNames,
        });

        return NextResponse.json({
            success: true,
            notifiedUsers: userNames,
            tareaId: recordatorio.tarea.id,
        });
    } catch (error) {
        console.error('[REMINDER_WEBHOOK_ERROR]', error);
        return NextResponse.json({ error: 'Error en webhook de recordatorio' }, { status: 500 });
    }
}
