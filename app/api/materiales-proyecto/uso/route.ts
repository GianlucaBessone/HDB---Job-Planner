import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/materiales-proyecto/uso
// Body: { materialId, cantidadUtilizada, operadorNombre, ordenServicioId? }
export async function POST(req: Request) {
    const body = await req.json();
    const { materialId, cantidadUtilizada, operadorNombre, ordenServicioId } = body;

    if (!materialId || cantidadUtilizada === undefined || !operadorNombre) {
        return NextResponse.json({ error: 'materialId, cantidadUtilizada y operadorNombre son requeridos' }, { status: 400 });
    }

    const uso = await prisma.materialUso.create({
        data: {
            materialId,
            cantidadUtilizada: parseFloat(cantidadUtilizada),
            operadorNombre,
            ordenServicioId: ordenServicioId || null,
        },
    });

    // Update material state to 'uso_confirmado'
    await prisma.materialProyecto.update({
        where: { id: materialId },
        data: { estado: 'uso_confirmado' },
    });

    return NextResponse.json(uso, { status: 201 });
}
