import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { sendPushNotification } from '@/lib/onesignal';
import { withIdempotency } from '@/lib/idempotency';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Siempre los avisos del usuario de la sesión: se ignora ?operatorId.
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;
        const operatorId = acceso.userId;

        const activities = await prisma.activity.findMany({
            where: {
                recipients: {
                    some: {
                        operatorId: operatorId,
                        archivedAt: null
                    }
                }
            },
            include: {
                recipients: {
                    where: {
                        operatorId: operatorId
                    },
                    select: {
                        readAt: true,
                        archivedAt: true,
                        id: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to recent 50
        });

        // Map to a frontend-friendly format (flattening the recipient read status)
        const mappedActivities = activities.map(act => {
            const recipient = act.recipients[0];
            return {
                id: act.id, // we use activity ID for frontend reference, but the frontend needs to hit the API correctly
                recipientId: recipient?.id,
                title: act.title,
                message: act.message,
                type: act.type,
                priority: act.priority,
                category: act.category,
                entityType: act.entityType,
                entityId: act.entityId,
                metadata: act.metadata,
                createdBy: act.createdBy, // emisor: a quién responder al aprobar o rechazar una solicitud
                read: !!recipient?.readAt,
                createdAt: act.createdAt
            };
        });

        return NextResponse.json(mappedActivities, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

/** Roles que reciben los avisos marcados `forSupervisors`. */
const ROLES_SUPERVISION = ['admin', 'administrador', 'supervisor', 'qa'];

const postSchema = z
    .object({
        type: z.string().trim().min(1).max(64).default('SYSTEM'),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
        category: z.string().trim().min(1).max(64).default('System'),
        title: z.string().trim().min(1, 'Falta el título').max(200),
        message: z.string().trim().min(1, 'Falta el mensaje').max(5000),
        entityType: z.string().trim().max(64).nullish(),
        entityId: z.string().trim().max(128).nullish(),
        metadata: z.record(z.string(), z.unknown()).nullish(),
        /** Destinatario puntual. Pide la función "avisos.enviar". */
        operatorId: z.string().trim().min(1).max(64).optional(),
        /** Responder a quien creó un aviso que recibió el usuario de la sesión (id del aviso). */
        respondeA: z.string().trim().min(1).max(64).optional(),
        /** Avisar a supervisores, administradores y QA activos (sin incluir al emisor). */
        forSupervisors: z.boolean().optional(),
    })
    .refine((d) => !!d.operatorId || !!d.respondeA || d.forSupervisors === true, {
        message: 'Indicá un destinatario, el aviso al que respondés o forSupervisors',
    });

/**
 * Crea un aviso en la campana. El emisor (`createdBy`) sale de la sesión, nunca del cuerpo.
 * Destinatarios:
 *  - `respondeA`: quien creó un aviso que recibió el usuario de la sesión (respuesta a una solicitud).
 *  - `operatorId`: cualquier usuario; pide la función "avisos.enviar".
 *  - `forSupervisors`: supervisores, administradores y QA activos (el canal de pedidos, abierto a todos).
 */
export async function POST(req: Request) {
    return withIdempotency(req, async () => {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;
        const { userId } = acceso;

        const parsed = postSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        }
        const data = parsed.data;

        try {
            const recipientIds = new Set<string>();

            if (data.respondeA) {
                // Solo se responde un aviso propio, y la respuesta va a quien lo creó.
                const original = await prisma.activity.findFirst({
                    where: { id: data.respondeA, recipients: { some: { operatorId: userId } } },
                    select: { createdBy: true },
                });
                if (!original || !original.createdBy) {
                    return NextResponse.json({ error: 'No se encontró el aviso al que respondés' }, { status: 404 });
                }
                recipientIds.add(original.createdBy);
            }

            if (data.operatorId) {
                if (!acceso.puede('avisos.enviar')) {
                    return NextResponse.json({ error: 'No tenés permiso para enviar avisos a otros usuarios' }, { status: 403 });
                }
                const destinatario = await prisma.operator.findUnique({ where: { id: data.operatorId }, select: { id: true } });
                if (!destinatario) return NextResponse.json({ error: 'Destinatario no encontrado' }, { status: 404 });
                recipientIds.add(destinatario.id);
            }

            if (data.forSupervisors) {
                const supervisores = await prisma.operator.findMany({
                    where: { role: { in: ROLES_SUPERVISION }, activo: true, id: { not: userId } },
                    select: { id: true },
                });
                supervisores.forEach((s) => recipientIds.add(s.id));
            }

            if (recipientIds.size === 0) {
                return NextResponse.json({ error: 'No hay supervisores activos para recibir el aviso' }, { status: 422 });
            }
            const ids = Array.from(recipientIds);

            const activity = await prisma.activity.create({
                data: {
                    type: data.type,
                    priority: data.priority,
                    category: data.category,
                    title: data.title,
                    message: data.message,
                    entityType: data.entityType || null,
                    entityId: data.entityId || null,
                    metadata: data.metadata ? (data.metadata as Prisma.InputJsonObject) : undefined,
                    createdBy: userId,
                    recipients: { create: ids.map((operatorId) => ({ operatorId })) },
                },
                select: { id: true, type: true, title: true, createdAt: true },
            });

            try {
                await sendPushNotification({
                    userIds: ids,
                    title: data.title,
                    message: data.message,
                    data: {
                        type: data.type,
                        entityType: data.entityType,
                        entityId: data.entityId,
                    },
                });
            } catch (pushError: any) {
                console.error('❌ [PUSH_DISPATCH_ERROR]', pushError?.message || pushError);
            }

            return NextResponse.json({ ...activity, recipients: ids.length });
        } catch (e) {
            console.error('Error creating activity:', e);
            return NextResponse.json({ error: 'Error del servidor al crear el aviso' }, { status: 500 });
        }
    });
}

const archivarSchema = z.object({
    /** activityIds a archivar; sin ids se archivan todos los avisos del usuario. */
    ids: z.array(z.string().trim().min(1).max(64)).max(500).optional(),
});

// Clear or delete activities (Archive)
export async function DELETE(req: Request) {
    try {
        // Solo se archivan avisos del usuario de la sesión: se ignora ?operatorId.
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;
        const operatorId = acceso.userId;

        // Sin cuerpo (o vacío) se archivan todos los avisos del usuario.
        const texto = await req.text();
        let cuerpo: unknown = {};
        if (texto.trim()) {
            try { cuerpo = JSON.parse(texto); } catch { cuerpo = null; }
        }
        const parsed = archivarSchema.safeParse(cuerpo);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        }
        const ids = parsed.data.ids;

        const whereClause: Prisma.ActivityRecipientWhereInput = {
            operatorId: operatorId,
            ...(ids && ids.length > 0 ? { activityId: { in: ids } } : {}),
        };

        // Archive instead of delete
        await prisma.activityRecipient.updateMany({
            where: whereClause,
            data: { archivedAt: new Date() }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error clearing activities:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}


