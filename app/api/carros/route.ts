import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function GET() {
    try {
        const carts = await prisma.toolCart.findMany({
            include: {
                items: true,
                movements: {
                    where: { estado: 'ACTIVO' },
                    include: { operator: { select: { nombreCompleto: true } }, project: { select: { nombre: true, codigoProyecto: true } } }
                }
            },
            orderBy: { nombre: 'asc' }
        });
        return NextResponse.json(carts);
    } catch (e: any) {
        return NextResponse.json({ error: 'Fallo al obtener los carros', details: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const { nombre, descripcion, items } = data; // items = [{nombre, cantidad}]
        
        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        const cart = await prisma.toolCart.create({
            data: {
                nombre,
                descripcion,
                items: {
                    create: (items || []).map((i: any) => ({
                        nombre: i.nombre,
                        cantidad: i.cantidad || 1,
                    }))
                }
            },
            include: {
                items: true
            }
        });
        return NextResponse.json(cart);
    } catch (e: any) {
        if (e.code === 'P2002') return NextResponse.json({ error: 'Ya existe un carro con este nombre' }, { status: 400 });
        return NextResponse.json({ error: 'Fallo al crear carrito', details: e.message }, { status: 500 });
    }
}
