import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';
import { withIdempotency } from '@/lib/idempotency';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const operatorId = url.searchParams.get('operatorId');
        
        if (!operatorId) {
            return NextResponse.json({ error: 'Falta operatorId' }, { status: 400 });
        }

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

export async function POST(req: Request) {
    return withIdempotency(req, async () => {
        try {
            const body = await req.json();
            console.log("API Activities POST received:", JSON.stringify(body));

            let operatorIdToUse: string | undefined = undefined;
            if (body.operatorId) {
                const operatorExists = await prisma.operator.findUnique({ where: { id: body.operatorId } });
                if (!operatorExists) {
                    console.warn(`Operator ID ${body.operatorId} not found.`);
                } else {
                    operatorIdToUse = body.operatorId;
                }
            }

            // Create activity
            const activity = await prisma.activity.create({
                data: {
                    type: body.type || 'SYSTEM',
                    priority: body.priority || 'NORMAL',
                    category: body.category || 'System',
                    title: body.title,
                    message: body.message,
                    entityType: body.entityType || null,
                    entityId: body.entityId || null,
                    metadata: body.metadata || null,
                    createdBy: body.createdBy || null,
                    recipients: operatorIdToUse ? {
                        create: [{ operatorId: operatorIdToUse }]
                    } : undefined
                },
                include: { recipients: true }
            });

            console.log("✅ [INTERNAL_ACTIVITY] Guardadas en DB correctamente");

            // Dispatch push notification
            if (operatorIdToUse) {
                try {
                    const pushResult = await sendPushNotification({
                        userIds: [operatorIdToUse],
                        title: body.title,
                        message: body.message,
                        data: {
                            type: body.type,
                            entityType: body.entityType,
                            entityId: body.entityId,
                            metadata: body.metadata
                        }
                    });
                    console.log("✅ [PUSH_DISPATCH_RESULT]", JSON.stringify(pushResult));
                } catch (pushError: any) {
                    console.error("❌ [PUSH_DISPATCH_ERROR]", pushError?.message || pushError);
                }
            }

            return NextResponse.json(activity);
        } catch (e: any) {
            console.error('Error creating activity:', e);
            return NextResponse.json({
                error: 'Error del servidor al crear actividad',
                details: e?.message || String(e)
            }, { status: 500 });
        }
    });
}

// Clear or delete activities (Archive)
export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const operatorId = url.searchParams.get('operatorId');

        if (!operatorId) {
            return NextResponse.json({ error: 'Falta operatorId' }, { status: 400 });
        }

        let ids: string[] | undefined;
        try {
            const body = await req.json();
            if (body && Array.isArray(body.ids)) {
                ids = body.ids; // these are activityIds
            }
        } catch (e) {
            // No body or invalid JSON, ignore and delete all
        }

        let whereClause: any = {
            operatorId: operatorId
        };

        if (ids && ids.length > 0) {
            whereClause.activityId = { in: ids };
        }

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


