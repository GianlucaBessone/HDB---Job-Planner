import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
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

        const codes = Array.from(new Set(materialesProyecto.map(m => m.codigo as string)));

        // Fetch master materials
        const maestros = await prisma.materialMaestro.findMany({
            where: { codigo: { in: codes } }
        });

        const maestroMap = new Map<string, number>();
        for (const m of maestros) {
            if (m.precioVenta != null) {
                maestroMap.set(m.codigo, m.precioVenta);
            }
        }

        let updated = 0;
        
        // Update each project material with the latest master price
        for (const mat of materialesProyecto) {
            if (mat.codigo && maestroMap.has(mat.codigo)) {
                const newPrice = maestroMap.get(mat.codigo)!;
                if (mat.precioVenta !== newPrice) {
                    await prisma.materialProyecto.update({
                        where: { id: mat.id },
                        data: { precioVenta: newPrice }
                    });
                    updated++;
                }
            }
        }

        return NextResponse.json({ success: true, updated });
    } catch (e) {
        console.error('Error syncing material prices:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
