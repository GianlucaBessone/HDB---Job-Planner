/**
 * Sesión para las APIs de presupuestos de servicio y del wizard de proyectos.
 * Mismo criterio que lib/rrhh/eppSesion.ts: verificarAcceso (lib/permisosServer.ts)
 * confirma en la base que el usuario está activo, resuelve sus funciones y trae su
 * nombre real para la auditoría.
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { verificarAcceso, type AccesoSesion } from '@/lib/permisosServer';
import type { FuncionId } from '@/lib/permisos';

export interface UsuarioSesion {
    id: string;
    nombre: string;
}

export interface Sesion {
    acceso: AccesoSesion;
    usuario: UsuarioSesion;
}

export function errorJson(status: number, mensaje: string, extra?: Record<string, unknown>): NextResponse {
    return NextResponse.json({ error: mensaje, ...(extra || {}) }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/**
 * Exige sesión de un usuario activo. Con funciones, alcanza con tener una de ellas.
 *     const s = await sesion(req, ['presupuestos.ver']);
 *     if (s instanceof NextResponse) return s;
 */
export async function sesion(req: Request, funciones: FuncionId[] = []): Promise<Sesion | NextResponse> {
    const r = await verificarAcceso(req, funciones);
    if (!r.ok) return errorJson(r.status, r.error);
    return { acceso: r.acceso, usuario: { id: r.acceso.userId, nombre: r.acceso.nombre } };
}

/** Lee y valida el cuerpo JSON con Zod. */
export async function leerBody<T extends z.ZodType>(req: Request, schema: T): Promise<{ data: z.infer<T> } | NextResponse> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return errorJson(400, 'El cuerpo de la solicitud no es JSON válido');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return errorJson(400, issue?.message || 'Datos inválidos', { campo: issue?.path?.join('.') || null });
    }
    return { data: parsed.data };
}

/** Error de negocio con status HTTP: lo lanzan los servicios y lo traducen las rutas. */
export class ErrorNegocio extends Error {
    constructor(message: string, public status: number = 400) {
        super(message);
        this.name = 'ErrorNegocio';
    }
}

/** Las tablas del módulo todavía no existen en la base (falta aplicar la migración). */
export function esTablaFaltante(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2022');
}

/** Traduce errores de servicio a respuestas HTTP. */
export function responderError(e: unknown, contexto: string): NextResponse {
    if (e instanceof ErrorNegocio) return errorJson(e.status, e.message);
    if (esTablaFaltante(e)) {
        return errorJson(503, 'El módulo de presupuestos de servicio todavía no está instalado en la base de datos.');
    }
    console.error(`[${contexto}]`, e);
    return errorJson(500, 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.');
}
