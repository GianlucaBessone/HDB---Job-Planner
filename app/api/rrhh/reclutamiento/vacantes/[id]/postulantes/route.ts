import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { vincularSchema } from '@/lib/rrhh/reclutamiento';
import { conflicto, errorValidacion, esEtapaActiva, getActorRRHH, noEncontrado, prohibido, recalcularEstado, respuestaError } from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Postulantes de la base que todavía no están en esta vacante (para vincular). */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();
        const disponibles = await prisma.candidate.findMany({
            where: { stageHistory: { none: { vacancyId: id } } },
            select: {
                id: true, firstName: true, lastName: true, email: true, city: true, status: true,
                tags: { select: { name: true }, take: 3 },
                experience: { select: { position: true }, orderBy: { id: 'asc' }, take: 1 },
            },
            orderBy: { createdAt: 'desc' },
            take: 1000,
        });
        return NextResponse.json({
            disponibles: disponibles.map(c => ({ ...c, tags: c.tags.map(t => t.name), titular: c.experience[0]?.position ?? null, experience: undefined })),
        });
    } catch (error) {
        return respuestaError(error, 'VINCULAR_GET', 'No se pudo cargar la base de talentos.');
    }
}

/** Suma un postulante existente a la vacante. */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido();
        const parsed = vincularSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);
        const { candidateId, stage, notes } = parsed.data;

        const [vacante, candidato, existente] = await Promise.all([
            prisma.recruitmentVacancy.findUnique({ where: { id }, select: { id: true } }),
            prisma.candidate.findUnique({ where: { id: candidateId }, select: { id: true } }),
            prisma.candidateStageHistory.findFirst({ where: { candidateId, vacancyId: id }, select: { id: true } }),
        ]);
        if (!vacante) return noEncontrado('La vacante no existe.');
        if (!candidato) return noEncontrado('El postulante no existe.');
        if (existente) return conflicto('El postulante ya está en esta vacante.');

        await prisma.$transaction(async tx => {
            await tx.candidateStageHistory.create({
                data: { candidateId, vacancyId: id, stage, notes: notes || 'Sumado desde la base de talentos', movedById: actor.id || null },
            });
            await recalcularEstado(candidateId, tx, esEtapaActiva(stage));
        });
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (error) {
        return respuestaError(error, 'VINCULAR_POST', 'No se pudo sumar el postulante a la vacante.');
    }
}
