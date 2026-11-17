import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analisisCvVigente, getActorRRHH, noEncontrado, permisosDe, prohibido, raw, respuestaError } from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Vacante + postulantes con su etapa actual, compatibilidad con esta vacante y veracidad del CV. */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();

        const vacante = await prisma.recruitmentVacancy.findUnique({ where: { id } });
        if (!vacante) return noEncontrado('La vacante no existe.');

        const rows = await prisma.candidate.findMany({
            where: { stageHistory: { some: { vacancyId: id } } },
            select: {
                id: true, firstName: true, lastName: true, email: true, phone: true, city: true, status: true,
                stageHistory: { where: { vacancyId: id }, orderBy: { createdAt: 'desc' }, take: 1, select: { stage: true, createdAt: true } },
                aiAnalyses: { select: { vacancyId: true, matchScore: true, rawAiResponse: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
                experience: { select: { position: true }, orderBy: { id: 'asc' }, take: 1 },
                tags: { select: { name: true }, take: 4 },
            },
        });

        const postulantes = rows.map(c => {
            const cv = analisisCvVigente(c.aiAnalyses);
            const r = cv ? raw(cv.rawAiResponse) : null;
            const match = c.aiAnalyses.find(a => a.vacancyId === id);
            const etapa = c.stageHistory[0];
            return {
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone,
                city: c.city,
                etapa: etapa?.stage === 'FINALISTA' ? 'FINALISTAS' : etapa?.stage || 'POSTULADO',
                enEtapaDesde: etapa?.createdAt ?? null,
                titular: r?.titular || c.experience[0]?.position || null,
                veracidad: r?.veracidad?.puntaje ?? null,
                match: match ? match.matchScore : null,
                recomendacion: match ? raw(match.rawAiResponse).match?.recomendacion ?? null : null,
                tags: c.tags.map(t => t.name),
            };
        }).sort((a, b) => (b.match ?? -1) - (a.match ?? -1));

        return NextResponse.json({ vacante, postulantes, permisos: permisosDe(actor) });
    } catch (error) {
        return respuestaError(error, 'PIPELINE_GET', 'No se pudo cargar el pipeline.');
    }
}
