import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { generateCodigoOkr } from '@/lib/codeGenerator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const estado = searchParams.get('estado');

        const where: any = {};
        if (estado) where.estado = estado;

        const okrs = await prisma.okr.findMany({
            where,
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                kpis: {
                    include: {
                        responsableCarga: { select: { id: true, nombreCompleto: true } },

                        _count: { select: { historico: true, planesAccion: true } },
                    },
                    orderBy: { codigoKpi: 'asc' },
                },
            },
            orderBy: { codigoOkr: 'asc' },
        });

        return NextResponse.json(okrs);
    } catch (error) {
        console.error('Error fetching OKRs:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (!body.nombre) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        const codigoOkr = await generateCodigoOkr();

        const okr = await prisma.okr.create({
            data: {
                codigoOkr,
                nombre: body.nombre,
                descripcion: body.descripcion || null,
                areaResponsable: body.areaResponsable || null,
                responsableId: body.responsableId || null,
                fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
                fechaFin: body.fechaFin ? new Date(body.fechaFin) : null,
                frecuenciaRevision: body.frecuenciaRevision || null,
                metaGlobal: body.metaGlobal || null,
                estado: body.estado || 'Activo',
                observaciones: body.observaciones || null,
                usuarioCreacionId: auth.user.id,
                usuarioModificacionId: auth.user.id,
            },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                kpis: true,
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'OKR',
            entityId: okr.id,
            newValue: okr,
        });

        return NextResponse.json(okr, { status: 201 });
    } catch (error) {
        console.error('Error creating OKR:', error);
        return NextResponse.json({ error: 'Error del servidor al crear OKR' }, { status: 500 });
    }
}
