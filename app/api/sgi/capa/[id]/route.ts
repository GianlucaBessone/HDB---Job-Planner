import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const accion = await prisma.accionMejora.findUnique({
            where: { id: params.id },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                noConformidad: true,
                sugerencia: true,
                verificaciones: true
            }
        });

        if (!accion) return NextResponse.json({ error: 'Acción CAPA no encontrada' }, { status: 404 });

        return NextResponse.json(accion);
    } catch (error) {
        console.error('Error fetching Accion CAPA details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        
        // Transform date strings back to Date objects if needed
        const dataToUpdate = { ...body };
        if (dataToUpdate.fechaInicio) dataToUpdate.fechaInicio = new Date(dataToUpdate.fechaInicio);
        if (dataToUpdate.fechaCompromiso) dataToUpdate.fechaCompromiso = new Date(dataToUpdate.fechaCompromiso);
        if (dataToUpdate.fechaCierre) dataToUpdate.fechaCierre = new Date(dataToUpdate.fechaCierre);

        const currentAction = await prisma.accionMejora.findUnique({ where: { id: params.id } });

        const accion = await prisma.accionMejora.update({
            where: { id: params.id },
            data: dataToUpdate
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'CAPA',
            entityId: accion.id,
            oldValue: currentAction,
            newValue: accion
        });

        return NextResponse.json(accion);
    } catch (error) {
        console.error('Error updating Accion CAPA:', error);
        return NextResponse.json({ error: 'Error al actualizar Acción CAPA' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const accion = await prisma.accionMejora.findUnique({ where: { id: params.id } });

        await prisma.accionMejora.delete({
            where: { id: params.id }
        });

        if (accion) {
            await logAudit({
                userId: auth.user.id,
                action: 'DELETE',
                entity: 'CAPA',
                entityId: accion.id,
                oldValue: accion
            });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting Accion CAPA:', error);
        return NextResponse.json({ error: 'Error al eliminar Acción CAPA' }, { status: 500 });
    }
}
