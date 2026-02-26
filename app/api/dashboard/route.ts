import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function GET() {
    try {
        const [projects, operators, plannings] = await Promise.all([
            prisma.project.findMany(),
            prisma.operator.findMany(),
            prisma.planning.findMany()
        ]);

        // Health Metrics
        const totalProjects = projects.length;
        const activeProjects = projects.filter(p => p.estado !== 'finalizado').length;
        const activeOperatorsCount = operators.filter(o => o.activo).length;

        // Efficiency (Hours)
        const totalEstimated = projects.reduce((acc, p) => acc + (p.horasEstimadas || 0), 0);
        const totalConsumed = projects.reduce((acc, p) => acc + (p.horasConsumidas || 0), 0);
        const overallEfficiency = totalEstimated > 0 ? (totalConsumed / totalEstimated) * 100 : 0;

        // Status Distribution
        const statusDistribution = {
            activo: projects.filter(p => p.estado === 'activo').length,
            en_riesgo: projects.filter(p => p.estado === 'en_riesgo').length,
            atrasado: projects.filter(p => p.estado === 'atrasado').length,
            finalizado: projects.filter(p => p.estado === 'finalizado').length,
        };

        // Client Concentration
        const clientCount: Record<string, number> = {};
        projects.forEach(p => {
            const clientName = p.cliente || 'Sin Cliente';
            clientCount[clientName] = (clientCount[clientName] || 0) + 1;
        });
        const topClients = Object.entries(clientCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Resource Utilization (from recent plannings)
        const operatorUsage: Record<string, number> = {};
        plannings.forEach(p => {
            const blocks = (p.blocks as any[]) || [];
            blocks.forEach(b => {
                if (b.operatorNames && Array.isArray(b.operatorNames)) {
                    b.operatorNames.forEach((name: string) => {
                        operatorUsage[name] = (operatorUsage[name] || 0) + 1;
                    });
                }
            });
        });
        const topOperators = Object.entries(operatorUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Critical Projects (highest consumption percentage)
        const criticalProjects = projects
            .filter(p => p.estado !== 'finalizado' && p.horasEstimadas > 0)
            .map(p => ({
                nombre: p.nombre,
                percentage: (p.horasConsumidas / p.horasEstimadas) * 100,
                estado: p.estado
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);

        return NextResponse.json({
            kpis: {
                totalProjects,
                activeProjects,
                activeOperatorsCount,
                overallEfficiency: Math.round(overallEfficiency)
            },
            statusDistribution,
            topClients,
            topOperators,
            criticalProjects
        });
    } catch (error) {
        console.error('Dashboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
