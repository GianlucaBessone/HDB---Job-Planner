'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronRight, Activity, BarChart3, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import SemaforoIcon from './SemaforoIcon';

interface DashboardData {
    okrs: any[];
    resumen: {
        totalOkrs: number;
        totalKpis: number;
        kpisCumple: number;
        kpisEnRiesgo: number;
        kpisNoCumple: number;
        kpisSinDatos: number;
    };
}



function GaugeChart({ value, label }: { value: number; label: string }) {
    const option = {
        series: [{
            type: 'gauge',
            startAngle: 200,
            endAngle: -20,
            min: 0,
            max: 100,
            splitNumber: 5,
            itemStyle: { color: value >= 100 ? '#10b981' : value >= 70 ? '#f59e0b' : '#ef4444' },
            progress: { show: true, width: 16 },
            pointer: { show: false },
            axisLine: { lineStyle: { width: 16, color: [[1, '#e2e8f0']] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            title: { show: true, offsetCenter: [0, '65%'], fontSize: 11, fontWeight: 'bold', color: '#64748b' },
            detail: { valueAnimation: true, fontSize: 24, fontWeight: 'bold', offsetCenter: [0, '20%'], formatter: '{value}%', color: value >= 100 ? '#10b981' : value >= 70 ? '#f59e0b' : '#ef4444' },
            data: [{ value: Math.round(value), name: label }],
        }],
    };
    return <ReactECharts option={option} style={{ height: 160, width: 160 }} opts={{ renderer: 'svg' }} />;
}

function KpiSparkline({ historico, valorObjetivo }: { historico: any[]; valorObjetivo: number }) {
    if (!historico || historico.length === 0) return <div className="text-xs text-slate-400 italic">Sin mediciones</div>;

    const sorted = [...historico].sort((a, b) => new Date(a.fechaMedicion).getTime() - new Date(b.fechaMedicion).getTime());
    const option = {
        grid: { top: 8, right: 8, bottom: 8, left: 8 },
        xAxis: { type: 'category' as const, show: false, data: sorted.map((_, i) => i) },
        yAxis: { type: 'value' as const, show: false },
        series: [
            {
                type: 'line',
                data: sorted.map(h => h.valorObtenido),
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                lineStyle: { width: 2, color: '#6366f1' },
                itemStyle: { color: '#6366f1' },
                areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.3)' }, { offset: 1, color: 'rgba(99,102,241,0.02)' }] } },
            },
            {
                type: 'line',
                data: sorted.map(() => valorObjetivo),
                lineStyle: { width: 1, type: 'dashed' as const, color: '#10b981' },
                symbol: 'none',
            },
        ],
        tooltip: { show: false },
    };
    return <ReactECharts option={option} style={{ height: 60, width: '100%' }} opts={{ renderer: 'svg' }} />;
}

export default function DashboardEstrategicoTab({ user, isActive = true }: { user: any; isActive?: boolean }) {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedOkrs, setExpandedOkrs] = useState<Set<string>>(new Set());

    const fetchDashboard = useCallback(async () => {
        try {
            const res = await fetch('/api/okr-kpi/dashboard');
            if (res.ok) {
                const json = await res.json();
                setData(json);
                // Auto expand all OKRs
                setExpandedOkrs(new Set(json.okrs.map((o: any) => o.id)));
            }
        } catch (err) {
            console.error('Error fetching dashboard:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { 
        if (isActive) fetchDashboard(); 
    }, [fetchDashboard, isActive]);

    const toggleOkr = (id: string) => {
        setExpandedOkrs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
    );

    if (!data) return <div className="text-center py-20 text-slate-400">Error al cargar el tablero</div>;

    const { resumen, okrs } = data;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <SummaryCard icon={<Target className="w-5 h-5" />} label="OKRs" value={resumen.totalOkrs} color="bg-indigo-500" />
                <SummaryCard icon={<Activity className="w-5 h-5" />} label="KPIs Totales" value={resumen.totalKpis} color="bg-blue-500" />
                <SummaryCard icon={<CheckCircle2 className="w-5 h-5" />} label="Cumple" value={resumen.kpisCumple} color="bg-emerald-500" />
                <SummaryCard icon={<AlertTriangle className="w-5 h-5" />} label="En Riesgo" value={resumen.kpisEnRiesgo} color="bg-amber-500" />
                <SummaryCard icon={<XCircle className="w-5 h-5" />} label="No Cumple" value={resumen.kpisNoCumple} color="bg-rose-500" />
                <SummaryCard icon={<Clock className="w-5 h-5" />} label="Sin Datos" value={resumen.kpisSinDatos} color="bg-slate-400" />
            </div>

            {/* OKR Tree */}
            {okrs.length === 0 ? (
                <div className="bg-card text-card-foreground border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <Target className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Sin OKRs registrados</h3>
                    <p className="text-sm text-slate-400">Creá tu primer Objetivo Estratégico desde la pestaña "OKRs"</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {okrs.map(okr => (
                        <div key={okr.id} className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                            {/* OKR Header */}
                            <button
                                onClick={() => toggleOkr(okr.id)}
                                className="w-full flex items-center gap-4 p-4 md:p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                            >
                                <div className="shrink-0">
                                    {expandedOkrs.has(okr.id) ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                </div>
                                <div className="shrink-0">
                                    <SemaforoIcon estado={okr.estadoCumplimiento} size="lg" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">{okr.codigoOkr}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                            okr.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            okr.estado === 'Cerrado' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                                            'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                        }`}>{okr.estado}</span>
                                    </div>
                                    <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">{okr.nombre}</h3>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {okr.responsable && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{okr.responsable.nombreCompleto}</span>}
                                        <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{okr.kpis.length} KPIs</span>
                                    </div>
                                </div>
                                <div className="hidden md:block shrink-0">
                                    <GaugeChart value={okr.porcentajeAvance} label="Avance" />
                                </div>
                                <div className="md:hidden shrink-0 text-right">
                                    <div className={`text-2xl font-black ${
                                        okr.porcentajeAvance >= 100 ? 'text-emerald-600' :
                                        okr.porcentajeAvance >= 70 ? 'text-amber-600' : 'text-rose-600'
                                    }`}>{Math.round(okr.porcentajeAvance)}%</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Avance</div>
                                </div>
                            </button>

                            {/* KPIs Expanded */}
                            {expandedOkrs.has(okr.id) && okr.kpis.length > 0 && (
                                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {okr.kpis.map((kpi: any) => (
                                        <div key={kpi.id} className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 p-4 md:px-6 hover:bg-white dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="shrink-0 pl-6">
                                                <SemaforoIcon estado={kpi.estadoCumplimiento} size="md" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{kpi.codigoKpi}</span>
                                                    {kpi.estadoCumplimiento && (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                            kpi.estadoCumplimiento === 'Cumple' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            kpi.estadoCumplimiento === 'En Riesgo' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                        }`}>{kpi.estadoCumplimiento}</span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5 truncate">{kpi.nombre}</p>
                                                {kpi.responsableCarga && <p className="text-xs text-slate-400">{kpi.responsableCarga.nombreCompleto}</p>}
                                            </div>
                                            <div className="flex items-center gap-4 md:gap-6 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-400 font-medium">Último</p>
                                                    <p className="text-base font-black text-slate-800 dark:text-slate-100">
                                                        {kpi.ultimoValor !== null ? kpi.ultimoValor : '—'}
                                                        {kpi.unidadMedida && <span className="text-xs font-normal text-slate-400 ml-1">{kpi.unidadMedida}</span>}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-400 font-medium">Objetivo</p>
                                                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                                        {kpi.valorObjetivo}
                                                        {kpi.unidadMedida && <span className="text-xs font-normal ml-1">{kpi.unidadMedida}</span>}
                                                    </p>
                                                </div>
                                                <div className="w-32 hidden lg:block">
                                                    <KpiSparkline historico={kpi.historico} valorObjetivo={kpi.valorObjetivo} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {expandedOkrs.has(okr.id) && okr.kpis.length === 0 && (
                                <div className="border-t border-slate-100 dark:border-slate-700 p-6 text-center text-sm text-slate-400">
                                    Sin KPIs asociados a este OKR
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    return (
        <div className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl p-3 md:p-4 flex items-center gap-3 shadow-sm">
            <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">{value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
        </div>
    );
}
