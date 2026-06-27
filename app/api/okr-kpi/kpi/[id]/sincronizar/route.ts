import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { recalcularTrasNuevaMedicion } from '@/lib/okrKpiEngine';
import { ejecutarDataset, extraerValorParaKpi } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const kpi = await prisma.kpi.findUnique({
            where: { id: params.id },
            include: { dataset: true }
        });

        if (!kpi) {
            return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 });
        }

        if (kpi.tipoRegistro !== 'Dataset' || !kpi.datasetId || !kpi.dataset) {
            return NextResponse.json({ error: 'El KPI no está configurado para registro vía Dataset o no tiene dataset asignado' }, { status: 400 });
        }

        if (!kpi.campoValor) {
            return NextResponse.json({ error: 'El KPI no tiene configurado el campoValor para extraer los datos' }, { status: 400 });
        }

        // Ejecutar el dataset
        const resultado = await ejecutarDataset(kpi.datasetId, {
            preview: false,
            usuarioId: auth.user.id,
            tipo: 'Manual'
        });

        // Extraer el valor para el KPI
        const valorObtenidoRaw = extraerValorParaKpi(resultado.datos, kpi.campoValor, kpi.funcionAgregacion);

        if (valorObtenidoRaw === null) {
            return NextResponse.json({ error: 'No se pudo obtener un valor numérico válido desde el Dataset para el campo indicado' }, { status: 400 });
        }

        // Redondear a 2 decimales
        let valorObtenido = Math.round(valorObtenidoRaw * 100) / 100;

        // Get the user name for snapshot
        let usuarioNombre: string | null = null;
        if (auth.user.id) {
            const op = await prisma.operator.findUnique({
                where: { id: auth.user.id },
                select: { nombreCompleto: true },
            });
            usuarioNombre = op?.nombreCompleto || null;
        }

        // Crear medición
        const medicion = await prisma.kpiHistorico.create({
            data: {
                kpiId: params.id,
                fechaMedicion: new Date(),
                valorObtenido,
                comentario: `Sincronización automática desde Dataset: ${kpi.dataset.codigoDataset}`,
                usuarioRegistroId: auth.user.id,
                usuarioRegistroNombre: usuarioNombre,
            },
        });

        // Recalcular estado del KPI y del OKR
        await recalcularTrasNuevaMedicion(params.id);

        await logAudit({
            userId: auth.user.id,
            action: 'SYNC',
            entity: 'KPI_MEDICION',
            entityId: medicion.id,
            newValue: medicion,
            metadata: { kpiId: params.id, datasetId: kpi.datasetId },
        });

        return NextResponse.json({ success: true, valorObtenido }, { status: 201 });
    } catch (error: any) {
        console.error('Error syncing KPI:', error);
        return NextResponse.json({ error: error.message || 'Error del servidor al sincronizar' }, { status: 500 });
    }
}

