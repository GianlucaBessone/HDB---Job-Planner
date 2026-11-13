/**
 * Control de accesos del lado del servidor: lee los permisos especiales del
 * usuario de la sesión y resuelve sus funciones. Catálogo y reglas en lib/permisos.ts.
 *
 * Uso en una API:
 *
 *     const acceso = await getAcceso(req);
 *     if (!acceso.puede('ventas.anular_venta')) return NextResponse.json({ error: '...' }, { status: 403 });
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
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
    userId: string;
    role: string;
    permisos: PermisoEspecial[];
    puede: (funcion: FuncionId) => boolean;
}

/** Acceso del usuario de la sesión (el middleware deja x-user-id / x-user-role). */
export async function getAcceso(req: Request): Promise<AccesoSesion> {
    const userId = req.headers.get('x-user-id') || '';
    const role = (req.headers.get('x-user-role') || '').toLowerCase();
    const permisos = await getPermisosEspeciales(userId);
    return {
        userId,
        role,
        permisos,
        puede: (funcion) => !!userId && puedeFuncion(funcion, role, permisos),
    };
}

/** Atajo para chequear una sola función. */
export async function puede(req: Request, funcion: FuncionId): Promise<boolean> {
    return (await getAcceso(req)).puede(funcion);
}
