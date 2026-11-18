import { NextRequest, NextResponse } from 'next/server';
import { sesion, responderError } from '@/lib/presupuestosServicio/sesion';
import { presupuestadoVsReal } from '@/lib/presupuestosServicio/reporte';

export const dynamic = 'force-dynamic';

/** GET: presupuestado vs. real. Para proyectos sin presupuesto devuelve { tienePresupuesto: false }. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['presupuestos.ver']);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        return NextResponse.json(await presupuestadoVsReal(id), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'projects/[id]/presupuesto-vs-real');
    }
}
