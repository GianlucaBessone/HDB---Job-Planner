import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const nc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            include: {
                responsableRegistro: { select: { id: true, nombreCompleto: true } },
                responsableTratamiento: { select: { id: true, nombreCompleto: true } },
                analisisCausaRaiz: true,
                accionesMejora: true,
                verificacionesEficacia: true,
                reuniones: true,
                documentacionAfectada: {
                    include: {
                        documento: { select: { id: true, codigoDocumental: true, titulo: true } }
                    }
                },
                capacitacionesReq: true
            }
        });

        if (!nc) return NextResponse.json({ error: 'No Conformidad no encontrada' }, { status: 404 });

        return NextResponse.json(nc);
    } catch (error) {
        console.error('Error fetching No Conformidad details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        
        const nc = await prisma.noConformidad.update({
            where: { id: params.id },
            data: body
        });

        return NextResponse.json(nc);
    } catch (error) {
        console.error('Error updating No Conformidad:', error);
        return NextResponse.json({ error: 'Error al actualizar NC' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        await prisma.noConformidad.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting No Conformidad:', error);
        return NextResponse.json({ error: 'Error al eliminar NC' }, { status: 500 });
    }
}
