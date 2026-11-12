import { NextRequest, NextResponse } from 'next/server';
import { pliegoAltaSchema } from '@/lib/pliegos';
import { crearPliego, errorValidacion, getActor, listarPliegos, prohibido, respuestaError, urlSubida } from '@/lib/pliegosServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const actor = await getActor(req);
        if (!actor.puedeVer) return prohibido();
        const q = req.nextUrl.searchParams.get('q')?.trim().slice(0, 100) || undefined;
        return NextResponse.json({ pliegos: await listarPliegos(q), puedeGestionar: actor.puedeGestionar });
    } catch (error) {
        return respuestaError(error, 'PLIEGOS_GET', 'Error al obtener los pliegos.');
    }
}

/** Alta del pliego. Devuelve la URL para que el navegador suba el PDF directo al almacenamiento. */
export async function POST(req: NextRequest) {
    try {
        const actor = await getActor(req);
        if (!actor.puedeGestionar) return prohibido('Solo admin y supervisores pueden subir pliegos.');
        const parsed = pliegoAltaSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);
        const pliego = await crearPliego(parsed.data, actor);
        return NextResponse.json({ ...pliego, subida: await urlSubida(pliego.id) }, { status: 201 });
    } catch (error) {
        return respuestaError(error, 'PLIEGOS_POST', 'Error al crear el pliego.');
    }
}
