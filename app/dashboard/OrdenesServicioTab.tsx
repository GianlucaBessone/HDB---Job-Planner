import React, { useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, Clock, Activity, CreditCard, CheckCircle2, AlertTriangle, Calendar, Info } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { COMMON_GRID } from './EChartsComponents'; // Let's check if COMMON_GRID is exported
import CodeBadge from '@/components/CodeBadge';

export function KpiCard({ title, value, icon, trend, color, tooltip }: any) {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between relative group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2 md:mb-4">
                <div className={`p-2.5 md:p-3 rounded-2xl ${color} text-white shadow-lg`}>
                    {icon}
                </div>
                {tooltip && (
                    <div className="relative z-50">
                        <Info className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-slate-400 cursor-help transition-colors" />
                        <div className="absolute right-0 w-64 p-3 bg-slate-900 text-slate-100 text-[11px] rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none top-6 leading-relaxed font-medium z-50 border border-slate-700">
                            <p className="mb-1.5"><strong className="text-white">Qué es:</strong> {tooltip.def}</p>
                            <p className="mb-1.5"><strong className="text-white">Para qué sirve:</strong> {tooltip.purpose}</p>
                            <p className="text-slate-400 text-[10px] border-t border-slate-700 pt-1.5 mt-1.5"><strong className="text-slate-300">Cálculo:</strong> {tooltip.calc}</p>
                        </div>
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{value}</h3>
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                    {trend}
                </p>
            </div>
        </div>
    );
}

export function RevenueLineChart({ data, height = 300 }: { data: any[], height?: number }) {
    const option = useMemo(() => ({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#f8fafc', fontSize: 12 },
            formatter: (params: any) => {
                const label = params[0].name;
                let html = `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${label}</div>`;
                params.forEach((p: any) => {
                    const formattedValue = Math.round(p.value).toLocaleString('es-AR');
                    html += `<div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${p.color}"></span>
                                <span style="color:#cbd5e1;font-size:12px">${p.seriesName}:</span>
                                <span style="color:${p.color};font-weight:bold">$${formattedValue}</span>
                             </div>`;
                });
                return html;
            }
        },
        legend: {
            data: ['Total', 'Materiales', 'Mano de Obra'],
            bottom: 0,
            icon: 'circle',
            textStyle: { color: '#64748b', fontSize: 12, fontWeight: 'bold' }
        },
        grid: { top: 20, right: 20, bottom: 40, left: 60, containLabel: false },
        xAxis: {
            type: 'category',
            data: data.map(d => d.label),
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 11 }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
            axisLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 11, formatter: (val: number) => '$' + Math.round(val).toLocaleString('es-AR') }
        },
        series: [
            {
                name: 'Total',
                type: 'line',
                data: data.map(d => d.total),
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#3b82f6' }, // Blue
                lineStyle: { width: 3 },
                areaStyle: {
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.2)' }, { offset: 1, color: 'rgba(59, 130, 246, 0)' }]
                    }
                }
            },
            {
                name: 'Materiales',
                type: 'line',
                data: data.map(d => d.materiales),
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: '#8b5cf6' }, // Violet
                lineStyle: { width: 2, type: 'dashed' }
            },
            {
                name: 'Mano de Obra',
                type: 'line',
                data: data.map(d => d.mo),
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: '#f59e0b' }, // Amber
                lineStyle: { width: 2, type: 'dashed' }
            }
        ]
    }), [data]);

    return <ReactECharts option={option} style={{ height }} opts={{ renderer: 'svg' }} />;
}

export function AvgLaborLineChart({ data, height = 300 }: { data: any[], height?: number }) {
    const option = useMemo(() => ({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            formatter: (params: any) => {
                const val = params[0];
                return `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${val.name}</div>
                        <div style="font-size:14px;font-weight:bold;color:${val.color}">${val.value} hs</div>`;
            }
        },
        grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: false },
        xAxis: {
            type: 'category',
            data: data.map(d => d.label),
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 11 }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
            axisLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 11 }
        },
        series: [{
            data: data.map(d => d.avgHours),
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#10b981' },
            lineStyle: { width: 3 },
            areaStyle: {
                color: {
                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [{ offset: 0, color: 'rgba(16, 185, 129, 0.2)' }, { offset: 1, color: 'rgba(16, 185, 129, 0)' }]
                }
            }
        }]
    }), [data]);

    return <ReactECharts option={option} style={{ height }} opts={{ renderer: 'svg' }} />;
}

export function ProcessTimeBarChart({ data, height = 300 }: { data: any[], height?: number }) {
    const option = useMemo(() => ({
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            formatter: (params: any) => {
                const val = params[0];
                return `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${val.name}</div>
                        <div style="font-size:14px;font-weight:bold;color:${val.color}">${val.value} días</div>`;
            }
        },
        grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: false },
        xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 11 }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
            axisLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 11 }
        },
        series: [{
            data: data.map((d, idx) => ({
                value: d.days,
                itemStyle: { color: idx === 0 ? '#6366f1' : '#f43f5e', borderRadius: [4, 4, 0, 0] }
            })),
            type: 'bar',
            barMaxWidth: 60
        }]
    }), [data]);

    return <ReactECharts option={option} style={{ height }} opts={{ renderer: 'svg' }} />;
}

export default function OrdenesServicioTab({ data }: { data: any }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard
                    title="Total Órdenes"
                    value={data.kpis.totalOrdenes}
                    icon={<CheckCircle2 className="w-6 h-6" />}
                    color="bg-primary"
                    trend="En el período seleccionado"
                />
                <KpiCard
                    title="Ticket Promedio (Horas MO)"
                    value={`${data.kpis.globalAvgTimeTicket} hs`}
                    icon={<Clock className="w-6 h-6" />}
                    color="bg-indigo-500"
                    trend="Promedio Global"
                    tooltip={{
                        def: "Cantidad promedio de horas de mano de obra reportadas por Orden de Servicio.",
                        purpose: "Entender el esfuerzo operativo típico por trabajo.",
                        calc: "Suma(Horas MO) / Total de OS"
                    }}
                />
                <KpiCard
                    title="Ticket Promedio (Cobro)"
                    value={`$${Math.round(data.kpis.globalAvgBillingTicket).toLocaleString('es-AR')}`}
                    icon={<CreditCard className="w-6 h-6" />}
                    color="bg-emerald-500"
                    trend="Promedio Global"
                    tooltip={{
                        def: "Monto promedio cobrado por Orden de Servicio.",
                        purpose: "Evaluar la rentabilidad y tamaño típico de los trabajos.",
                        calc: "Suma(Cobro Total Final) / Total de OS"
                    }}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        Seguimiento de Ingresos
                    </h3>
                    <div className="flex-1 min-h-[300px]">
                        <RevenueLineChart data={data.trends.revenue} height={300} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Tiempo Promedio MO
                    </h3>
                    <div className="flex-1 min-h-[300px]">
                        <AvgLaborLineChart data={data.trends.laborHours} height={300} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                            <Clock className="w-5 h-5 text-indigo-500" />
                            Tiempos de Proceso Promedio
                        </h3>
                    </div>
                    <div className="flex-1 min-h-[300px]">
                        <ProcessTimeBarChart data={data.trends.processTimes} height={300} />
                    </div>
                </div>
            </div>
        </div>
    );
}
