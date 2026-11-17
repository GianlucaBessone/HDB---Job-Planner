import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { evaluarCompatibilidad } from '@/lib/rrhh/cvIA';
import { perfilComoTexto } from '@/lib/rrhh/reclutamiento';
import {
    analisisCvVigente, errorValidacion, getActorRRHH, mejorMatch, noEncontrado, prohibido, raw, respuestaError, type RawAnalisis,
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

        const [c, vacante] = await Promise.all([
            prisma.candidate.findUnique({
                where: { id },
                select: {
                    city: true,
                    skills: { select: { name: true, level: true }, orderBy: { id: 'asc' } },
                    experience: { orderBy: { id: 'asc' } },
                    education: { orderBy: { id: 'asc' } },
                    aiAnalyses: { select: { vacancyId: true, matchScore: true, rawAiResponse: true, createdAt: true } },
                },
            }),
            prisma.recruitmentVacancy.findUnique({
                where: { id: parsed.data.vacancyId },
                select: { id: true, title: true, branch: true, description: true, requirements: true, keywords: true },
            }),
        ]);
        if (!c) return noEncontrado('El postulante no existe.');
        if (!vacante) return noEncontrado('La vacante no existe.');

        const cv = analisisCvVigente(c.aiAnalyses);
        const r = cv ? raw(cv.rawAiResponse) : null;
        const perfil = perfilComoTexto({
            titular: r?.titular, resumen: r?.resumen, city: c.city, skills: c.skills, experience: c.experience, education: c.education,
            idiomas: r?.idiomas, certificaciones: r?.certificaciones, aniosExperiencia: r?.aniosExperiencia,
        });
        if (!c.skills.length && !c.experience.length && !c.education.length && !r?.resumen) {
            return NextResponse.json({ error: 'El perfil no tiene experiencia, formación ni habilidades cargadas para comparar.' }, { status: 422 });
        }

        const m = await evaluarCompatibilidad(perfil, vacante, { userId: actor.id, userName: actor.nombre, userRole: actor.rol, entityId: id });

        const crudo: RawAnalisis = {
            origen: 'MATCH',
            match: { puntaje: m.puntaje, explicacion: m.explicacion, cumple: m.cumple, noCumple: m.noCumple, recomendacion: m.recomendacion },
        };
        await prisma.$transaction([
            prisma.candidateAIAnalysis.create({
                data: {
                    candidateId: id, vacancyId: vacante.id, matchScore: m.puntaje, explanation: m.explicacion,
                    strengths: m.fortalezas, weaknesses: m.debilidades, risks: m.riesgos, rawAiResponse: crudo as object,
                },
            }),
            prisma.candidate.update({
                where: { id },
                data: { aiScore: Math.max(m.puntaje, mejorMatch(c.aiAnalyses.filter(a => a.vacancyId !== vacante.id)) ?? 0) },
            }),
        ]);

        return NextResponse.json({ match: m });
    } catch (error) {
        return respuestaError(error, 'COMPATIBILIDAD', 'No se pudo evaluar la compatibilidad.');
    }
}
