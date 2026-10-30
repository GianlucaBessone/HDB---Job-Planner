import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sendPushNotification } from '@/lib/onesignal';
import { canTransition, TICKET_ESTADO_LABEL, type TicketEstado } from '@/lib/tickets';
import { generateResolutionResponse } from '@/lib/tickets-ai';

export const dynamic = 'force-dynamic';
// La resolución puede disparar el redactado de respuesta con Gemini.
export const maxDuration = 60;

const GESTORES = ['admin', 'qa', 'supervisor'];

const actualizarTicketSchema = z.object({
    estado: z.enum([
        'nuevo', 'triaje', 'en_analisis', 'pendiente_aprobacion', 'listo_para_fix',
        'en_progreso', 'en_revision', 'resuelto', 'cerrado', 'rechazado', 'duplicado',
    ]).optional(),
    urgencia: z.enum(['critica', 'alta', 'media', 'baja']).optional(),
    impacto: z.enum(['organizacion', 'area', 'varios_usuarios', 'usuario_unico']).optional(),
    prioridad: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
    riesgo: z.enum(['bajo', 'medio', 'alto', 'critico', 'desconocido']).optional(),
    asignadoAId: z.string().max(120).nullable().optional(),
    autoFixPermitido: z.boolean().optional(),
    resolucion: z.string().max(12000).nullable().optional(),
    verificado: z.boolean().optional(),
    etiquetas: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
    comentario: z.string().trim().max(4000).optional(),
    comentarioInterno: z.boolean().optional(),
    autorNombre: z.string().max(200).optional(),
});

function getActor(req: NextRequest) {
    const role = (req.headers.get('x-user-role') || 'operador').toLowerCase();
    const userId = req.headers.get('x-user-id') || null;
    return { role, userId, canManage: GESTORES.includes(role) };
}

