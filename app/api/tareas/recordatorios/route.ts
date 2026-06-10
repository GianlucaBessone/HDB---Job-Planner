import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CRONJOB_API = 'https://api.cron-job.org/jobs';

function getCronJobApiKey(): string {
    const key = process.env.CRONJOB_ORG_API_KEY;
    if (!key) throw new Error('CRONJOB_ORG_API_KEY not set');
    return key.replace(/^"|"$/g, '');
}

/**
 * Build the cron-job.org schedule from tipo and fechaDisparo.
 *  - "unico":  fires once at the exact date/time
 *  - "diario": fires every day at the same hour/minute
 *  - "semanal": fires every week on the same weekday at the same hour/minute
 */
function buildSchedule(tipo: string, fecha: Date) {
    const minutes = [fecha.getUTCMinutes()];
    const hours = [fecha.getUTCHours()];

    switch (tipo) {
        case 'diario':
            return {
                timezone: 'America/Argentina/Buenos_Aires',
                expiresAt: 0,
                hours,
                minutes,
                mdays: [-1],
                months: [-1],
                wdays: [-1],
            };
        case 'semanal':
            return {
                timezone: 'America/Argentina/Buenos_Aires',
                expiresAt: 0,
                hours,
                minutes,
                mdays: [-1],
                months: [-1],
                wdays: [fecha.getUTCDay()],
            };
        case 'unico':
        default:
            return {
                timezone: 'America/Argentina/Buenos_Aires',
                expiresAt: Math.floor(fecha.getTime() / 1000) + 120, // expire 2 min after
                hours,
                minutes,
                mdays: [fecha.getUTCDate()],
                months: [fecha.getUTCMonth() + 1],
                wdays: [-1],
            };
    }
}

// ── POST — Create reminder + register in cron-job.org ──────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { tareaId, tipo = 'unico', fechaDisparo, mensaje } = body;

        if (!tareaId || !fechaDisparo) {
            return NextResponse.json({ error: 'tareaId y fechaDisparo son obligatorios' }, { status: 400 });
        }

        // Verify tarea exists
        const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
        if (!tarea) {
            return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
        }

        // Create DB record first
        const recordatorio = await prisma.tareaRecordatorio.create({
            data: {
                tareaId,
                tipo,
                fechaDisparo: new Date(fechaDisparo),
                mensaje: mensaje || null,
            },
        });

        // Build the webhook URL — use the app's base URL
        const baseUrl = req.headers.get('x-forwarded-host')
            ? `https://${req.headers.get('x-forwarded-host')}`
            : req.headers.get('origin') || 'https://hdb-sgi.vercel.app';

        const webhookUrl = `${baseUrl}/api/tareas/reminder-webhook?recordatorioId=${recordatorio.id}`;

        // Create cron job on cron-job.org
        let cronJobId: number | null = null;
        try {
            const schedule = buildSchedule(tipo, new Date(fechaDisparo));
            const cronResponse = await fetch(CRONJOB_API, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getCronJobApiKey()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    job: {
                        url: webhookUrl,
                        enabled: true,
                        saveResponses: true,
                        title: `SGI Recordatorio: ${tarea.titulo.substring(0, 50)}`,
                        schedule,
                        requestMethod: 0, // GET
                    },
                }),
            });

            const cronResult = await cronResponse.json();
            console.log('[CRONJOB_CREATE]', cronResult);

            if (cronResult.jobId) {
                cronJobId = cronResult.jobId;
            }
        } catch (cronError) {
            console.error('[CRONJOB_CREATE_ERROR]', cronError);
            // Don't fail the whole operation, just log it
        }

        // Update record with cronJobId
        const updated = await prisma.tareaRecordatorio.update({
            where: { id: recordatorio.id },
            data: { cronJobId },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('[RECORDATORIOS_POST]', error);
        return NextResponse.json({ error: 'Error al crear recordatorio' }, { status: 500 });
    }
}

// ── DELETE — Remove reminder + delete from cron-job.org ────────────
export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        const recordatorio = await prisma.tareaRecordatorio.findUnique({ where: { id } });
        if (!recordatorio) {
            return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });
        }

        // Delete from cron-job.org if we have a job ID
        if (recordatorio.cronJobId) {
            try {
                await fetch(`${CRONJOB_API}/${recordatorio.cronJobId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${getCronJobApiKey()}`,
                        'Content-Type': 'application/json',
                    },
                });
            } catch (e) {
                console.warn('[CRONJOB_DELETE_WARN]', e);
            }
        }

        await prisma.tareaRecordatorio.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[RECORDATORIOS_DELETE]', error);
        return NextResponse.json({ error: 'Error al eliminar recordatorio' }, { status: 500 });
    }
}
