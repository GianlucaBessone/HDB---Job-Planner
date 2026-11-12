import { NextRequest, NextResponse } from 'next/server';
import { borrarPliego, cargarPliego, getActor, noEncontrado, prohibido, respuestaError } from '@/lib/pliegosServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Detalle con la versión pedida (?version=N) o la vigente. */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.puedeVer) return prohibido();
        const v = Number(req.nextUrl.searchParams.get('version'));
        const pliego = await cargarPliego(id, Number.isInteger(v) && v > 0 ? v : undefined);
        if (!pliego) return noEncontrado();
        return NextResponse.json({ ...pliego, puedeGestionar: actor.puedeGestionar });
    } catch (error) {
        return respuestaError(error, 'PLIEGO_GET', 'Error al obtener el pliego.');
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.puedeGestionar) return prohibido('Solo admin y supervisores pueden borrar pliegos.');
        await borrarPliego(id, actor);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return respuestaError(error, 'PLIEGO_DELETE', 'Error al borrar el pliego.');
    }
}
