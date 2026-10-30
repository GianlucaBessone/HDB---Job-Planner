import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, TicketAgenteToken } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';

// API para agentes externos (/api/agente). Cualquier herramienta con acceso al repo
// la usa con un token: no necesita credenciales de la base ni una integración propia.

export const TOKEN_TICKET_HORAS = 48;
export const BLOQUEO_HORAS = 4;

// Desde dónde puede tomar un ticket cada tipo de token. El token de un ticket lo
// generó una persona para ese ticket, así que puede retomarlo aunque no esté listo.
export const ESTADOS_TOMABLES_GLOBAL = ['listo_para_fix'];
export const ESTADOS_TOMABLES_TICKET = [
    'nuevo', 'triaje', 'en_analisis', 'pendiente_aprobacion', 'listo_para_fix', 'en_progreso', 'en_revision',
];

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function generarToken(): { token: string; hash: string; prefijo: string } {
    const token = `sgia_${crypto.randomBytes(32).toString('base64url')}`;
    return { token, hash: hashToken(token), prefijo: token.slice(0, 10) };
}

export function errorAgente(mensaje: string, status: number) {
    return NextResponse.json({ error: mensaje }, { status });
}

/** Valida el token Bearer. Devuelve null si falta, no existe, venció o fue revocado. */
export async function autenticarAgente(req: NextRequest): Promise<TicketAgenteToken | null> {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(\S+)$/i);
    if (!match) return null;

    const registro = await prisma.ticketAgenteToken.findUnique({ where: { tokenHash: hashToken(match[1]) } });
    if (!registro || registro.revocadoEn) return null;
    if (registro.expiraEn && registro.expiraEn < new Date()) return null;

    await prisma.ticketAgenteToken.update({ where: { id: registro.id }, data: { ultimoUsoEn: new Date() } });
    return registro;
}

/** Busca el ticket por código (TCK-2026-0001) o id y verifica que el token pueda verlo. */
export async function ticketDelAgente(token: TicketAgenteToken, codigo: string) {
    const ticket = await prisma.ticket.findFirst({
        where: { OR: [{ codigo: codigo.toUpperCase() }, { id: codigo }] },
    });
    if (!ticket) return null;
    if (token.ticketId && token.ticketId !== ticket.id) return null;
    return ticket;
}

export function bloqueadoPorOtro(
    ticket: { tomadoPorTokenId: string | null; tomadoHasta: Date | null },
    token: TicketAgenteToken
): boolean {
    return !!ticket.tomadoPorTokenId
        && ticket.tomadoPorTokenId !== token.id
        && !!ticket.tomadoHasta
        && ticket.tomadoHasta > new Date();
}

export async function cambiarEstadoAgente(
    tx: Prisma.TransactionClient,
    ticket: { id: string; estado: string },
    token: TicketAgenteToken,
    estadoNuevo: string,
    comentario: string,
    data: Prisma.TicketUpdateInput = {}
) {
    const actualizado = await tx.ticket.update({
        where: { id: ticket.id },
        data: { ...data, estado: estadoNuevo, fechaResolucion: null, fechaCierre: null },
    });
    if (ticket.estado !== estadoNuevo) {
        await tx.ticketHistorial.create({
            data: {
                ticketId: ticket.id,
                estadoAnterior: ticket.estado,
                estadoNuevo,
                usuario: token.nombre,
                comentario,
            },
        });
    }
    return actualizado;
}

export async function registrarEventoAgente(
    tx: Prisma.TransactionClient,
    ticketId: string,
    token: TicketAgenteToken,
    tipo: string,
    payload: Record<string, unknown>
) {
    await tx.ticketEventoAgente.create({
        data: { ticketId, agente: token.nombre, tipo, payload: payload as Prisma.InputJsonValue },
    });
}

/** Avisa a supervisores y admins. En local no manda push para no molestar a usuarios reales. */
export async function avisarGestores(titulo: string, mensaje: string, ticketId: string) {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[AGENTE_AVISO] (push omitido fuera de producción)', titulo, '—', mensaje);
        return;
    }
    await sendPushNotification({
        forSupervisors: true,
        title: titulo,
        message: mensaje,
        data: { route: `/tickets?id=${ticketId}` },
    }).catch(err => console.error('[AGENTE_AVISO] Push failed:', err));
}

export function urlBase(req: NextRequest): string {
    return new URL(req.url).origin;
}

export function promptParaAgente(base: string, codigo: string, token: string, expiraEn: Date): string {
    return [
        `Resolvé el ticket de soporte ${codigo} de HDB SGI en este repositorio.`,
        `Antes de empezar, leé las instrucciones: ${base}/api/agente/instrucciones`,
        `Token de acceso (header "Authorization: Bearer ..."): ${token}`,
        `El token sirve solo para este ticket y vence el ${expiraEn.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}.`,
    ].join('\n');
}
