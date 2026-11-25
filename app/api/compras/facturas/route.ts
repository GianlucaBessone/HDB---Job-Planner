import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { numeroFactura } from '@/lib/comprasTipos';

export const dynamic = 'force-dynamic';

/** GET /api/compras/facturas?proveedorId= — últimas facturas del proveedor, para vincular a una orden. */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['compras.gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const proveedorId = new URL(req.url).searchParams.get('proveedorId');
    if (!proveedorId) return NextResponse.json({ error: 'Falta el proveedor' }, { status: 400 });
    try {
        const facturas = await prisma.facturaConsumo.findMany({
            where: { proveedorId, esFactura: true },
            select: {
                id: true,
                tipoComprobante: true,
                letraComprobante: true,
                puntoVenta: true,
                numeroComprobante: true,
                fechaEmision: true,
                total: true,
                ordenesCompra: { select: { numero: true } },
            },
            orderBy: { fechaEmision: 'desc' },
            take: 50,
        });
        return NextResponse.json({
            facturas: facturas.map((f) => ({
                id: f.id,
                numero: numeroFactura(f),
                fechaEmision: f.fechaEmision.toISOString(),
                total: f.total,
                ordenes: f.ordenesCompra.map((o) => o.numero),
            })),
        });
    } catch (error) {
        console.error('Error en compras/facturas:', error);
        return NextResponse.json({ error: 'No se pudieron cargar las facturas' }, { status: 500 });
    }
}
