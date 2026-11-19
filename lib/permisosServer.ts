/**
 * Control de accesos del lado del servidor: identifica al usuario de la sesión,
 * confirma que sigue activo y resuelve sus funciones. Catálogo y reglas en lib/permisos.ts.
 *
 * Del pedido solo se toma x-user-id, que deja el middleware después de validar la
 * cookie. El rol, si está activo, el nombre y los permisos especiales se leen de la
 * base en cada pedido: el rol guardado en el token (x-user-role) no se usa, porque
 * puede estar desactualizado hasta 30 días.
 *
 * Uso en una API:
 *
 *     const acceso = await exigirAcceso(req, ['ventas.anular_venta']);
 *     if (acceso instanceof NextResponse) return acceso;
 *     // acceso.userId, acceso.nombre, acceso.role, acceso.puede('...')
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { EfectoPermiso, FuncionId, PermisoEspecial, normalizarRol, puedeFuncion } from '@/lib/permisos';

/**
 * La tabla OperatorPermiso todavía no existe en la base (falta `prisma db push`).
 * En ese caso rigen solo los roles, igual que antes de este módulo.
 */
export function esTablaPermisosFaltante(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021';
}

function esEfecto(v: string): v is EfectoPermiso {
    return v === 'permitir' || v === 'denegar';
}

/** Permisos especiales guardados para un usuario. */
export async function getPermisosEspeciales(operatorId: string | null | undefined): Promise<PermisoEspecial[]> {
    if (!operatorId) return [];
    try {
        const rows = await prisma.operatorPermiso.findMany({
            where: { operatorId },
            select: { clave: true, efecto: true },
        });
        const permisos: PermisoEspecial[] = [];
        for (const r of rows) {
            if (esEfecto(r.efecto)) permisos.push({ clave: r.clave, efecto: r.efecto });
        }
        return permisos;
    } catch (e) {
        if (esTablaPermisosFaltante(e)) return [];
        throw e;
    }
}

/** Por qué no hay un usuario válido: sin sesión, o con sesión de un usuario dado de baja o borrado. */
export type MotivoSinAcceso = 'sin_sesion' | 'inactivo';

export interface AccesoSesion {
    /** Id del usuario activo de la sesión; vacío si no hay sesión o el usuario no está activo. */
    userId: string;
    /** Rol guardado en la base, normalizado (vacío sin usuario activo). */
    role: string;
    /** Nombre guardado en la base, para auditoría. */
    nombre: string;
    activo: boolean;
    /** Solo cuando no hay usuario activo. */
    motivo: MotivoSinAcceso | null;
    permisos: PermisoEspecial[];
    puede: (funcion: FuncionId) => boolean;
}

function sinAcceso(motivo: MotivoSinAcceso): AccesoSesion {
    return { userId: '', role: '', nombre: '', activo: false, motivo, permisos: [], puede: () => false };
}

/** Acceso de un usuario por id, leído de la base. */
export async function getAccesoDeUsuario(userId: string | null | undefined): Promise<AccesoSesion> {
    if (!userId) return sinAcceso('sin_sesion');

    const [operador, permisos] = await Promise.all([
        prisma.operator.findUnique({
            where: { id: userId },
            select: { id: true, role: true, activo: true, nombreCompleto: true },
        }),
        getPermisosEspeciales(userId),
    ]);
    if (!operador || !operador.activo) return sinAcceso('inactivo');

    const role = normalizarRol(operador.role);
    return {
        userId: operador.id,
        role,
        nombre: operador.nombreCompleto,
        activo: true,
        motivo: null,
        permisos,
        puede: (funcion) => puedeFuncion(funcion, role, permisos),
    };
}

/** Acceso del usuario de la sesión (el middleware deja x-user-id). */
export async function getAcceso(req: Request): Promise<AccesoSesion> {
    return getAccesoDeUsuario(req.headers.get('x-user-id'));
}

/** Atajo para chequear una sola función. */
export async function puede(req: Request, funcion: FuncionId): Promise<boolean> {
    return (await getAcceso(req)).puede(funcion);
}

export const MENSAJE_SIN_SESION = 'Iniciá sesión para continuar';
export const MENSAJE_INACTIVO = 'Tu usuario no está activo';
export const MENSAJE_SIN_PERMISO = 'No tenés permiso para esta acción';

export interface ResultadoAcceso {
    ok: boolean;
    /** Con ok = false trae el acceso vacío o el del usuario sin la función. */
    acceso: AccesoSesion;
    status: 200 | 401 | 403;
    /** Mensaje para el usuario cuando ok = false. */
    error: string;
}

/**
 * Exige un usuario activo y, si se pasan funciones, que tenga al menos una.
 * Devuelve el motivo del rechazo para que cada módulo arme su respuesta.
 */
export async function verificarAcceso(req: Request, funciones: readonly FuncionId[] = []): Promise<ResultadoAcceso> {
    const acceso = await getAcceso(req);
    if (!acceso.activo) {
        return { ok: false, acceso, status: 401, error: acceso.motivo === 'inactivo' ? MENSAJE_INACTIVO : MENSAJE_SIN_SESION };
    }
    if (funciones.length > 0 && !funciones.some((f) => acceso.puede(f))) {
        return { ok: false, acceso, status: 403, error: MENSAJE_SIN_PERMISO };
    }
    return { ok: true, acceso, status: 200, error: '' };
}

/**
 * Igual que verificarAcceso, pero devuelve la respuesta de error lista para retornar:
 *
 *     const acceso = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
 *     if (acceso instanceof NextResponse) return acceso;
 */
export async function exigirAcceso(req: Request, funciones: readonly FuncionId[] = []): Promise<AccesoSesion | NextResponse> {
    const r = await verificarAcceso(req, funciones);
    if (r.ok) return r.acceso;
    return NextResponse.json({ error: r.error }, { status: r.status, headers: { 'Cache-Control': 'private, no-store' } });
}
