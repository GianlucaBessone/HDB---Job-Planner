import { NextRequest, NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { ejecutarDataset } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['datasets.usar', 'datasets.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const resultado = await ejecutarDataset(params.id, {
            preview: true,
        });

        return NextResponse.json(resultado);
    } catch (error: any) {
        console.error('Error preview dataset:', error);
        return NextResponse.json({
            error: error.message || 'Error al previsualizar el dataset',
        }, { status: 500 });
    }
}
