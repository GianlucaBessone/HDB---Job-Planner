import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const opt = await prisma.oportunidad.findUnique({
            where: { id: params.id },
            include: { accionesMejora: true }
        });

        if (!opt) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 });

        return NextResponse.json(opt);
    } catch (error) {
        console.error('Error fetching Oportunidad details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        
        const currentOpt = await prisma.oportunidad.findUnique({ where: { id: params.id } });

        const opt = await prisma.oportunidad.update({
            where: { id: params.id },
            data: body
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'OPORTUNIDAD',
            entityId: opt.id,
            oldValue: currentOpt,
            newValue: opt
        });

        return NextResponse.json(opt);
    } catch (error) {
        console.error('Error updating Oportunidad:', error);
        return NextResponse.json({ error: 'Error al actualizar Oportunidad' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const opt = await prisma.oportunidad.findUnique({ where: { id: params.id } });

        await prisma.oportunidad.delete({
            where: { id: params.id }
        });

        if (opt) {
            await logAudit({
                userId: auth.user.id,
                action: 'DELETE',
                entity: 'OPORTUNIDAD',
                entityId: opt.id,
                oldValue: opt
            });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting Oportunidad:', error);
        return NextResponse.json({ error: 'Error al eliminar Oportunidad' }, { status: 500 });
    }
}
