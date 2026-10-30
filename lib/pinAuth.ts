import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

/**
 * Utilidades de PIN de operadores: hash, verificación y límite de intentos fallidos.
 *
 * Los intentos se registran en AuditLog (entity 'AUTH') para que el bloqueo
 * funcione igual en todas las instancias serverless, sin tablas nuevas.
 */

const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

export function isPinHashed(pin: string | null | undefined) {
    return !!pin && pin.startsWith('$2');
}

export function hashPin(pin: string) {
    return bcrypt.hashSync(pin, 10);
}

/** Compara el PIN ingresado con el guardado (hash bcrypt o texto plano heredado). */
export function verifyPin(input: string, stored: string | null | undefined) {
    if (!input || !stored) return false;
    if (isPinHashed(stored)) return bcrypt.compareSync(input, stored);
    return stored === input;
}

/**
 * Devuelve los minutos que faltan si la clave está bloqueada, o 0 si puede intentar.
 * Cuenta los fallos de la ventana posteriores al último acceso correcto.
 */
export async function getPinLockMinutes(key: string) {
    const desdeVentana = new Date(Date.now() - VENTANA_MS);
    const ultimoOk = await prisma.auditLog.findFirst({
        where: { entity: 'AUTH', entityId: key, action: 'PIN_OK', timestamp: { gte: desdeVentana } },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
    });
    const fallos = await prisma.auditLog.findMany({
        where: {
            entity: 'AUTH',
            entityId: key,
            action: 'PIN_FAILED',
            timestamp: { gte: ultimoOk?.timestamp ?? desdeVentana },
        },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
        take: MAX_INTENTOS,
    });
    if (fallos.length < MAX_INTENTOS) return 0;
    const desbloqueo = fallos[0].timestamp.getTime() + VENTANA_MS;
    return Math.max(1, Math.ceil((desbloqueo - Date.now()) / 60000));
}

export async function registerPinAttempt(key: string, ok: boolean, metadata?: Record<string, any>) {
    try {
        await prisma.auditLog.create({
            data: {
                action: ok ? 'PIN_OK' : 'PIN_FAILED',
                entity: 'AUTH',
                entityId: key,
                userId: metadata?.userId ?? null,
                userName: metadata?.userName ?? null,
                metadata: metadata ?? undefined,
            },
        });
    } catch (e) {
        console.error('[pinAuth] No se pudo registrar el intento:', e);
    }
}

export function lockedMessage(minutes: number) {
    return `Demasiados intentos fallidos. Intente de nuevo en ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
}
