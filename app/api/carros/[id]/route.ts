import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enriquecerTool } from '@/lib/toolControl';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const cart = await prisma.tool.findFirst({
            where: {
                OR: [
                    { id: params.id, tipo: 'CARRO' },
                    // Support old TOOLCART: format QR codes
                    { id: params.id },
                ],
                activo: true,
            },
            include: {
                herramientas: {
                    where: { activo: true },
                    orderBy: { nombre: 'asc' },
                    include: {
                        verificaciones: {
                            orderBy: { fecha: 'desc' },
                            take: 1,
                        }
                    }
                },
                cartMovementsAsCarro: {
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

        const hasActiveMovement = cart.cartMovementsAsCarro.some(m => m.estado === 'ACTIVO');
        const enrichedHerramientas = cart.herramientas.map(h => enriquecerTool(h));

        return NextResponse.json({
            ...cart,
            herramientas: enrichedHerramientas,
            estado: hasActiveMovement ? 'EN_USO' : 'DISPONIBLE',
            // Backward compat: items array
            items: enrichedHerramientas.map(h => ({
                id: h.id,
                nombre: h.nombre,
                cantidad: 1,
            })),
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Fallo al obtener carro', details: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const { nombre, descripcion } = data;

        const cart = await prisma.tool.update({
            where: { id: params.id },
            data: {
                ...(nombre && { nombre }),
                ...(descripcion !== undefined && { descripcion }),
            },
        });

        return NextResponse.json(cart);
    } catch (e: any) {
        if (e.code === 'P2025') return NextResponse.json({ error: 'Carro no encontrado' }, { status: 404 });
        return NextResponse.json({ error: 'Fallo al actualizar carro', details: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const cart = await prisma.tool.findUnique({
            where: { id: params.id },
            include: {
                cartMovementsAsCarro: { where: { estado: 'ACTIVO' } }
            }
        });

        if (!cart) return NextResponse.json({ error: 'Carro no encontrado' }, { status: 404 });
        if (cart.cartMovementsAsCarro.length > 0) {
            return NextResponse.json({ error: 'No se puede eliminar un carro en uso.' }, { status: 400 });
        }

        // Unassign all tools first, then soft-delete
        await prisma.tool.updateMany({
            where: { carroId: params.id },
            data: { carroId: null }
        });

        await prisma.tool.update({
            where: { id: params.id },
            data: { activo: false }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Fallo al eliminar carro', details: e.message }, { status: 500 });
    }
}
