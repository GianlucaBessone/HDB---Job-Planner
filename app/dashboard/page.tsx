'use client';

import { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Briefcase,
    Users,
    Clock,
    BarChart3,
    PieChart,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    ArrowUpRight,
    User2,
    Building2,
    Info,
    TrendingDown,
    Activity,
    Target
} from 'lucide-react';

interface DashboardData {
    kpis: {
        totalProjects: number;
        activeProjects: number;
        activeOperatorsCount: number;
        overallEfficiency: number;
        avgIPT: number;
        totalSavings: number;
        variation: number;
    };
    statusDistribution: {
        por_hacer: number;
        planificado: number;
        activo: number;
        en_riesgo: number;
        atrasado: number;
        finalizado: number;
    };
    topClients: { name: string; count: number }[];
    topOperators: { name: string; count: number }[];
    criticalProjects: { nombre: string; percentage: number; estado: string }[];
    performance: {
        projects: {
            id: string;
            nombre: string;
            ipt: number;
            savings: number;
            variation: number;
            classification: string;
        }[];
        classification: {
            eficiente: number;
            exacto: number;
            desvio: number;
        };
        trend: { label: string; ipt: number }[];
    };
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard')
            .then(res => res.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return <div>Error loading dashboard</div>;

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-primary" />
                        Panel de Análisis
                    </h2>
                    <p className="text-slate-500 font-medium">Resumen del estado operativo y métricas de rendimiento</p>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <KpiCard
                    title="Eficiencia de Tiempo (IPT)"
                    value={data.kpis.avgIPT}
                    icon={<Target className="w-6 h-6" />}
                    color="bg-primary"
                    trend="Promedio Global"
                    tooltip={{
                        def: "El IPT compara las horas planificadas con las horas reales.",
                        purpose: "Sirve para evaluar la calidad de la estimación y la eficiencia operativa.",
                        calc: "Sumatoria(Horas Estimadas) / Sumatoria(Horas Consumidas). > 1 es eficiente."
                    }}
                />
                <KpiCard
                    title="Horas Ahorradas"
                    value={data.kpis.totalSavings > 0 ? `+${data.kpis.totalSavings}` : data.kpis.totalSavings}
                    icon={data.kpis.totalSavings >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    color={data.kpis.totalSavings >= 0 ? "bg-emerald-500" : "bg-rose-500"}
                    trend="Balance vs Estimado"
                    tooltip={{
                        def: "Total de horas presupuestadas que no fueron consumidas.",
                        purpose: "Mide el impacto directo en la rentabilidad y capacidad disponible.",
                        calc: "Horas Estimadas - Horas Consumidas."
                    }}
                />
                <KpiCard
                    title="Variación de Tiempo"
                    value={`${data.kpis.variation}%`}
                    icon={<Activity className="w-6 h-6" />}
                    color="bg-indigo-500"
                    trend="Desvío promedio"
                    tooltip={{
                        def: "Magnitud porcentual de la diferencia entre plan y realidad.",
                        purpose: "Identifica la precisión de la planificación comercial.",
                        calc: "((Consumido - Estimado) / Estimado) * 100."
                    }}
                />
                <KpiCard
                    title="Estado Crítico"
                    value={data.statusDistribution.en_riesgo + data.statusDistribution.atrasado}
                    icon={<AlertTriangle className="w-6 h-6" />}
                    color="bg-amber-500"
                    trend="Requieren atención"
                />
            </div>

            {/* Performance Visualizations Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* IPT Comparison Chart */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            <h3 className="text-xl font-bold text-slate-800">IPT por Proyecto</h3>
                        </div>
                        <MetricTooltip
                            def="Muestra la eficiencia individual de cada proyecto."
                            purpose="Permite identificar qué proyectos están performando por encima o debajo de la media."
                            calc="La línea roja indica el punto neutro (IPT = 1.0)."
                        />
                    </div>
                    <div className="h-64 flex items-end justify-between gap-3 px-2 relative px-4">
                        <div className="absolute w-full h-[1px] bg-rose-500/20 border-t border-dashed border-rose-500 z-0 left-0" style={{ bottom: '50%' }} />

                        {data.performance.projects.map((p, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group/bar relative h-full justify-end z-10">
                                <div className="absolute bottom-full mb-2 hidden group-hover/bar:block bg-slate-900 text-white text-[10px] py-1.5 px-3 rounded-xl whitespace-nowrap z-50 font-bold shadow-xl border border-white/10">
                                    {p.nombre}: <span className="text-primary">{p.ipt.toFixed(2)}</span>
                                </div>
                                <div
                                    className={`w-full rounded-t-xl transition-all duration-700 hover:brightness-110 shadow-sm ${p.ipt >= 1 ? 'bg-primary' : 'bg-rose-400'}`}
                                    style={{ height: `${Math.min(p.ipt * 50, 100)}%` }}
                                />
                                <span className="text-[9px] font-black text-slate-400 rotate-45 origin-left truncate max-w-[50px] mt-4 translate-x-1">{p.nombre}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Performance Trend */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-xl font-bold text-slate-800">Tendencia de Performance</h3>
                        </div>
                        <MetricTooltip
                            def="Evolución del IPT promedio en el tiempo."
                            purpose="Detectar si la eficiencia operativa está mejorando o deteriorándose mes a mes."
                            calc="Promedio de IPT de todos los proyectos por mes (últimos 6 meses)."
                        />
                    </div>
                    <div className="h-64 relative mt-4">
                        <svg className="w-full h-full p-2" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path
                                d={`M ${data.performance.trend.map((t, i) => `${(i / Math.max(data.performance.trend.length - 1, 1)) * 100},${100 - (Math.min(t.ipt, 2) * 50)}`).join(' L ')}`}
                                fill="none"
                                stroke="url(#lineGradient)"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="drop-shadow-xl"
                            />
                            <defs>
                                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-x-0 bottom-[-1.5rem] flex justify-between px-2">
                            {data.performance.trend.map((t, i) => (
                                <span key={i} className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t.label.split('-')[1]}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Classification Donut */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center">
                    <div className="flex items-center justify-between w-full mb-8">
                        <div className="flex items-center gap-3">
                            <PieChart className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-xl font-bold text-slate-800">Clasificación</h3>
                        </div>
                        <MetricTooltip
                            def="Segmentación de proyectos por su nivel de eficiencia."
                            purpose="Evaluar rápidamente el balance de la operación."
                            calc="Eficiente (IPT > 1.05), Exacto (0.95-1.05), Desvío (< 0.95)."
                        />
                    </div>

                    <div className="relative w-48 h-48 mb-6 group/donut">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
                            <circle r="16" cx="16" cy="16" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                            <circle r="16" cx="16" cy="16" fill="transparent" stroke="#10b981" strokeWidth="6"
                                strokeDasharray={`${(data.performance.classification.eficiente / Math.max(data.kpis.totalProjects, 1)) * 100} 100`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center group-hover/donut:scale-110 transition-transform duration-500">
                            <span className="text-4xl font-black text-slate-800 tracking-tighter">{data.performance.classification.eficiente}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Eficientes</span>
                        </div>
                    </div>

                    <div className="w-full space-y-3">
                        <LegendItem label="Eficientes" count={data.performance.classification.eficiente} color="bg-emerald-500" />
                        <LegendItem label="Exactos" count={data.performance.classification.exacto} color="bg-primary" />
                        <LegendItem label="Con Desvío" count={data.performance.classification.desvio} color="bg-rose-500" />
                    </div>
                </div>

                {/* Savings Deviation (Bar Divergent) */}
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Briefcase className="w-5 h-5 text-primary" />
                            <h3 className="text-xl font-bold text-slate-800">Balance de Horas por Proyecto</h3>
                        </div>
                        <MetricTooltip
                            def="Muestra el desvío absoluto en horas."
                            purpose="Determinar el impacto financiero (ahorro de costos vs sobrecostos)."
                            calc="Horas Estimadas - Horas Consumidas. Positivo = Ahorro, Negativo = Desvío."
                        />
                    </div>
                    <div className="space-y-6">
                        {data.performance.projects.slice(0, 5).map((p, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500 line-clamp-1 max-w-[200px]">{p.nombre}</span>
                                    <span className={p.savings >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                        {p.savings > 0 ? `+${p.savings}H AHORRO` : `${Math.abs(p.savings)}H DESVÍO`}
                                    </span>
                                </div>
                                <div className="h-5 bg-slate-50 rounded-xl relative overflow-hidden flex items-center border border-slate-100">
                                    <div className="absolute left-1/2 w-[2px] h-full bg-slate-200 z-10" />
                                    <div
                                        className={`h-full transition-all duration-1000 ${p.savings >= 0 ? 'bg-emerald-400 rounded-r-lg shadow-sm shadow-emerald-200' : 'bg-rose-400 rounded-l-lg self-end'}`}
                                        style={{
                                            width: `${Math.min(Math.abs(p.savings) * 2, 50)}%`,
                                            marginLeft: p.savings >= 0 ? '50%' : `${50 - Math.min(Math.abs(p.savings) * 2, 50)}%`
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Operational Foundations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 flex flex-col gap-8">
                    {/* Status Distribution */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-8">
                            <Activity className="w-5 h-5 text-primary" />
                            Estado Operativo
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            <StatusPill label="Por Hacer" count={data.statusDistribution.por_hacer} color="blue" />
                            <StatusPill label="Planificado" count={data.statusDistribution.planificado} color="violet" />
                            <StatusPill label="Activos" count={data.statusDistribution.activo} color="primary" />
                            <StatusPill label="En Riesgo" count={data.statusDistribution.en_riesgo} color="amber" />
                            <StatusPill label="Atrasados" count={data.statusDistribution.atrasado} color="rose" />
                            <StatusPill label="Finalizados" count={data.statusDistribution.finalizado} color="slate" />
                        </div>
                    </div>

                    {/* Alert List */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-6">
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                            Alertas de Consumo
                        </h3>
                        <div className="space-y-5">
                            {data.criticalProjects.map((project, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="font-bold text-slate-700 text-sm">{project.nombre}</span>
                                        <span className={`text-xs font-black px-2 py-1 rounded-lg ${project.percentage > 100 ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600'}`}>
                                            {Math.round(project.percentage)}%
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${project.percentage > 100 ? 'bg-rose-500' : project.percentage > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                            style={{ width: `${Math.min(project.percentage, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    {/* Concentration Metrics */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-6">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            Top Clientes
                        </h3>
                        <div className="space-y-4">
                            {data.topClients.map((client, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all group">
                                    <span className="font-bold text-slate-600 group-hover:text-primary transition-colors text-sm truncate">{client.name}</span>
                                    <span className="px-3 py-1 bg-white border border-slate-100 text-primary text-[10px] font-black rounded-xl shadow-sm">{client.count} Proj</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-6">
                            <Users className="w-5 h-5 text-slate-400" />
                            Mayor Actividad
                        </h3>
                        <div className="space-y-4">
                            {data.topOperators.map((op, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/30 hover:bg-white hover:shadow-sm border border-transparent hover:border-indigo-100 transition-all group">
                                    <span className="font-bold text-slate-600 group-hover:text-indigo-600 transition-colors text-sm truncate">{op.name}</span>
                                    <span className="px-3 py-1 bg-white border border-indigo-100 text-indigo-600 text-[10px] font-black rounded-xl shadow-sm">{op.count} Asig</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ title, value, icon, color, trend, tooltip }: { title: string; value: string | number; icon: any; color: string; trend: string; tooltip?: { def: string; purpose: string; calc: string } }) {
    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group relative">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                {tooltip && <MetricTooltip {...tooltip} />}
                {!tooltip && (
                    <div className="px-2 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                        KPI Global
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{title}</p>
                <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{value}</h4>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${color.replace('bg-', 'bg-').replace('500', '400')} animate-pulse`} />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{trend}</p>
            </div>
        </div>
    );
}

function MetricTooltip({ def, purpose, calc }: { def: string; purpose: string; calc: string }) {
    return (
        <div className="group relative">
            <Info className="w-5 h-5 text-slate-300 hover:text-primary transition-colors cursor-help" />
            <div className="absolute top-0 right-full mr-3 w-64 p-4 bg-slate-900 text-white rounded-2xl text-[10px] leading-relaxed hidden group-hover:block z-50 shadow-2xl animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="space-y-3">
                    <div>
                        <span className="block font-black uppercase tracking-widest text-primary mb-1">¿Qué mide?</span>
                        <p className="text-slate-300 font-medium">{def}</p>
                    </div>
                    <div>
                        <span className="block font-black uppercase tracking-widest text-emerald-400 mb-1">¿Para qué sirve?</span>
                        <p className="text-slate-300 font-medium">{purpose}</p>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                        <span className="block font-black uppercase tracking-widest text-indigo-400 mb-1">Cálculo</span>
                        <p className="font-mono text-[9px] text-slate-400">{calc}</p>
                    </div>
                </div>
                {/* Arrow */}
                <div className="absolute top-1.5 left-full w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-slate-900" />
            </div>
        </div>
    );
}

function LegendItem({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl group hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-100">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-sm font-black text-slate-800">{count}</span>
        </div>
    );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
    const colors: Record<string, string> = {
        primary: 'bg-primary/10 text-primary border-primary/20',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        rose: 'bg-rose-50 text-rose-500 border-rose-100',
        slate: 'bg-slate-50 text-slate-500 border-slate-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        violet: 'bg-violet-50 text-violet-600 border-violet-100'
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[color]} flex flex-col items-center justify-center gap-1 hover:scale-105 transition-transform cursor-default`}>
            <span className="text-2xl font-black leading-none">{count}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-center">{label}</span>
        </div>
    );
}
