import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAcceso } from '@/lib/permisosServer';

export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
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

/**
 * Archiva el aviso para quien lo recibió (`id` es el recipientId).
 * Con `?todos=1` lo archiva para todos sus destinatarios: se usa al aprobar o rechazar
 * una solicitud, para que no les quede pendiente a los demás supervisores. Solo puede
 * hacerlo un destinatario del aviso.
 */
export async function DELETE(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const todos = new URL(req.url).searchParams.get('todos') === '1';
        if (!todos) {
            await prisma.activityRecipient.update({
                where: { id: params.id },
                data: { archivedAt: new Date() }
            });
            return NextResponse.json({ success: true });
        }

        const { userId } = await getAcceso(req);
        const recipient = await prisma.activityRecipient.findUnique({
            where: { id: params.id },
            select: { activityId: true, operatorId: true }
        });
        if (!recipient) return NextResponse.json({ error: 'Aviso no encontrado' }, { status: 404 });
        if (!userId || recipient.operatorId !== userId) {
            return NextResponse.json({ error: 'No podés cerrar un aviso que no recibiste' }, { status: 403 });
        }

        await prisma.activityRecipient.updateMany({
            where: { activityId: recipient.activityId, archivedAt: null },
            data: { archivedAt: new Date() }
        });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Fallo al archivar actividad' }, { status: 500 });
    }
}
