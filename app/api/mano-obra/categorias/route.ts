import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

/**
 * Categorías de mano de obra para elegir la de una persona (P20). Solo nombre: el valor hora
 * se ve y se edita en Presupuestos de servicio → Mano de obra (`/api/presupuestos-servicio/mano-obra`).
 */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const categorias = await prisma.manoObraCategoria.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    return NextResponse.json(categorias, { headers: { 'Cache-Control': 'private, no-store' } });
}
