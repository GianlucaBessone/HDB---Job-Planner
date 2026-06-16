import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeCode(code: string | null | undefined): string {
    if (!code) return '';
    return code.replace(/^0+/, '').toLowerCase().trim();
}

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

        // Fetch all master materials
        const maestros = await prisma.materialMaestro.findMany();

        // Map normalized code to price
        const maestroMap = new Map<string, number>();
        for (const m of maestros) {
            if (m.precioVenta != null) {
                const norm = normalizeCode(m.codigo);
                const existing = maestroMap.get(norm);
                if (existing === undefined) {
                    maestroMap.set(norm, m.precioVenta);
                }
            }
        }

        // Map exact code to price to prioritize exact match
        const exactMaestroMap = new Map<string, number>();
        for (const m of maestros) {
            if (m.precioVenta != null) {
                exactMaestroMap.set(m.codigo, m.precioVenta);
            }
        }

        let updated = 0;
        
        // Update each project material with the latest master price
        for (const mat of materialesProyecto) {
            if (mat.codigo) {
                const exactPrice = exactMaestroMap.get(mat.codigo);
                const norm = normalizeCode(mat.codigo);
                const normPrice = maestroMap.get(norm);
                
                const newPrice = exactPrice !== undefined ? exactPrice : normPrice;

                if (newPrice !== undefined && mat.precioVenta !== newPrice) {
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