const fullInclude = {
    reportadoPor: { select: { id: true, nombreCompleto: true, role: true, posicion: true } },
    asignadoA: { select: { id: true, nombreCompleto: true, role: true, posicion: true } },
    comentarios: { orderBy: { createdAt: 'asc' as const } },
    historial: { orderBy: { createdAt: 'asc' as const } },
    eventosAgente: { orderBy: { createdAt: 'asc' as const } },
};

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const { userId, canManage } = getActor(req);

        const ticket = await prisma.ticket.findUnique({
            where: { id: params.id },
            include: {
                ...fullInclude,
                // Las notas internas solo las ve el equipo de soporte.
                comentarios: {
                    where: canManage ? {} : { interno: false },
                    orderBy: { createdAt: 'asc' as const },
                },
            },
        });

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
        }

        if (!canManage && ticket.reportadoPorId !== userId) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
        }

        return NextResponse.json(ticket);
    } catch (error) {
        console.error('[TICKET_GET]', error);
        return NextResponse.json({ error: 'Error al obtener el ticket' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const { userId, canManage, role } = getActor(req);
        const body = await req.json();
        const parsed = actualizarTicketSchema.safeParse(body);

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
        const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
        }

        const esAutor = ticket.reportadoPorId === userId;
        if (!canManage && !esAutor) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
        }

        // Un usuario común solo puede comentar o cerrar/reabrir su ticket resuelto.
        if (!canManage) {
            const transicionPermitida =
                data.estado &&
                ((ticket.estado === 'resuelto' && (data.estado === 'cerrado' || data.estado === 'en_revision')));
            const soloComentario =
                !data.estado &&
                data.comentario !== undefined &&
                data.asignadoAId === undefined &&
                data.urgencia === undefined &&
                data.impacto === undefined &&
                data.prioridad === undefined &&
                data.riesgo === undefined &&
                data.autoFixPermitido === undefined &&
                data.resolucion === undefined &&
                data.verificado === undefined &&
                data.etiquetas === undefined;

            if (!transicionPermitida && !soloComentario) {
                return NextResponse.json(
                    { error: 'Solo el equipo de soporte puede modificar la clasificación y el estado del ticket.' },
                    { status: 403 }
                );
            }
        }

        const updateData: any = {};
        const autor = data.autorNombre || (canManage ? 'Equipo de soporte' : ticket.reportadoPorNombre || 'Usuario');

        if (data.urgencia !== undefined) updateData.urgencia = data.urgencia;
        if (data.impacto !== undefined) updateData.impacto = data.impacto;
        if (data.prioridad !== undefined) updateData.prioridad = data.prioridad;
        if (data.riesgo !== undefined) updateData.riesgo = data.riesgo;
        if (data.autoFixPermitido !== undefined) updateData.autoFixPermitido = data.autoFixPermitido;
        if (data.resolucion !== undefined) updateData.resolucion = data.resolucion;
        if (data.verificado !== undefined) updateData.verificado = data.verificado;
        if (data.etiquetas !== undefined) updateData.etiquetas = data.etiquetas as any;

        if (data.asignadoAId !== undefined) {
            updateData.asignadoAId = data.asignadoAId;
            if (data.asignadoAId) {
                const operador = await prisma.operator.findUnique({
                    where: { id: data.asignadoAId },
                    select: { nombreCompleto: true },
                });
                updateData.asignadoANombre = operador?.nombreCompleto || null;
            } else {
                updateData.asignadoANombre = null;
            }
        }

        if (data.estado && data.estado !== ticket.estado) {
            if (!canTransition(ticket.estado, data.estado)) {
                return NextResponse.json(
                    {
                        error: `No se puede pasar de "${TICKET_ESTADO_LABEL[ticket.estado as TicketEstado] || ticket.estado}" a "${TICKET_ESTADO_LABEL[data.estado as TicketEstado] || data.estado}".`,
                    },
                    { status: 400 }
                );
            }
            updateData.estado = data.estado;

            if (data.estado === 'resuelto') updateData.fechaResolucion = new Date();
            if (data.estado === 'cerrado') updateData.fechaCierre = new Date();
            if (['en_progreso', 'en_revision', 'triaje', 'en_analisis', 'rechazado', 'duplicado', 'listo_para_fix'].includes(data.estado)) {
                updateData.fechaResolucion = null;
                updateData.fechaCierre = null;
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.ticket.update({
                where: { id: params.id },
                data: updateData,
            });

            if (data.estado && data.estado !== ticket.estado) {
                await tx.ticketHistorial.create({
                    data: {
                        ticketId: ticket.id,
                        estadoAnterior: ticket.estado,
                        estadoNuevo: data.estado,
                        usuario: autor,
                        comentario: data.comentario || null,
                    },
                });
            } else if (data.comentario) {
                await tx.ticketComentario.create({
                    data: {
                        ticketId: ticket.id,
                        autor,
                        texto: data.comentario,
                        interno: canManage ? (data.comentarioInterno ?? false) : false,
                    },
                });
            }

            return result;
        });

        // ── Flujo automático de respuesta al usuario ────────────────────────
        // Si el ticket pasa a `resuelto`, redactamos y envíamos la respuesta final
        // con Gemini, y la guardamos como comentario público del ticket.
        if (data.estado === 'resuelto' && data.estado !== ticket.estado) {
            try {
                const respuesta = await generateResolutionResponse(ticket.id, {
                    userId,
                    userName: autor,
                    userRole: role,
                });

                if (respuesta.ok && respuesta.mensaje) {
                    await prisma.ticketComentario
                        .create({
                            data: {
                                ticketId: ticket.id,
                                autor: 'Equipo de soporte',
                                texto: respuesta.mensaje,
                                interno: false,
                            },
                        })
                        .catch(err => console.error('[TICKET_RESOLUTION] Comment create failed:', err));

                    if (ticket.reportadoPorId) {
                        const message = `Tu ticket ${ticket.codigo} "${ticket.titulo}" fue marcado como resuelto.`;

                        await prisma.activity
                            .create({
                                data: {
                                    type: 'STATUS_UPDATED',
                                    priority: 'NORMAL',
                                    category: 'System',
                                    title: `Ticket ${ticket.codigo} resuelto`,
                                    message,
                                    entityType: 'ticket',
                                    entityId: ticket.id,
                                    recipients: { create: [{ operatorId: ticket.reportadoPorId }] },
                                },
                            })
                            .catch(err => console.error('[TICKET_RESOLUTION] Activity create failed:', err));

                        await sendPushNotification({
                            userIds: [ticket.reportadoPorId],
                            title: 'Ticket resuelto',
                            message,
                            data: { route: `/tickets?id=${ticket.id}` },
                        }).catch(err => console.error('[TICKET_RESOLUTION] Push failed:', err));
                    }

                    await logAudit({
                        userId: userId || undefined,
                        userName: autor,
                        action: 'RESPONSE_CREATE',
                        entity: 'TICKET',
                        entityId: ticket.id,
                        newValue: { tipo: 'respuesta_resolucion', codigo: ticket.codigo, estado: 'resuelto' },
                    }).catch(err => console.error('[TICKET_RESOLUTION] Audit failed:', err));
                }
            } catch (err) {
                // La respuesta automática no debe romper el flujo de resolución.
                console.error('[TICKET_RESOLUTION] Auto response failed:', err);
            }
        }

        await logAudit({
            userId: userId || undefined,
            userName: autor,
            action: 'UPDATE',
            entity: 'TICKET',
            entityId: ticket.id,
            oldValue: { estado: ticket.estado, tipo: ticket.tipo, prioridad: ticket.prioridad },
            newValue: updateData,
        }).catch(err => console.error('[TICKET_AUDIT]', err));

        return NextResponse.json(updated);
    } catch (error) {
        console.error('[TICKET_PATCH]', error);
        return NextResponse.json({ error: 'Error al actualizar el ticket' }, { status: 500 });
    }
}
