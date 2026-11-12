import { NextRequest, NextResponse } from 'next/server';
import { marcaSchema } from '@/lib/pliegos';
import { errorValidacion, getActor, marcarTarea, prohibido, respuestaError } from '@/lib/pliegosServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Marca la tarea dentro o fuera del pliego y la registra en el historial. */
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.puedeVer) return prohibido();
        const parsed = marcaSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);
        return NextResponse.json(await marcarTarea(id, parsed.data, actor));
    } catch (error) {
        return respuestaError(error, 'PLIEGO_TAREA_MARCAR', 'Error al marcar la tarea.');
    }
}
