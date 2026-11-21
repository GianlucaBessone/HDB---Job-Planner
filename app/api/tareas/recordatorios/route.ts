import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { nivelSobreTarea } from '@/lib/tareas/acceso';
import { firmarRecordatorio, urlWebhookRecordatorio } from '@/lib/tareas/recordatorioToken';
import { horarioCronJob, parsearFechaRecordatorio } from '@/lib/tareas/recordatorioHorario';

const CRONJOB_API = 'https://api.cron-job.org/jobs';

function getCronJobApiKey(): string | null {
    const key = process.env.CRONJOB_ORG_API_KEY;
    return key && key.trim() ? key.trim().replace(/^"|"$/g, '') : null;
}

const crearSchema = z.object({
    tareaId: z.string().min(1, 'tareaId es obligatorio'),
    tipo: z.enum(['unico', 'diario', 'semanal']).default('unico'),
    // ISO con zona (lo que manda la pantalla) o fecha sin zona, que se toma como hora de Argentina.
    fechaDisparo: z.string().min(1, 'fechaDisparo es obligatoria'),
    mensaje: z.string().nullish(),
});

/** Crea el trabajo en cron-job.org. Devuelve su id o el motivo por el que no se pudo. */
async function programarEnCronJob(params: {
    baseUrl: string; recordatorioId: string; titulo: string; tipo: string; fecha: Date;
}): Promise<{ jobId: number } | { error: string }> {
    const token = firmarRecordatorio(params.recordatorioId);
    if (!token) return { error: 'CRON_SECRET no está configurado' };
    const apiKey = getCronJobApiKey();
    if (!apiKey) return { error: 'CRONJOB_ORG_API_KEY no está configurada' };
    try {
        const res = await fetch(CRONJOB_API, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job: {
                    url: urlWebhookRecordatorio(params.baseUrl, params.recordatorioId, token),
                    enabled: true,
                    saveResponses: true,
                    title: `SGI Recordatorio: ${params.titulo.substring(0, 50)}`,
                    schedule: horarioCronJob(params.tipo, params.fecha),
                    requestMethod: 0, // GET
                },
            }),
        });
        const texto = await res.text();
        let jobId: unknown;
        try { jobId = JSON.parse(texto)?.jobId; } catch { /* respuesta no JSON */ }
        if (res.ok && typeof jobId === 'number') return { jobId };
        return { error: `cron-job.org respondió HTTP ${res.status}: ${texto.slice(0, 200)}` };
    } catch (e) {
        return { error: `No se pudo contactar a cron-job.org: ${e instanceof Error ? e.message : String(e)}` };
    }
}

// ── POST — Create reminder + register in cron-job.org ──────────────
export async function POST(req: NextRequest) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const parsed = crearSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        }
        const { tareaId, tipo, mensaje } = parsed.data;
        const fecha = parsearFechaRecordatorio(parsed.data.fechaDisparo);
        if (!fecha) {
            return NextResponse.json({ error: 'La fecha del recordatorio no es válida' }, { status: 400 });
        }
        if (tipo === 'unico' && fecha.getTime() <= Date.now()) {
            return NextResponse.json({ error: 'La fecha del recordatorio ya pasó' }, { status: 400 });
        }

        // Verify tarea exists
        const tarea = await prisma.tarea.findUnique({ where: { id: tareaId }, include: { involucrados: true } });
        if (!tarea) {
            return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
        }
        // Programar recordatorios es editar la tarea: creador, responsable o "tareas.ver_todas".
        if (nivelSobreTarea(acceso, tarea) !== 'total') {
            return NextResponse.json({ error: 'No tenés permiso para programar recordatorios en esta tarea' }, { status: 403 });
        }

        const recordatorio = await prisma.tareaRecordatorio.create({
            data: { tareaId, tipo, fechaDisparo: fecha, mensaje: mensaje || null },
        });

        // Build the webhook URL — use the app's base URL
        const baseUrl = req.headers.get('x-forwarded-host')
            ? `https://${req.headers.get('x-forwarded-host')}`
            : req.headers.get('origin') || 'https://hdb-sgi.vercel.app';

        const programado = await programarEnCronJob({
            baseUrl, recordatorioId: recordatorio.id, titulo: tarea.titulo, tipo, fecha,
        });

        // Un recordatorio sin trabajo en cron-job.org nunca se dispara: no se guarda.
        if ('error' in programado) {
            console.error('[CRONJOB_CREATE_ERROR]', programado.error);
            await prisma.tareaRecordatorio.delete({ where: { id: recordatorio.id } });
            return NextResponse.json(
                { error: 'No se pudo programar el recordatorio en cron-job.org. Revisá la configuración del servidor.' },
                { status: 502 },
            );
        }

        const updated = await prisma.tareaRecordatorio.update({
            where: { id: recordatorio.id },
            data: { cronJobId: programado.jobId },
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
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        const recordatorio = await prisma.tareaRecordatorio.findUnique({
            where: { id },
            include: { tarea: { include: { involucrados: true } } },
        });
        if (!recordatorio) {
            return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });
        }
        if (recordatorio.tarea && nivelSobreTarea(acceso, recordatorio.tarea) !== 'total') {
            return NextResponse.json({ error: 'No tenés permiso para quitar recordatorios de esta tarea' }, { status: 403 });
        }

        // Delete from cron-job.org if we have a job ID
        if (recordatorio.cronJobId) {
            try {
                await fetch(`${CRONJOB_API}/${recordatorio.cronJobId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${getCronJobApiKey() ?? ''}`,
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
