import { NextRequest, NextResponse } from 'next/server';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { contenidoPresupuestoSchema } from '@/lib/presupuestosServicio/schemas';
import { obtenerPresupuesto, actualizarPresupuesto, descartarPresupuesto } from '@/lib/presupuestosServicio/servicio';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
    const s = await sesion(req, ['presupuestos.ver']);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        return NextResponse.json(await obtenerPresupuesto(id), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id] GET');
    }
}

/** PUT: edita la revisión vigente (solo en borrador). */
export async function PUT(req: NextRequest, { params }: Ctx) {
    const s = await sesion(req, ['presupuestos.gestionar']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, contenidoPresupuestoSchema);
    if (body instanceof NextResponse) return body;
    try {
        const { id } = await params;
        const p = await actualizarPresupuesto(id, body.data, s.usuario);
        return NextResponse.json({ presupuesto: p, message: 'Cambios guardados' });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id] PUT');
    }
}

/** DELETE: descarta un presupuesto que nunca se envió. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
    const s = await sesion(req, ['presupuestos.gestionar']);
    if (s instanceof NextResponse) return s;
    try {
        const { id } = await params;
        await descartarPresupuesto(id, s.usuario);
        return NextResponse.json({ success: true, message: 'Presupuesto descartado' });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/[id] DELETE');
    }
}
