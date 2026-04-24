import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enriquecerTool } from '@/lib/toolControl';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const tool = await prisma.tool.findUnique({
            where: { id: params.id },
            include: {
                herramientas: {
                    where: { activo: true },
                    orderBy: { nombre: 'asc' },
                },
                carro: {
                    select: { id: true, nombre: true }
                },
                verificaciones: {
                    orderBy: { fecha: 'desc' },
                    take: 10,
                },
                cartMovementsAsCarro: {
                    orderBy: { fechaSalida: 'desc' },
                    take: 5,
                    include: {
                        operator: { select: { nombreCompleto: true } },
                        project: { select: { nombre: true, codigoProyecto: true } },
                        items: true,
                    }
                }
            }
        });

        if (!tool) return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });

        const enrichedTool = enriquecerTool(tool);
        if (enrichedTool.herramientas) {
            enrichedTool.herramientas = enrichedTool.herramientas.map((h: any) => enriquecerTool(h));
        }

        return NextResponse.json(enrichedTool);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener herramienta', details: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const { nombre, marca, descripcion, tipo, subtipo, rubro, controlActivo, periodoControl } = data;

        const tool = await prisma.tool.update({
            where: { id: params.id },
            data: {
                ...(nombre !== undefined && { nombre: nombre.trim() }),
                ...(marca !== undefined && { marca: marca?.trim() || null }),
                ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
                ...(tipo !== undefined && { tipo: tipo.toUpperCase() }),
                ...(subtipo !== undefined && { subtipo: subtipo?.toUpperCase() || null }),
                ...(rubro !== undefined && { rubro: rubro?.toUpperCase() || null }),
                ...(controlActivo !== undefined && { controlActivo }),
                ...(periodoControl !== undefined && { periodoControl }),
            }
        });

        return NextResponse.json(tool);
    } catch (e: any) {
        if (e.code === 'P2025') return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
        return NextResponse.json({ error: 'Error al actualizar herramienta', details: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const tool = await prisma.tool.findUnique({
            where: { id: params.id },
            include: {
                cartMovementsAsCarro: { where: { estado: 'ACTIVO' } },
                herramientas: { where: { activo: true } },
            }
        });

        if (!tool) return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });

        // Can't delete a cart with active movements
        if (tool.tipo === 'CARRO' && tool.cartMovementsAsCarro.length > 0) {
            return NextResponse.json({ error: 'No se puede eliminar un carro con movimientos activos' }, { status: 400 });
        }

        // Soft delete by marking inactive
        await prisma.tool.update({
            where: { id: params.id },
            data: { activo: false, carroId: null }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al eliminar herramienta', details: e.message }, { status: 500 });
    }
}
