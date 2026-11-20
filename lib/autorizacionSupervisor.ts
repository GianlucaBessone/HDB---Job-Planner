/**
 * Autorización por PIN: otra persona (supervisor, admin o quien tenga la función)
 * habilita una acción en la sesión de quien la pide, por ejemplo un cajero.
 *
 * - autorizarConPin: busca un usuario activo con ese PIN que tenga la función, por rol
 *   o por permiso especial. Limita los intentos fallidos por usuario que pide.
 * - emitirAutorizacion / leerAutorizacion: cuando la acción se confirma en otro pedido
 *   (el precio se cambia en el PDV y la venta se confirma después), el servidor entrega
 *   una autorización firmada, de corta duración, atada a quien la pidió y a la función.
 *   Se firma con una clave propia: no sirve como sesión.
 */
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { jwtKey } from '@/lib/jwtSecret';
import { getPinLockMinutes, lockedMessage, registerPinAttempt, verifyPin } from '@/lib/pinAuth';
import { puedeFuncion, type FuncionId } from '@/lib/permisos';
import { getPermisosEspeciales } from '@/lib/permisosServer';

/** Funciones que se pueden autorizar con el PIN de otra persona. */
export const FUNCIONES_CON_PIN = [
    'ventas.modificar_precios',
    'ventas.anular_venta',
    'ventas.anular_comprobante_cc',
] as const satisfies readonly FuncionId[];

export type FuncionConPin = (typeof FUNCIONES_CON_PIN)[number];

export interface Autorizante {
    id: string;
    nombre: string;
    role: string;
}

export interface ResultadoPin {
    /** Quien autorizó, o null si el PIN no sirve. */
    autorizante: Autorizante | null;
    /** Hay demasiados intentos fallidos recientes. */
    bloqueado: boolean;
    error: string;
}

/**
 * Valida el PIN de un usuario activo que tenga `funcion`.
 * @param solicitanteId Usuario de la sesión que pide la autorización (para el límite de intentos).
 */
export async function autorizarConPin(pin: string, funcion: FuncionConPin, solicitanteId: string): Promise<ResultadoPin> {
    const clave = `supervisor-pin:${solicitanteId}`;
    const minutos = await getPinLockMinutes(clave);
    if (minutos > 0) return { autorizante: null, bloqueado: true, error: lockedMessage(minutos) };

    const pinLimpio = pin.trim();
    const candidatos = await prisma.operator.findMany({
        where: { activo: true },
        select: { id: true, nombreCompleto: true, role: true, pin: true },
    });

    let autorizante: Autorizante | null = null;
    for (const op of candidatos) {
        if (!verifyPin(pinLimpio, op.pin)) continue;
        const permisos = await getPermisosEspeciales(op.id);
        if (puedeFuncion(funcion, op.role, permisos)) {
            autorizante = { id: op.id, nombre: op.nombreCompleto, role: op.role };
            break;
        }
    }

    await registerPinAttempt(clave, !!autorizante, {
        userId: solicitanteId,
        autorizadoPor: autorizante?.id ?? null,
        funcion,
    });

    if (!autorizante) {
        return {
            autorizante: null,
            bloqueado: false,
            error: 'PIN incorrecto o de alguien sin permiso para autorizar esta acción.',
        };
    }
    return { autorizante, bloqueado: false, error: '' };
}

// ── Autorización firmada ────────────────────────────────────────────

// Alcanza para cobrar la venta sin que la autorización quede abierta todo el turno.
const DURACION = '30m';
const TIPO = 'autorizacion-supervisor';

/** Autorización firmada para usar en un pedido posterior de la misma sesión. */
export async function emitirAutorizacion(funcion: FuncionConPin, autorizante: Autorizante, solicitanteId: string): Promise<string> {
    return new SignJWT({
        tipo: TIPO,
        funcion,
        solicitanteId,
        autorizanteId: autorizante.id,
        autorizanteNombre: autorizante.nombre,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(DURACION)
        .sign(jwtKey('autorizacion'));
}

/**
 * Valida una autorización firmada: vigente, para esa función y emitida para ese usuario.
 * Devuelve quién autorizó, o null si no sirve.
 */
export async function leerAutorizacion(
    token: string | null | undefined,
    funcion: FuncionConPin,
    solicitanteId: string
): Promise<{ id: string; nombre: string } | null> {
    if (!token || !solicitanteId) return null;
    try {
        const { payload } = await jwtVerify(token, jwtKey('autorizacion'), { algorithms: ['HS256'] });
        if (payload.tipo !== TIPO || payload.funcion !== funcion || payload.solicitanteId !== solicitanteId) return null;
        if (typeof payload.autorizanteId !== 'string' || typeof payload.autorizanteNombre !== 'string') return null;
        return { id: payload.autorizanteId, nombre: payload.autorizanteNombre };
    } catch {
        return null;
    }
}
