import { NextRequest, NextResponse } from 'next/server';
import { sesion, responderError } from '@/lib/presupuestosServicio/sesion';
import { duplicarPresupuesto } from '@/lib/presupuestosServicio/servicio';

export const dynamic = 'force-dynamic';

/** POST: crea un presupuesto nuevo con el contenido de la revisión vigente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['presupuestos.gestionar']);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        const p = await duplicarPresupuesto(id, s.usuario);
        return NextResponse.json({ presupuesto: p, message: `Presupuesto ${p.numero} creado como copia` }, { status: 201 });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id]/duplicar');
    }
}
