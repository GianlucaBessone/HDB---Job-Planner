import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { vacanteSchema } from '@/lib/rrhh/reclutamiento';
import { embudoPorVacante, errorValidacion, getActorRRHH, permisosDe, prohibido, respuestaError, totalesEmbudo } from '@/lib/rrhh/reclutamientoServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const actor = await getActorRRHH(req);
        if (!actor.puedeVer) return prohibido();
        const vacantes = await prisma.recruitmentVacancy.findMany({ orderBy: { createdAt: 'desc' } });
        const embudo = await embudoPorVacante(vacantes.map(v => v.id));
        return NextResponse.json({
            vacantes: vacantes.map(v => ({ ...v, embudo: embudo.get(v.id) ?? {}, ...totalesEmbudo(embudo.get(v.id)) })),
            permisos: permisosDe(actor),
        });
    } catch (error) {
        return respuestaError(error, 'VACANTES_GET', 'No se pudieron cargar las vacantes.');
    }
}

export async function POST(req: NextRequest) {
    try {
        const actor = await getActorRRHH(req);
        if (!actor.puedeGestionar) return prohibido('No tenés permiso para crear vacantes.');
        const parsed = vacanteSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorValidacion(parsed.error);
        const { endDate, ...d } = parsed.data;
        const v = await prisma.recruitmentVacancy.create({
            data: { ...d, endDate: endDate ?? null, responsableId: actor.id || null },
        });
        await logAudit({ userId: actor.id, userName: actor.nombre, action: 'CREATE', entity: 'RecruitmentVacancy', entityId: v.id, newValue: { title: v.title } });
        return NextResponse.json({ vacante: v }, { status: 201 });
    } catch (error) {
        return respuestaError(error, 'VACANTES_POST', 'No se pudo crear la vacante.');
    }
}
