import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { recalcularAvanceOkr } from '@/lib/okrKpiEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const okr = await prisma.okr.findUnique({
            where: { id: params.id },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                kpis: {
                    include: {
                        responsableCarga: { select: { id: true, nombreCompleto: true } },

                        historico: {
                            orderBy: { fechaMedicion: 'desc' },
                            take: 20,
                        },
                        planesAccion: {
                            orderBy: { createdAt: 'desc' },
                        },
                        _count: { select: { historico: true, planesAccion: true } },
                    },
                    orderBy: { codigoKpi: 'asc' },
                },
            },
        });

        if (!okr) {
            return NextResponse.json({ error: 'OKR no encontrado' }, { status: 404 });
        }

        return NextResponse.json(okr);
    } catch (error) {
        console.error('Error fetching OKR:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        const existing = await prisma.okr.findUnique({ where: { id: params.id } });
        if (!existing) {
            return NextResponse.json({ error: 'OKR no encontrado' }, { status: 404 });
        }

        const okr = await prisma.okr.update({
            where: { id: params.id },
            data: {
                nombre: body.nombre ?? existing.nombre,
                descripcion: body.descripcion !== undefined ? body.descripcion : existing.descripcion,
                areaResponsable: body.areaResponsable !== undefined ? body.areaResponsable : existing.areaResponsable,
                responsableId: body.responsableId !== undefined ? body.responsableId : existing.responsableId,
                fechaInicio: body.fechaInicio !== undefined ? (body.fechaInicio ? new Date(body.fechaInicio) : null) : existing.fechaInicio,
                fechaFin: body.fechaFin !== undefined ? (body.fechaFin ? new Date(body.fechaFin) : null) : existing.fechaFin,
                frecuenciaRevision: body.frecuenciaRevision !== undefined ? body.frecuenciaRevision : existing.frecuenciaRevision,
                metaGlobal: body.metaGlobal !== undefined ? body.metaGlobal : existing.metaGlobal,
                estado: body.estado ?? existing.estado,
                observaciones: body.observaciones !== undefined ? body.observaciones : existing.observaciones,
                usuarioModificacionId: auth.user.id,
            },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                kpis: {
                    include: {
                        responsableCarga: { select: { id: true, nombreCompleto: true } },

                    },
                    orderBy: { codigoKpi: 'asc' },
                },
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'OKR',
            entityId: okr.id,
            oldValue: existing,
            newValue: okr,
        });

        // Recalculate in case KPI status changed
        await recalcularAvanceOkr(params.id);

        return NextResponse.json(okr);
    } catch (error) {
        console.error('Error updating OKR:', error);
        return NextResponse.json({ error: 'Error del servidor al actualizar OKR' }, { status: 500 });
    }
}
