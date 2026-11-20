import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const materiales = await prisma.materialMaestro.findMany({
            select: {
                codigo: true,
                nombre: true,
                precioVenta: true,
                costo: true,
            },
            orderBy: { nombre: 'asc' }
        });
        return NextResponse.json(materiales);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching materials' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['ventas.catalogo_gestionar'], 'No tenés permiso para modificar el catálogo comercial');
        if (acceso instanceof NextResponse) return acceso;

        const body = await req.json();
        const { codigo, nombre, precioVenta, costo } = body;

        if (!codigo || !nombre) {
            return NextResponse.json({ error: 'Código y material son obligatorios' }, { status: 400 });
        }

        const existing = await prisma.materialMaestro.findUnique({ where: { codigo } });
        if (existing) {
            return NextResponse.json({ error: 'El código ya existe' }, { status: 400 });
        }

        const nuevoMaterial = await prisma.materialMaestro.create({
            data: {
                codigo,
                nombre,
                unidad: 'unidad', // default for now, could be passed in body
                precioVenta: precioVenta !== undefined && precioVenta !== null ? parseFloat(precioVenta) : null,
                costo: costo !== undefined && costo !== null ? parseFloat(costo) : null,
            }
        });

        return NextResponse.json(nuevoMaterial);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error creating material' }, { status: 500 });
    }
}
