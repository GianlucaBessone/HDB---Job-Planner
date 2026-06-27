import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { recalcularTrasNuevaMedicion } from '@/lib/okrKpiEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '100', 10);

        const mediciones = await prisma.kpiHistorico.findMany({
            where: { kpiId: params.id },
            orderBy: { fechaMedicion: 'desc' },
            take: limit,
        });

        return NextResponse.json(mediciones);
    } catch (error) {
        console.error('Error fetching mediciones:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (body.valorObtenido === undefined || body.valorObtenido === null) {
            return NextResponse.json({ error: 'valorObtenido es obligatorio' }, { status: 400 });
        }

        // Verify KPI exists
        const kpi = await prisma.kpi.findUnique({ where: { id: params.id } });
        if (!kpi) {
            return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 });
        }

        // Get the user name for snapshot
        let usuarioNombre: string | null = null;
        if (auth.user.id) {
            const op = await prisma.operator.findUnique({
                where: { id: auth.user.id },
                select: { nombreCompleto: true },
            });
            usuarioNombre = op?.nombreCompleto || null;
        }

        // Create measurement (never overwrite existing)
        const medicion = await prisma.kpiHistorico.create({
            data: {
                kpiId: params.id,
                fechaMedicion: body.fechaMedicion ? new Date(body.fechaMedicion) : new Date(),
                valorObtenido: parseFloat(body.valorObtenido),
                comentario: body.comentario || null,
                usuarioRegistroId: auth.user.id,
                usuarioRegistroNombre: usuarioNombre,
            },
        });

        // Recalculate KPI status and OKR progress
        await recalcularTrasNuevaMedicion(params.id);

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'KPI_MEDICION',
            entityId: medicion.id,
            newValue: medicion,
            metadata: { kpiId: params.id, kpiCodigo: kpi.codigoKpi },
        });

        // Return the updated KPI with the new measurement
        const updatedKpi = await prisma.kpi.findUnique({
            where: { id: params.id },
            include: {
                historico: {
                    orderBy: { fechaMedicion: 'desc' },
                    take: 10,
                },
            },
        });

        return NextResponse.json({
            medicion,
            kpiActualizado: updatedKpi,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating medicion:', error);
        return NextResponse.json({ error: 'Error del servidor al registrar medición' }, { status: 500 });
    }
}
