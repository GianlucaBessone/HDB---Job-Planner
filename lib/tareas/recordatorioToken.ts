/**
 * Token del webhook de recordatorios (/api/tareas/reminder-webhook).
 *
 * cron-job.org llama al webhook sin sesión. Cada recordatorio lleva en su URL un
 * HMAC de su id firmado con CRON_SECRET: la URL guardada en cron-job.org solo
 * dispara ese recordatorio y no expone el secreto.
 */
import { createHmac, timingSafeEqual } from 'crypto';

function secreto(): string | null {
    const s = process.env.CRON_SECRET;
    return s && s.trim() ? s.trim() : null;
}

/** Token para la URL del webhook, o null si falta CRON_SECRET. */
export function firmarRecordatorio(recordatorioId: string): string | null {
    const s = secreto();
    if (!s) return null;
    return createHmac('sha256', s).update(`tarea-recordatorio:${recordatorioId}`).digest('hex');
}

export function verificarFirmaRecordatorio(recordatorioId: string, token: string | null | undefined): boolean {
    const esperado = firmarRecordatorio(recordatorioId);
    if (!esperado || !token) return false;
    const a = Buffer.from(esperado);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
}

/** URL que llama cron-job.org para un recordatorio. */
export function urlWebhookRecordatorio(baseUrl: string, recordatorioId: string, token: string): string {
    return `${baseUrl}/api/tareas/reminder-webhook?recordatorioId=${encodeURIComponent(recordatorioId)}&token=${token}`;
}
