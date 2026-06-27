import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const limite = parseInt(searchParams.get('limite') || '50');

        const ejecuciones = await prisma.datasetEjecucion.findMany({
            where: { datasetId: params.id },
            orderBy: { fechaEjecucion: 'desc' },
            take: Math.min(limite, 200),
        });

        return NextResponse.json(ejecuciones);
    } catch (error) {
        console.error('Error fetching historial:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
