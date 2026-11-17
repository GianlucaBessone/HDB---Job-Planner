import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { vacanteEdicionSchema } from '@/lib/rrhh/reclutamiento';
import { errorValidacion, getActorRRHH, noEncontrado, permisosDe, prohibido, recalcularEstado, respuestaError } from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();
        const vacante = await prisma.recruitmentVacancy.findUnique({ where: { id } });
        if (!vacante) return noEncontrado('La vacante no existe.');
        return NextResponse.json({ vacante, permisos: permisosDe(actor) });
    } catch (error) {
        return respuestaError(error, 'VACANTE_GET', 'No se pudo cargar la vacante.');
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido('No tenés permiso para editar vacantes.');
        const parsed = vacanteEdicionSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);

        const antes = await prisma.recruitmentVacancy.findUnique({ where: { id }, select: { status: true, title: true } });
        if (!antes) return noEncontrado('La vacante no existe.');

        const d = parsed.data;
        const cierra = d.status === 'CERRADA' && antes.status !== 'CERRADA';
        const vacante = await prisma.recruitmentVacancy.update({
            where: { id },
            data: { ...d, ...(cierra && !d.endDate ? { endDate: new Date() } : {}) },
        });
        await logAudit({
            userId: actor.id, userName: actor.nombre, action: 'UPDATE', entity: 'RecruitmentVacancy', entityId: id,
            oldValue: { status: antes.status, title: antes.title }, newValue: { campos: Object.keys(d), status: vacante.status },
        });
        return NextResponse.json({ vacante });
    } catch (error) {
        return respuestaError(error, 'VACANTE_PATCH', 'No se pudo guardar la vacante.');
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActorRRHH(req);
        if (!actor.puedeEliminar) return prohibido('No tenés permiso para eliminar vacantes.');

        const v = await prisma.recruitmentVacancy.findUnique({
            where: { id },
            select: { title: true, candidates: { select: { candidateId: true } } },
        });
        if (!v) return noEncontrado('La vacante no existe.');
        const afectados = Array.from(new Set(v.candidates.map(c => c.candidateId)));

        await prisma.$transaction(async tx => {
            // Los análisis de compatibilidad quedan en el perfil, sin vacante.
            await tx.candidateAIAnalysis.updateMany({ where: { vacancyId: id }, data: { vacancyId: null } });
            await tx.recruitmentVacancy.delete({ where: { id } }); // historial, entrevistas y evaluaciones caen en cascada
            for (const candidateId of afectados) await recalcularEstado(candidateId, tx);
        });

        await logAudit({ userId: actor.id, userName: actor.nombre, action: 'DELETE', entity: 'RecruitmentVacancy', entityId: id, oldValue: { title: v.title, postulantes: afectados.length } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return respuestaError(error, 'VACANTE_DELETE', 'No se pudo eliminar la vacante.');
    }
}
