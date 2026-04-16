import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');
        const userName = url.searchParams.get('userName');

        if (!userId && !userName) {
            return NextResponse.json([]);
        }

        const projectLastActivity: Record<string, number> = {};

        const updateActivity = (projectId: string | null, dateStr: string | Date | null) => {
            if (!projectId || !dateStr) return;
            const time = new Date(dateStr).getTime();
            if (!isNaN(time)) {
                if (!projectLastActivity[projectId] || time > projectLastActivity[projectId]) {
                    projectLastActivity[projectId] = time;
                }
            }
        };

        const promises: Promise<any>[] = [];

        if (userName) {
            promises.push(
                prisma.projectLog.findMany({
                    where: { responsable: userName },
                    select: { projectId: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 100
                }).then(logs => {
                    logs.forEach(l => updateActivity(l.projectId, l.createdAt));
                })
            );
            
            promises.push(
                prisma.clientDelay.findMany({
                    where: { operador: userName },
                    select: { projectId: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 100
                }).then(delays => {
                    delays.forEach(d => updateActivity(d.projectId, d.createdAt));
                })
            );
            
            promises.push(
                prisma.timeEntry.findMany({
                    where: { operator: { nombreCompleto: userName } },
                    select: { projectId: true, createdAt: true, fecha: true },
                    orderBy: { createdAt: 'desc' },
                    take: 100
                }).then(entries => {
                    entries.forEach(t => updateActivity(t.projectId, t.createdAt || t.fecha));
                })
            );
            
            promises.push(
                prisma.checklistItem.findMany({
                    where: { updatedAt: { not: undefined } },
                    select: { projectId: true, updatedAt: true },
                    orderBy: { updatedAt: 'desc' },
                    take: 100
                }).then(items => {
                    items.forEach(i => updateActivity(i.projectId, i.updatedAt));
                })
            );
        }

        if (userId) {
            promises.push(
                prisma.timeEntry.findMany({
                    where: { operatorId: userId },
                    select: { projectId: true, createdAt: true, fecha: true },
                    orderBy: { createdAt: 'desc' },
                    take: 100
                }).then(entries => {
                    entries.forEach(t => updateActivity(t.projectId, t.createdAt || t.fecha));
                })
            );
        }

        await Promise.all(promises);

        const recentProjectIds = Object.entries(projectLastActivity)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(e => e[0]);

        return NextResponse.json(recentProjectIds);
    } catch (e) {
        console.error('Fetch Recent Projects Error:', e);
        return NextResponse.json([]);
    }
}
