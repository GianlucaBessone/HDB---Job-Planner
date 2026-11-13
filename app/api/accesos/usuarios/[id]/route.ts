import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { claveFuncion, getFuncion, parseClave } from '@/lib/permisos';
import { esTablaPermisosFaltante, getAcceso } from '@/lib/permisosServer';
import { DEFAULT_VIEWS, VISTAS_DESACTIVADAS } from '@/lib/viewAccess';

export const dynamic = 'force-dynamic';

const SIN_PERMISO = 'No tenés permiso para administrar accesos';
const TABLA_FALTANTE =
    'El control de accesos todavía no está activo en la base de datos. Falta ejecutar "npx prisma db push".';

const bodySchema = z.object({
    permisos: z
        .array(
            z.object({
                clave: z.string().min(1).max(200),
                efecto: z.enum(['permitir', 'denegar']),
            })
        )
        .max(500),
});

function claveValida(clave: string): boolean {
    const parsed = parseClave(clave);
    if (!parsed) return false;
    if (parsed.tipo === 'funcion') return !!getFuncion(parsed.id);
    return DEFAULT_VIEWS.some(v => v.key === parsed.id) && !VISTAS_DESACTIVADAS.includes(parsed.id);
}

type Ctx = { params: Promise<{ id: string }> };

/** Permisos especiales de un usuario, para el editor de accesos. */
export async function GET(req: NextRequest, { params }: Ctx) {
    try {
        const { id } = await params;
        const acceso = await getAcceso(req);
        if (!acceso.puede('usuarios.accesos')) {
            return NextResponse.json({ error: SIN_PERMISO }, { status: 403 });
        }

        const operator = await prisma.operator.findUnique({
            where: { id },
            select: { id: true, nombreCompleto: true, role: true },
        });
        if (!operator) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

        let disponible = true;
        let permisos: { clave: string; efecto: string; otorgadoPorNombre: string | null; createdAt: Date }[] = [];
        try {
            permisos = await prisma.operatorPermiso.findMany({
                where: { operatorId: id },
                select: { clave: true, efecto: true, otorgadoPorNombre: true, createdAt: true },
                orderBy: { clave: 'asc' },
            });
        } catch (e) {
            if (!esTablaPermisosFaltante(e)) throw e;
            disponible = false;
        }

        return NextResponse.json(
            { operator, permisos, disponible },
            { headers: { 'Cache-Control': 'private, no-store' } }
        );
    } catch (e) {
        console.error('Error al leer accesos del usuario:', e);
        return NextResponse.json({ error: 'No se pudieron leer los accesos' }, { status: 500 });
    }
}

/** Reemplaza los permisos especiales de un usuario por la lista recibida. */
export async function PUT(req: NextRequest, { params }: Ctx) {
    try {
        const { id } = await params;
        const acceso = await getAcceso(req);
        if (!acceso.puede('usuarios.accesos')) {
            return NextResponse.json({ error: SIN_PERMISO }, { status: 403 });
        }

        const parsed = bodySchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
        }
        const nuevos = parsed.data.permisos;

        const claves = new Set<string>();
        for (const p of nuevos) {
            if (!claveValida(p.clave)) {
                return NextResponse.json({ error: `Acceso desconocido: ${p.clave}` }, { status: 400 });
            }
            if (claves.has(p.clave)) {
                return NextResponse.json({ error: `Acceso repetido: ${p.clave}` }, { status: 400 });
            }
            claves.add(p.clave);
        }

        const operator = await prisma.operator.findUnique({
            where: { id },
            select: { id: true, nombreCompleto: true },
        });
        if (!operator) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

        let actuales: { id: string; clave: string; efecto: string }[];
        try {
            actuales = await prisma.operatorPermiso.findMany({
                where: { operatorId: id },
                select: { id: true, clave: true, efecto: true },
            });
        } catch (e) {
            if (!esTablaPermisosFaltante(e)) throw e;
            return NextResponse.json({ error: TABLA_FALTANTE }, { status: 503 });
        }
        const actualPorClave = new Map(actuales.map(a => [a.clave, a]));

        // Nadie cambia su propio permiso de administrar accesos: evita quedarse afuera
        // (o que el único administrador se lo quite) por error.
        if (id === acceso.userId) {
            const clavePropia = claveFuncion('usuarios.accesos');
            const antes = actualPorClave.get(clavePropia)?.efecto ?? null;
            const despues = nuevos.find(p => p.clave === clavePropia)?.efecto ?? null;
            if (antes !== despues) {
                return NextResponse.json(
                    { error: 'No podés cambiar tu propio permiso de administrar accesos. Pedíselo a otro administrador.' },
                    { status: 400 }
                );
            }
        }

        const aBorrar = actuales.filter(a => !claves.has(a.clave)).map(a => a.id);
        const aGuardar = nuevos.filter(p => actualPorClave.get(p.clave)?.efecto !== p.efecto);

        if (aBorrar.length === 0 && aGuardar.length === 0) {
            return NextResponse.json({ success: true, cambios: 0 });
        }

        const autor = await prisma.operator.findUnique({
            where: { id: acceso.userId },
            select: { nombreCompleto: true },
        });

        await prisma.$transaction([
            prisma.operatorPermiso.deleteMany({ where: { id: { in: aBorrar } } }),
            ...aGuardar.map(p =>
                prisma.operatorPermiso.upsert({
                    where: { operatorId_clave: { operatorId: id, clave: p.clave } },
                    create: {
                        operatorId: id,
                        clave: p.clave,
                        efecto: p.efecto,
                        otorgadoPorId: acceso.userId,
                        otorgadoPorNombre: autor?.nombreCompleto ?? null,
                    },
                    update: {
                        efecto: p.efecto,
                        otorgadoPorId: acceso.userId,
                        otorgadoPorNombre: autor?.nombreCompleto ?? null,
                        createdAt: new Date(),
                    },
                })
            ),
        ]);

        await logAudit({
            userId: acceso.userId,
            userName: autor?.nombreCompleto,
            action: 'UPDATE',
            entity: 'OPERATOR_PERMISOS',
            entityId: id,
            oldValue: actuales.map(a => ({ clave: a.clave, efecto: a.efecto })),
            newValue: nuevos,
            metadata: { usuario: operator.nombreCompleto },
        });

        return NextResponse.json({ success: true, cambios: aBorrar.length + aGuardar.length });
    } catch (e) {
        console.error('Error al guardar accesos del usuario:', e);
        return NextResponse.json({ error: 'No se pudieron guardar los accesos' }, { status: 500 });
    }
}
