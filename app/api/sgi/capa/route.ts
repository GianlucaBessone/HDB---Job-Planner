import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        let codigoAccion = body.codigoAccion;
        if (!codigoAccion) {
            const count = await prisma.accionMejora.count();
            codigoAccion = `CAPA-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
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

        return NextResponse.json(accion, { status: 201 });
    } catch (error) {
        console.error('Error creating Accion CAPA:', error);
        return NextResponse.json({ error: 'Error del servidor al crear Acción CAPA' }, { status: 500 });
    }
}
