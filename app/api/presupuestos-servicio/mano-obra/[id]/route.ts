import { NextRequest, NextResponse } from 'next/server';
import { sesion, leerBody, responderError } from '@/lib/presupuestosServicio/sesion';
import { manoObraCategoriaSchema } from '@/lib/presupuestosServicio/schemas';
import { actualizarCategoria } from '@/lib/presupuestosServicio/manoObra';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const s = await sesion(req, ['ventas.mano_obra_gestionar']);
    if (s instanceof NextResponse) return s;
    const body = await leerBody(req, manoObraCategoriaSchema);
    if (body instanceof NextResponse) return body;
    try {
        const { id } = await params;
        const c = await actualizarCategoria(id, body.data, s.usuario);
        return NextResponse.json({ categoria: c, message: `Categoría ${c.nombre} actualizada` });
    } catch (e) {
        return responderError(e, 'presupuestos-servicio/mano-obra/[id] PUT');
    }
}
