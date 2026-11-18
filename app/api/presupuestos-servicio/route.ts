import { NextRequest, NextResponse } from 'next/server';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { contenidoPresupuestoSchema } from '@/lib/presupuestosServicio/schemas';
import { listarPresupuestos, crearPresupuesto, esEstadoPresupuesto } from '@/lib/presupuestosServicio/servicio';

export const dynamic = 'force-dynamic';

/** GET /api/presupuestos-servicio?q=&estado=&clienteId=&page=&limit= */
export async function GET(req: NextRequest) {
    const s = await sesion(req, ['presupuestos.ver']);
    if (s instanceof NextResponse) return s;
    try {
        const sp = new URL(req.url).searchParams;
        const estado = sp.get('estado') || undefined;
        const data = await listarPresupuestos({
            q: sp.get('q')?.trim().slice(0, 100) || undefined,
            estado: estado && esEstadoPresupuesto(estado) ? estado : undefined,
            clienteId: sp.get('clienteId') || undefined,
            page: parseInt(sp.get('page') || '1', 10) || 1,
            limit: parseInt(sp.get('limit') || '25', 10) || 25,
        });
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio GET');
    }
}

/** POST /api/presupuestos-servicio — crea la revisión 1 en borrador. */
export async function POST(req: NextRequest) {
    const s = await sesion(req, ['presupuestos.gestionar']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, contenidoPresupuestoSchema);
    if (body instanceof NextResponse) return body;
    try {
        const creado = await crearPresupuesto(body.data, s.usuario);
        return NextResponse.json({ presupuesto: creado, message: `Presupuesto ${creado.numero} creado` }, { status: 201 });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio POST');
    }
}
