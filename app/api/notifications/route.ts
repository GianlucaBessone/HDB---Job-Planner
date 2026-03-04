import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { sendPushNotification } from '@/lib/onesignal';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const operatorId = url.searchParams.get('operatorId');
        const role = url.searchParams.get('role');

        if (!operatorId) {
            return NextResponse.json({ error: 'Falta operatorId' }, { status: 400 });
        }

        let whereClause: any;

        if (role === 'supervisor' || role === 'admin') {
            // Supervisors/Admins see notifications for them OR notifications for all supervisors
            whereClause = {
                OR: [
                    { operatorId: operatorId },
                    { forSupervisors: true }
                ]
            };
        } else {
            // Regular operators see ONLY notifications specifically for them AND that are not for supervisors only
            whereClause = {
                operatorId: operatorId,
                forSupervisors: false
            };
        }

        const notifications = await prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to recent 50
        });

        return NextResponse.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("API Notifications POST received:", JSON.stringify(body));

        // Validate operatorId if provided
        let operatorIdToUse: string | undefined = undefined;
        if (body.operatorId) {
            const operatorExists = await prisma.operator.findUnique({ where: { id: body.operatorId } });
            if (!operatorExists) {
                console.warn(`Operator ID ${body.operatorId} not found. Creating notification without operator reference.`);
            } else {
                operatorIdToUse = body.operatorId;
            }
        }

        console.log("🔔 [INTERNAL_NOTIFICATION] Generando notificación:", {
            operatorId: operatorIdToUse,
            forSupervisors: body.forSupervisors,
            type: body.type,
            title: body.title
        });

        const notification = await prisma.notification.create({
            data: {
                operatorId: operatorIdToUse,
                forSupervisors: body.forSupervisors || false,
                title: body.title,
                message: body.message,
                type: body.type,
                relatedId: body.relatedId,
                metadata: body.metadata,
            }
        });

        console.log("✅ [INTERNAL_NOTIFICATION] Guardadas en DB correctamente");

        // Trigger push notification - MUST await before returning response (Vercel compatibility)
        const pushTargets = (operatorIdToUse && !body.forSupervisors) ? [operatorIdToUse] : [];

        if (pushTargets.length > 0 || body.forSupervisors) {
            console.log("📡 [PUSH_DISPATCH]", {
                operatorId: body.operatorId,
                forSupervisors: body.forSupervisors,
                pushTargets,
            });
            try {
                const pushResult = await sendPushNotification({
                    userIds: pushTargets.length > 0 ? pushTargets : undefined,
                    forSupervisors: body.forSupervisors || false,
                    title: body.title,
                    message: body.message,
                    data: {
                        type: body.type,
                        relatedId: body.relatedId,
                        metadata: body.metadata
                    }
                });
                console.log("✅ [PUSH_DISPATCH_RESULT]", JSON.stringify(pushResult));
            } catch (pushError: any) {
                console.error("❌ [PUSH_DISPATCH_ERROR]", pushError?.message || pushError);
            }
        } else {
            console.warn("⚠️ [PUSH_DISPATCH_SKIPPED] No targets for push notification", {
                operatorId: body.operatorId,
                operatorIdToUse,
                forSupervisors: body.forSupervisors,
            });
        }


        return NextResponse.json(notification);
    } catch (e: any) {
        console.error('Error creating notification:', e);
        return NextResponse.json({
            error: 'Error del servidor al crear notificación',
            details: e?.message || String(e)
        }, { status: 500 });
    }
}

