import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        const existing = await prisma.planAccionKpi.findUnique({ where: { id: params.id } });
        if (!existing) {
            return NextResponse.json({ error: 'Plan de acción no encontrado' }, { status: 404 });
        }

        const plan = await prisma.planAccionKpi.update({
            where: { id: params.id },
            data: {
                descripcion: body.descripcion ?? existing.descripcion,
                causa: body.causa !== undefined ? body.causa : existing.causa,
                accionCorrectiva: body.accionCorrectiva !== undefined ? body.accionCorrectiva : existing.accionCorrectiva,
                responsableId: body.responsableId !== undefined ? body.responsableId : existing.responsableId,
                fechaCompromiso: body.fechaCompromiso !== undefined ? (body.fechaCompromiso ? new Date(body.fechaCompromiso) : null) : existing.fechaCompromiso,
                fechaCierre: body.fechaCierre !== undefined ? (body.fechaCierre ? new Date(body.fechaCierre) : null) : existing.fechaCierre,
                estado: body.estado ?? existing.estado,
            },
            include: {
                kpi: { select: { id: true, codigoKpi: true, nombre: true } },
                responsable: { select: { id: true, nombreCompleto: true } },
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'PLAN_ACCION_KPI',
            entityId: plan.id,
            oldValue: existing,
            newValue: plan,
        });

        return NextResponse.json(plan);
    } catch (error) {
        console.error('Error updating plan de acción:', error);
        return NextResponse.json({ error: 'Error del servidor al actualizar plan de acción' }, { status: 500 });
    }
}
