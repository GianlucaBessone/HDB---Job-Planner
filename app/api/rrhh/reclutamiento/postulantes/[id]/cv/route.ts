import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { borrarObjeto, storageConfigurado, subirObjeto, urlPrefirmada } from '@/lib/objectStorage';
import { analizarCvPdf } from '@/lib/rrhh/cvIA';
import { analisisAFormulario, CV_MAX_BYTES, perfilComoTexto } from '@/lib/rrhh/reclutamiento';
import { getActorRRHH, noEncontrado, prohibido, respuestaError, type RawAnalisis } from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/** Abre el PDF del CV: redirige a una URL prefirmada del almacenamiento (5 minutos). */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();

        const cv = await prisma.candidateCV.findFirst({
            where: { candidateId: id, fileUrl: { startsWith: 'rrhh/cv/' } },
            orderBy: { createdAt: 'desc' },
            select: { fileUrl: true, fileName: true },
        });
        if (!cv || !storageConfigurado()) return noEncontrado('El PDF del CV no está disponible.');
        return NextResponse.redirect(urlPrefirmada('GET', cv.fileUrl, { descargaComo: cv.fileName, tipo: 'application/pdf' }), 302);
    } catch (error) {
        return respuestaError(error, 'CV_GET', 'No se pudo abrir el CV.');
    }
}

/**
 * Sube un CV nuevo para un postulante existente y lo analiza con IA. Guarda el
 * análisis y completa experiencia, formación y habilidades solo si estaban vacías
 * (no pisa lo cargado a mano).
 */
export async function POST(req: NextRequest, { params }: Params) {
    let clave: string | null = null;
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido();

        const c = await prisma.candidate.findUnique({
            where: { id },
            select: {
                id: true, city: true, email: true, phone: true, linkedin: true,
                _count: { select: { skills: true, experience: true, education: true, tags: true } },
            },
        });
        if (!c) return noEncontrado('El postulante no existe.');

        const form = await req.formData().catch(() => null);
        const archivo = form?.get('archivo');
        if (!(archivo instanceof File) || archivo.size === 0) return NextResponse.json({ error: 'Adjuntá el CV en PDF.' }, { status: 400 });
        if (archivo.size > CV_MAX_BYTES) return NextResponse.json({ error: `El PDF supera los ${CV_MAX_BYTES / (1024 * 1024)} MB.` }, { status: 413 });
        const pdf = Buffer.from(await archivo.arrayBuffer());
        if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return NextResponse.json({ error: 'El archivo no es un PDF válido.' }, { status: 400 });

        const a = await analizarCvPdf(pdf, null, { userId: actor.id, userName: actor.nombre, userRole: actor.rol, entityId: id });
        if (!a.esCv) return NextResponse.json({ error: 'El PDF no parece un currículum.' }, { status: 422 });

        const fileName = (archivo.name || 'cv.pdf').slice(0, 200);
        if (storageConfigurado()) {
            clave = `rrhh/cv/${randomUUID()}.pdf`;
            await subirObjeto(clave, pdf, 'application/pdf');
        }
        const f = analisisAFormulario(a);
        const crudo: RawAnalisis = {
            origen: 'CV', titular: a.titular, resumen: a.resumen, seniority: a.seniority, aniosExperiencia: a.aniosExperiencia,
            idiomas: a.idiomas, certificaciones: a.certificaciones, veracidad: a.veracidad, match: null, archivo: fileName,
        };

        await prisma.$transaction(async tx => {
            await tx.candidate.update({
                where: { id },
                data: {
                    // Solo se completan datos de contacto vacíos.
                    ...(!c.email && f.email ? { email: f.email } : {}),
                    ...(!c.phone && f.phone ? { phone: f.phone, whatsapp: f.phone } : {}),
                    ...(!c.city && f.city ? { city: f.city } : {}),
                    ...(!c.linkedin && f.linkedin ? { linkedin: f.linkedin } : {}),
                },
            });
            if (!c._count.skills && f.skills.length) await tx.candidateSkill.createMany({ data: f.skills.map(s => ({ ...s, candidateId: id })) });
            if (!c._count.experience && f.experience.length) await tx.candidateExperience.createMany({ data: f.experience.map(e => ({ ...e, candidateId: id })) });
            if (!c._count.education && f.education.length) await tx.candidateEducation.createMany({ data: f.education.map(e => ({ ...e, candidateId: id })) });
            if (!c._count.tags && f.tags.length) await tx.candidateTag.createMany({ data: Array.from(new Set(f.tags)).map(name => ({ name, candidateId: id })) });
            await tx.candidateCV.create({
                data: {
                    candidateId: id, fileUrl: clave || '', fileName, fileType: 'application/pdf',
                    parsedText: perfilComoTexto({
                        titular: a.titular, resumen: a.resumen, city: f.city, skills: f.skills, experience: f.experience, education: f.education,
                        idiomas: a.idiomas, certificaciones: a.certificaciones, aniosExperiencia: a.aniosExperiencia,
                    }),
                },
            });
            await tx.candidateAIAnalysis.create({
                data: {
                    candidateId: id, vacancyId: null, matchScore: 0, explanation: a.resumen,
                    strengths: a.evaluacion.fortalezas, weaknesses: a.evaluacion.debilidades, risks: a.evaluacion.riesgos, rawAiResponse: crudo as object,
                },
            });
        });

        await logAudit({ userId: actor.id, userName: actor.nombre, action: 'UPDATE', entity: 'Candidate', entityId: id, newValue: { cv: fileName, veracidad: a.veracidad.puntaje } });
        return NextResponse.json({ ok: true, cvGuardado: !!clave, almacenamiento: storageConfigurado() });
    } catch (error) {
        if (clave) await borrarObjeto(clave).catch(() => {});
        return respuestaError(error, 'CV_POST', 'No se pudo procesar el CV.');
    }
}
