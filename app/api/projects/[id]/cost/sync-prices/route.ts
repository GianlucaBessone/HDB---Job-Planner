import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { preciosPorCodigos } from '@/lib/ventas/precioMaterial';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const acceso = await exigirAcceso(req, ['proyectos.costos'], 'No tenés permiso para ver o ajustar costos de proyecto');
        if (acceso instanceof NextResponse) return acceso;

        const { id } = params;

        // Fetch all materials for this project that have a code
        const materialesProyecto = await prisma.materialProyecto.findMany({
            where: { 
                proyectoId: id,
                codigo: { not: null }
            }
        });

        if (materialesProyecto.length === 0) {
            return NextResponse.json({ success: true, updated: 0 });
        }

        // Precio de venta vigente del catálogo de Productos con la lista del proyecto (P8).
        // Antes se copiaba de MaterialMaestro, una tabla que ya no se mantenía.
        const precios = await preciosPorCodigos(materialesProyecto.map(m => m.codigo as string), { proyectoId: id });

        let updated = 0;
        for (const mat of materialesProyecto) {
            const nuevo = mat.codigo ? precios[mat.codigo]?.precioVenta : undefined;
            if (nuevo !== undefined && mat.precioVenta !== nuevo) {
                await prisma.materialProyecto.update({ where: { id: mat.id }, data: { precioVenta: nuevo } });
                updated++;
            }
        }

        return NextResponse.json({ success: true, updated });
    } catch (e) {
        console.error('Error syncing material prices:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

