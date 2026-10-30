import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { triageTicket } from '@/lib/tickets-ai';

export const dynamic = 'force-dynamic';
// El triaje llama a Gemini y puede tardar unos segundos.
export const maxDuration = 60;

const GESTORES = ['admin', 'qa', 'supervisor'];
const COOLDOWN_MS = 30 * 1000;

function getActor(req: NextRequest) {
    const role = (req.headers.get('x-user-role') || 'operador').toLowerCase();
    const userId = req.headers.get('x-user-id') || null;
    return { role, userId, canManage: GESTORES.includes(role) };
}

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const { userId, canManage, role } = getActor(req);

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

        const actorNombre = userId
            ? (await prisma.operator.findUnique({
                  where: { id: userId },
                  select: { nombreCompleto: true },
              }))?.nombreCompleto || undefined
            : undefined;

        const result = await triageTicket(ticket.id, {
            userId,
            userName: actorNombre,
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
