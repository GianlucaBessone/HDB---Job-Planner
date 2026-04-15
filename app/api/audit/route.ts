import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const limit = parseInt(searchParams.get('limit') || '100');

    try {
        const where: any = {};
        if (userId) where.userId = userId;
        if (action) where.action = action;
        if (entity) where.entity = entity;

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit
        });

        return NextResponse.json(logs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
