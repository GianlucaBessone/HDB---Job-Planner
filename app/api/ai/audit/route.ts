import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const successParam = searchParams.get('success');
    const limit = parseInt(searchParams.get('limit') || '100');

    try {
        const where: any = {};
        if (userId) where.userId = userId;
        if (action) where.action = action;
        if (successParam === 'true') where.success = true;
        if (successParam === 'false') where.success = false;

        // 1. Fetch detailed request logs
        const logs = await prisma.aiRequestLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        // 2. Fetch general stats
        const [totalCount, successCount, failedCount, totalUsageData] = await Promise.all([
            prisma.aiRequestLog.count({ where }),
            prisma.aiRequestLog.count({ where: { ...where, success: true } }),
            prisma.aiRequestLog.count({ where: { ...where, success: false } }),
            prisma.aiRequestLog.aggregate({
                where,
                _sum: {
                    inputTokens: true,
                    outputTokens: true,
                    totalTokens: true,
                    estimatedCost: true,
                    latencyMs: true
                },
                _avg: {
                    latencyMs: true
                }
            })
        ]);

        const avgLatency = totalUsageData._avg.latencyMs || 0;
        const totalInputTokens = totalUsageData._sum.inputTokens || 0;
        const totalOutputTokens = totalUsageData._sum.outputTokens || 0;
        const totalTokens = totalUsageData._sum.totalTokens || 0;
        const totalCost = totalUsageData._sum.estimatedCost || 0;

        // 3. Consumption per user
        // We group by userId, userName and userRole to sum estimatedCost and totalTokens
        const userConsumptionRaw = await prisma.aiRequestLog.groupBy({
            by: ['userId', 'userName', 'userRole'],
            where: { success: true },
            _sum: {
                totalTokens: true,
                estimatedCost: true
            },
            _count: {
                id: true
            },
            orderBy: {
                _sum: {
                    estimatedCost: 'desc'
                }
            }
        });

        const userConsumption = userConsumptionRaw.map((u: any) => ({
            userId: u.userId || 'anonymous',
            userName: u.userName || 'Usuario Anónimo',
            userRole: u.userRole || 'Desconocido',
            totalTokens: u._sum.totalTokens || 0,
            estimatedCost: u._sum.estimatedCost || 0,
            requestCount: u._count.id || 0
        }));

        // 4. Fetch recent chat threads (AiConversation + Messages)
        const conversations = await prisma.aiConversation.findMany({
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 30
        });

        // Resolve operator details
        const userIds = Array.from(new Set(conversations.map(c => c.userId).filter(Boolean)));
        const operators = await prisma.operator.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nombreCompleto: true, role: true }
        });
        const operatorMap = new Map(operators.map(op => [op.id, op]));

        // Resolve projects
        const projectIds = Array.from(new Set(
            conversations
                .filter(c => c.entity === 'Project' && c.entityId)
                .map(c => c.entityId as string)
        ));
        const projects = await prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, nombre: true }
        });
        const projectMap = new Map(projects.map(p => [p.id, p]));

        // Resolve OrdenServicio
        const osIds = Array.from(new Set(
            conversations
                .filter(c => c.entity === 'OrdenServicio' && c.entityId)
                .map(c => c.entityId as string)
        ));
        const ordenesServicio = await prisma.ordenServicio.findMany({
            where: { id: { in: osIds } },
            select: { id: true, codigoOS: true }
        });
        const osMap = new Map(ordenesServicio.map(os => [os.id, os]));

        const enrichedConversations = conversations.map(c => {
            const op = c.userId ? operatorMap.get(c.userId) : null;
            let entityName = c.entityId || null;
            if (c.entity === 'Project' && c.entityId) {
                entityName = projectMap.get(c.entityId)?.nombre || c.entityId;
            } else if (c.entity === 'OrdenServicio' && c.entityId) {
                entityName = osMap.get(c.entityId)?.codigoOS || c.entityId;
            }

            return {
                ...c,
                userName: op?.nombreCompleto || 'Usuario Anónimo',
                userRole: op?.role || 'Desconocido',
                entityName: entityName || 'Sin asociar'
            };
        });

        return NextResponse.json({
            success: true,
            logs,
            stats: {
                totalCount,
                successCount,
                failedCount,
                totalTokens,
                totalInputTokens,
                totalOutputTokens,
                totalCost,
                avgLatency: Math.round(avgLatency)
            },
            userConsumption,
            conversations: enrichedConversations
        });
    } catch (error: any) {
        console.error('[AiAuditApi] Error fetching AI audit logs:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
