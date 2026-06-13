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
        const tipoAccion = searchParams.get('tipo');

        const where: any = {};
        if (estado) where.estado = estado;
        if (tipoAccion) where.tipoAccion = tipoAccion;

        const acciones = await prisma.accionMejora.findMany({
            where,
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                noConformidad: { select: { id: true, codigoNC: true } },
                sugerencia: { select: { id: true, titulo: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(acciones);
    } catch (error) {
        console.error('Error fetching Acciones CAPA:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        
        // Validation H-003
        if (!body.descripcion || !body.tipoAccion || !body.origen) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // Generate robust code H-001
        let codigoAccion = body.codigoAccion;
        if (!codigoAccion) {
            const year = new Date().getFullYear();
            const pattern = `CAPA-${year}-`;
            const last = await prisma.accionMejora.findFirst({
                where: { codigoAccion: { startsWith: pattern } },
                orderBy: { codigoAccion: 'desc' },
                select: { codigoAccion: true },
            });
            let lastNumber = 0;
            if (last?.codigoAccion) {
                const parts = last.codigoAccion.split('-');
                lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
            }
            codigoAccion = `CAPA-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
        }

        const accion = await prisma.accionMejora.create({
            data: {
                codigoAccion,
                tipoAccion: body.tipoAccion || 'Mejora Continua',
                origen: body.origen || 'Otro',
                descripcion: body.descripcion,
                justificacion: body.justificacion,
                beneficioEsperado: body.beneficioEsperado,
                responsableId: body.responsableId,
                prioridad: body.prioridad || 'Media',
                fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
                fechaCompromiso: body.fechaCompromiso ? new Date(body.fechaCompromiso) : null,
                estado: 'Pendiente',
                ncId: body.ncId,
                sugerenciaId: body.sugerenciaId,
                riesgoId: body.riesgoId,
                oportunidadId: body.oportunidadId,
                auditoriaId: body.auditoriaId,
                documentoId: body.documentoId,
            }
        });

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'CAPA',
            entityId: accion.id,
            newValue: accion
        });

        return NextResponse.json(accion, { status: 201 });
    } catch (error) {
        console.error('Error creating Accion CAPA:', error);
        return NextResponse.json({ error: 'Error del servidor al crear Acción CAPA' }, { status: 500 });
    }
}
