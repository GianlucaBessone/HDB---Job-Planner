import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enriquecerTool } from '@/lib/toolControl';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        let cleanId = params.id ? decodeURIComponent(params.id).trim() : '';
        if (cleanId.startsWith('TOOL:')) cleanId = cleanId.replace('TOOL:', '').trim();
        else if (cleanId.startsWith('TOOLCART:')) cleanId = cleanId.replace('TOOLCART:', '').trim();

        const tool = await prisma.tool.findFirst({
            where: {
                OR: [
                    { id: cleanId },
                    { id: { equals: cleanId, mode: 'insensitive' } }
                ]
            },
            include: {
                herramientas: {
                    where: { activo: true },
                    orderBy: { nombre: 'asc' },
                    include: {
                        verificaciones: {
                            orderBy: { fecha: 'desc' },
                            take: 3
                        }
                    }
                },
                carro: {
                    select: { id: true, nombre: true }
                },
                verificaciones: {
                    orderBy: { fecha: 'desc' },
                    take: 20,
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

        if (!tool) {
            return NextResponse.json({ error: 'Herramienta o Carro no encontrado' }, { status: 404 });
        }

        const enrichedTool = enriquecerTool(tool as any);
        if (enrichedTool.herramientas) {
            enrichedTool.herramientas = enrichedTool.herramientas.map((h: any) => enriquecerTool(h));
        }

        return NextResponse.json(enrichedTool);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al consultar herramienta', details: e.message }, { status: 500 });
    }
}
