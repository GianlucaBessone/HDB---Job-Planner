import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { recalcularAvanceOkr } from '@/lib/okrKpiEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const kpi = await prisma.kpi.findUnique({
            where: { id: params.id },
            include: {
                okr: { select: { id: true, codigoOkr: true, nombre: true } },
                responsableCarga: { select: { id: true, nombreCompleto: true } },
                dataset: true,
                historico: {
                    orderBy: { fechaMedicion: 'desc' },
                },
                planesAccion: {
                    include: {
                        responsable: { select: { id: true, nombreCompleto: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!kpi) {
            return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 });
        }

        return NextResponse.json(kpi);
    } catch (error) {
        console.error('Error fetching KPI:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        const existing = await prisma.kpi.findUnique({ where: { id: params.id } });
        if (!existing) {
            return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 });
        }

        const kpi = await prisma.kpi.update({
            where: { id: params.id },
            data: {
                nombre: body.nombre ?? existing.nombre,
                descripcion: body.descripcion !== undefined ? body.descripcion : existing.descripcion,
                formulaCalculo: body.formulaCalculo !== undefined ? body.formulaCalculo : existing.formulaCalculo,
                unidadMedida: body.unidadMedida !== undefined ? body.unidadMedida : existing.unidadMedida,
                valorObjetivo: body.valorObjetivo !== undefined ? parseFloat(body.valorObjetivo) : existing.valorObjetivo,
                valorMinimoAceptable: body.valorMinimoAceptable !== undefined ? (body.valorMinimoAceptable != null ? parseFloat(body.valorMinimoAceptable) : null) : existing.valorMinimoAceptable,
                valorMaximoEsperado: body.valorMaximoEsperado !== undefined ? (body.valorMaximoEsperado != null ? parseFloat(body.valorMaximoEsperado) : null) : existing.valorMaximoEsperado,
                frecuenciaMedicion: body.frecuenciaMedicion !== undefined ? body.frecuenciaMedicion : existing.frecuenciaMedicion,
                responsableCargaId: body.responsableCargaId !== undefined ? (body.responsableCargaId === "" ? null : body.responsableCargaId) : existing.responsableCargaId,
                fuenteDatos: body.fuenteDatos !== undefined ? (body.fuenteDatos === "" ? null : body.fuenteDatos) : existing.fuenteDatos,
                estado: body.estado ?? existing.estado,
                tipoRegistro: body.tipoRegistro !== undefined ? body.tipoRegistro : existing.tipoRegistro,
                datasetId: body.datasetId !== undefined ? (body.datasetId === "" ? null : body.datasetId) : existing.datasetId,
                campoValor: body.campoValor !== undefined ? body.campoValor : existing.campoValor,
                funcionAgregacion: body.funcionAgregacion !== undefined ? body.funcionAgregacion : existing.funcionAgregacion,
                usuarioModificacionId: auth.user.id,
            },
            include: {
                okr: { select: { id: true, codigoOkr: true, nombre: true } },
                responsableCarga: { select: { id: true, nombreCompleto: true } },
                dataset: true,
            },
        });

        // Recalculate OKR advance (valor objetivo may have changed)
        await recalcularAvanceOkr(existing.okrId);

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'KPI',
            entityId: kpi.id,
            oldValue: existing,
            newValue: kpi,
        });

        return NextResponse.json(kpi);
    } catch (error) {
        console.error('Error updating KPI:', error);
        return NextResponse.json({ error: 'Error del servidor al actualizar KPI' }, { status: 500 });
    }
}
