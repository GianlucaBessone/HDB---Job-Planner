import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { triageTicket } from '@/lib/tickets-ai';

export const dynamic = 'force-dynamic';
// El triaje llama a Gemini y puede tardar unos segundos.
export const maxDuration = 60;

const COOLDOWN_MS = 30 * 1000;

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;
        const { userId, role } = acceso;
        const canManage = acceso.puede('tickets.gestionar');

        const ticket = await prisma.ticket.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                codigo: true,
                estado: true,
                reportadoPorId: true,
                analisisAgente: true,
            },
        });

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
        }

        const esAutor = ticket.reportadoPorId === userId;
        if (!canManage && !esAutor) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
        }

        // Un usuario común no puede re-analizar un ticket que ya tiene análisis:
        // evita spam de llamadas a la IA. El equipo de soporte sí puede.
        const analisis = ticket.analisisAgente as { generadoEn?: string } | null;
        if (!canManage && analisis) {
            return NextResponse.json(
                { error: 'Este ticket ya fue analizado. Pedile al equipo de soporte que lo vuelva a analizar.' },
                { status: 429 }
            );
        }

        // Cooldown para evitar re-análisis en ráfaga incluso desde gestión.
        if (analisis?.generadoEn) {
            const transcurrido = Date.now() - new Date(analisis.generadoEn).getTime();
            if (Number.isFinite(transcurrido) && transcurrido >= 0 && transcurrido < COOLDOWN_MS) {
                return NextResponse.json(
                    { error: 'El ticket se analizó hace menos de 30 segundos. Esperá un momento.' },
                    { status: 429 }
                );
            }
        }

        const result = await triageTicket(ticket.id, {
            userId,
            userName: acceso.nombre,
            userRole: role,
        });

        if (result.ok) {
            const success = result;
            console.log(
                `[TICKET_TRIAGE] ${ticket.codigo} · ${success.latenciaMs}ms · USD ${success.costo.toFixed(6)}`
            );

            return NextResponse.json(success.ticket);
        }

        const failure = result as { ok: false; status: number; error: string };
        return NextResponse.json({ error: failure.error }, { status: failure.status });
    } catch (error) {
        console.error('[TICKET_TRIAGE_POST]', error);
        return NextResponse.json({ error: 'Error al analizar el ticket con IA.' }, { status: 500 });
    }
}
