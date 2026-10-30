import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { generarToken, promptParaAgente, TOKEN_TICKET_HORAS, urlBase } from '@/lib/ticketsAgente';

export const dynamic = 'force-dynamic';

const GESTORES = ['admin', 'qa', 'supervisor'];

function getActor(req: NextRequest) {
    const role = (req.headers.get('x-user-role') || '').toLowerCase();
    const userId = req.headers.get('x-user-id') || null;
    return { userId, canManage: GESTORES.includes(role) };
}

// Genera un token para que un agente externo trabaje solo este ticket.
// Revoca los tokens anteriores del ticket y libera el bloqueo: el nuevo link reemplaza al viejo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId, canManage } = getActor(req);
        if (!userId || !canManage) {
            return NextResponse.json({ error: 'Solo el equipo de soporte puede delegar tickets a un agente.' }, { status: 403 });
        }

        const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true, codigo: true, estado: true } });
        if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });

        if (['resuelto', 'cerrado', 'rechazado', 'duplicado'].includes(ticket.estado)) {
            return NextResponse.json({ error: `El ticket está ${ticket.estado}: reabrilo antes de delegarlo.` }, { status: 409 });
        }

        const { token, hash, prefijo } = generarToken();
        const expiraEn = new Date(Date.now() + TOKEN_TICKET_HORAS * 60 * 60 * 1000);

        await prisma.$transaction([
            prisma.ticketAgenteToken.updateMany({
                where: { ticketId: ticket.id, revocadoEn: null },
                data: { revocadoEn: new Date() },
            }),
            prisma.ticket.update({ where: { id: ticket.id }, data: { tomadoPorTokenId: null, tomadoHasta: null } }),
            prisma.ticketAgenteToken.create({
                data: {
                    nombre: `Agente ${ticket.codigo}`,
                    tokenHash: hash,
                    prefijo,
                    ticketId: ticket.id,
                    creadoPorId: userId,
                    expiraEn,
                },
            }),
        ]);

        await logAudit({
            userId,
            action: 'CREATE',
            entity: 'TICKET_AGENTE_TOKEN',
            entityId: ticket.id,
            newValue: { codigo: ticket.codigo, prefijo, expiraEn },
        }).catch(err => console.error('[AGENTE_TOKEN] Audit failed:', err));

        // El token se muestra una sola vez: en la base queda solo el hash.
        return NextResponse.json({
            prompt: promptParaAgente(urlBase(req), ticket.codigo, token, expiraEn),
            expiraEn,
        });
    } catch (error) {
        console.error('[AGENTE_TOKEN]', error);
        return NextResponse.json({ error: 'No se pudo generar el acceso para el agente.' }, { status: 500 });
    }
}

// Revoca el acceso de agentes a este ticket.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId, canManage } = getActor(req);
        if (!userId || !canManage) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
        }

        const { count } = await prisma.ticketAgenteToken.updateMany({
            where: { ticketId: id, revocadoEn: null },
            data: { revocadoEn: new Date() },
        });
        await prisma.ticket.update({ where: { id }, data: { tomadoPorTokenId: null, tomadoHasta: null } });

        return NextResponse.json({ revocados: count });
    } catch (error) {
        console.error('[AGENTE_TOKEN_DELETE]', error);
        return NextResponse.json({ error: 'No se pudo revocar el acceso.' }, { status: 500 });
    }
}
