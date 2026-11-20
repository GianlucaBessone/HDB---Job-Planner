import { NextRequest, NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { ejecutarDataset } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['datasets.usar', 'datasets.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const resultado = await ejecutarDataset(params.id, {
            preview: false,
            usuarioId: auth.userId,
            tipo: 'Manual',
        });

        await logAudit({
            userId: auth.userId,
            action: 'UPDATE',
            entity: 'DATASET',
            entityId: params.id,
            metadata: {
                cantidadRegistros: resultado.cantidadRegistros,
                duracionMs: resultado.duracionMs,
            },
        });

        return NextResponse.json(resultado);
    } catch (error: any) {
        console.error('Error ejecutando dataset:', error);
        return NextResponse.json({
            error: error.message || 'Error al ejecutar el dataset',
        }, { status: 500 });
    }
}
