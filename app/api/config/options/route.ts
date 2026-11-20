import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

/**
 * Las opciones VIEW_ACCESS guardan los roles de cada vista del menú (ver /api/config/views):
 * tocarlas es configurar accesos, así que piden "config.vistas" y no solo "config.administrar".
 */
const CATEGORIA_VISTAS = 'VIEW_ACCESS';

function exigirParaCategoria(req: Request, category: unknown) {
    return category === CATEGORIA_VISTAS
        ? exigirAcceso(req, ['config.vistas'], 'No tenés permiso para configurar las vistas por rol')
        : exigirAcceso(req, ['config.administrar'], 'No tenés permiso para cambiar la configuración');
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');

        let options;
        if (category) {
            options = await prisma.configOption.findMany({
                where: { category },
                orderBy: { order: 'asc' }
            });
        } else {
            options = await prisma.configOption.findMany({
                orderBy: [{ category: 'asc' }, { order: 'asc' }]
            });
        }
        return NextResponse.json(options);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch config options' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const acceso = await exigirParaCategoria(req, body?.category);
        if (acceso instanceof NextResponse) return acceso;

        const option = await prisma.configOption.create({
            data: {
                category: body.category,
                value: body.value,
                active: body.active !== undefined ? body.active : true,
                order: body.order || 0,
            }
        });
        return NextResponse.json(option);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const actual = body?.id ? await prisma.configOption.findUnique({ where: { id: String(body.id) }, select: { category: true } }) : null;
        if (!actual) return NextResponse.json({ error: 'Opción no encontrada' }, { status: 404 });
        // Se mira la categoría actual y la nueva: no se puede mover una opción a VIEW_ACCESS ni sacarla de ahí.
        const categorias = [actual.category, body.category ?? actual.category].filter((c, i, arr) => arr.indexOf(c) === i);
        for (const categoria of categorias) {
            const acceso = await exigirParaCategoria(req, categoria);
            if (acceso instanceof NextResponse) return acceso;
        }

        const option = await prisma.configOption.update({
            where: { id: body.id },
            data: {
                category: body.category,
                value: body.value,
                active: body.active,
                order: body.order,
            }
        });
        return NextResponse.json(option);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const actual = await prisma.configOption.findUnique({ where: { id }, select: { category: true } });
        if (!actual) return NextResponse.json({ error: 'Opción no encontrada' }, { status: 404 });
        const acceso = await exigirParaCategoria(req, actual.category);
        if (acceso instanceof NextResponse) return acceso;

        await prisma.configOption.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
    }
}
