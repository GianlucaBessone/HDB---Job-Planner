/**
 * Re-firma los recordatorios de tareas ya programados en cron-job.org.
 *
 * Desde que el webhook (/api/tareas/reminder-webhook) exige un token firmado, los
 * recordatorios creados antes tienen en cron-job.org una URL sin token y el webhook
 * los rechaza. Este script les actualiza la URL. Se corre una vez, después del deploy:
 *
 *   APP_URL=https://<dominio-de-produccion> npx tsx scripts/firmar-recordatorios-tareas.ts
 *   (agregar --dry para ver qué cambiaría sin tocar cron-job.org)
 *
 * Necesita DATABASE_URL, CRON_SECRET (el mismo que usa la app) y CRONJOB_ORG_API_KEY.
 * Solo toca recordatorios con trabajo en cron-job.org que siguen vigentes: los únicos
 * ya disparados y los de tareas completadas o canceladas se saltean.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { firmarRecordatorio, urlWebhookRecordatorio } from '../lib/tareas/recordatorioToken';

const prisma = new PrismaClient();
const dry = process.argv.includes('--dry');

async function main() {
    const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
    const apiKey = (process.env.CRONJOB_ORG_API_KEY || '').replace(/^"|"$/g, '');
    if (!appUrl) throw new Error('Falta APP_URL (dominio de la app, p. ej. https://hdb-sgi.vercel.app)');
    if (!apiKey) throw new Error('Falta CRONJOB_ORG_API_KEY');
    if (!firmarRecordatorio('prueba')) throw new Error('Falta CRON_SECRET');

    const recordatorios = await prisma.tareaRecordatorio.findMany({
        where: { cronJobId: { not: null } },
        include: { tarea: { select: { estado: true } } },
    });

    let actualizados = 0;
    let salteados = 0;
    let errores = 0;
    for (const r of recordatorios) {
        const vigente = !(r.tipo === 'unico' && r.disparado) && !['completada', 'cancelada'].includes(r.tarea?.estado || '');
        if (!vigente) { salteados++; continue; }

        const url = urlWebhookRecordatorio(appUrl, r.id, firmarRecordatorio(r.id)!);
        if (dry) { console.log(`[dry] job ${r.cronJobId} → ${url.replace(/token=[^&]+/, 'token=…')}`); actualizados++; continue; }

        const res = await fetch(`https://api.cron-job.org/jobs/${r.cronJobId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ job: { url } }),
        });
        if (res.ok) actualizados++;
        else { errores++; console.error(`job ${r.cronJobId}: HTTP ${res.status} ${await res.text()}`); }
    }

    console.log(`Recordatorios: ${actualizados} actualizados, ${salteados} salteados, ${errores} con error${dry ? ' (simulación)' : ''}`);
}

main()
    .catch(e => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
