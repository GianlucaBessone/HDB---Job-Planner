import { NextRequest, NextResponse } from 'next/server';
import { moverEtapaSchema } from '@/lib/rrhh/reclutamiento';
import { errorValidacion, getActorRRHH, moverEtapa, prohibido, respuestaError } from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; candidateId: string }> };

/** Mueve al postulante de etapa dentro de la vacante (queda en el historial). */
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id, candidateId } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido('No tenés permiso para mover postulantes.');
        const parsed = moverEtapaSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);

        const res = await moverEtapa(candidateId, id, parsed.data.stage, parsed.data.notes, actor);
        if ('error' in res) return NextResponse.json({ error: res.error }, { status: 404 });
        return NextResponse.json({ ok: true, status: 'status' in res ? res.status : undefined });
    } catch (error) {
        return respuestaError(error, 'MOVER_ETAPA', 'No se pudo mover el postulante.');
    }
}
