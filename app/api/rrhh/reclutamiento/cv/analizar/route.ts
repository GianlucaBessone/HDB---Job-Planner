import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analizarCvPdf } from '@/lib/rrhh/cvIA';
import { CV_MAX_BYTES } from '@/lib/rrhh/reclutamiento';
import { firmarAnalisis, getActorRRHH, prohibido, respuestaError } from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Lee un CV en PDF con IA y devuelve los datos para que el usuario los revise.
 * No guarda nada: el alta la hace POST /api/rrhh/reclutamiento/postulantes con
 * el análisis firmado que devuelve esta ruta.
 */
export async function POST(req: NextRequest) {
    try {
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido('No tenés permiso para cargar postulantes.');

        const form = await req.formData().catch(() => null);
        const archivo = form?.get('archivo');
        if (!(archivo instanceof File)) return NextResponse.json({ error: 'Adjuntá el CV en PDF.' }, { status: 400 });
        if (archivo.size === 0) return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 });
        if (archivo.size > CV_MAX_BYTES) return NextResponse.json({ error: `El PDF supera los ${CV_MAX_BYTES / (1024 * 1024)} MB.` }, { status: 413 });

        const pdf = Buffer.from(await archivo.arrayBuffer());
        if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
            return NextResponse.json({ error: 'El archivo no es un PDF válido.' }, { status: 400 });
        }

        const vacancyIdRaw = form?.get('vacancyId');
        const vacancyId = typeof vacancyIdRaw === 'string' && vacancyIdRaw.trim() ? vacancyIdRaw.trim() : null;
        const vacante = vacancyId
            ? await prisma.recruitmentVacancy.findUnique({
                where: { id: vacancyId },
                select: { id: true, title: true, branch: true, description: true, requirements: true, keywords: true },
            })
            : null;
        if (vacancyId && !vacante) return NextResponse.json({ error: 'La vacante ya no existe.' }, { status: 404 });

        const analisis = await analizarCvPdf(pdf, vacante, { userId: actor.id, userName: actor.nombre, userRole: actor.rol });

        if (!analisis.esCv) {
            return NextResponse.json({ error: 'El PDF no parece un currículum. Revisá el archivo o cargá los datos a mano.' }, { status: 422 });
        }

        // Posibles duplicados en la base (mismo email o mismo nombre y apellido).
        const { email, nombre, apellido } = analisis.datosPersonales;
        const or: object[] = [];
        if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
        if (nombre && apellido) {
            or.push({ AND: [{ firstName: { equals: nombre, mode: 'insensitive' } }, { lastName: { equals: apellido, mode: 'insensitive' } }] });
        }
        const duplicados = or.length
            ? await prisma.candidate.findMany({ where: { OR: or }, select: { id: true, firstName: true, lastName: true, email: true, status: true }, take: 5 })
            : [];

        return NextResponse.json({ analisis, firma: firmarAnalisis(analisis, vacancyId), vacancyId, duplicados });
    } catch (error) {
        return respuestaError(error, 'CV_ANALIZAR', 'No se pudo analizar el CV.');
    }
}
