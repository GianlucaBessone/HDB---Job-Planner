import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const objetivo = await prisma.objetivoCalidad.findUnique({
            where: { id: params.id },
            include: { accionesMejora: true }
        });

        if (!objetivo) return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });

        return NextResponse.json(objetivo);
    } catch (error) {
        console.error('Error fetching Objetivo details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        
        const currentObj = await prisma.objetivoCalidad.findUnique({ where: { id: params.id } });

        const objetivo = await prisma.objetivoCalidad.update({
            where: { id: params.id },
            data: body
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'OBJETIVO',
            entityId: objetivo.id,
            oldValue: currentObj,
            newValue: objetivo
        });

        return NextResponse.json(objetivo);
    } catch (error) {
        console.error('Error updating Objetivo:', error);
        return NextResponse.json({ error: 'Error al actualizar Objetivo' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const obj = await prisma.objetivoCalidad.findUnique({ where: { id: params.id } });

        await prisma.objetivoCalidad.delete({
            where: { id: params.id }
        });

        if (obj) {
            await logAudit({
                userId: auth.user.id,
                action: 'DELETE',
                entity: 'OBJETIVO',
                entityId: obj.id,
                oldValue: obj
            });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting Objetivo:', error);
        return NextResponse.json({ error: 'Error al eliminar Objetivo' }, { status: 500 });
    }
}
