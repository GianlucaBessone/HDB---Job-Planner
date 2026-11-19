/**
 * Control de accesos del lado del servidor: lee el usuario de la sesión y sus
 * permisos especiales, y resuelve sus funciones. Catálogo y reglas en lib/permisos.ts.
 *
 * Uso en una API:
 *
 *     const acceso = await exigirAcceso(req, ['ventas.anular_venta']);
 *     if (acceso instanceof NextResponse) return acceso;
 *     // acceso.userId / acceso.nombre son los del usuario de la sesión
 *
 * O, para decidir sin cortar el pedido:
 *
 *     const acceso = await getAcceso(req);
 *     if (!acceso.puede('ventas.anular_venta')) return NextResponse.json({ error: '...' }, { status: 403 });
 *
 * El rol y el estado (activo) se leen siempre de la base, no del token: un cambio
 * de rol o una baja aplican en el pedido siguiente, aunque la cookie siga vigente.
 * Nunca uses el rol o el usuario que manda el navegador (cuerpo, query o headers propios).
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { EfectoPermiso, FuncionId, PermisoEspecial, puedeFuncion } from '@/lib/permisos';

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

export interface AccesoSesion {
    /** Usuario de la sesión. Vacío si no hay sesión, o si el usuario no existe o está inactivo. */
    userId: string;
    /** Nombre del usuario según la base, para auditoría. */
    nombre: string;
    /** Rol según la base (en minúsculas), no el del token. */
    role: string;
    permisos: PermisoEspecial[];
    puede: (funcion: FuncionId) => boolean;
}

const SIN_SESION: AccesoSesion = {
    userId: '',
    nombre: '',
    role: '',
    permisos: [],
    puede: () => false,
};

/**
 * Acceso del usuario de la sesión. El middleware valida la cookie y deja x-user-id;
 * rol, estado y nombre se leen de la base en cada pedido.
 */
export async function getAcceso(req: Request): Promise<AccesoSesion> {
    return accesoDeUsuario(req.headers.get('x-user-id') || '');
}

/**
 * Igual que getAcceso, para rutas que el middleware deja pasar sin sesión (no completa
 * x-user-id): lee y valida la cookie. Sin cookie válida devuelve un acceso vacío.
 */
export async function getAccesoDeCookie(req: Request): Promise<AccesoSesion> {
    const sesion = await getSessionFromRequest(req);
    return accesoDeUsuario(sesion?.id || '');
}

async function accesoDeUsuario(userId: string): Promise<AccesoSesion> {
    if (!userId) return SIN_SESION;

    const [operador, permisos] = await Promise.all([
        prisma.operator.findUnique({
            where: { id: userId },
            select: { id: true, nombreCompleto: true, role: true, activo: true },
        }),
        getPermisosEspeciales(userId),
    ]);
    // Usuario borrado o dado de baja: la sesión no vale aunque el token siga vigente.
    if (!operador || !operador.activo) return SIN_SESION;

    const role = (operador.role || '').trim().toLowerCase();
    return {
        userId: operador.id,
        nombre: operador.nombreCompleto,
        role,
        permisos,
        puede: (funcion) => puedeFuncion(funcion, role, permisos),
    };
}

/** Atajo para chequear una sola función. */
export async function puede(req: Request, funcion: FuncionId): Promise<boolean> {
    return (await getAcceso(req)).puede(funcion);
}

/**
 * Exige un usuario activo en la sesión y, si se pasan funciones, al menos una de ellas.
 * Devuelve el acceso, o la respuesta de error (401/403) lista para retornar.
 */
export async function exigirAcceso(
    req: Request,
    funciones: FuncionId[] = [],
    mensaje = 'No tenés permiso para esta acción'
): Promise<AccesoSesion | NextResponse> {
    const acceso = await getAcceso(req);
    if (!acceso.userId) {
        return NextResponse.json({ error: 'Iniciá sesión para continuar' }, { status: 401 });
    }
    if (funciones.length > 0 && !funciones.some(f => acceso.puede(f))) {
        return NextResponse.json({ error: mensaje }, { status: 403 });
    }
    return acceso;
}
