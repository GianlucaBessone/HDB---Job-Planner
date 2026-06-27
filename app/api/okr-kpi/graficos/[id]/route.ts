import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const grafico = await prisma.graficoConfig.findUnique({
            where: { id: params.id },
            include: {
                okrsAsociados: { select: { id: true, codigoOkr: true, nombre: true } },
                kpisAsociados: { select: { id: true, codigoKpi: true, nombre: true, valorObjetivo: true, ultimoValor: true } },
            },
        });

        if (!grafico) {
            return NextResponse.json({ error: 'Gráfico no encontrado' }, { status: 404 });
        }

        return NextResponse.json(grafico);
    } catch (error) {
        console.error('Error fetching gráfico:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        const existing = await prisma.graficoConfig.findUnique({ where: { id: params.id } });
        if (!existing) {
            return NextResponse.json({ error: 'Gráfico no encontrado' }, { status: 404 });
        }

        const grafico = await prisma.graficoConfig.update({
            where: { id: params.id },
            data: {
                nombre: body.nombre ?? existing.nombre,
                descripcion: body.descripcion !== undefined ? body.descripcion : existing.descripcion,
                tipoGrafico: body.tipoGrafico ?? existing.tipoGrafico,
                datasetId: body.datasetId !== undefined ? body.datasetId : existing.datasetId,
                configuracion: body.configuracion !== undefined ? body.configuracion : existing.configuracion,
                estado: body.estado ?? existing.estado,
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'GRAFICO',
            entityId: grafico.id,
            oldValue: existing,
            newValue: grafico,
        });

        return NextResponse.json(grafico);
    } catch (error) {
        console.error('Error updating gráfico:', error);
        return NextResponse.json({ error: 'Error del servidor al actualizar gráfico' }, { status: 500 });
    }
}
