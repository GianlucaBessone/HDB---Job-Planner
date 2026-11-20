/**
 * Cliente de POST /api/signatures/sign.
 *
 * Usa `fetch` directo a propósito, no `safeApiRequest` (lib/offline.ts): una
 * firma nunca se encola offline. La cola se reenvía más tarde con la sesión
 * vigente en ese momento, que puede ser de otro usuario del mismo equipo, y
 * mientras tanto devuelve una respuesta falsa sin SignatureID ni HashSignature.
 *
 * El firmante lo resuelve el servidor desde la sesión: acá no se manda nombre,
 * DNI ni id de usuario.
 */

export const MENSAJE_SIN_CONEXION_FIRMA = 'Necesitás conexión para firmar';

export interface DatosFirma {
    documentId: string;
    documentVersion: string;
    deviceId: string;
}

/** Respuesta de la API, sin cambios de formato. */
export interface FirmaAuditada {
    SignatureID: string;
    HashSignature: string;
    [campo: string]: any;
}

/**
 * Interfaz plana (no unión discriminada): el tsconfig no tiene strictNullChecks
 * y sin eso `ok` no estrecha el tipo. Con `ok: true` siempre viene `firma`;
 * con `ok: false`, `error` y `sinConexion`.
 */
export interface ResultadoFirma {
    ok: boolean;
    firma?: FirmaAuditada;
    error?: string;
    sinConexion?: boolean;
}

export async function firmarDocumento(datos: DatosFirma): Promise<ResultadoFirma> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { ok: false, error: MENSAJE_SIN_CONEXION_FIRMA, sinConexion: true };
    }

    let res: Response;
    try {
        res = await fetch('/api/signatures/sign', {
            method: 'POST',
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
        });
    } catch {
        // Error de red: no hay respuesta del servidor y no se reintenta.
        return { ok: false, error: MENSAJE_SIN_CONEXION_FIRMA, sinConexion: true };
    }

    let body: any = null;
    try {
        body = await res.json();
    } catch {
        body = null;
    }

    if (!res.ok) {
        return {
            ok: false,
            error: body?.error || 'No se pudo generar la firma',
            sinConexion: false,
        };
    }

    if (!body?.SignatureID || !body?.HashSignature) {
        return { ok: false, error: 'La firma no devolvió un identificador válido', sinConexion: false };
    }

    return { ok: true, firma: body as FirmaAuditada };
}
