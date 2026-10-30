import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    autenticarAgente, bloqueadoPorOtro, BLOQUEO_HORAS, cambiarEstadoAgente, errorAgente,
    ESTADOS_TOMABLES_GLOBAL, ESTADOS_TOMABLES_TICKET, registrarEventoAgente, ticketDelAgente,
} from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
    try {
        const { codigo } = await params;
        const token = await autenticarAgente(req);
        if (!token) return errorAgente('Token inválido, vencido o revocado.', 401);

        const ticket = await ticketDelAgente(token, codigo);
        if (!ticket) return errorAgente('Ticket no encontrado.', 404);

        const tomables = token.ticketId ? ESTADOS_TOMABLES_TICKET : ESTADOS_TOMABLES_GLOBAL;
        if (!tomables.includes(ticket.estado)) {
            return errorAgente(`No se puede tomar un ticket en estado "${ticket.estado}".`, 409);
        }
        if (bloqueadoPorOtro(ticket, token)) {
            return errorAgente(`Otro agente lo está trabajando hasta ${ticket.tomadoHasta?.toISOString()}.`, 409);
        }

        const tomadoHasta = new Date(Date.now() + BLOQUEO_HORAS * 60 * 60 * 1000);
        const actualizado = await prisma.$transaction(async tx => {
            await registrarEventoAgente(tx, ticket.id, token, 'nota', { accion: 'tomar', estadoAnterior: ticket.estado });
            return cambiarEstadoAgente(tx, ticket, token, 'en_progreso', 'Ticket tomado por un agente.', {
                tomadoPorTokenId: token.id,
                tomadoHasta,
            });
        });

        return NextResponse.json({
            codigo: actualizado.codigo,
            estado: actualizado.estado,
            tomadoHasta,
            mensaje: `Ticket tomado. Trabajá en la rama ticket/${actualizado.codigo} y avisá con /solucion o /escalar.`,
        });
    } catch (error) {
        console.error('[AGENTE_TOMAR]', error);
        return errorAgente('Error al tomar el ticket.', 500);
    }
}
