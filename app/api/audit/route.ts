import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeStats = searchParams.get('stats') === 'true';

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

        if (includeStats) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const [todayCount, totalCount, uniqueUsersToday] = await Promise.all([
                prisma.auditLog.count({
                    where: { timestamp: { gte: todayStart } }
                }),
                prisma.auditLog.count({ where }),
                prisma.auditLog.groupBy({
                    by: ['userName'],
                    where: { 
                        timestamp: { gte: todayStart },
                        userName: { not: null }
                    }
                })
            ]);

            return NextResponse.json({
                logs,
                stats: {
                    todayCount,
                    totalCount,
                    uniqueUsersToday: uniqueUsersToday.length
                }
            });
        }

        return NextResponse.json(logs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
