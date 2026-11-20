import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ErrorAnalisisCv } from '@/lib/rrhh/cvIA';
import {
    afinidad, analisisCvVigente, errorValidacion, esEtapaActiva, etapasActuales, evaluarYGuardarCompatibilidad, getActorRRHH,
    noEncontrado, PerfilIncompleto, permisosDe, prohibido, raw, respuestaError, terminosVacante,
} from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

const VACANTE_SELECT = { id: true, title: true, branch: true, description: true, requirements: true, keywords: true } as const;

/**
 * Postulantes de la base que NO están en la vacante, con su afinidad por
 * palabras clave (sin IA) y el match con IA si ya se evaluó contra esta vacante.
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();

        const vacante = await prisma.recruitmentVacancy.findUnique({ where: { id }, select: VACANTE_SELECT });
        if (!vacante) return noEncontrado('La vacante no existe.');

        const rows = await prisma.candidate.findMany({
            where: { stageHistory: { none: { vacancyId: id } } },
            select: {
                id: true, firstName: true, lastName: true, email: true, phone: true, city: true, status: true,
                tags: { select: { name: true } },
                skills: { select: { name: true, type: true }, orderBy: { id: 'asc' } },
                experience: { select: { position: true, company: true, description: true }, orderBy: { id: 'asc' } },
                education: { select: { degree: true, institution: true } },
                cvs: { select: { parsedText: true }, orderBy: { createdAt: 'desc' }, take: 1 },
                aiAnalyses: {
                    select: { vacancyId: true, matchScore: true, explanation: true, rawAiResponse: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                },
                stageHistory: { select: { vacancyId: true, stage: true, createdAt: true } },
            },
            take: 2000,
        });

        const pesos = terminosVacante(vacante);
        const postulantes = rows.map(c => {
            const cv = analisisCvVigente(c.aiAnalyses);
            const r = cv ? raw(cv.rawAiResponse) : null;
            const texto = [
                r?.titular, r?.resumen, c.cvs[0]?.parsedText,
                ...c.tags.map(t => t.name),
                ...c.skills.map(s => s.name),
                ...c.experience.flatMap(e => [e.position, e.description]),
                ...c.education.map(e => e.degree),
                ...(r?.certificaciones ?? []),
            ].filter(Boolean).join(' \n ');
            const af = afinidad(pesos, texto);
            const ultimo = c.aiAnalyses.find(a => a.vacancyId === id);
            const m = ultimo ? raw(ultimo.rawAiResponse).match : null;
            const hard = c.skills.filter(s => s.type !== 'SOFT');
            return {
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                city: c.city,
                status: c.status,
                titular: r?.titular || c.experience[0]?.position || null,
                veracidad: r?.veracidad?.puntaje ?? null,
                habilidades: (hard.length ? hard : c.skills).map(s => s.name).slice(0, 6),
                procesosActivos: Array.from(etapasActuales(c.stageHistory).values()).filter(e => esEtapaActiva(e.stage)).length,
                evaluable: c.skills.length > 0 || c.experience.length > 0 || c.education.length > 0 || !!r?.resumen,
                afinidad: af.puntaje,
                coincidencias: af.coincidencias.slice(0, 6),
                match: ultimo
                    ? {
                        puntaje: ultimo.matchScore,
                        explicacion: ultimo.explanation,
                        cumple: m?.cumple ?? [],
                        noCumple: m?.noCumple ?? [],
                        recomendacion: m?.recomendacion ?? null,
                        fecha: ultimo.createdAt,
                    }
                    : null,
            };
        });

        return NextResponse.json({ vacante: { id: vacante.id, title: vacante.title }, postulantes, permisos: permisosDe(actor) });
    } catch (error) {
        return respuestaError(error, 'SUGERENCIAS_GET', 'No se pudo cargar la base de talentos.');
    }
}

/** Lote chico por pedido: el navegador manda de a pocos para mostrar avance y no exceder el tiempo de la función. */
const MAX_POR_PEDIDO = 5;
const bodySchema = z.object({
    candidateIds: z.array(z.string().trim().min(1).max(60)).min(1, 'Elegí al menos un postulante.').max(MAX_POR_PEDIDO, `Máximo ${MAX_POR_PEDIDO} por pedido.`),
});

/** Evalúa con IA la compatibilidad de varios postulantes con la vacante, sin sumarlos al pipeline. */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido('No tenés permiso para evaluar postulantes.');
        const parsed = bodySchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);

        const vacante = await prisma.recruitmentVacancy.findUnique({ where: { id }, select: VACANTE_SELECT });
        if (!vacante) return noEncontrado('La vacante no existe.');

        const ids = Array.from(new Set(parsed.data.candidateIds));
        const resultados: { candidateId: string; ok: boolean; puntaje?: number; error?: string }[] = [];
        // De a dos en paralelo: respeta el límite de la IA y entra en el tiempo de la función.
        for (let i = 0; i < ids.length; i += 2) {
            const lote = ids.slice(i, i + 2);
            const res = await Promise.all(lote.map(async candidateId => {
                try {
                    const m = await evaluarYGuardarCompatibilidad(candidateId, vacante, actor);
                    return { candidateId, ok: true, puntaje: m.puntaje };
                } catch (e) {
                    const msg = e instanceof PerfilIncompleto || e instanceof ErrorAnalisisCv ? e.message : 'No se pudo evaluar.';
                    if (!(e instanceof PerfilIncompleto)) console.error('[RRHH SUGERENCIAS_POST]', candidateId, e);
                    return { candidateId, ok: false, error: msg };
                }
            }));
            resultados.push(...res);
        }
        return NextResponse.json({ resultados });
    } catch (error) {
        return respuestaError(error, 'SUGERENCIAS_POST', 'No se pudo evaluar a los postulantes.');
    }
}
