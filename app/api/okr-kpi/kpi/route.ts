import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { generateCodigoKpi } from '@/lib/codeGenerator';
import { recalcularAvanceOkr } from '@/lib/okrKpiEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const okrId = searchParams.get('okrId');
        const estado = searchParams.get('estado');

        const where: any = {};
        if (okrId) where.okrId = okrId;
        if (estado) where.estado = estado;

        const kpis = await prisma.kpi.findMany({
            where,
            include: {
                okr: { select: { id: true, codigoOkr: true, nombre: true } },
                responsableCarga: { select: { id: true, nombreCompleto: true } },
                dataset: true,
                historico: {
                    orderBy: { fechaMedicion: 'desc' },
                    take: 10,
                },
                _count: { select: { historico: true, planesAccion: true } },
            },
            orderBy: { codigoKpi: 'asc' },
        });

        return NextResponse.json(kpis);
    } catch (error) {
        console.error('Error fetching KPIs:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (!body.okrId || !body.nombre || body.valorObjetivo === undefined) {
            return NextResponse.json({ error: 'okrId, nombre y valorObjetivo son obligatorios' }, { status: 400 });
        }

        // Verify OKR exists
        const okr = await prisma.okr.findUnique({ where: { id: body.okrId } });
        if (!okr) {
            return NextResponse.json({ error: 'OKR no encontrado' }, { status: 404 });
        }

        const codigoKpi = await generateCodigoKpi();

        const kpi = await prisma.kpi.create({
            data: {
                codigoKpi,
                okrId: body.okrId,
                nombre: body.nombre,
                descripcion: body.descripcion || null,
                formulaCalculo: body.formulaCalculo || null,
                unidadMedida: body.unidadMedida || null,
                valorObjetivo: parseFloat(body.valorObjetivo),
                valorMinimoAceptable: body.valorMinimoAceptable != null ? parseFloat(body.valorMinimoAceptable) : null,
                valorMaximoEsperado: body.valorMaximoEsperado != null ? parseFloat(body.valorMaximoEsperado) : null,
                frecuenciaMedicion: body.frecuenciaMedicion || null,
                responsableCargaId: body.responsableCargaId || null,
                fuenteDatos: body.fuenteDatos || null,
                estado: 'Activo',
                tipoRegistro: body.tipoRegistro || 'Manual',
                datasetId: body.datasetId || null,
                campoValor: body.campoValor || null,
                funcionAgregacion: body.funcionAgregacion || null,
                usuarioCreacionId: auth.user.id,
                usuarioModificacionId: auth.user.id,
            },
            include: {
                okr: { select: { id: true, codigoOkr: true, nombre: true } },
                responsableCarga: { select: { id: true, nombreCompleto: true } },
                dataset: true,
            },
        });

        // Recalculate OKR advance
        await recalcularAvanceOkr(body.okrId);

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'KPI',
            entityId: kpi.id,
            newValue: kpi,
        });

        return NextResponse.json(kpi, { status: 201 });
    } catch (error) {
        console.error('Error creating KPI:', error);
        return NextResponse.json({ error: 'Error del servidor al crear KPI' }, { status: 500 });
    }
}
