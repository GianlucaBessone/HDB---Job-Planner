import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// GET /api/materiales-proyecto?proyectoId=xxx
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyectoId');
    if (!proyectoId) return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 });

    const materiales = await prisma.materialProyecto.findMany({
        where: { proyectoId },
        include: {
            usos: { orderBy: { createdAt: 'desc' } },
            devolucion: true,
        },
        orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(materiales);
}

// POST /api/materiales-proyecto — crear material
export async function POST(req: Request) {
    const body = await req.json();
    const { proyectoId, nombre, unidad, cantidadSolicitada, cantidadDisponible, cantidadEntregada } = body;
    if (!proyectoId || !nombre) return NextResponse.json({ error: 'proyectoId y nombre son requeridos' }, { status: 400 });

    const material = await prisma.materialProyecto.create({
        data: {
            proyectoId,
            nombre,
            unidad: unidad || 'unidad',
            cantidadSolicitada: parseFloat(cantidadSolicitada) || 0,
            cantidadDisponible: parseFloat(cantidadDisponible) || 0,
            cantidadEntregada: parseFloat(cantidadEntregada) || 0,
        },
        include: { usos: true, devolucion: true },
    });
    return NextResponse.json(material, { status: 201 });
}
