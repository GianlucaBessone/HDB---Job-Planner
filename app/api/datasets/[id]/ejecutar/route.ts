import { NextRequest, NextResponse } from 'next/server';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { ejecutarDataset } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const resultado = await ejecutarDataset(params.id, {
            preview: false,
            usuarioId: auth.user.id,
            tipo: 'Manual',
        });

        await logAudit({
            userId: auth.user.id,
            action: 'EXECUTE',
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
