import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToolIds } from '@/lib/codeGenerator';

export async function POST(req: Request) {
    try {
        const { toolId, cantidad, carroId } = await req.json();

        if (!toolId) {
            return NextResponse.json({ error: 'Se requiere el ID de la herramienta' }, { status: 400 });
        }

        const count = Math.max(1, Math.min(Number(cantidad) || 1, 100));

        // Find the source tool
        const source = await prisma.tool.findUnique({ where: { id: toolId } });
        if (!source) {
            return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
        }

        if (source.tipo === 'CARRO') {
            return NextResponse.json({ error: 'No se pueden replicar carros' }, { status: 400 });
        }

        // Validate carroId if provided
        if (carroId) {
            const carro = await prisma.tool.findUnique({ where: { id: carroId } });
            if (!carro || carro.tipo !== 'CARRO') {
                return NextResponse.json({ error: 'El carro especificado no existe o no es de tipo CARRO' }, { status: 400 });
            }
        }

        // Generate new unique IDs
        const ids = await generateToolIds(count);

        const toolData = ids.map(id => ({
            id,
            nombre: source.nombre,
            marca: source.marca,
            descripcion: source.descripcion,
            tipo: source.tipo,
            subtipo: source.subtipo,
            rubro: source.rubro,
            controlActivo: source.controlActivo,
            periodoControl: source.periodoControl,
            carroId: carroId || null,
        }));

        await prisma.tool.createMany({ data: toolData });

        const created = await prisma.tool.findMany({
            where: { id: { in: ids } },
            orderBy: { id: 'asc' }
        });

        return NextResponse.json(created);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al replicar herramienta', details: e.message }, { status: 500 });
    }
}
