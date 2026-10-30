import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { autenticarAgente, errorAgente, registrarEventoAgente, ticketDelAgente } from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';

const schema = z.object({
    texto: z.string().trim().min(1).max(8000),
    // Por defecto es una nota para el equipo; el usuario que reportó no la ve.
    interno: z.boolean().default(true),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
    try {
        const { codigo } = await params;
        const token = await autenticarAgente(req);
        if (!token) return errorAgente('Token inválido, vencido o revocado.', 401);

        const ticket = await ticketDelAgente(token, codigo);
        if (!ticket) return errorAgente('Ticket no encontrado.', 404);

        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorAgente('Body inválido: {"texto": "...", "interno": true}.', 400);

        const comentario = await prisma.$transaction(async tx => {
            await registrarEventoAgente(tx, ticket.id, token, 'nota', { accion: 'comentario', interno: parsed.data.interno });
            return tx.ticketComentario.create({
                data: { ticketId: ticket.id, autor: token.nombre, texto: parsed.data.texto, interno: parsed.data.interno },
                select: { autor: true, texto: true, interno: true, createdAt: true },
            });
        });

        return NextResponse.json({ comentario }, { status: 201 });
    } catch (error) {
        console.error('[AGENTE_COMENTARIO]', error);
        return errorAgente('Error al guardar el comentario.', 500);
    }
}
