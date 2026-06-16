import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeCode(code: string | null | undefined): string {
    if (!code) return '';
    return code.replace(/^0+/, '').toLowerCase().trim();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const body = await req.json();
        const { codigo, precioUnitario } = body;

        if (!codigo) {
            return NextResponse.json({ error: 'Falta el código de material' }, { status: 400 });
        }
        if (typeof precioUnitario !== 'number') {
            return NextResponse.json({ error: 'Precio unitario inválido' }, { status: 400 });
        }

        const norm = normalizeCode(codigo);

        // Actualizamos todos los registros de MaterialProyecto de este proyecto que tengan códigos que coincidan al normalizar
        const allProjectMaterials = await prisma.materialProyecto.findMany({
            where: { 
                proyectoId: id,
                codigo: { not: null }
            }
        });
        const matchingProjectIds = allProjectMaterials
            .filter(m => normalizeCode(m.codigo) === norm)
            .map(m => m.id);

        if (matchingProjectIds.length > 0) {
            await prisma.materialProyecto.updateMany({
                where: { id: { in: matchingProjectIds } },
                data: {
                    precioVenta: precioUnitario
                }
            });
        }

        // Actualizar en el Maestro de Materiales para uso futuro (todos los códigos equivalentes)
        const allMaestros = await prisma.materialMaestro.findMany();
        const matchingMaestroCodes = allMaestros
            .filter(m => normalizeCode(m.codigo) === norm)
            .map(m => m.codigo);

        if (matchingMaestroCodes.length > 0) {
            await prisma.materialMaestro.updateMany({
                where: { codigo: { in: matchingMaestroCodes } },
                data: { precioVenta: precioUnitario }
            });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error updating material price:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

