import { useMemo } from 'react';

export function useOrdenesServicioAggregation(rawData: any, filters: any) {
    return useMemo(() => {
        if (!rawData || !rawData.ordenesServicio) return null;

        let ordenes = [...rawData.ordenesServicio];
        const operators = rawData.operators || [];

        // Apply filters
        if (filters.filterClientId) {
            ordenes = ordenes.filter(o => o.project?.clientId === filters.filterClientId);
        }
        if (filters.filterFrom) {
            ordenes = ordenes.filter(o => {
                const date = new Date(o.fechaCreacion).toISOString().split('T')[0];
                return date >= filters.filterFrom;
            });
        }
        if (filters.filterTo) {
            ordenes = ordenes.filter(o => {
                const date = new Date(o.fechaCreacion).toISOString().split('T')[0];
                return date <= filters.filterTo;
            });
        }
        if (filters.filterProjectId) {
            ordenes = ordenes.filter(o => o.projectId === filters.filterProjectId || o.project?.codigoProyecto === filters.filterProjectId);
        }
        if (filters.filterOperator) {
            // Find operator ID by name
            const op = operators.find((o: any) => o.nombreCompleto === filters.filterOperator || o.name === filters.filterOperator);
            if (op) {
                ordenes = ordenes.filter(o => o.operadores?.some((osOp: any) => osOp.operadorId === op.id));
            }
        }
        if (filters.filterStatus === 'finished') {
            const finishedProjectIds = (rawData.projects || []).filter((p: any) => p.estado === 'finalizado').map((p: any) => p.id);
            ordenes = ordenes.filter(o => finishedProjectIds.includes(o.projectId));
        } else if (filters.filterStatus === 'active') {
            const activeProjectIds = (rawData.projects || []).filter((p: any) => p.estado !== 'finalizado').map((p: any) => p.id);
            ordenes = ordenes.filter(o => activeProjectIds.includes(o.projectId));
        } else if (filters.filterStatus && filters.filterStatus !== 'all') {
            const matchedProjectIds = (rawData.projects || []).filter((p: any) => p.estado === filters.filterStatus).map((p: any) => p.id);
            ordenes = ordenes.filter(o => matchedProjectIds.includes(o.projectId));
        }

        // --- Aggregations ---

        const revenueMap: Record<string, { total: number; materiales: number; mo: number }> = {};
        const laborHoursMap: Record<string, { totalHours: number; count: number }> = {};
        
        let firmaToOC = 0;
        let ocToPago = 0;
        let countFirmaToOC = 0;
        let countOCToPago = 0;

        let globalTotalHours = 0;
        let globalTotalBilling = 0;

        ordenes.forEach(o => {
            const month = new Date(o.fechaCreacion).toISOString().slice(0, 7);
            
            // Billing (From the Generated OC)
            const totalFinal = o.cobroGenerado ? (o.cobroTotalFinal || 0) : 0;
            const mo = o.cobroGenerado ? (o.cobroValorManoObra || 0) : 0;
            
            // To ensure the chart is consistent and represents the OC generated:
            // "Materiales" will capture all non-labor costs from the OC (including 'otros conceptos' if any)
            let materialesTotal = 0;
            if (o.cobroGenerado) {
                if (totalFinal > 0) {
                    materialesTotal = totalFinal - mo;
                } else if (o.materiales && Array.isArray(o.materiales)) {
                    materialesTotal = o.materiales.reduce((acc: number, m: any) => acc + (m.cantidad * (m.precioUnitario || 0)), 0);
                }
            }

            if (!revenueMap[month]) revenueMap[month] = { total: 0, materiales: 0, mo: 0 };
            revenueMap[month].total += totalFinal;
            revenueMap[month].materiales += materialesTotal;
            revenueMap[month].mo += mo;

            globalTotalBilling += totalFinal;

            // Labor Hours (from OS signed by client)
            let totalHoursOS = 0;
            if (o.operadores && Array.isArray(o.operadores)) {
                totalHoursOS = o.operadores.reduce((acc: number, op: any) => acc + (op.horas || 0), 0);
            }
            if (totalHoursOS > 0) {
                if (!laborHoursMap[month]) laborHoursMap[month] = { totalHours: 0, count: 0 };
                laborHoursMap[month].totalHours += totalHoursOS;
                laborHoursMap[month].count += 1;
                globalTotalHours += totalHoursOS;
            }

            // Process Times
            if (o.firma?.fechaFirma && o.cobroFechaGeneracion) {
                const fFirma = new Date(o.firma.fechaFirma).getTime();
                const fOC = new Date(o.cobroFechaGeneracion).getTime();
                const diffDays = (fOC - fFirma) / (1000 * 60 * 60 * 24);
                if (diffDays >= 0) {
                    firmaToOC += diffDays;
                    countFirmaToOC += 1;
                }
            }

            if (o.cobroFechaGeneracion) {
                const fOC = new Date(o.cobroFechaGeneracion).getTime();
                let fPago;
                if (o.cobroFechaPago) {
                    fPago = new Date(o.cobroFechaPago).getTime();
                } else {
                    fPago = fOC + (5 * 24 * 60 * 60 * 1000); // 5 days after OC
                }
                const diffDays = (fPago - fOC) / (1000 * 60 * 60 * 24);
                if (diffDays >= 0) {
                    ocToPago += diffDays;
                    countOCToPago += 1;
                }
            }
        });

        // Format Trends
        const revenueTrend = Object.entries(revenueMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, data]) => ({
                label,
                total: data.total,
                materiales: data.materiales,
                mo: data.mo
            }))
            .slice(-6); // Keep last 6 months

        const laborHoursTrend = Object.entries(laborHoursMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, data]) => ({
                label,
                avgHours: Number((data.totalHours / data.count).toFixed(2))
            }))
            .slice(-6);

        // Ensure at least 2 points for line charts
        if (revenueTrend.length === 1) {
            const first = revenueTrend[0];
            const [year, month] = first.label.split('-').map(Number);
            const prevMonthDate = new Date(year, month - 2, 1);
            const prevLabel = prevMonthDate.toISOString().slice(0, 7);
            revenueTrend.unshift({ label: prevLabel, total: 0, materiales: 0, mo: 0 });
        }
        if (laborHoursTrend.length === 1) {
             const first = laborHoursTrend[0];
             const [year, month] = first.label.split('-').map(Number);
             const prevMonthDate = new Date(year, month - 2, 1);
             const prevLabel = prevMonthDate.toISOString().slice(0, 7);
             laborHoursTrend.unshift({ label: prevLabel, avgHours: 0 });
        }

        const avgFirmaToOC = countFirmaToOC > 0 ? (firmaToOC / countFirmaToOC) : 0;
        const avgOCToPago = countOCToPago > 0 ? (ocToPago / countOCToPago) : 0;
        
        const globalAvgTimeTicket = ordenes.length > 0 ? globalTotalHours / ordenes.length : 0;
        const globalAvgBillingTicket = ordenes.length > 0 ? globalTotalBilling / ordenes.length : 0;

        return {
            kpis: {
                totalOrdenes: ordenes.length,
                globalAvgTimeTicket: Number(globalAvgTimeTicket.toFixed(1)),
                globalAvgBillingTicket: Number(globalAvgBillingTicket.toFixed(2))
            },
            trends: {
                revenue: revenueTrend,
                laborHours: laborHoursTrend,
                processTimes: [
                    { name: 'Firma a Generación OC', days: Number(avgFirmaToOC.toFixed(1)) },
                    { name: 'Generación OC a Pago', days: Number(avgOCToPago.toFixed(1)) }
                ]
            }
        };

    }, [rawData, filters]);
}
