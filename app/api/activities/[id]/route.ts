import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

/**
 * Busca el destinatario (params.id es el recipientId que devuelve GET /api/activities)
 * solo si pertenece al usuario de la sesión: nadie marca ni archiva avisos ajenos.
 */
async function destinatarioPropio(req: Request, recipientId: string) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const recipient = await prisma.activityRecipient.findFirst({
        where: { id: recipientId, operatorId: acceso.userId },
        select: { id: true, activityId: true },
    });
    if (!recipient) return NextResponse.json({ error: 'Aviso no encontrado' }, { status: 404 });
    return recipient;
}

const marcarSchema = z.object({ read: z.boolean() });

export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const propio = await destinatarioPropio(req, params.id);
        if (propio instanceof NextResponse) return propio;

        const parsed = marcarSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: 'Indicá si el aviso queda leído (read: true o false)' }, { status: 400 });
        }

        const recipient = await prisma.activityRecipient.update({
            where: { id: propio.id },
            data: { readAt: parsed.data.read ? new Date() : null }
        });

        return NextResponse.json(recipient);
    } catch (e) {
        return NextResponse.json({ error: 'Fallo al actualizar actividad' }, { status: 500 });
    }
}

/**
 * Archiva el aviso para quien lo recibió (`id` es el recipientId, y tiene que ser del
 * usuario de la sesión). Con `?todos=1` lo archiva para todos sus destinatarios: se usa al
 * aprobar o rechazar una solicitud, para que no les quede pendiente a los demás supervisores.
 */
export async function DELETE(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const propio = await destinatarioPropio(req, params.id);
        if (propio instanceof NextResponse) return propio;

        const todos = new URL(req.url).searchParams.get('todos') === '1';
        if (!todos) {
            await prisma.activityRecipient.update({
                where: { id: propio.id },
                data: { archivedAt: new Date() }
            });
            return NextResponse.json({ success: true });
        }

        await prisma.activityRecipient.updateMany({
            where: { activityId: propio.activityId, archivedAt: null },
            data: { archivedAt: new Date() }
        });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Fallo al archivar actividad' }, { status: 500 });
    }
}
