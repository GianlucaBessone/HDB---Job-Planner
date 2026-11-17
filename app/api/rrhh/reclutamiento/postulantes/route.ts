import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { borrarObjeto, storageConfigurado, subirObjeto } from '@/lib/objectStorage';
import { altaPostulanteSchema, CV_MAX_BYTES, perfilComoTexto } from '@/lib/rrhh/reclutamiento';
import {
    errorValidacion, getActorRRHH, permisosDe, POSTULANTE_LISTA_SELECT, prohibido, recalcularEstado,
    respuestaError, serializarPostulanteLista, verificarAnalisis, type RawAnalisis,
} from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Base de talentos. */
export async function GET(req: NextRequest) {
    try {
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();
        const rows = await prisma.candidate.findMany({ select: POSTULANTE_LISTA_SELECT, orderBy: { createdAt: 'desc' }, take: 2000 });
        return NextResponse.json({ postulantes: rows.map(serializarPostulanteLista), permisos: permisosDe(actor) });
    } catch (error) {
        return respuestaError(error, 'POSTULANTES_GET', 'No se pudo cargar la base de talentos.');
    }
}

/**
 * Alta de postulante. Cuerpo multipart: `datos` (JSON, ver altaPostulanteSchema)
 * y opcionalmente `archivo` (el PDF del CV). Si viene `datos.analisis`, debe ser el
 * análisis firmado que devolvió /cv/analizar.
 */
export async function POST(req: NextRequest) {
    let claveSubida: string | null = null;
    try {
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido('No tenés permiso para cargar postulantes.');

        const form = await req.formData().catch(() => null);
        let json: unknown = null;
        try { json = JSON.parse(String(form?.get('datos') ?? '')); } catch { /* inválido */ }
        const parsed = altaPostulanteSchema.safeParse(json);
        if (!parsed.success) return errorValidacion(parsed.error);
        const d = parsed.data;

        if (d.vacancyId) {
            const v = await prisma.recruitmentVacancy.findUnique({ where: { id: d.vacancyId }, select: { id: true } });
            if (!v) return NextResponse.json({ error: 'La vacante ya no existe.' }, { status: 404 });
        }

        const analisis = d.analisis ? verificarAnalisis(d.analisis.datos, d.analisis.firma, d.analisis.vacancyId) : null;
        if (d.analisis && !analisis) {
            return NextResponse.json({ error: 'El análisis del CV venció o fue modificado. Volvé a analizar el PDF.' }, { status: 400 });
        }
        // La compatibilidad solo vale para la vacante contra la que se analizó.
        if (analisis && (d.analisis?.vacancyId || null) !== d.vacancyId) analisis.match = null;

        // PDF del CV (opcional). Se sube antes de crear el registro; si el alta falla se borra.
        const archivo = form?.get('archivo');
        let cv: { fileUrl: string; fileName: string; fileType: string } | null = null;
        if (archivo instanceof File && archivo.size > 0) {
            if (archivo.size > CV_MAX_BYTES) return NextResponse.json({ error: `El PDF supera los ${CV_MAX_BYTES / (1024 * 1024)} MB.` }, { status: 413 });
            const pdf = Buffer.from(await archivo.arrayBuffer());
            if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return NextResponse.json({ error: 'El archivo no es un PDF válido.' }, { status: 400 });
            const fileName = (archivo.name || 'cv.pdf').slice(0, 200);
            if (storageConfigurado()) {
                claveSubida = `rrhh/cv/${randomUUID()}.pdf`;
                await subirObjeto(claveSubida, pdf, 'application/pdf');
            }
            cv = { fileUrl: claveSubida || '', fileName, fileType: 'application/pdf' };
        }

        const crudo: RawAnalisis | null = analisis
            ? {
                origen: 'CV',
                titular: analisis.titular,
                resumen: analisis.resumen,
                seniority: analisis.seniority,
                aniosExperiencia: analisis.aniosExperiencia,
                idiomas: analisis.idiomas,
                certificaciones: analisis.certificaciones,
                veracidad: analisis.veracidad,
                match: analisis.match,
                archivo: cv?.fileName ?? null,
            }
            : null;

        const texto = perfilComoTexto({
            titular: analisis?.titular,
            resumen: analisis?.resumen,
            city: d.city,
            skills: d.skills,
            experience: d.experience,
            education: d.education,
            idiomas: analisis?.idiomas,
            certificaciones: analisis?.certificaciones,
            aniosExperiencia: analisis?.aniosExperiencia,
        });

        const creado = await prisma.$transaction(async tx => {
            const c = await tx.candidate.create({
                data: {
                    firstName: d.firstName,
                    lastName: d.lastName,
                    email: d.email,
                    phone: d.phone,
                    whatsapp: d.phone,
                    city: d.city,
                    linkedin: d.linkedin,
                    observations: d.observations,
                    status: 'ACTIVO',
                    aiScore: analisis?.match ? analisis.match.puntaje : null,
                    skills: { create: d.skills.map(s => ({ name: s.name, level: s.level, type: s.type })) },
                    experience: { create: d.experience },
                    education: { create: d.education },
                    tags: { create: Array.from(new Set(d.tags)).map(name => ({ name })) },
                    ...(cv || analisis ? {
                        cvs: { create: { fileUrl: cv?.fileUrl ?? '', fileName: cv?.fileName ?? 'Sin archivo', fileType: cv?.fileType ?? 'application/pdf', parsedText: texto } },
                    } : {}),
                    ...(analisis && crudo ? {
                        aiAnalyses: {
                            create: {
                                vacancyId: analisis.match ? d.vacancyId : null,
                                matchScore: analisis.match?.puntaje ?? 0,
                                explanation: analisis.match?.explicacion || analisis.resumen,
                                strengths: analisis.evaluacion.fortalezas,
                                weaknesses: analisis.evaluacion.debilidades,
                                risks: analisis.evaluacion.riesgos,
                                rawAiResponse: crudo as object,
                            },
                        },
                    } : {}),
                    ...(d.vacancyId ? {
                        stageHistory: {
                            create: {
                                vacancyId: d.vacancyId,
                                stage: d.stage,
                                notes: analisis ? 'Alta con CV analizado por IA' : 'Alta manual',
                                movedById: actor.id || null,
                            },
                        },
                    } : {}),
                },
                select: { id: true },
            });
            await recalcularEstado(c.id, tx);
            return c;
        });

        await logAudit({
            userId: actor.id, userName: actor.nombre, action: 'CREATE', entity: 'Candidate', entityId: creado.id,
            newValue: { nombre: `${d.firstName} ${d.lastName}`, vacancyId: d.vacancyId, conCv: !!cv, conIA: !!analisis },
        });

        return NextResponse.json({ id: creado.id, cvGuardado: !!cv?.fileUrl, almacenamiento: storageConfigurado() }, { status: 201 });
    } catch (error) {
        if (claveSubida) await borrarObjeto(claveSubida).catch(() => {});
        return respuestaError(error, 'POSTULANTES_POST', 'No se pudo crear el postulante.');
    }
}
