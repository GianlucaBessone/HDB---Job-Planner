import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import {
    computePrioridad,
    generarCodigoTicket,
    TICKET_ADJUNTOS_MAX,
    TICKET_DESCRIPCION_MIN,
    TICKET_TITULO_MAX,
} from '@/lib/tickets';

export const dynamic = 'force-dynamic';

const GESTORES = ['admin', 'qa', 'supervisor'];

const contextoShape = z.object({
    ruta: z.string().max(500).optional(),
    url: z.string().max(1000).optional(),
    navegador: z.string().max(500).optional(),
    plataforma: z.string().max(120).optional(),
    pantalla: z.string().max(60).optional(),
    zonaHoraria: z.string().max(80).optional(),
    version: z.string().max(40).optional(),
}).catchall(z.any());

const adjuntoShape = z.object({
    nombre: z.string().min(1).max(200),
    url: z.string().min(1).max(1000),
    size: z.number().int().nonnegative().max(20 * 1024 * 1024),
});

const crearTicketSchema = z.object({
    tipo: z.enum(['error', 'funcionalidad', 'sugerencia', 'consulta']),
    titulo: z.string().trim().min(5).max(TICKET_TITULO_MAX),
    descripcion: z.string().trim().min(TICKET_DESCRIPCION_MIN).max(12000),
    pasosReproducir: z.string().trim().max(6000).optional().nullable(),
    comportamientoEsperado: z.string().trim().max(3000).optional().nullable(),
    urgencia: z.enum(['critica', 'alta', 'media', 'baja']).default('media'),
    impacto: z.enum(['organizacion', 'area', 'varios_usuarios', 'usuario_unico']).default('usuario_unico'),
    contexto: contextoShape.optional(),
    adjuntos: z.array(adjuntoShape).max(TICKET_ADJUNTOS_MAX).optional(),
    etiquetas: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    autoFixPermitido: z.boolean().optional(),
    reportadoPorId: z.string().max(120).optional().nullable(),
    reportadoPorNombre: z.string().max(200).optional().nullable(),
});

function getActor(req: NextRequest) {
    const role = (req.headers.get('x-user-role') || 'operador').toLowerCase();
    const userId = req.headers.get('x-user-id') || null;
    return { role, userId, canManage: GESTORES.includes(role) };
}

export async function GET(req: NextRequest) {
    try {
        const { userId, canManage } = getActor(req);
        const url = new URL(req.url);

        const estado = url.searchParams.get('estado');
        const tipo = url.searchParams.get('tipo');
        const urgencia = url.searchParams.get('urgencia');
        const prioridad = url.searchParams.get('prioridad');
        const q = url.searchParams.get('q');
        const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);

        const where: any = {};
        if (estado && estado !== 'todos') where.estado = estado;
        if (tipo && tipo !== 'todos') where.tipo = tipo;
        if (urgencia && urgencia !== 'todos') where.urgencia = urgencia;
        if (prioridad && prioridad !== 'todos') where.prioridad = prioridad;

        if (q) {
            where.OR = [
                { codigo: { contains: q, mode: 'insensitive' } },
                { titulo: { contains: q, mode: 'insensitive' } },
                { descripcion: { contains: q, mode: 'insensitive' } },
                { reportadoPorNombre: { contains: q, mode: 'insensitive' } },
            ];
        }

        // Los usuarios que no gestionan solo ven sus propios tickets.
        if (!canManage) {
            where.reportadoPorId = userId || '__sin_usuario__';
        }

        const tickets = await prisma.ticket.findMany({
            where,
            orderBy: [
                { prioridad: 'asc' },
                { createdAt: 'desc' },
            ],
            take: limit,
            include: {
                reportadoPor: { select: { id: true, nombreCompleto: true, role: true } },
                asignadoA: { select: { id: true, nombreCompleto: true, role: true } },
                _count: { select: { comentarios: true } },
            },
        });

        return NextResponse.json(tickets);
    } catch (error) {
        console.error('[TICKETS_GET]', error);
        return NextResponse.json({ error: 'Error al obtener los tickets' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, canManage } = getActor(req);
        const body = await req.json();
        const parsed = crearTicketSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos inválidos',
                    detalle: parsed.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
                },
                { status: 400 }
            );
        }

        const data = parsed.data;

        // Un usuario no puede reportar en nombre de otro.
        const reportadoPorId = canManage
            ? (data.reportadoPorId || userId)
            : userId;

        if (!reportadoPorId) {
            return NextResponse.json({ error: 'No se pudo identificar al usuario que reporta.' }, { status: 401 });
        }

        const prioridad = computePrioridad(data.tipo, data.urgencia, data.impacto);

        const ticket = await prisma.$transaction(async (tx) => {
            const year = new Date().getFullYear();
            const counter = await tx.ticketCounter.upsert({
                where: { year },
                create: { year, currentNumber: 1 },
                update: { currentNumber: { increment: 1 } },
            });

            const codigo = generarCodigoTicket(year, counter.currentNumber);

            const created = await tx.ticket.create({
                data: {
                    codigo,
                    tipo: data.tipo,
                    titulo: data.titulo,
                    descripcion: data.descripcion,
                    pasosReproducir: data.pasosReproducir || null,
                    comportamientoEsperado: data.comportamientoEsperado || null,
                    contexto: (data.contexto || {}) as any,
                    adjuntos: (data.adjuntos || []) as any,
                    etiquetas: (data.etiquetas || []) as any,
                    urgencia: data.urgencia,
                    impacto: data.impacto,
                    prioridad,
                    estado: 'nuevo',
                    reportadoPorId,
                    reportadoPorNombre: data.reportadoPorNombre || null,
                    autoFixPermitido: data.tipo === 'error' ? (data.autoFixPermitido ?? true) : false,
                },
            });

            await tx.ticketHistorial.create({
                data: {
                    ticketId: created.id,
                    estadoAnterior: '-',
                    estadoNuevo: 'nuevo',
                    usuario: data.reportadoPorNombre || userId || 'Usuario',
                    comentario: 'Ticket creado',
                },
            });

            return created;
        });

        await logAudit({
            userId: userId || undefined,
            userName: data.reportadoPorNombre || 'Usuario',
            action: 'CREATE',
            entity: 'TICKET',
            entityId: ticket.id,
            newValue: { codigo: ticket.codigo, tipo: ticket.tipo, prioridad: ticket.prioridad },
        }).catch(err => console.error('[TICKETS_AUDIT]', err));

        return NextResponse.json(ticket, { status: 201 });
    } catch (error) {
        console.error('[TICKETS_POST]', error);
        return NextResponse.json({ error: 'Error al crear el ticket' }, { status: 500 });
    }
}
