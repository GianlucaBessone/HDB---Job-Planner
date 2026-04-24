import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToolId, generateToolIds } from '@/lib/codeGenerator';
import { enriquecerTool } from '@/lib/toolControl';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tipo = searchParams.get('tipo');
        const rubro = searchParams.get('rubro');
        const carroId = searchParams.get('carroId');
        const sinAsignar = searchParams.get('sinAsignar');
        const controlVencido = searchParams.get('controlVencido');
        const search = searchParams.get('search');
        const soloCarros = searchParams.get('soloCarros');

        const where: any = { activo: true };

        if (tipo) where.tipo = tipo;
        if (rubro) where.rubro = rubro;
        if (soloCarros === 'true') where.tipo = 'CARRO';
        if (carroId) where.carroId = carroId;
        if (sinAsignar === 'true') {
            where.carroId = null;
            where.tipo = { not: 'CARRO' };
        }
        if (search) {
            where.OR = [
                { nombre: { contains: search, mode: 'insensitive' } },
                { id: { contains: search, mode: 'insensitive' } },
                { marca: { contains: search, mode: 'insensitive' } },
            ];
        }

        const tools = await prisma.tool.findMany({
            where,
            include: {
                herramientas: tipo === 'CARRO' || soloCarros === 'true' ? {
                    where: { activo: true },
                    orderBy: { nombre: 'asc' }
                } : false,
                verificaciones: {
                    orderBy: { fecha: 'desc' },
                    take: 1,
                },
                cartMovementsAsCarro: tipo === 'CARRO' || soloCarros === 'true' ? {
                    where: { estado: 'ACTIVO' },
                    include: {
                        operator: { select: { nombreCompleto: true } },
                        project: { select: { nombre: true, codigoProyecto: true } }
                    }
                } : false,
            },
            orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
        });

        // Enrich with computed control state
        const enriched = tools.map(t => enriquecerTool(t));

        // Optionally filter by control status (post-query since it's computed)
        if (controlVencido === 'true') {
            return NextResponse.json(enriched.filter(t =>
                t.estadoControl === 'VENCIDO' || t.estadoControl === 'POR_VENCER'
            ));
        }

        return NextResponse.json(enriched);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener herramientas', details: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const {
            nombre, marca, descripcion, tipo, subtipo, rubro,
            controlActivo, periodoControl,
            cantidad = 1
        } = data;

        if (!nombre?.trim()) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }
        if (!tipo?.trim()) {
            return NextResponse.json({ error: 'El tipo es obligatorio' }, { status: 400 });
        }

        const count = Math.max(1, Math.min(cantidad, 100)); // Max 100 at once
        const ids = await generateToolIds(count);

        const toolData = ids.map(id => ({
            id,
            nombre: nombre.trim(),
            marca: marca?.trim() || null,
            descripcion: descripcion?.trim() || null,
            tipo: tipo.toUpperCase(),
            subtipo: subtipo?.toUpperCase() || null,
            rubro: rubro?.toUpperCase() || null,
            controlActivo: controlActivo || false,
            periodoControl: periodoControl || 60,
        }));

        // Use createMany for bulk, individual create for single
        if (count === 1) {
            const tool = await prisma.tool.create({ data: toolData[0] });
            return NextResponse.json(tool);
        }

        await prisma.tool.createMany({ data: toolData });

        // Return created tools
        const created = await prisma.tool.findMany({
            where: { id: { in: ids } },
            orderBy: { id: 'asc' }
        });

        return NextResponse.json(created);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al crear herramienta', details: e.message }, { status: 500 });
    }
}
