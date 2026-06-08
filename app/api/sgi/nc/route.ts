import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const estado = searchParams.get('estado');

        const where: any = {};
        if (estado) where.estado = estado;

        const ncs = await prisma.noConformidad.findMany({
            where,
            include: {
                responsableRegistro: { select: { id: true, nombreCompleto: true } },
                responsableTratamiento: { select: { id: true, nombreCompleto: true } },
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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Generate a simple code if not provided
        let codigoNC = body.codigoNC;
        if (!codigoNC) {
            const count = await prisma.noConformidad.count();
            codigoNC = `NC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
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
                responsableTratamientoId: body.responsableTratamientoId,
                criticidad: body.criticidad || 'Media',
                impacto: body.impacto,
                estado: 'Abierta',
            }
        });

        return NextResponse.json(nc, { status: 201 });
    } catch (error) {
        console.error('Error creating No Conformidad:', error);
        return NextResponse.json({ error: 'Error del servidor al crear NC' }, { status: 500 });
    }
}
