import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const kpiId = searchParams.get('kpiId');
        const estado = searchParams.get('estado');

        const where: any = {};
        if (kpiId) where.kpiId = kpiId;
        if (estado) where.estado = estado;

        const planes = await prisma.planAccionKpi.findMany({
            where,
            include: {
                kpi: { select: { id: true, codigoKpi: true, nombre: true, estadoCumplimiento: true } },
                responsable: { select: { id: true, nombreCompleto: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(planes);
    } catch (error) {
        console.error('Error fetching planes de acción:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (!body.kpiId || !body.descripcion) {
            return NextResponse.json({ error: 'kpiId y descripcion son obligatorios' }, { status: 400 });
        }

        // Verify KPI exists
        const kpi = await prisma.kpi.findUnique({ where: { id: body.kpiId } });
        if (!kpi) {
            return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 });
        }

        const plan = await prisma.planAccionKpi.create({
            data: {
                kpiId: body.kpiId,
                descripcion: body.descripcion,
                causa: body.causa || null,
                accionCorrectiva: body.accionCorrectiva || null,
                responsableId: body.responsableId || null,
                fechaCompromiso: body.fechaCompromiso ? new Date(body.fechaCompromiso) : null,
                estado: 'Pendiente',
            },
            include: {
                kpi: { select: { id: true, codigoKpi: true, nombre: true } },
                responsable: { select: { id: true, nombreCompleto: true } },
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'PLAN_ACCION_KPI',
            entityId: plan.id,
            newValue: plan,
            metadata: { kpiId: body.kpiId, kpiCodigo: kpi.codigoKpi },
        });

        return NextResponse.json(plan, { status: 201 });
    } catch (error) {
        console.error('Error creating plan de acción:', error);
        return NextResponse.json({ error: 'Error del servidor al crear plan de acción' }, { status: 500 });
    }
}
