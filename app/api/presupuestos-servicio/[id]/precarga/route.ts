import { NextRequest, NextResponse } from 'next/server';
import { sesion, responderError } from '@/lib/presupuestosServicio/sesion';
import { precargaDesdePresupuesto } from '@/lib/proyectos/wizard';

export const dynamic = 'force-dynamic';

/** GET: datos para precargar el wizard de proyecto desde la copia congelada del presupuesto aceptado. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['presupuestos.convertir']);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        return NextResponse.json(await precargaDesdePresupuesto(id), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id]/precarga');
    }
}
