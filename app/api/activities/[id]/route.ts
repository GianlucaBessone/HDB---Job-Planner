import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();

        const recipient = await prisma.activityRecipient.update({
            // params.id is the recipientId we sent from the GET /api/activities
            where: { id: params.id },
            data: { readAt: body.read ? new Date() : null }
        });

        return NextResponse.json(recipient);
    } catch (e) {
        return NextResponse.json({ error: 'Fallo al actualizar actividad' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        await prisma.activityRecipient.update({
            where: { id: params.id },
            data: { archivedAt: new Date() }
        });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Fallo al archivar actividad' }, { status: 500 });
    }
}
