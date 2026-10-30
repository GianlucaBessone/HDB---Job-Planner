import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
    autenticarAgente, avisarGestores, cambiarEstadoAgente, errorAgente, registrarEventoAgente, ticketDelAgente,
} from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';

const schema = z.object({
    resumen: z.string().trim().min(10).max(12000),
    archivos: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
    verificaciones: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    rama: z.string().trim().max(200).optional(),
    commit: z.string().trim().regex(/^[0-9a-f]{7,40}$/i, 'commit debe ser un hash de git').optional(),
    prUrl: z.string().trim().url().max(500).refine(u => u.startsWith('https://'), 'prUrl debe ser https').optional(),
    pendientes: z.string().trim().max(4000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
    try {
        const { codigo } = await params;
        const token = await autenticarAgente(req);
        if (!token) return errorAgente('Token inválido, vencido o revocado.', 401);

        const ticket = await ticketDelAgente(token, codigo);
        if (!ticket) return errorAgente('Ticket no encontrado.', 404);

        if (ticket.estado !== 'en_progreso' || ticket.tomadoPorTokenId !== token.id) {
            return errorAgente('Primero tomá el ticket con POST /tomar.', 409);
        }

        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return errorAgente(`Body inválido: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`, 400);
        }
        const s = parsed.data;

        const nota = [
            `Solución propuesta por ${token.nombre}:`,
            s.resumen,
            s.archivos.length ? `\nArchivos: ${s.archivos.join(', ')}` : '',
            s.verificaciones.length ? `\nVerificaciones:\n- ${s.verificaciones.join('\n- ')}` : '',
            s.rama ? `\nRama: ${s.rama}` : '',
            s.commit ? `Commit: ${s.commit}` : '',
            s.prUrl ? `PR: ${s.prUrl}` : '',
            s.pendientes ? `\nPara revisar: ${s.pendientes}` : '',
        ].filter(Boolean).join('\n');

        const actualizado = await prisma.$transaction(async tx => {
            await registrarEventoAgente(tx, ticket.id, token, 'cambio', s);
            await tx.ticketComentario.create({
                data: { ticketId: ticket.id, autor: token.nombre, texto: nota, interno: true },
            });
            return cambiarEstadoAgente(tx, ticket, token, 'en_revision', 'Solución propuesta por un agente, pendiente de revisión.', {
                resolucion: s.resumen,
                rama: s.rama ?? ticket.rama,
                commitHash: s.commit ?? ticket.commitHash,
                prUrl: s.prUrl ?? ticket.prUrl,
                // Lo verifica una persona al revisar, no el agente.
                verificado: false,
                tomadoPorTokenId: null,
                tomadoHasta: null,
            });
        });

        await avisarGestores(
            `Ticket ${ticket.codigo} listo para revisar`,
            s.prUrl ? `Hay un PR con la solución: ${s.prUrl}` : `Solución en la rama ${s.rama || '(sin rama)'}.`,
            ticket.id
        );

        return NextResponse.json({
            codigo: actualizado.codigo,
            estado: actualizado.estado,
            mensaje: 'Solución registrada. Una persona la revisa, la publica y marca el ticket como resuelto.',
        });
    } catch (error) {
        console.error('[AGENTE_SOLUCION]', error);
        return errorAgente('Error al registrar la solución.', 500);
    }
}
