import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

// Solo lectura: nunca crea ni borra etiquetas. Las etiquetas base se siembran aparte,
// solo las que faltan (scripts/seed-etiquetas-base.ts, lib/proyectos/etiquetasBase.ts).
export async function GET() {
    try {
        const tags = await prisma.projectTag.findMany({
            orderBy: { name: 'asc' },
            include: { 
                checklists: true,
                templates: {
                    include: {
                        checklistTemplate: true
                    }
                }
            }
        });
        return NextResponse.json(tags);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch tags', details: error.message || String(error) }, { status: 500 });
    }
}

// Crear, editar y borrar exigen la función "config.administrar" (lib/permisos.ts):
// por rol o por permiso especial del usuario. Borrar una etiqueta borra en cascada su
// checklist y sus vínculos con plantillas.
async function sinPermiso(req: Request): Promise<NextResponse | null> {
    const acceso = await exigirAcceso(req, ['config.administrar'], 'No tenés permiso para cambiar la configuración');
    return acceso instanceof NextResponse ? acceso : null;
}

const nombreSchema = z.string({ error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(100, 'El nombre no puede superar los 100 caracteres');

const siNoSchema = z.boolean({ error: 'Datos inválidos' });

const postSchema = z.object({
    name: nombreSchema,
    active: siNoSchema.default(true),
    impactsMetrics: siNoSchema.default(false),
});

const putSchema = z.object({
    id: z.string({ error: 'Falta la etiqueta a editar' }).min(1, 'Falta la etiqueta a editar'),
    name: nombreSchema.optional(),
    active: siNoSchema.optional(),
    impactsMetrics: siNoSchema.optional(),
});

async function leerBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | NextResponse> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    }
    return parsed.data;
}

function errorGuardado(e: unknown, mensaje: string) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') return NextResponse.json({ error: 'Ya existe una etiqueta con ese nombre.' }, { status: 409 });
        if (e.code === 'P2025') return NextResponse.json({ error: 'La etiqueta no existe.' }, { status: 404 });
    }
    return NextResponse.json({ error: mensaje }, { status: 500 });
}

export async function POST(req: Request) {
    const denegado = await sinPermiso(req);
    if (denegado) return denegado;
    const body = await leerBody(req, postSchema);
    if (body instanceof NextResponse) return body;
    try {
        const tag = await prisma.projectTag.create({ data: body });
        return NextResponse.json(tag);
    } catch (e) {
        return errorGuardado(e, 'No se pudo crear la etiqueta.');
    }
}

export async function PUT(req: Request) {
    const denegado = await sinPermiso(req);
    if (denegado) return denegado;
    const body = await leerBody(req, putSchema);
    if (body instanceof NextResponse) return body;
    try {
        const { id, ...data } = body;
        const tag = await prisma.projectTag.update({ where: { id }, data });
        return NextResponse.json(tag);
    } catch (e) {
        return errorGuardado(e, 'No se pudo actualizar la etiqueta.');
    }
}

export async function DELETE(req: Request) {
    const denegado = await sinPermiso(req);
    if (denegado) return denegado;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta la etiqueta a eliminar' }, { status: 400 });
    try {
        await prisma.projectTag.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        return errorGuardado(e, 'No se pudo eliminar la etiqueta.');
    }
}
