import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
    autenticarAgente, avisarGestores, bloqueadoPorOtro, cambiarEstadoAgente, errorAgente,
    registrarEventoAgente, ticketDelAgente,
} from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';

const schema = z.object({
    motivo: z.string().trim().min(5).max(4000),
    pregunta: z.string().trim().max(2000).optional(),
});

const ESTADOS_ESCALABLES = ['nuevo', 'triaje', 'en_analisis', 'listo_para_fix', 'en_progreso', 'pendiente_aprobacion'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
    try {
        const { codigo } = await params;
        const token = await autenticarAgente(req);
        if (!token) return errorAgente('Token inválido, vencido o revocado.', 401);

        const ticket = await ticketDelAgente(token, codigo);
        if (!ticket) return errorAgente('Ticket no encontrado.', 404);

        if (!ESTADOS_ESCALABLES.includes(ticket.estado)) {
            return errorAgente(`No se puede escalar un ticket en estado "${ticket.estado}".`, 409);
        }
        if (bloqueadoPorOtro(ticket, token)) {
            return errorAgente('Otro agente está trabajando este ticket.', 409);
        }

        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return errorAgente('Body inválido: {"motivo": "...", "pregunta": "..."}.', 400);
        const { motivo, pregunta } = parsed.data;

        const texto = pregunta ? `Escalado: ${motivo}\n\nPregunta: ${pregunta}` : `Escalado: ${motivo}`;

        const actualizado = await prisma.$transaction(async tx => {
            await registrarEventoAgente(tx, ticket.id, token, 'escalamiento', { motivo, pregunta: pregunta || null });
            await tx.ticketComentario.create({
                data: { ticketId: ticket.id, autor: token.nombre, texto, interno: true },
            });
            return cambiarEstadoAgente(tx, ticket, token, 'pendiente_aprobacion', motivo, {
                tomadoPorTokenId: null,
                tomadoHasta: null,
            });
        });

        await avisarGestores(`Ticket ${ticket.codigo} necesita una decisión`, motivo.slice(0, 180), ticket.id);

        return NextResponse.json({
            codigo: actualizado.codigo,
            estado: actualizado.estado,
            mensaje: 'Escalado. Una persona va a revisar el motivo y responder en el ticket.',
        });
    } catch (error) {
        console.error('[AGENTE_ESCALAR]', error);
        return errorAgente('Error al escalar el ticket.', 500);
    }
}
