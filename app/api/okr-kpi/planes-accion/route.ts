import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';
import { INCLUIR_RESPONSABLE, WHERE_PLAN_KPI, asignarResponsable, comoPlanKpi, estadoTareaDesdeKpi } from '@/lib/acciones';

export const dynamic = 'force-dynamic';

const KPI_SELECT = { id: true, codigoKpi: true, nombre: true, estadoCumplimiento: true } as const;

/** Planes de acción de KPI = tareas con KPI (P31). Mismo formato de respuesta que antes. */
export async function GET(req: NextRequest) {
    const auth = await exigirAcceso(req, ['okr.ver', 'okr.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const kpiId = searchParams.get('kpiId');
        const estado = searchParams.get('estado');

        const where: any = { ...WHERE_PLAN_KPI };
        if (kpiId) where.kpiId = kpiId;
        if (estado) where.estado = estado === 'Cerrado' ? { in: ['cerrada', 'completada', 'cancelada', 'anulada'] } : estadoTareaDesdeKpi(estado);

        const planes = await prisma.tarea.findMany({
            where,
            include: { ...INCLUIR_RESPONSABLE, kpi: { select: KPI_SELECT } },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(planes.map(comoPlanKpi));
    } catch (error) {
        console.error('Error fetching planes de acción:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await exigirAcceso(req, ['okr.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        if (!body.kpiId || !body.descripcion) {
            return NextResponse.json({ error: 'kpiId y descripcion son obligatorios' }, { status: 400 });
        }
        const kpi = await prisma.kpi.findUnique({ where: { id: body.kpiId } });
        if (!kpi) return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 });

        const descripcion = String(body.descripcion).trim();
        const plan = await prisma.$transaction(async (tx) => {
            const t = await tx.tarea.create({
                data: {
                    titulo: descripcion.split('\n')[0].slice(0, 140),
                    descripcion,
                    origenTipo: 'kpi',
                    kpiId: body.kpiId,
                    causa: body.causa || null,
                    accionCorrectiva: body.accionCorrectiva || null,
                    fechaVencimiento: body.fechaCompromiso ? new Date(body.fechaCompromiso) : null,
                    estado: 'pendiente',
                    creadorId: auth.userId,
                    creadorNombre: auth.nombre,
                },
            });
            await asignarResponsable(tx, t.id, body.responsableId || null);
            return tx.tarea.findUniqueOrThrow({ where: { id: t.id }, include: { ...INCLUIR_RESPONSABLE, kpi: { select: KPI_SELECT } } });
        });

        const resultado = comoPlanKpi(plan);
        await logAudit({
            userId: auth.userId,
            action: 'CREATE',
            entity: 'PLAN_ACCION_KPI',
            entityId: plan.id,
            newValue: resultado,
            metadata: { kpiId: body.kpiId, kpiCodigo: kpi.codigoKpi },
        });
        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        console.error('Error creating plan de acción:', error);
        return NextResponse.json({ error: 'Error del servidor al crear plan de acción' }, { status: 500 });
    }
}
