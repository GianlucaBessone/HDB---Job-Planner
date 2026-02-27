import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const operatorId = url.searchParams.get('operatorId');
        const role = url.searchParams.get('role');

        if (!operatorId) {
            return NextResponse.json({ error: 'Falta operatorId' }, { status: 400 });
        }

        const whereClause: any = {
            OR: [
                { operatorId: operatorId }
            ]
        };

        if (role === 'supervisor' || role === 'admin') {
            whereClause.OR.push({ forSupervisors: true });
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
        return NextResponse.json(notification);
    } catch (e) {
        console.error('Error creating notification:', e);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
