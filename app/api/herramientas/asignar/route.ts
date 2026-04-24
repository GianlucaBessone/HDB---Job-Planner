import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST - Assign tool to cart
 * DELETE - Unassign tool from cart
 */
export async function POST(req: Request) {
    try {
        const { toolId, carroId } = await req.json();

        if (!toolId || !carroId) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        // Validate the cart exists and is type CARRO
        const carro = await prisma.tool.findUnique({ where: { id: carroId } });
        if (!carro || carro.tipo !== 'CARRO') {
            return NextResponse.json({ error: 'El carro especificado no existe o no es de tipo CARRO' }, { status: 400 });
        }

        // Validate the tool exists and is not already assigned
        const tool = await prisma.tool.findUnique({ where: { id: toolId } });
        if (!tool) return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
        if (tool.tipo === 'CARRO') {
            return NextResponse.json({ error: 'No se puede asignar un carro dentro de otro carro' }, { status: 400 });
        }
        if (tool.carroId) {
            return NextResponse.json({
                error: `Esta herramienta ya está asignada al carro ${tool.carroId}. Desasígnela primero.`
            }, { status: 400 });
        }

        const updated = await prisma.tool.update({
            where: { id: toolId },
            data: { carroId }
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al asignar herramienta', details: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const toolId = searchParams.get('toolId');

        if (!toolId) {
            return NextResponse.json({ error: 'Falta el toolId' }, { status: 400 });
        }

        const tool = await prisma.tool.findUnique({ where: { id: toolId } });
        if (!tool) return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });

        const updated = await prisma.tool.update({
            where: { id: toolId },
            data: { carroId: null }
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al desasignar herramienta', details: e.message }, { status: 500 });
    }
}
