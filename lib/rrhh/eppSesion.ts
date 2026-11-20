/**
 * Sesión y permisos para las APIs de EPP (app/api/rrhh/epp/**).
 *
 * El middleware valida la cookie sgi_session y deja x-user-id. verificarAcceso
 * (lib/permisosServer.ts) confirma en la base que el usuario sigue activo, resuelve
 * sus funciones (rol + permisos especiales) y trae su nombre real para la auditoría.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verificarAcceso, type AccesoSesion } from '@/lib/permisosServer';
import type { FuncionId } from '@/lib/permisos';

/** Usuario de la sesión, tal como queda en actas, kardex y auditoría. */
export interface UsuarioEpp {
    id: string;
    nombre: string;
}

export interface SesionEpp {
    acceso: AccesoSesion;
    usuario: UsuarioEpp;
}

// Los helpers devuelven la respuesta de error lista para retornar:
//     const sesion = await sesionEpp(req, ['rrhh.epp_ver']);
//     if (sesion instanceof NextResponse) return sesion;
function error(status: number, mensaje: string): NextResponse {
    return NextResponse.json({ success: false, error: mensaje }, { status });
}

/**
 * Exige sesión válida de un usuario activo. Si se pasan funciones, alcanza con
 * tener una de ellas.
 */
export async function sesionEpp(req: Request, funciones: FuncionId[] = []): Promise<SesionEpp | NextResponse> {
    const r = await verificarAcceso(req, funciones);
    if (!r.ok) return error(r.status, r.error);
    return { acceso: r.acceso, usuario: { id: r.acceso.userId, nombre: r.acceso.nombre } };
}

/** Lee y valida el cuerpo JSON. */
export async function leerBody<T extends z.ZodType>(
    req: Request,
    schema: T
): Promise<{ data: z.infer<T> } | NextResponse> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return error(400, 'El cuerpo de la solicitud no es JSON válido');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return error(400, parsed.error.issues[0]?.message || 'Datos inválidos');
    }
    return { data: parsed.data };
}

/** Respuesta estándar para los resultados { success, data | error } de la lógica de EPP. */
export function responder(result: { success: boolean; error?: string }, statusError = 400) {
    return NextResponse.json(result, {
        status: result.success ? 200 : statusError,
        headers: { 'Cache-Control': 'private, no-store' },
    });
}

/** Id de un registro (cuid/uuid). */
export const idSchema = z.string().trim().min(1, 'Identificador requerido').max(64);
