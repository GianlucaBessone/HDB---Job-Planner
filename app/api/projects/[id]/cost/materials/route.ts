import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

        // Actualizamos todos los registros de MaterialProyecto de este proyecto que tengan este código
        await prisma.materialProyecto.updateMany({
            where: { 
                proyectoId: id,
                codigo: codigo 
            },
            data: {
                precioVenta: precioUnitario
            }
        });

        // Actualizar en el Maestro de Materiales para uso futuro
        await prisma.materialMaestro.updateMany({
            where: { codigo: codigo },
            data: { precioVenta: precioUnitario }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error updating material price:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
