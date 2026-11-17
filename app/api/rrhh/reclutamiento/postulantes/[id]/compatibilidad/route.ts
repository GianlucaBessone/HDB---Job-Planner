import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
    errorValidacion, evaluarYGuardarCompatibilidad, getActorRRHH, noEncontrado, PerfilIncompleto, prohibido, respuestaError,
} from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ vacancyId: z.string().trim().min(1, 'Elegí una vacante.').max(60) });

/** Evalúa con IA la compatibilidad del perfil (datos actuales) con una vacante. */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido();

        const parsed = bodySchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);

        const vacante = await prisma.recruitmentVacancy.findUnique({
            where: { id: parsed.data.vacancyId },
            select: { id: true, title: true, branch: true, description: true, requirements: true, keywords: true },
        });
        if (!vacante) return noEncontrado('La vacante no existe.');

        const m = await evaluarYGuardarCompatibilidad(id, vacante, actor);
        return NextResponse.json({ match: m });
    } catch (error) {
        if (error instanceof PerfilIncompleto) return NextResponse.json({ error: error.message }, { status: 422 });
        return respuestaError(error, 'COMPATIBILIDAD', 'No se pudo evaluar la compatibilidad.');
    }
}
