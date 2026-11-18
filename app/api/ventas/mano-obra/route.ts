import { NextRequest, NextResponse } from 'next/server';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { manoObraCategoriaSchema } from '@/lib/presupuestosServicio/schemas';
import { listarCategorias, crearCategoria } from '@/lib/presupuestosServicio/manoObra';

export const dynamic = 'force-dynamic';

/** GET /api/ventas/mano-obra?activas=1 — catálogo de categorías de mano de obra. */
export async function GET(req: NextRequest) {
    const s = await sesion(req, ['presupuestos.ver', 'ventas.mano_obra_gestionar']);
    if (s instanceof NextResponse) return s;
    try {
        const activas = new URL(req.url).searchParams.get('activas') === '1';
        return NextResponse.json(await listarCategorias(activas), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        return responderError(e, 'ventas/mano-obra GET');
    }
}

export async function POST(req: NextRequest) {
    const s = await sesion(req, ['ventas.mano_obra_gestionar']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, manoObraCategoriaSchema);
    if (body instanceof NextResponse) return body;
    try {
        const c = await crearCategoria(body.data, s.usuario);
        return NextResponse.json({ categoria: c, message: `Categoría ${c.nombre} creada` }, { status: 201 });
    } catch (e) {
        return responderError(e, 'ventas/mano-obra POST');
    }
}
