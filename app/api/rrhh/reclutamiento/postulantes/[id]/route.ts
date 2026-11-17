import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { borrarObjeto } from '@/lib/objectStorage';
import { edicionPostulanteSchema } from '@/lib/rrhh/reclutamiento';
import {
    analisisCvVigente, errorValidacion, etapasActuales, getActorRRHH, mejorMatch, noEncontrado, nombresOperadores,
    permisosDe, prohibido, raw, respuestaError,
} from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();

        const c = await prisma.candidate.findUnique({
            where: { id },
            include: {
                tags: { orderBy: { id: 'asc' } },
                skills: { orderBy: { id: 'asc' } },
                experience: { orderBy: { id: 'asc' } },
                education: { orderBy: { id: 'asc' } },
                cvs: { orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, fileUrl: true, createdAt: true } },
                aiAnalyses: { orderBy: { createdAt: 'desc' }, include: { vacancy: { select: { id: true, title: true, status: true } } } },
                stageHistory: { orderBy: { createdAt: 'desc' }, include: { vacancy: { select: { id: true, title: true, status: true, branch: true } } } },
            },
        });
        if (!c) return noEncontrado('El postulante no existe.');

        const nombres = await nombresOperadores(c.stageHistory.map(h => h.movedById));
        const actuales = etapasActuales(c.stageHistory);
        const procesos = Array.from(actuales.values()).map(actual => ({
            vacancyId: actual.vacancyId,
            vacante: actual.vacancy,
            etapa: actual.stage,
            desde: actual.createdAt,
            historial: c.stageHistory
                .filter(h => h.vacancyId === actual.vacancyId)
                .map(h => ({ id: h.id, etapa: h.stage, notas: h.notes, fecha: h.createdAt, por: h.movedById ? nombres.get(h.movedById) || null : null })),
        }));

        const cvAnalisis = analisisCvVigente(c.aiAnalyses);
        const r = cvAnalisis ? raw(cvAnalisis.rawAiResponse) : null;

        // Última evaluación de compatibilidad por vacante.
        const vistas = new Set<string>();
        const compatibilidades = c.aiAnalyses
            .filter(a => a.vacancyId && !vistas.has(a.vacancyId) && vistas.add(a.vacancyId))
            .map(a => {
                const m = raw(a.rawAiResponse).match;
                return {
                    id: a.id,
                    vacante: a.vacancy,
                    puntaje: a.matchScore,
                    explicacion: a.explanation,
                    cumple: m?.cumple ?? [],
                    noCumple: m?.noCumple ?? [],
                    recomendacion: m?.recomendacion ?? null,
                    fortalezas: lista(a.strengths),
                    debilidades: lista(a.weaknesses),
                    riesgos: lista(a.risks),
                    fecha: a.createdAt,
                };
            });

        const cv = c.cvs[0];
        return NextResponse.json({
            postulante: {
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone,
                city: c.city,
                linkedin: c.linkedin,
                observations: c.observations,
                status: c.status,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                mejorMatch: mejorMatch(c.aiAnalyses),
                tags: c.tags.map(t => t.name),
                skills: c.skills.map(s => ({ name: s.name, level: s.level, type: s.type })),
                experience: c.experience.map(e => ({ company: e.company, position: e.position, startDate: e.startDate, endDate: e.endDate, description: e.description })),
                education: c.education.map(e => ({ institution: e.institution, degree: e.degree, startDate: e.startDate, endDate: e.endDate })),
                cv: cv ? { id: cv.id, fileName: cv.fileName, disponible: !!cv.fileUrl, fecha: cv.createdAt } : null,
                analisis: cvAnalisis && r
                    ? {
                        fecha: cvAnalisis.createdAt,
                        titular: r.titular || null,
                        resumen: r.resumen || null,
                        seniority: r.seniority ?? null,
                        aniosExperiencia: r.aniosExperiencia ?? null,
                        idiomas: r.idiomas ?? [],
                        certificaciones: r.certificaciones ?? [],
                        veracidad: r.veracidad ?? null,
                        fortalezas: lista(cvAnalisis.strengths),
                        debilidades: lista(cvAnalisis.weaknesses),
                        riesgos: lista(cvAnalisis.risks),
                    }
                    : null,
                compatibilidades,
                procesos,
            },
            permisos: permisosDe(actor),
        });
    } catch (error) {
        return respuestaError(error, 'POSTULANTE_GET', 'No se pudo cargar el postulante.');
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido();

        const parsed = edicionPostulanteSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);
        const d = parsed.data;

        const antes = await prisma.candidate.findUnique({ where: { id }, select: { id: true, status: true, firstName: true, lastName: true } });
        if (!antes) return noEncontrado('El postulante no existe.');

        await prisma.$transaction(async tx => {
            await tx.candidate.update({
                where: { id },
                data: {
                    ...(d.firstName !== undefined && { firstName: d.firstName }),
                    ...(d.lastName !== undefined && { lastName: d.lastName }),
                    ...(d.email !== undefined && { email: d.email }),
                    ...(d.phone !== undefined && { phone: d.phone, whatsapp: d.phone }),
                    ...(d.city !== undefined && { city: d.city }),
                    ...(d.linkedin !== undefined && { linkedin: d.linkedin }),
                    ...(d.observations !== undefined && { observations: d.observations }),
                    ...(d.status !== undefined && { status: d.status }),
                },
            });
            if (d.skills) {
                await tx.candidateSkill.deleteMany({ where: { candidateId: id } });
                if (d.skills.length) await tx.candidateSkill.createMany({ data: d.skills.map(s => ({ ...s, candidateId: id })) });
            }
            if (d.experience) {
                await tx.candidateExperience.deleteMany({ where: { candidateId: id } });
                if (d.experience.length) await tx.candidateExperience.createMany({ data: d.experience.map(e => ({ ...e, candidateId: id })) });
            }
            if (d.education) {
                await tx.candidateEducation.deleteMany({ where: { candidateId: id } });
                if (d.education.length) await tx.candidateEducation.createMany({ data: d.education.map(e => ({ ...e, candidateId: id })) });
            }
            if (d.tags) {
                await tx.candidateTag.deleteMany({ where: { candidateId: id } });
                const unicos = Array.from(new Set(d.tags));
                if (unicos.length) await tx.candidateTag.createMany({ data: unicos.map(name => ({ name, candidateId: id })) });
            }
        });

        await logAudit({
            userId: actor.id, userName: actor.nombre, action: 'UPDATE', entity: 'Candidate', entityId: id,
            oldValue: d.status !== undefined ? { status: antes.status } : undefined,
            newValue: { campos: Object.keys(d) , ...(d.status !== undefined && { status: d.status }) },
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return respuestaError(error, 'POSTULANTE_PATCH', 'No se pudo guardar el postulante.');
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeEliminar) return prohibido('No tenés permiso para eliminar postulantes.');

        const c = await prisma.candidate.findUnique({ where: { id }, select: { firstName: true, lastName: true, cvs: { select: { fileUrl: true } } } });
        if (!c) return noEncontrado('El postulante no existe.');

        await prisma.candidate.delete({ where: { id } });
        await Promise.all(c.cvs.filter(cv => cv.fileUrl.startsWith('rrhh/cv/')).map(cv => borrarObjeto(cv.fileUrl).catch(() => {})));

        await logAudit({
            userId: actor.id, userName: actor.nombre, action: 'DELETE', entity: 'Candidate', entityId: id,
            oldValue: { nombre: `${c.firstName} ${c.lastName}` },
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return respuestaError(error, 'POSTULANTE_DELETE', 'No se pudo eliminar el postulante.');
    }
}
