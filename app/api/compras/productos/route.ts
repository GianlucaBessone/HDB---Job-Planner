import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { buildProductSearchWhere } from '@/lib/ventas/skuUtils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/compras/productos?q=&proveedorId= — productos para una orden de compra, con el costo de ese proveedor
 * (o el del proveedor principal si no lo tiene cargado) y el stock total.
 */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['compras.gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const sp = new URL(req.url).searchParams;
    const q = (sp.get('q') || '').trim().slice(0, 80);
    const proveedorId = sp.get('proveedorId') || '';
    if (q.length < 2) return NextResponse.json({ productos: [] });
    try {
        const productos = await prisma.producto.findMany({
            where: { activo: true, ...buildProductSearchWhere(q) },
            select: {
                id: true,
                sku: true,
                descripcion: true,
                unidad: { select: { codigo: true } },
                proveedores: { select: { proveedorId: true, costo: true, esPrincipal: true, skuProveedor: true } },
                stocks: { select: { stockActual: true } },
            },
            orderBy: { sku: 'asc' },
            take: 25,
        });
        return NextResponse.json({
            productos: productos.map((p) => {
                const delProveedor = p.proveedores.find((v) => v.proveedorId === proveedorId);
                const principal = p.proveedores.find((v) => v.esPrincipal) || p.proveedores[0];
                return {
                    id: p.id,
                    sku: p.sku,
                    descripcion: p.descripcion,
                    unidad: p.unidad?.codigo ?? null,
                    costo: (delProveedor || principal)?.costo ?? 0,
                    esDelProveedor: !!delProveedor,
                    skuProveedor: delProveedor?.skuProveedor ?? null,
                    stock: p.stocks.reduce((a, s) => a + s.stockActual, 0),
                };
            }),
        });
    } catch (error) {
        console.error('Error en compras/productos:', error);
        return NextResponse.json({ error: 'No se pudo buscar' }, { status: 500 });
    }
}
