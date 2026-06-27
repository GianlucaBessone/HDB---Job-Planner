import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { generateCodigoGrafico } from '@/lib/codeGenerator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const estado = searchParams.get('estado');

        const where: any = {};
        if (estado) where.estado = estado;

        const graficos = await prisma.graficoConfig.findMany({
            where,
            include: {
                dataset: { select: { id: true, nombre: true } }
            },
            orderBy: { codigoGrafico: 'asc' },
        });

        return NextResponse.json(graficos);
    } catch (error) {
        console.error('Error fetching gráficos:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (!body.nombre || !body.tipoGrafico) {
            return NextResponse.json({ error: 'nombre y tipoGrafico son obligatorios' }, { status: 400 });
        }

        const validTypes = ['Linea', 'Barra', 'Gauge', 'Indicador', 'Torta'];
        if (!validTypes.includes(body.tipoGrafico)) {
            return NextResponse.json({ error: `tipoGrafico inválido. Valores permitidos: ${validTypes.join(', ')}` }, { status: 400 });
        }

        const codigoGrafico = await generateCodigoGrafico();

        const grafico = await prisma.graficoConfig.create({
            data: {
                codigoGrafico,
                nombre: body.nombre,
                descripcion: body.descripcion || null,
                tipoGrafico: body.tipoGrafico,
                datasetId: body.datasetId || null,
                configuracion: body.configuracion || null,
                estado: body.estado || 'Activo',
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'GRAFICO',
            entityId: grafico.id,
            newValue: grafico,
        });

        return NextResponse.json(grafico, { status: 201 });
    } catch (error) {
        console.error('Error creating gráfico:', error);
        return NextResponse.json({ error: 'Error del servidor al crear gráfico' }, { status: 500 });
    }
}
