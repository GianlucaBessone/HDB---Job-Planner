import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autenticarAgente, errorAgente, ESTADOS_TOMABLES_GLOBAL } from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const token = await autenticarAgente(req);
        if (!token) return errorAgente('Token inválido, vencido o revocado.', 401);

        const tickets = await prisma.ticket.findMany({
            where: token.ticketId ? { id: token.ticketId } : { estado: { in: ESTADOS_TOMABLES_GLOBAL } },
            select: {
                codigo: true, tipo: true, titulo: true, estado: true, prioridad: true,
                urgencia: true, riesgo: true, tomadoHasta: true, createdAt: true,
            },
            orderBy: [{ prioridad: 'asc' }, { createdAt: 'asc' }],
            take: 50,
        });

        return NextResponse.json({ tickets });
    } catch (error) {
        console.error('[AGENTE_TICKETS_LIST]', error);
        return errorAgente('Error al listar tickets.', 500);
    }
}
