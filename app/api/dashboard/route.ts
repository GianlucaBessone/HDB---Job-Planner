import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let [projects, operators, plannings, clientDelays] = await Promise.all([
            prisma.project.findMany(),
            prisma.operator.findMany(),
            prisma.planning.findMany(),
            prisma.clientDelay.findMany()
        ]);

        // Filter out inactive projects for dashboard metrics
        projects = projects.filter(p => p.activo !== false);
        const activeProjectIds = new Set(projects.map(p => p.id));

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
                // Only count assignments for projects included in metrics
                if (b.projectId && !activeProjectIds.has(b.projectId)) return;

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

        let performanceTrend = Object.entries(trendMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, data]) => ({
                label: month,
                ipt: Number((data.totalIPT / data.count).toFixed(2))
            }))
            .slice(-6); // last 6 months

        // Pad with a starting point if only 1 point exists to make the line visible
        if (performanceTrend.length === 1) {
            const first = performanceTrend[0];
            const [year, month] = first.label.split('-').map(Number);
            const prevMonthDate = new Date(year, month - 2, 1);
            const prevMonthLabel = prevMonthDate.toISOString().slice(0, 7);
            performanceTrend = [{ label: prevMonthLabel, ipt: 0 }, first];
        }

        // Client Delay Metrics
        const activeDelays = clientDelays.filter(d => activeProjectIds.has(d.projectId));
        const totalDelayHours = activeDelays.reduce((acc, d) => acc + d.duracion, 0);
        const delayImpactPercent = (totalConsumed + totalDelayHours) > 0
            ? (totalDelayHours / (totalConsumed + totalDelayHours)) * 100
            : 0;

        const areaDist: Record<string, number> = {};
        activeDelays.forEach(d => {
            areaDist[d.area] = (areaDist[d.area] || 0) + d.duracion;
        });
        const topAreas = Object.entries(areaDist)
            .sort((a, b) => b[1] - a[1])
            .map(([name, hours]) => ({ name, hours }));

        const reasonDist: Record<string, number> = {};
        activeDelays.forEach(d => {
            reasonDist[d.motivo] = (reasonDist[d.motivo] || 0) + d.duracion;
        });
        const delayReasons = Object.entries(reasonDist)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));

        const delayTrendMap: Record<string, number> = {};
        activeDelays.forEach(d => {
            const month = d.fecha.slice(0, 7);
            delayTrendMap[month] = (delayTrendMap[month] || 0) + d.duracion;
        });
        let delayTrend = Object.entries(delayTrendMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, hours]) => ({ label, hours }))
            .slice(-6);

        // Pad with a starting point if only 1 point exists to make the line visible
        if (delayTrend.length === 1) {
            const first = delayTrend[0];
            const [year, month] = first.label.split('-').map(Number);
            const prevMonthDate = new Date(year, month - 2, 1);
            const prevMonthLabel = prevMonthDate.toISOString().slice(0, 7);
            delayTrend = [{ label: prevMonthLabel, hours: 0 }, first];
        }

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
            },
            delays: {
                totalHours: Number(totalDelayHours.toFixed(1)),
                impactPercent: Number(delayImpactPercent.toFixed(1)),
                totalEvents: activeDelays.length,
                topAreas,
                reasons: delayReasons,
                trend: delayTrend
            }
        });
    } catch (error) {
        console.error('Dashboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data', details: String(error) }, { status: 500 });
    }
}
