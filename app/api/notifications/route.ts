import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { sendPushNotification } from '@/lib/onesignal';

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

        const notification = await prisma.notification.create({
            data: {
                operatorId: body.operatorId,
                forSupervisors: body.forSupervisors || false,
                title: body.title,
                message: body.message,
                type: body.type,
                relatedId: body.relatedId,
                metadata: body.metadata,
            }
        });

        // Trigger push notification asynchronously (don't block the internal response)
        // If it's for supervisors, we target supervisors via filters.
        // If it's for an operator (and NOT for supervisors), we target them by ID.
        const pushTargets = (body.operatorId && !body.forSupervisors) ? [body.operatorId] : [];

        if (pushTargets.length > 0 || body.forSupervisors) {
            console.log(`API Notifications: Triggering push. operatorId=${body.operatorId}, forSupervisors=${body.forSupervisors}`);
            sendPushNotification({
                userIds: pushTargets.length > 0 ? pushTargets : undefined,
                forSupervisors: body.forSupervisors || false,
                title: body.title,
                message: body.message,
                data: {
                    type: body.type,
                    relatedId: body.relatedId,
                    metadata: body.metadata
                }
            }).then(res => {
                console.log("API Notifications: OneSignal Response:", JSON.stringify(res));
            }).catch(e => {
                console.error("API Notifications: OneSignal Error:", e);
            });
        }

        return NextResponse.json(notification);
    } catch (e) {
        console.error('Error creating notification:', e);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

