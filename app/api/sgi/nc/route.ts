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
        const estado = searchParams.get('estado');

        const where: any = {};
        if (estado) where.estado = estado;

        const ncs = await prisma.noConformidad.findMany({
            where,
            include: {
                responsableRegistro: { select: { id: true, nombreCompleto: true } },
                responsablesTratamiento: { select: { id: true, nombreCompleto: true } },
                analisisCausaRaiz: true,
                accionesMejora: {
                    select: {
                        id: true,
                        codigoAccion: true,
                        estado: true,
                        porcentajeAvance: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(ncs);
    } catch (error) {
        console.error('Error fetching No Conformidades:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        
        // Validation H-003
        if (!body.descripcion || !body.origen || !body.tipoNC || !body.categoria || !body.procesoAfectado || !body.areaAfectada) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // Generate robust code H-001
        let codigoNC = body.codigoNC;
        if (!codigoNC) {
            const year = new Date().getFullYear();
            const pattern = `NC-${year}-`;
            const last = await prisma.noConformidad.findFirst({
                where: { codigoNC: { startsWith: pattern } },
                orderBy: { codigoNC: 'desc' },
                select: { codigoNC: true },
            });
            let lastNumber = 0;
            if (last?.codigoNC) {
                const parts = last.codigoNC.split('-');
                lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
            }
            codigoNC = `NC-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
        }

        const nc = await prisma.noConformidad.create({
            data: {
                codigoNC,
                fechaDeteccion: new Date(body.fechaDeteccion || new Date()),
                origen: body.origen || 'Otro',
                tipoNC: body.tipoNC || 'Menor',
                categoria: body.categoria || 'General',
                descripcion: body.descripcion,
                procesoAfectado: body.procesoAfectado,
                areaAfectada: body.areaAfectada,
                responsableRegistroId: body.responsableRegistroId,
                responsablesTratamiento: body.responsablesTratamientoIds?.length > 0 ? {
                    connect: body.responsablesTratamientoIds.map((id: string) => ({ id }))
                } : undefined,
                criticidad: body.criticidad || 'Media',
                impacto: body.impacto,
                estado: 'Abierta',
            }
        });

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'NC',
            entityId: nc.id,
            newValue: nc
        });

        return NextResponse.json(nc, { status: 201 });
    } catch (error) {
        console.error('Error creating No Conformidad:', error);
        return NextResponse.json({ error: 'Error del servidor al crear NC' }, { status: 500 });
    }
}
