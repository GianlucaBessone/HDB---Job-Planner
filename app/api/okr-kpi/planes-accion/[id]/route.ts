import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { INCLUIR_RESPONSABLE, WHERE_PLAN_KPI, asignarResponsable, comoPlanKpi, estadoTareaDesdeKpi } from '@/lib/acciones';

export const dynamic = 'force-dynamic';

const INCLUIR = { ...INCLUIR_RESPONSABLE, kpi: { select: { id: true, codigoKpi: true, nombre: true } } };

/** Plan de acción de KPI = tarea con KPI (P31). */
export async function PUT(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['okr.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        const existing = await prisma.tarea.findFirst({ where: { id: params.id, ...WHERE_PLAN_KPI }, include: INCLUIR });
        if (!existing) return NextResponse.json({ error: 'Plan de acción no encontrado' }, { status: 404 });

        const data: Prisma.TareaUncheckedUpdateInput = {};
        if (body.descripcion !== undefined) {
            data.descripcion = body.descripcion;
            data.titulo = String(body.descripcion).trim().split('\n')[0].slice(0, 140) || existing.titulo;
        }
        if (body.causa !== undefined) data.causa = body.causa;
        if (body.accionCorrectiva !== undefined) data.accionCorrectiva = body.accionCorrectiva;
        if (body.fechaCompromiso !== undefined) data.fechaVencimiento = body.fechaCompromiso ? new Date(body.fechaCompromiso) : null;
        if (body.fechaCierre !== undefined) data.fechaCompletada = body.fechaCierre ? new Date(body.fechaCierre) : null;
        if (body.estado !== undefined) data.estado = estadoTareaDesdeKpi(body.estado);

        const plan = await prisma.$transaction(async (tx) => {
            await tx.tarea.update({ where: { id: params.id }, data });
            await asignarResponsable(tx, params.id, body.responsableId);
            return tx.tarea.findUniqueOrThrow({ where: { id: params.id }, include: INCLUIR });
        });

        const resultado = comoPlanKpi(plan);
        await logAudit({ userId: auth.userId, action: 'UPDATE', entity: 'PLAN_ACCION_KPI', entityId: plan.id, oldValue: comoPlanKpi(existing), newValue: resultado });
        return NextResponse.json(resultado);
    } catch (error) {
        console.error('Error updating plan de acción:', error);
        return NextResponse.json({ error: 'Error del servidor al actualizar plan de acción' }, { status: 500 });
    }
}
