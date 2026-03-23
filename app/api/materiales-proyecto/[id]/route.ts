import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// PUT /api/materiales-proyecto/[id] — actualizar material
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    const body = await req.json();
    const { nombre, unidad, cantidadSolicitada, cantidadDisponible, cantidadEntregada, estado } = body;

    const material = await prisma.materialProyecto.update({
        where: { id },
        data: {
            ...(nombre !== undefined && { nombre }),
            ...(unidad !== undefined && { unidad }),
            ...(cantidadSolicitada !== undefined && { cantidadSolicitada: parseFloat(cantidadSolicitada) }),
            ...(cantidadDisponible !== undefined && { cantidadDisponible: parseFloat(cantidadDisponible) }),
            ...(cantidadEntregada !== undefined && { cantidadEntregada: parseFloat(cantidadEntregada) }),
            ...(estado !== undefined && { estado }),
        },
        include: { usos: true, devolucion: true },
    });
    return NextResponse.json(material);
}

// DELETE /api/materiales-proyecto/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    await prisma.materialProyecto.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
