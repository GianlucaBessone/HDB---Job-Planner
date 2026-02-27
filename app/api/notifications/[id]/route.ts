import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();

        const notification = await prisma.notification.update({
            where: { id: params.id },
            data: { read: body.read }
        });

        return NextResponse.json(notification);
    } catch (e) {
        return NextResponse.json({ error: 'Fallo al actualizar notificación' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        await prisma.notification.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Fallo al eliminar notificación' }, { status: 500 });
    }
}
