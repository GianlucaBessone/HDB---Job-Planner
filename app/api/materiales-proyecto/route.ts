import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/materiales-proyecto?proyectoId=xxx
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyectoId');
    
    // Autocomplete by codigo - Gestión Comercial como fuente maestra
    const searchCodigo = searchParams.get('codigo');
    if (searchCodigo) {
        const trimmed = searchCodigo.trim();
        const termNoZeros = trimmed.replace(/^0+/, '').toLowerCase();
        const upperTerm = trimmed.toUpperCase();
        
        // 1. Buscar primero en Gestión Comercial -> Producto
        const productoCandidato = await prisma.producto.findFirst({
            where: {
                activo: true,
                OR: [
                    { sku: { equals: upperTerm, mode: 'insensitive' } },
                    { sku: { contains: termNoZeros, mode: 'insensitive' } },
                    {
                        proveedores: {
                            some: { skuProveedor: { equals: upperTerm, mode: 'insensitive' } }
                        }
                    }
                ]
            },
            include: {
                unidad: { select: { codigo: true, nombre: true } },
                proveedores: {
                    where: { esPrincipal: true },
                    take: 1
                }
            }
        });

        if (productoCandidato) {
            return NextResponse.json({
                id: productoCandidato.id,
                codigo: productoCandidato.sku,
                nombre: productoCandidato.descripcion,
                unidad: productoCandidato.unidad?.codigo || productoCandidato.unidad?.nombre || 'Unidad',
                precioVenta: productoCandidato.precioBase,
                costo: productoCandidato.proveedores[0]?.costo || 0,
                skuProveedor: productoCandidato.proveedores[0]?.skuProveedor || null,
            }, {
                headers: { 'Cache-Control': 'no-store, max-age=0' },
            });
        }

        // 2. Fallback retrocompatible con MaterialMaestro
        const candidatos = await prisma.materialMaestro.findMany({
            where: { codigo: { contains: termNoZeros, mode: 'insensitive' } }
        });
        
        const maestro = candidatos.find(m => 
            m.codigo.replace(/^0+/, '').toLowerCase() === termNoZeros
        ) || null;

        return NextResponse.json(maestro, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    }

    if (!proyectoId) return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 });

    const materiales = await prisma.materialProyecto.findMany({
        where: { proyectoId },
        include: {
            usos: { orderBy: { createdAt: 'desc' } },
            devoluciones: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(materiales);
}

// POST /api/materiales-proyecto — crear material
export async function POST(req: Request) {
    const body = await req.json();
    const { proyectoId, nombre, unidad, codigo, cantidadSolicitada, cantidadDisponible, cantidadEntregada, precioVenta } = body;
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
            precioVenta: precioVenta ? parseFloat(precioVenta) : null,
            estado: (parseFloat(cantidadEntregada) > 0) ? 'material_entregado' : 'material_cargado'
        },
        include: { usos: true, devoluciones: true },
    });

    // Actualizar MaterialMaestro si se usó un código
    if (codigo) {
        await prisma.materialMaestro.upsert({
            where: { codigo },
            update: { 
                nombre, 
                unidad: unidad || 'unidad',
                precioVenta: precioVenta ? parseFloat(precioVenta) : undefined
            },
            create: { 
                codigo, 
                nombre, 
                unidad: unidad || 'unidad',
                precioVenta: precioVenta ? parseFloat(precioVenta) : null
            },
        });
    }

    return NextResponse.json(material, { status: 201 });
}
