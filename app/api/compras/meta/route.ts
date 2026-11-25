import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { PROVEEDORES_COMERCIALES } from '@/lib/proveedores';
import { almacenPorDefecto } from '@/lib/inventario/consumos';

export const dynamic = 'force-dynamic';

/** GET /api/compras/meta — proveedores comerciales activos y almacenes para armar una orden. */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['compras.ver', 'compras.gestionar', 'compras.recibir']);
    if (acceso instanceof NextResponse) return acceso;
    try {
        const [proveedores, almacenes, almacenId] = await Promise.all([
            prisma.proveedorVentas.findMany({
                where: { activo: true, ...PROVEEDORES_COMERCIALES },
                select: { id: true, razonSocial: true, cuit: true },
                orderBy: { razonSocial: 'asc' },
            }),
            prisma.almacen.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
            almacenPorDefecto(),
        ]);
        return NextResponse.json({ proveedores, almacenes, almacenPorDefecto: almacenId });
    } catch (error) {
        console.error('Error en compras/meta:', error);
        return NextResponse.json({ error: 'No se pudieron cargar los datos' }, { status: 500 });
    }
}
