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
    Target,
    Timer
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
    delays: {
        totalHours: number;
        impactPercent: number;
        totalEvents: number;
        topAreas: { name: string; hours: number }[];
        reasons: { name: string; value: number }[];
        trend: { label: string; hours: number }[];
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

    if (!data || !data.kpis) return <div className="p-8 text-center text-rose-500 font-bold">Error loading dashboard data. Please verify database connection.</div>;

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
                <ElegantTrendChart
                    title="Tendencia de Performance"
                    data={data.performance.trend.map(t => ({ label: t.label, value: t.ipt }))}
                    color="#6366f1"
                    icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
                    tooltip={{
                        def: "Evolución del IPT promedio en el tiempo.",
                        purpose: "Detectar si la eficiencia operativa está mejorando o deteriorándose mes a mes.",
                        calc: "Promedio de IPT de todos los proyectos por mes (últimos 6 meses)."
                    }}
                    valuePrefix=""
                    valueSuffix=""
                    minY={0}
                    maxY={2}
                    yScale={50}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-visible">
                {/* Classification Donut */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center overflow-visible">
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

                    <div className="relative w-48 h-48 mb-6 mt-6 group/donut overflow-visible rounded-none z-10">
                        <svg className="w-full h-full -rotate-90" viewBox="-4 -4 40 40">
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

            {/* Client Delays Analysis Section (NEW) */}
            <div className="space-y-6 pt-12 border-t border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/20">
                        <Timer className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Análisis de Demoras Externas</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 px-0.5">Responsabilidad del Cliente</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <KpiCard
                        title="Total Tiempo Perdido"
                        value={`${data.delays.totalHours}h`}
                        icon={<Timer className="w-6 h-6" />}
                        color="bg-amber-500"
                        trend="Horas acumuladas"
                        tooltip={{
                            def: "Suma total de horas demoradas atribuidas al cliente.",
                            purpose: "Cuantificar el costo en tiempo de las fricciones externas.",
                            calc: "Sumatoria de todos los eventos de demora del cliente realizados."
                        }}
                    />
                    <KpiCard
                        title="Impacto en Proyecto"
                        value={`${data.delays.impactPercent}%`}
                        icon={<AlertTriangle className="w-6 h-6" />}
                        color="bg-rose-500"
                        trend="Carga sobre ejecución"
                        tooltip={{
                            def: "Proporción de tiempo que el proyecto estuvo detenido por el cliente.",
                            purpose: "Entender qué tanto peso tiene la burocracia/demora del cliente en el cronograma.",
                            calc: "(Horas Demora / (Horas Consumidas + Horas Demora)) * 100."
                        }}
                    />
                    <KpiCard
                        title="Frecuencia de Eventos"
                        value={data.delays.totalEvents}
                        icon={<Activity className="w-6 h-6" />}
                        color="bg-slate-700"
                        trend="Incidentes registrados"
                        tooltip={{
                            def: "Cantidad absoluta de reportes de demora.",
                            purpose: "Medir la recurrencia de los problemas externos.",
                            calc: "Conteo simple de registros en la base de demoras."
                        }}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Delays by Area */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-amber-500" />
                                <h3 className="text-xl font-bold text-slate-800">Demoras por Área del Cliente</h3>
                            </div>
                            <MetricTooltip
                                def="Distribución de horas perdidas según el departamento responsable del cliente."
                                purpose="Identificar qué áreas del cliente son los cuellos de botella más críticos."
                                calc="Horas totales acumuladas por cada etiqueta de área."
                            />
                        </div>
                        <div className="space-y-4">
                            {data.delays.topAreas.length === 0 ? (
                                <div className="h-48 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin datos de áreas</div>
                            ) : (
                                data.delays.topAreas.slice(0, 5).map((area, idx) => {
                                    const maxHours = Math.max(...data.delays.topAreas.map(a => a.hours), 1);
                                    const percentage = (area.hours / maxHours) * 100;
                                    return (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-slate-500">{area.name}</span>
                                                <span className="text-amber-600 font-black">{area.hours}h</span>
                                            </div>
                                            <div className="h-4 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 p-0.5">
                                                <div
                                                    className="h-full bg-amber-400 rounded-md transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Delay Evolution */}
                    <ElegantTrendChart
                        title="Evolución de Demoras"
                        data={data.delays.trend.map(t => ({ label: t.label, value: t.hours }))}
                        color="#f59e0b"
                        icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
                        tooltip={{
                            def: "Muestra si las demoras del cliente están aumentando o disminuyendo mensualmente.",
                            purpose: "Validar si las gestiones para reducir tiempos muertos externos están siendo efectivas.",
                            calc: "Suma de horas de demora agrupadas por mes."
                        }}
                        valuePrefix=""
                        valueSuffix="h"
                        minY={0}
                        maxY={Math.max(...data.delays.trend.map(d => d.hours), 1)}
                        yScale={80}
                    />
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
        <div className="group/tooltip relative">
            <Info className="w-5 h-5 text-slate-300 hover:text-primary transition-colors cursor-help" />
            <div className="absolute top-0 right-full mr-3 w-64 p-4 bg-slate-900 text-white rounded-2xl text-[10px] leading-relaxed hidden group-hover/tooltip:block z-50 shadow-2xl animate-in fade-in slide-in-from-right-2 duration-200">
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

function ElegantTrendChart({ title, data, color, icon, tooltip, valuePrefix = '', valueSuffix = '', minY = 0, maxY = 100, yScale = 80 }: {
    title: string;
    data: { label: string; value: number }[];
    color: string;
    icon: any;
    tooltip: { def: string; purpose: string; calc: string };
    valuePrefix?: string;
    valueSuffix?: string;
    minY?: number;
    maxY?: number;
    yScale?: number;
}) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const maxVal = Math.max(...data.map(d => d.value), maxY || 1);
    const points = data.map((d, i) => ({
        x: (i / Math.max(data.length - 1, 1)) * 100,
        y: 100 - ((d.value / maxVal) * yScale)
    }));

    // Cubic Bezier smoothing
    const getSmoothingPath = () => {
        if (points.length < 2) return '';
        let d = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            // Smoothing factor
            const dx = (p1.x - p0.x) / 3;
            d += ` C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        return d;
    };

    const linePath = getSmoothingPath();
    const areaPath = points.length >= 2 ? `${linePath} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z` : '';

    return (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    {icon}
                    <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                </div>
                <MetricTooltip {...tooltip} />
            </div>

            <div className="h-56 relative mt-4 cursor-crosshair" onMouseLeave={() => setHoveredIndex(null)}>
                {data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin datos históricos</div>
                ) : (
                    <>
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {/* Area fill */}
                            {areaPath && (
                                <path
                                    d={areaPath}
                                    fill={color}
                                    fillOpacity="0.05"
                                    className="transition-all duration-700"
                                />
                            )}
                            {/* Main line */}
                            <path
                                d={linePath}
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-700"
                            />



                            {/* Interaction zones */}
                            {points.map((p, i) => (
                                <rect
                                    key={i}
                                    x={p.x - 5}
                                    y={0}
                                    width={10}
                                    height={100}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredIndex(i)}
                                />
                            ))}
                        </svg>

                        {/* Hover point – rendered as HTML div to avoid SVG stretching */}
                        {hoveredIndex !== null && points[hoveredIndex] && (
                            <div
                                className="absolute w-[10px] h-[10px] rounded-full border-2 bg-white pointer-events-none animate-in zoom-in duration-200"
                                style={{
                                    borderColor: color,
                                    left: `${points[hoveredIndex].x}%`,
                                    top: `${points[hoveredIndex].y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: `0 0 6px ${color}40`
                                }}
                            />
                        )}

                        {/* Labels */}
                        <div className="absolute inset-x-0 bottom-[-1.5rem] flex justify-between px-2">
                            {data.map((t, i) => (
                                <span key={i} className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${hoveredIndex === i ? 'text-slate-900 scale-110' : 'text-slate-400'}`}>
                                    {t.label.split('-').length > 1 ? t.label.split('-')[1] : t.label}
                                </span>
                            ))}
                        </div>

                        {/* Floating Tooltip */}
                        {hoveredIndex !== null && (
                            <div
                                className="absolute p-3 bg-slate-900 text-white rounded-xl shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                                style={{
                                    left: `${points[hoveredIndex].x}%`,
                                    top: `${points[hoveredIndex].y}%`,
                                    transform: `translate(${points[hoveredIndex].x > 80 ? '-100%' : points[hoveredIndex].x < 20 ? '0%' : '-50%'}, -130%)`
                                }}
                            >
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{data[hoveredIndex].label}</p>
                                    <p className="text-sm font-black flex items-center gap-2">
                                        <span style={{ color }}>{valuePrefix}{data[hoveredIndex].value}{valueSuffix}</span>
                                    </p>
                                </div>
                                <div className={`absolute bottom-[-4px] w-2 h-2 bg-slate-900 rotate-45 ${points[hoveredIndex].x > 80 ? 'right-4' : points[hoveredIndex].x < 20 ? 'left-4' : 'left-1/2 -translate-x-1/2'}`} />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
