import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autenticarAgente, errorAgente, ticketDelAgente, urlBase } from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
    try {
        const { codigo } = await params;
        const token = await autenticarAgente(req);
        if (!token) return errorAgente('Token inválido, vencido o revocado.', 401);

        const ticket = await ticketDelAgente(token, codigo);
        if (!ticket) return errorAgente('Ticket no encontrado.', 404);

        const [archivos, comentarios, historial] = await Promise.all([
            prisma.ticketAdjunto.findMany({
                where: { ticketId: ticket.id },
                select: { id: true, nombre: true, mime: true, size: true },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.ticketComentario.findMany({
                where: { ticketId: ticket.id },
                select: { autor: true, texto: true, interno: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.ticketHistorial.findMany({
                where: { ticketId: ticket.id },
                select: { estadoAnterior: true, estadoNuevo: true, usuario: true, comentario: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        const base = `${urlBase(req)}/api/agente/tickets/${ticket.codigo}`;

        return NextResponse.json({
            codigo: ticket.codigo,
            tipo: ticket.tipo,
            titulo: ticket.titulo,
            descripcion: ticket.descripcion,
            pasosReproducir: ticket.pasosReproducir,
            comportamientoEsperado: ticket.comportamientoEsperado,
            contexto: ticket.contexto,
            etiquetas: ticket.etiquetas,
            estado: ticket.estado,
            urgencia: ticket.urgencia,
            impacto: ticket.impacto,
            prioridad: ticket.prioridad,
            riesgo: ticket.riesgo,
            analisisPrevio: ticket.analisisAgente,
            rama: ticket.rama,
            commit: ticket.commitHash,
            prUrl: ticket.prUrl,
            resolucion: ticket.resolucion,
            tomadoHasta: ticket.tomadoHasta,
            tomadoPorVos: ticket.tomadoPorTokenId === token.id,
            createdAt: ticket.createdAt,
            adjuntos: archivos.map(a => ({ ...a, url: `${base}/adjuntos/${a.id}` })),
            comentarios,
            historial,
        });
    } catch (error) {
        console.error('[AGENTE_TICKET_GET]', error);
        return errorAgente('Error al obtener el ticket.', 500);
    }
}
