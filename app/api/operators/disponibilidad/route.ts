import { NextRequest, NextResponse } from 'next/server';
import { sesion, responderError } from '@/lib/presupuestosServicio/sesion';
import { calcularDisponibilidad } from '@/lib/proyectos/disponibilidad';

export const dynamic = 'force-dynamic';

/** GET /api/operators/disponibilidad?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&excluirProyectoId= */
export async function GET(req: NextRequest) {
    const s = await sesion(req, ['proyectos.crear']);
    if (s instanceof NextResponse) return s;
    try {
        const sp = new URL(req.url).searchParams;
        const data = await calcularDisponibilidad({
            desde: sp.get('desde') || '',
            hasta: sp.get('hasta') || '',
            excluirProyectoId: sp.get('excluirProyectoId'),
        });
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'operators/disponibilidad');
    }
}
