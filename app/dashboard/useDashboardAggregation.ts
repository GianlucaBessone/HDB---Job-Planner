import { useMemo } from 'react';

export function useDashboardAggregation(rawData: any, filters: any) {
    return useMemo(() => {
        if (!rawData || !rawData.projects) return null;

        let projects = [...rawData.projects];
        let clientDelays = [...rawData.clientDelays];
        const operators = rawData.operators || [];
        const plannings = rawData.plannings || [];

        // 1. Exclude inactive projects
        projects = projects.filter(p => p.activo !== false);
        
        // 1b. Exclude projects marked as "NO en métricas" UNLESS we are specifically looking at "Proyectos Fijos"
        if (filters.filterStatus !== 'fijo') {
            projects = projects.filter(p => p.noEnMetricas !== true);
        }

        // 2. Filter by Client
        if (filters.filterClientId) {
            projects = projects.filter(p => p.clientId === filters.filterClientId);
        }

        // 3. Filter by Finished Status
        if (filters.filterStatus === 'finished') {
            projects = projects.filter(p => p.estado === 'finalizado');
        } else if (filters.filterStatus === 'active') {
            projects = projects.filter(p => p.estado !== 'finalizado');
        } else if (filters.filterStatus === 'fijo') {
            projects = projects.filter(p => p.proyectoFijo === true);
        } else if (filters.filterStatus && filters.filterStatus !== 'all') {
            projects = projects.filter(p => p.estado === filters.filterStatus);
        }

        // 4. Filter by Project ID
        if (filters.filterProjectId) {
            projects = projects.filter(p => p.id === filters.filterProjectId || p.codigoProyecto === filters.filterProjectId);
        }

        // Filter Delays by Area
        if (filters.filterArea) {
            clientDelays = clientDelays.filter(d => d.area === filters.filterArea);
        }

        // Filter by Date Range (For Delays and Performance Trend)
        if (filters.filterFrom) {
            clientDelays = clientDelays.filter(d => d.fecha >= filters.filterFrom);
        }
        if (filters.filterTo) {
            clientDelays = clientDelays.filter(d => d.fecha <= filters.filterTo);
        }

        // Resource Utilization (from recent plannings)
        const operatorUsage: Record<string, number> = {};
        plannings.forEach((p: any) => {
            const blocks = (p.blocks as any[]) || [];
            blocks.forEach(b => {
                if (b.operatorNames && Array.isArray(b.operatorNames)) {
                    b.operatorNames.forEach((name: string) => {
                        operatorUsage[name] = (operatorUsage[name] || 0) + 1;
                    });
                }
            });
        });

        // Filter by Operator
        if (filters.filterOperator) {
            // Find projects that this operator has been assigned to
            const operatorProjects = new Set<string>();
            plannings.forEach((p: any) => {
                const blocks = (p.blocks as any[]) || [];
                blocks.forEach(b => {
                    if (b.operatorNames && b.operatorNames.includes(filters.filterOperator) && b.projectId) {
                        operatorProjects.add(b.projectId);
                    }
                });
            });
            projects = projects.filter(p => operatorProjects.has(p.id));
        }

        // Base project IDs after general filters
        const activeProjectIds = new Set(projects.map(p => p.id));

        // Filter operator usage again but only for active projects (for the "Mayor Actividad" list)
        const operatorUsageFiltered: Record<string, number> = {};
        plannings.forEach((p: any) => {
            const blocks = (p.blocks as any[]) || [];
            blocks.forEach(b => {
                if (b.projectId && !activeProjectIds.has(b.projectId)) return;
                if (b.operatorNames && Array.isArray(b.operatorNames)) {
                    b.operatorNames.forEach((name: string) => {
                        operatorUsageFiltered[name] = (operatorUsageFiltered[name] || 0) + 1;
                    });
                }
            });
        });
        const topOperators = Object.entries(operatorUsageFiltered)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Filter Delays for active projects
        const activeDelays = clientDelays.filter(d => activeProjectIds.has(d.projectId));

        // Health Metrics
        const totalProjects = projects.length;
        const activeProjects = projects.filter(p => p.estado !== 'finalizado').length;
        const activeOperatorsCount = operators.filter((o: any) => o.activo).length;

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

        // Critical Projects
        const criticalProjects = projects
            .filter(p => p.estado !== 'finalizado' && p.horasEstimadas > 0)
            .map(p => ({
                id: p.id,
                nombre: p.nombre,
                codigoProyecto: p.codigoProyecto,
                percentage: (p.horasConsumidas / p.horasEstimadas) * 100,
                estado: p.estado
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);

        // Performance Metrics
        let projectPerformance = projects
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
                    codigoProyecto: p.codigoProyecto,
                    horasEstimadas: p.horasEstimadas,
                    horasConsumidas: p.horasConsumidas,
                    ipt,
                    savings,
                    variation,
                    classification,
                    createdAt: new Date(p.createdAt)
                };
            });

        // Filter by Classification if needed
        if (filters.filterClassification) {
            projectPerformance = projectPerformance.filter(p => p.classification === filters.filterClassification);
            // Apply this to general active project IDs to filter everything else too?
            // Usually, classification filter is global.
            const classificationIds = new Set(projectPerformance.map(p => p.id));
            // But if we re-filter everything here it's complicated. We only apply classification to the performance charts.
        }

        // Apply date filter to performance trend
        if (filters.filterFrom) {
            projectPerformance = projectPerformance.filter(p => p.createdAt >= new Date(filters.filterFrom));
        }
        if (filters.filterTo) {
            projectPerformance = projectPerformance.filter(p => p.createdAt <= new Date(filters.filterTo));
        }

        // Weighted TPI: sum(estimated) / sum(consumed) — consistent with totalSavings
        const perfTotalEstimated = projectPerformance.reduce((acc, p) => acc + p.horasEstimadas, 0);
        const perfTotalConsumed = projectPerformance.reduce((acc, p) => acc + p.horasConsumidas, 0);
        const avgIPT = perfTotalConsumed > 0 ? perfTotalEstimated / perfTotalConsumed : 0;

        const totalSavings = perfTotalEstimated - perfTotalConsumed;

        const performanceClassification = {
            eficiente: projectPerformance.filter(p => p.classification === 'eficiente').length,
            exacto: projectPerformance.filter(p => p.classification === 'exacto').length,
            desvio: projectPerformance.filter(p => p.classification === 'desvio').length,
        };

        const trendMap: Record<string, { totalEst: number; totalCons: number }> = {};
        projectPerformance.forEach(p => {
            const month = p.createdAt.toISOString().slice(0, 7);
            if (!trendMap[month]) trendMap[month] = { totalEst: 0, totalCons: 0 };
            trendMap[month].totalEst += p.horasEstimadas;
            trendMap[month].totalCons += p.horasConsumidas;
        });

        let performanceTrend = Object.entries(trendMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, data]) => ({
                label: month,
                ipt: Number((data.totalCons > 0 ? data.totalEst / data.totalCons : 0).toFixed(2))
            }))
            .slice(-6);

        if (performanceTrend.length === 1) {
            const first = performanceTrend[0];
            const [year, month] = first.label.split('-').map(Number);
            const prevMonthDate = new Date(year, month - 2, 1);
            const prevMonthLabel = prevMonthDate.toISOString().slice(0, 7);
            performanceTrend = [{ label: prevMonthLabel, ipt: 0 }, first];
        }

        // Client Delay Metrics
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

        if (delayTrend.length === 1) {
            const first = delayTrend[0];
            const [year, month] = first.label.split('-').map(Number);
            const prevMonthDate = new Date(year, month - 2, 1);
            const prevMonthLabel = prevMonthDate.toISOString().slice(0, 7);
            delayTrend = [{ label: prevMonthLabel, hours: 0 }, first];
        }

        return {
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
                projects: projectPerformance.slice(0, 10),
                classification: performanceClassification,
                trend: performanceTrend,
                hoursConsumption: projects.map(p => ({ nombre: p.nombre, codigoProyecto: p.codigoProyecto, horasConsumidas: p.horasConsumidas, horasEstimadas: p.horasEstimadas })).sort((a, b) => b.horasConsumidas - a.horasConsumidas)
            },
            delays: {
                totalHours: totalDelayHours,
                totalEvents: activeDelays.length,
                impactPercent: Math.round(delayImpactPercent),
                topAreas,
                reasons: delayReasons,
                trend: delayTrend
            }
        };

    }, [rawData, filters]);
}
