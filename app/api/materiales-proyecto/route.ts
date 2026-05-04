import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/materiales-proyecto?proyectoId=xxx
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyectoId');
    
    // Autocomplete by codigo
    const searchCodigo = searchParams.get('codigo');
    if (searchCodigo) {
        const termNoZeros = searchCodigo.replace(/^0+/, '').toLowerCase();
        
        // Buscar candidatos que contengan el término
        const candidatos = await prisma.materialMaestro.findMany({
            where: { codigo: { contains: termNoZeros, mode: 'insensitive' } }
        });
        
        // Encontrar coincidencia exacta ignorando ceros a la izquierda
        const maestro = candidatos.find(m => 
            m.codigo.replace(/^0+/, '').toLowerCase() === termNoZeros
        ) || null;
        return NextResponse.json(maestro, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    }

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
    const { proyectoId, nombre, unidad, codigo, cantidadSolicitada, cantidadDisponible, cantidadEntregada } = body;
    if (!proyectoId || !nombre) return NextResponse.json({ error: 'proyectoId y nombre son requeridos' }, { status: 400 });

    const material = await prisma.materialProyecto.create({
        data: {
            proyectoId,
            nombre,
            codigo: codigo || null,
            unidad: unidad || 'unidad',
            cantidadSolicitada: parseFloat(cantidadSolicitada) || 0,
            cantidadDisponible: parseFloat(cantidadDisponible) || 0,
            cantidadEntregada: parseFloat(cantidadEntregada) || 0,
        },
        include: { usos: true, devolucion: true },
    });

    // Actualizar MaterialMaestro si se usó un código
    if (codigo) {
        await prisma.materialMaestro.upsert({
            where: { codigo },
            update: { nombre, unidad: unidad || 'unidad' },
            create: { codigo, nombre, unidad: unidad || 'unidad' },
        });
    }

    return NextResponse.json(material, { status: 201 });
}
