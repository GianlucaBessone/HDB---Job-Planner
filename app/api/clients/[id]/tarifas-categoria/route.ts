import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { valorPorDefecto } from '@/lib/manoObra/tarifa';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/**
 * Valor hora del cliente por categoría de mano de obra (P20). Para cada categoría activa devuelve
 * el valor de la categoría y, si existe, el del cliente. Sin valor del cliente se usa el de la categoría
 * (o el valor por defecto si la categoría no tiene).
 */
export async function GET(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['clientes.gestionar'], 'No tenés permiso para gestionar clientes');
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    const [categorias, propias, defecto] = await Promise.all([
        prisma.manoObraCategoria.findMany({ where: { activo: true }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true, valorHora: true } }),
        prisma.clienteTarifaCategoria.findMany({ where: { clientId: id }, select: { categoriaId: true, valorHora: true } }),
        valorPorDefecto(),
    ]);
    const delCliente = new Map(propias.map(p => [p.categoriaId, p.valorHora]));
    return NextResponse.json({
        valorPorDefecto: defecto,
        categorias: categorias.map(c => ({
            id: c.id,
            nombre: c.nombre,
            valorCategoria: c.valorHora,
            valorCliente: delCliente.has(c.id) ? delCliente.get(c.id)! : null,
        })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const schema = z.object({
    categoriaId: z.string().min(1).max(64),
    // null = quitar el valor del cliente y volver al de la categoría
    valorHora: z.coerce.number().min(0, 'El valor no puede ser negativo').max(10_000_000).nullable(),
});

export async function PUT(req: Request, { params }: Ctx) {
    const acceso = await exigirAcceso(req, ['clientes.gestionar'], 'No tenés permiso para gestionar clientes');
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    const { categoriaId, valorHora } = parsed.data;

    const [cliente, categoria] = await Promise.all([
        prisma.hdbClient.findUnique({ where: { id }, select: { id: true } }),
        prisma.manoObraCategoria.findUnique({ where: { id: categoriaId }, select: { id: true, nombre: true } }),
    ]);
    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    if (!categoria) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });

    const antes = await prisma.clienteTarifaCategoria.findUnique({ where: { clientId_categoriaId: { clientId: id, categoriaId } } });
    if (valorHora === null) {
        if (antes) await prisma.clienteTarifaCategoria.delete({ where: { id: antes.id } });
    } else {
        await prisma.clienteTarifaCategoria.upsert({
            where: { clientId_categoriaId: { clientId: id, categoriaId } },
            update: { valorHora },
            create: { clientId: id, categoriaId, valorHora },
        });
    }
    await logAudit({
        userId: acceso.userId,
        userName: acceso.nombre,
        action: valorHora === null ? 'DELETE' : antes ? 'UPDATE' : 'CREATE',
        entity: 'CLIENTE_TARIFA_CATEGORIA',
        entityId: `${id}:${categoriaId}`,
        oldValue: antes ? { categoria: categoria.nombre, valorHora: antes.valorHora } : undefined,
        newValue: valorHora === null ? undefined : { categoria: categoria.nombre, valorHora },
    });
    return NextResponse.json({ success: true });
}
