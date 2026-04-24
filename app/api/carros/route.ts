import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enriquecerTool } from '@/lib/toolControl';

/**
 * Carros API — now backed by Tool model where tipo = 'CARRO'
 */
export async function GET() {
    try {
        const carts = await prisma.tool.findMany({
            where: { tipo: 'CARRO', activo: true },
            include: {
                herramientas: {
                    where: { activo: true },
                    orderBy: { nombre: 'asc' },
                },
                cartMovementsAsCarro: {
                    where: { estado: 'ACTIVO' },
                    include: {
                        operator: { select: { nombreCompleto: true } },
                        project: { select: { nombre: true, codigoProyecto: true } }
                    }
                }
            },
            orderBy: { nombre: 'asc' }
        });

        // Derive estado from active movements
        const result = carts.map(cart => {
            const hasActiveMovement = cart.cartMovementsAsCarro.length > 0;
            return {
                ...enriquecerTool(cart),
                estado: hasActiveMovement ? 'EN_USO' : 'DISPONIBLE',
                // Map herramientas to items format for backward compat
                items: cart.herramientas.map(h => ({
                    id: h.id,
                    nombre: h.nombre,
                    cantidad: 1, // each tool is individual now
                })),
            };
        });

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: 'Fallo al obtener los carros', details: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const { nombre, descripcion, items } = data;

        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        // This endpoint now creates a Tool of tipo CARRO
        // For backward compat from ToolCartsSection / config
        const { generateToolId } = await import('@/lib/codeGenerator');
        const id = await generateToolId();

        const cart = await prisma.tool.create({
            data: {
                id,
                nombre,
                descripcion,
                tipo: 'CARRO',
            }
        });

        return NextResponse.json(cart);
    } catch (e: any) {
        return NextResponse.json({ error: 'Fallo al crear carro', details: e.message }, { status: 500 });
    }
}
