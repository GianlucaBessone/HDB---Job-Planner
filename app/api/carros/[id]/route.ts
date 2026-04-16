import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const cart = await prisma.toolCart.findUnique({
            where: { id: params.id },
            include: {
                items: true,
                movements: {
                    orderBy: { fechaSalida: 'desc' },
                    include: {
                        operator: { select: { nombreCompleto: true } },
                        project: { select: { nombre: true, codigoProyecto: true } },
                        items: true
                    }
                }
            }
        });
        if (!cart) return NextResponse.json({ error: 'Carro no encontrado' }, { status: 404 });
        return NextResponse.json(cart);
    } catch (e: any) {
        return NextResponse.json({ error: 'Fallo al obtener carro', details: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const { nombre, descripcion, items } = data;

        // Clean slate old items to map the new array cleanly (only for items; we keep movements separate)
        await prisma.toolCartItem.deleteMany({ where: { cartId: params.id } });

        const cart = await prisma.toolCart.update({
            where: { id: params.id },
            data: {
                nombre,
                descripcion,
                items: {
                    create: (items || []).map((i: any) => ({
                        nombre: i.nombre,
                        cantidad: i.cantidad || 1
                    }))
                }
            },
            include: { items: true }
        });
        return NextResponse.json(cart);
    } catch (e: any) {
        if (e.code === 'P2002') return NextResponse.json({ error: 'Ya existe un carro con este nombre' }, { status: 400 });
        return NextResponse.json({ error: 'Fallo al actualizar carro', details: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        // Can only delete if no active movements
        const cart = await prisma.toolCart.findUnique({ where: { id: params.id }, include: { movements: { where: { estado: 'ACTIVO' } } } });
        if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
        if (cart.movements.length > 0) return NextResponse.json({ error: 'No se puede eliminar un carro en uso.' }, { status: 400 });

        await prisma.toolCart.delete({ where: { id: params.id } });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Fallo al eliminar carro', details: e.message }, { status: 500 });
    }
}
