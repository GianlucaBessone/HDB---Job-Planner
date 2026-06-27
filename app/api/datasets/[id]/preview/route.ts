import { NextRequest, NextResponse } from 'next/server';
import { requireSGIRole } from '@/lib/sgiAuth';
import { ejecutarDataset } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

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
