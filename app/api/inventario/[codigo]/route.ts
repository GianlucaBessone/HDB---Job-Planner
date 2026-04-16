import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: { codigo: string } }) {
    try {
        const body = await req.json();
        const { nombre, precioVenta, costo } = body;

        if (!nombre) {
            return NextResponse.json({ error: 'El material (nombre) es obligatorio' }, { status: 400 });
        }

        const actualizado = await prisma.materialMaestro.update({
            where: { codigo: params.codigo },
            data: {
                nombre,
                precioVenta: precioVenta !== undefined && precioVenta !== null ? parseFloat(precioVenta) : null,
                costo: costo !== undefined && costo !== null ? parseFloat(costo) : null,
            }
        });

        return NextResponse.json(actualizado);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ error: error.message || 'Error updating material' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { codigo: string } }) {
    try {
        await prisma.materialMaestro.delete({
            where: { codigo: params.codigo }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 });
        }
        // Check for relational constraints if any
        return NextResponse.json({ error: 'No se puede eliminar el material. Es posible que esté en uso.' }, { status: 500 });
    }
}
