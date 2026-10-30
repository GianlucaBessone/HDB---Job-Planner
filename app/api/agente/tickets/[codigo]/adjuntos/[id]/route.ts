import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autenticarAgente, errorAgente, ticketDelAgente } from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string; id: string }> }) {
    try {
        const { codigo, id } = await params;
        const token = await autenticarAgente(req);
        if (!token) return errorAgente('Token inválido, vencido o revocado.', 401);

        const ticket = await ticketDelAgente(token, codigo);
        if (!ticket) return errorAgente('Ticket no encontrado.', 404);

        const adjunto = await prisma.ticketAdjunto.findFirst({ where: { id, ticketId: ticket.id } });
        if (!adjunto) return errorAgente('Adjunto no encontrado.', 404);

        return new NextResponse(new Uint8Array(adjunto.datos), {
            headers: {
                'Content-Type': adjunto.mime,
                'Content-Length': String(adjunto.size),
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(adjunto.nombre)}`,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('[AGENTE_ADJUNTO_GET]', error);
        return errorAgente('Error al obtener el adjunto.', 500);
    }
}
