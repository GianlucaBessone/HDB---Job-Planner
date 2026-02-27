import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function GET() {
    try {
        let [projects, operators, plannings] = await Promise.all([
            prisma.project.findMany(),
            prisma.operator.findMany(),
            prisma.planning.findMany()
        ]);

        // Filter out inactive projects for dashboard metrics
        projects = projects.filter(p => p.activo !== false);

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
            por_hacer: projects.filter(p => p.estado === 'por_hacer').length,
            planificado: projects.filter(p => p.estado === 'planificado').length,
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

        // Performance Metrics (New)
        const projectPerformance = projects
            .filter(p => p.horasEstimadas > 0 && p.horasConsumidas > 0)
            .map(p => {
                const ipt = p.horasEstimadas / p.horasConsumidas;
                const savings = p.horasEstimadas - p.horasConsumidas;
                const variation = ((p.horasConsumidas - p.horasEstimadas) / p.horasEstimadas) * 100;

                let classification = 'exacto';
                if (ipt > 1.05) classification = 'eficiente';
                else if (ipt < 0.95) classification = 'desvio';

                return {
                    id: p.id,
                    nombre: p.nombre,
                    ipt,
                    savings,
                    variation,
                    classification,
                    createdAt: p.createdAt
                };
            });

        const avgIPT = projectPerformance.length > 0
            ? projectPerformance.reduce((acc, p) => acc + p.ipt, 0) / projectPerformance.length
            : 0;

        const totalSavings = projectPerformance.reduce((acc, p) => acc + p.savings, 0);

        const performanceClassification = {
            eficiente: projectPerformance.filter(p => p.classification === 'eficiente').length,
            exacto: projectPerformance.filter(p => p.classification === 'exacto').length,
            desvio: projectPerformance.filter(p => p.classification === 'desvio').length,
        };

        // Trend Analysis (by month)
        const trendMap: Record<string, { totalIPT: number; count: number }> = {};
        projectPerformance.forEach(p => {
            const month = p.createdAt.toISOString().slice(0, 7); // YYYY-MM
            if (!trendMap[month]) trendMap[month] = { totalIPT: 0, count: 0 };
            trendMap[month].totalIPT += p.ipt;
            trendMap[month].count += 1;
        });

        const performanceTrend = Object.entries(trendMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, data]) => ({
                label: month,
                ipt: Number((data.totalIPT / data.count).toFixed(2))
            }))
            .slice(-6); // last 6 months

        return NextResponse.json({
            kpis: {
                totalProjects,
                activeProjects,
                activeOperatorsCount,
                overallEfficiency: Math.round(overallEfficiency),
                avgIPT: Number(avgIPT.toFixed(2)),
                totalSavings,
                variation: Number(((totalConsumed - totalEstimated) / (totalEstimated || 1) * 100).toFixed(1))
            },
            statusDistribution,
            topClients,
            topOperators,
            criticalProjects,
            performance: {
                projects: projectPerformance.slice(0, 10), // Limit for charts
                classification: performanceClassification,
                trend: performanceTrend
            }
        });
    } catch (error) {
        console.error('Dashboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
