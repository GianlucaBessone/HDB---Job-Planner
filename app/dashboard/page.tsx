'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    Timer,
    SlidersHorizontal,
    Star,
    MessageSquare,
    Smile,
    TrendingUp as TrendUp,
    Award
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import CodeBadge from '@/components/CodeBadge';
import { safeApiRequest } from '@/lib/offline';

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
    criticalProjects: { nombre: string; percentage: number; estado: string; codigoProyecto?: string }[];
    performance: {
        projects: {
            id: string;
            nombre: string;
            ipt: number;
            savings: number;
            variation: number;
            classification: string;
            codigoProyecto?: string;
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
    const [clients, setClients] = useState<{ id: string; nombre: string }[]>([]);
    const [activeTab, setActiveTab] = useState<'proyectos' | 'servicios'>('proyectos');

    // Filter States
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [filterClientId, setFilterClientId] = useState('');
    const [filterStatus, setFilterStatus] = useState('active');
    const router = useRouter();

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const user = JSON.parse(stored);
            if (user.role?.toLowerCase() === 'operador') {
                router.replace('/timesheets');
            }
        }
    }, [router]);

    useEffect(() => {
        safeApiRequest('/api/clients')
            .then(res => res.json())
            .then(setClients)
            .catch(console.error);
    }, []);

    useEffect(() => {
        loadDashboardData();
    }, [filterFrom, filterTo, filterClientId, filterStatus]);

    const loadDashboardData = () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (filterFrom) params.append('from', filterFrom);
        if (filterTo) params.append('to', filterTo);
        if (filterClientId) params.append('clientId', filterClientId);
        if (filterStatus) params.append('status', filterStatus);

        safeApiRequest(`/api/dashboard?${params.toString()}`)
            .then(res => res.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    };

    const clearFilters = () => {
        setFilterFrom('');
        setFilterTo('');
        setFilterClientId('');
        setFilterStatus('active');
    };

    if (isLoading && !data) {
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                        <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Panel de Análisis
                    </h2>
                    <p className="text-sm text-slate-500 font-medium hidden md:block">Resumen del estado operativo y métricas de rendimiento</p>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('proyectos')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                        activeTab === 'proyectos'
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Proyectos
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('servicios')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                        activeTab === 'servicios'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Star className="w-4 h-4" />
                        Servicios
                    </span>
                </button>
            </div>

            {activeTab === 'servicios' && <ServiciosTab clients={clients} />}
            {activeTab === 'proyectos' && <>

            {/* Advanced Filters (Requirement 2) */}
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm space-y-3 md:space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        Filtros de Análisis
                    </h3>
                    {(filterFrom || filterTo || filterClientId || filterStatus !== 'active') && (
                        <button onClick={clearFilters} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                            Limpiar Filtros
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Desde
                        </label>
                        <input
                            type="date"
                            className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none"
                            value={filterFrom}
                            onChange={e => setFilterFrom(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Hasta
                        </label>
                        <input
                            type="date"
                            className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none"
                            value={filterTo}
                            onChange={e => setFilterTo(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                        <SearchableSelect
                            label="Cliente"
                            icon={<Building2 className="w-3 h-3" />}
                            options={clients.map(c => ({ id: c.id, label: c.nombre }))}
                            value={filterClientId}
                            onChange={setFilterClientId}
                            placeholder="Todos los Clientes"
                            className="!space-y-1.5"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Estado <MetricTooltip def="Filtra proyectos por su estado de finalización." purpose="Permite comparar el rendimiento histórico con el operativo actual." calc="N/A" />
                        </label>
                        <select
                            className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none cursor-pointer"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="active">Proyectos No Finalizados</option>
                            <option value="finished">Proyectos Finalizados</option>
                            <option value="all">Ver Todos</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-fr">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* IPT Comparison Chart */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
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
                    {data.performance.projects.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin datos de proyectos</div>
                    ) : (
                        <div className="h-56 flex items-end justify-between gap-3 px-2 relative px-4">
                            <div className="absolute w-full h-[1px] bg-rose-500/20 border-t border-dashed border-rose-500 z-0 left-0" style={{ bottom: '50%' }} />

                            {data.performance.projects.map((p, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group/bar relative h-full justify-end z-10">
                                    <div className="absolute bottom-full mb-2 hidden group-hover/bar:block bg-slate-900 text-white text-[10px] py-1.5 px-3 rounded-xl whitespace-nowrap z-50 font-bold shadow-xl border border-white/10">
                                        {p.codigoProyecto && <span className="text-primary/70 mr-1">{p.codigoProyecto} |</span>} {p.nombre}: <span className="text-primary font-black ml-1">{p.ipt.toFixed(2)}</span>
                                    </div>
                                    <div
                                        className={`w-full rounded-t-xl transition-all duration-700 hover:brightness-110 shadow-sm ${p.ipt >= 1 ? 'bg-primary' : 'bg-rose-400'}`}
                                        style={{ height: `${Math.min(p.ipt * 50, 100)}%` }}
                                    />
                                    <div className="flex flex-col items-center mt-4 translate-x-1 gap-1">
                                        <span className="text-[9px] font-black text-slate-400 rotate-45 origin-left truncate max-w-[50px]">{p.codigoProyecto || p.nombre}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-visible">
                {/* Classification Donut */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center overflow-visible">
                    <div className="flex items-center justify-between w-full mb-6">
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
                    <div className="flex items-center justify-between mb-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Status Distribution */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-5">
                            <Activity className="w-5 h-5 text-primary" />
                            Estado Operativo
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            <StatusPill label="Por Hacer" count={data.statusDistribution.por_hacer} color="blue" />
                            <StatusPill label="Planificado" count={data.statusDistribution.planificado} color="violet" />
                            <StatusPill label="Activos" count={data.statusDistribution.activo} color="primary" />
                            <StatusPill label="En Riesgo" count={data.statusDistribution.en_riesgo} color="amber" />
                            <StatusPill label="Atrasados" count={data.statusDistribution.atrasado} color="rose" />
                            <StatusPill label="Finalizados" count={data.statusDistribution.finalizado} color="slate" />
                        </div>
                    </div>

                    {/* Alert List */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-5">
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                            Alertas de Consumo
                        </h3>
                        {data.criticalProjects.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">Sin proyectos críticos activos</div>
                        ) : (
                            <div className="space-y-4">
                                {data.criticalProjects.map((project, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-2 flex-wrap max-w-[70%]">
                                                <span className="font-bold text-slate-700 text-sm truncate">{project.nombre}</span>
                                                {project.codigoProyecto && <CodeBadge code={project.codigoProyecto} variant="project" size="sm" showCopy={false} />}
                                            </div>
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
                        )}
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Top Clients */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3 mb-4">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            Top Clientes
                        </h3>
                        {data.topClients.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">Sin datos</div>
                        ) : (
                            <div className="space-y-2.5">
                                {data.topClients.map((client, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all group">
                                        <span className="font-bold text-slate-600 group-hover:text-primary transition-colors text-sm truncate">{client.name}</span>
                                        <span className="px-3 py-1 bg-white border border-slate-100 text-primary text-[10px] font-black rounded-xl shadow-sm shrink-0">{client.count} Proj</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Top Operators */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3 mb-4">
                            <Users className="w-5 h-5 text-slate-400" />
                            Mayor Actividad
                        </h3>
                        {data.topOperators.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">Sin datos</div>
                        ) : (
                            <div className="space-y-2.5">
                                {data.topOperators.map((op, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/30 hover:bg-white hover:shadow-sm border border-transparent hover:border-indigo-100 transition-all group">
                                        <span className="font-bold text-slate-600 group-hover:text-indigo-600 transition-colors text-sm truncate">{op.name}</span>
                                        <span className="px-3 py-1 bg-white border border-indigo-100 text-indigo-600 text-[10px] font-black rounded-xl shadow-sm shrink-0">{op.count} Asig</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Client Delays Analysis Section (NEW) */}
            <div className="space-y-6 pt-8 border-t border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/20">
                        <Timer className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Análisis de Demoras Externas</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1 px-0.5">Responsabilidad del Cliente</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 auto-rows-fr">
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Delays by Area */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
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
            </> /* end proyectos tab */
            }
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// SERVICIOS TAB
// ═══════════════════════════════════════════════════════

interface MetricasServicio {
    total: number;
    nps: {
        score: number | null;
        promotores: number;
        pasivos: number;
        detractores: number;
        pctPromo: number;
        pctDetrac: number;
        pctPasivos: number;
    };
    promedios: { atencion: number | null; calidad: number | null; tiempo: number | null };
    porMes: { label: string; atencion: number; calidad: number; tiempo: number; nps: number; count: number }[];
    porOperador: { id: string; nombre: string; atencion: number | null; calidad: number | null; tiempo: number | null; nps: number | null; count: number }[];
}

function ServiciosTab({ clients }: { clients: { id: string; nombre: string }[] }) {
    const [metricas, setMetricas] = useState<MetricasServicio | null>(null);
    const [loading, setLoading] = useState(true);
    const [operators, setOperators] = useState<{ id: string; nombreCompleto: string }[]>([]);
    const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);

    // Filters
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [filterClientId, setFilterClientId] = useState('');
    const [filterProyectoId, setFilterProyectoId] = useState('');
    const [filterOperadorId, setFilterOperadorId] = useState('');

    useEffect(() => {
        safeApiRequest('/api/operators').then(r => r.json()).then(setOperators).catch(console.error);
        safeApiRequest('/api/projects').then(r => r.json()).then(d => setProyectos(Array.isArray(d) ? d : d.projects || [])).catch(console.error);
    }, []);

    useEffect(() => { loadMetricas(); }, [filterFrom, filterTo, filterClientId, filterProyectoId, filterOperadorId]);

    const loadMetricas = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterFrom) params.append('from', filterFrom);
        if (filterTo) params.append('to', filterTo);
        if (filterClientId) params.append('clientId', filterClientId);
        if (filterProyectoId) params.append('proyectoId', filterProyectoId);
        if (filterOperadorId) params.append('operadorId', filterOperadorId);
        safeApiRequest(`/api/metricas-servicio?${params.toString()}`)
            .then(r => r.json())
            .then(setMetricas)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const clearFilters = () => { setFilterFrom(''); setFilterTo(''); setFilterClientId(''); setFilterProyectoId(''); setFilterOperadorId(''); };
    const hasFilters = filterFrom || filterTo || filterClientId || filterProyectoId || filterOperadorId;

    const TARGET_CSAT = 8;
    const TARGET_NPS = 50;

    if (loading) return (
        <div className="w-full h-64 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
    );

    const m = metricas;
    const npsScore = m?.nps.score;
    const npsColor = npsScore === null ? 'text-slate-400' : npsScore >= TARGET_NPS ? 'text-emerald-600' : npsScore >= 0 ? 'text-amber-500' : 'text-rose-500';

    // Donut helpers
    const total3 = (m?.nps.promotores ?? 0) + (m?.nps.pasivos ?? 0) + (m?.nps.detractores ?? 0);
    const promoPct = total3 > 0 ? (m!.nps.promotores / total3) * 100 : 33;
    const pasivoPct = total3 > 0 ? (m!.nps.pasivos / total3) * 100 : 33;
    const detracPct = total3 > 0 ? (m!.nps.detractores / total3) * 100 : 34;

    // SVG donut: circumference = 2π×16 ≈ 100.5
    const C = 100.53;
    const promoArc = (promoPct / 100) * C;
    const pasivoArc = (pasivoPct / 100) * C;
    const detracArc = (detracPct / 100) * C;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400">
            {/* Section header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                    <Star className="w-7 h-7" fill="white" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Métricas de Servicios</h3>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-0.5">Satisfacción del cliente · NPS · Desempeño por operador</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                        Filtros de Servicio
                    </h4>
                    {hasFilters && (
                        <button onClick={clearFilters} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline">
                            Limpiar Filtros
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Desde</label>
                        <input type="date" className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 outline-none appearance-none" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Hasta</label>
                        <input type="date" className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 outline-none appearance-none" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                        <SearchableSelect
                            label="Cliente"
                            icon={<Building2 className="w-3 h-3" />}
                            options={clients.map(c => ({ id: c.id, label: c.nombre }))}
                            value={filterClientId}
                            onChange={setFilterClientId}
                            placeholder="Todos los clientes"
                            className="!space-y-1.5"
                        />
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                        <SearchableSelect
                            label="Proyecto"
                            icon={<Briefcase className="w-3 h-3" />}
                            options={proyectos.map(p => ({ id: p.id, label: p.nombre }))}
                            value={filterProyectoId}
                            onChange={setFilterProyectoId}
                            placeholder="Todos los proyectos"
                            className="!space-y-1.5"
                        />
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                        <SearchableSelect
                            label="Operador"
                            icon={<Users className="w-3 h-3" />}
                            options={operators.map(o => ({ id: o.id, label: o.nombreCompleto }))}
                            value={filterOperadorId}
                            onChange={setFilterOperadorId}
                            placeholder="Todos los operadores"
                            className="!space-y-1.5"
                        />
                    </div>
                </div>
            </div>

            {/* No data state */}
            {m?.total === 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center space-y-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                        <Star className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-bold text-slate-500">Aún no hay encuestas de satisfacción</p>
                    <p className="text-xs text-slate-400 font-medium">Las métricas aparecerán aquí una vez que los clientes completen la encuesta post-firma.</p>
                </div>
            )}

            {m && m.total > 0 && (
                <>
                    {/* KPI Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {/* NPS Score */}
                        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group col-span-2 md:col-span-1 flex flex-col">
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div className="group/tooltip relative">
                                    <Info className="w-4 h-4 text-slate-300 hover:text-indigo-500 cursor-help" />
                                    <div className="absolute top-0 right-full mr-3 w-56 p-3 bg-slate-900 text-white rounded-xl text-[10px] leading-relaxed hidden group-hover/tooltip:block z-50 shadow-2xl">
                                        <p className="font-black text-indigo-400 mb-1">NPS Global</p>
                                        <p className="text-slate-300">% Promotores (9-10) − % Detractores (0-6). Objetivo: &gt; {TARGET_NPS}</p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NPS Global</p>
                            <h4 className={`text-3xl font-black tracking-tighter ${npsColor}`}>
                                {npsScore !== null ? (npsScore >= 0 ? `+${npsScore}` : npsScore) : '—'}
                            </h4>
                            <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${npsScore !== null && npsScore >= TARGET_NPS ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Objetivo: &gt;{TARGET_NPS}</p>
                            </div>
                        </div>

                        {/* Atención promedio */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                            <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-lg w-fit mb-3 group-hover:scale-110 transition-transform">
                                <Users className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Atención</p>
                            <h4 className={`text-3xl font-black tracking-tighter ${(m.promedios.atencion ?? 0) >= TARGET_CSAT ? 'text-emerald-600' : 'text-amber-500'}`}>
                                {m.promedios.atencion ?? '—'}
                            </h4>
                            <div className="mt-auto pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Objetivo: {TARGET_CSAT}+</div>
                        </div>

                        {/* Calidad promedio */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                            <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-lg w-fit mb-3 group-hover:scale-110 transition-transform">
                                <Award className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Calidad</p>
                            <h4 className={`text-3xl font-black tracking-tighter ${(m.promedios.calidad ?? 0) >= TARGET_CSAT ? 'text-emerald-600' : 'text-amber-500'}`}>
                                {m.promedios.calidad ?? '—'}
                            </h4>
                            <div className="mt-auto pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Objetivo: {TARGET_CSAT}+</div>
                        </div>

                        {/* Tiempo promedio */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-lg w-fit mb-3 group-hover:scale-110 transition-transform">
                                <Clock className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tiempo</p>
                            <h4 className={`text-3xl font-black tracking-tighter ${(m.promedios.tiempo ?? 0) >= TARGET_CSAT ? 'text-emerald-600' : 'text-amber-500'}`}>
                                {m.promedios.tiempo ?? '—'}
                            </h4>
                            <div className="mt-auto pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Objetivo: {TARGET_CSAT}+</div>
                        </div>
                    </div>

                    {/* Charts row: NPS Donut + Trend */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* NPS Donut */}
                        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center">
                            <div className="flex items-center justify-between w-full mb-4">
                                <div className="flex items-center gap-3">
                                    <PieChart className="w-5 h-5 text-indigo-500" />
                                    <h3 className="text-xl font-bold text-slate-800">Distribución NPS</h3>
                                </div>
                            </div>

                            <div className="relative w-44 h-44 my-4">
                                <svg className="w-full h-full -rotate-90" viewBox="-4 -4 40 40">
                                    <circle r="16" cx="16" cy="16" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                                    {/* Detractores (rose) */}
                                    <circle r="16" cx="16" cy="16" fill="transparent" stroke="#f43f5e" strokeWidth="6"
                                        strokeDasharray={`${detracArc} ${C}`}
                                        strokeDashoffset={0}
                                        strokeLinecap="round"
                                    />
                                    {/* Pasivos (amber) */}
                                    <circle r="16" cx="16" cy="16" fill="transparent" stroke="#f59e0b" strokeWidth="6"
                                        strokeDasharray={`${pasivoArc} ${C}`}
                                        strokeDashoffset={`${-detracArc}`}
                                        strokeLinecap="round"
                                    />
                                    {/* Promotores (emerald) */}
                                    <circle r="16" cx="16" cy="16" fill="transparent" stroke="#10b981" strokeWidth="6"
                                        strokeDasharray={`${promoArc} ${C}`}
                                        strokeDashoffset={`${-(detracArc + pasivoArc)}`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-3xl font-black tracking-tighter ${npsColor}`}>
                                        {npsScore !== null ? (npsScore >= 0 ? `+${npsScore}` : npsScore) : '—'}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">NPS</span>
                                </div>
                            </div>

                            <div className="w-full space-y-2.5 mt-2">
                                <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Promotores (9-10)</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-emerald-700">{m.nps.promotores}</span>
                                        <span className="text-[10px] text-emerald-500 ml-1">{m.nps.pctPromo}%</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-amber-400" />
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Pasivos (7-8)</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-amber-700">{m.nps.pasivos}</span>
                                        <span className="text-[10px] text-amber-500 ml-1">{m.nps.pctPasivos}%</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between px-4 py-3 bg-rose-50 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-rose-500" />
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Detractores (0-6)</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-rose-700">{m.nps.detractores}</span>
                                        <span className="text-[10px] text-rose-500 ml-1">{m.nps.pctDetrac}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Promedios de servicio (bar chart with target line) */}
                        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <BarChart3 className="w-5 h-5 text-indigo-500" />
                                <h3 className="text-xl font-bold text-slate-800">Promedios de Servicio</h3>
                            </div>
                            <div className="space-y-5 relative">
                                {/* Target line annotation */}
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-0 border-t-2 border-dashed border-slate-300" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objetivo: {TARGET_CSAT}/10</span>
                                </div>
                                {[
                                    { label: 'Atención', value: m.promedios.atencion, color: 'bg-blue-500', shadow: 'shadow-blue-200' },
                                    { label: 'Calidad', value: m.promedios.calidad, color: 'bg-emerald-500', shadow: 'shadow-emerald-200' },
                                    { label: 'Tiempo', value: m.promedios.tiempo, color: 'bg-amber-500', shadow: 'shadow-amber-200' },
                                ].map(({ label, value, color, shadow }) => {
                                    const pct = value !== null ? (value / 10) * 100 : 0;
                                    const targetPct = (TARGET_CSAT / 10) * 100;
                                    const isAboveTarget = value !== null && value >= TARGET_CSAT;
                                    return (
                                        <div key={label} className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-slate-500">{label}</span>
                                                <span className={isAboveTarget ? 'text-emerald-600' : 'text-amber-500'}>
                                                    {value ?? '—'}/10
                                                </span>
                                            </div>
                                            <div className="h-5 bg-slate-50 rounded-xl relative overflow-hidden border border-slate-100">
                                                {/* Progress bar */}
                                                <div
                                                    className={`h-full rounded-xl transition-all duration-1000 ${color} ${shadow} shadow-sm`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                                {/* Target line */}
                                                <div
                                                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400/60 border-l border-dashed border-slate-400 z-10"
                                                    style={{ left: `${targetPct}%` }}
                                                    title={`Objetivo: ${TARGET_CSAT}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* NPS trend + service averages over time */}
                    {m.porMes.length >= 2 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* NPS trend */}
                            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                                    <h3 className="text-xl font-bold text-slate-800">Evolución del NPS</h3>
                                </div>
                                <ServiceTrendChart
                                    data={m.porMes.map(p => ({ label: p.label, value: p.nps }))}
                                    color="#6366f1"
                                    targetY={TARGET_NPS}
                                    minY={-100}
                                    maxY={100}
                                    valueSuffix=""
                                    targetLabel={`Objetivo NPS > ${TARGET_NPS}`}
                                />
                            </div>
                            {/* CSAT trend */}
                            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                    <h3 className="text-xl font-bold text-slate-800">Satisfacción en el Tiempo</h3>
                                </div>
                                <ServiceMultiTrendChart data={m.porMes} targetCsat={TARGET_CSAT} />
                            </div>
                        </div>
                    )}

                    {/* Metrics per operator */}
                    {m.porOperador.length > 0 && (
                        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <Users className="w-5 h-5 text-indigo-500" />
                                <h3 className="text-xl font-bold text-slate-800">Métricas por Operador</h3>
                                <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                    {m.total} encuesta{m.total !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Atención</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Calidad</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiempo</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">NPS</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Encuestas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {m.porOperador.map(op => {
                                            const ratingColor = (v: number | null) => {
                                                if (v === null) return 'text-slate-400';
                                                if (v >= TARGET_CSAT) return 'text-emerald-700 font-black';
                                                if (v >= 6) return 'text-amber-600 font-black';
                                                return 'text-rose-600 font-black';
                                            };
                                            const npsOpColor = (v: number | null) => {
                                                if (v === null) return 'text-slate-400';
                                                if (v >= TARGET_NPS) return 'text-emerald-700 font-black';
                                                if (v >= 0) return 'text-amber-600 font-black';
                                                return 'text-rose-600 font-black';
                                            };
                                            const barWidth = (v: number | null, max = 10) =>
                                                v !== null ? `${(v / max) * 100}%` : '0%';
                                            return (
                                                <tr key={op.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                                                                {op.nombre.charAt(0)}
                                                            </div>
                                                            <span className="font-bold text-slate-700">{op.nombre}</span>
                                                        </div>
                                                    </td>
                                                    {[
                                                        { val: op.atencion, color: '#3b82f6' },
                                                        { val: op.calidad, color: '#10b981' },
                                                        { val: op.tiempo, color: '#f59e0b' },
                                                    ].map(({ val, color }, idx) => (
                                                        <td key={idx} className="px-4 py-4">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <span className={`text-base ${ratingColor(val)}`}>{val ?? '—'}</span>
                                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full rounded-full transition-all duration-700"
                                                                        style={{ width: barWidth(val), backgroundColor: color }} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`text-base ${npsOpColor(op.nps)}`}>
                                                            {op.nps !== null ? (op.nps >= 0 ? `+${op.nps}` : op.nps) : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg border border-indigo-100">{op.count}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Service trend chart (single line + target line) ──────────────────────────
function ServiceTrendChart({ data, color, targetY, minY, maxY, valueSuffix = '', targetLabel }: {
    data: { label: string; value: number }[];
    color: string;
    targetY: number;
    minY: number;
    maxY: number;
    valueSuffix?: string;
    targetLabel?: string;
}) {
    const [hovered, setHovered] = useState<number | null>(null);
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin datos</div>;

    const range = maxY - minY;
    const yOf = (v: number) => 100 - ((v - minY) / range) * 85;
    const targetYPct = yOf(targetY);

    const points = data.map((d, i) => ({
        x: (i / Math.max(data.length - 1, 1)) * 100,
        y: yOf(d.value),
    }));

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const dx = (points[i + 1].x - points[i].x) / 3;
        linePath += ` C ${points[i].x + dx} ${points[i].y}, ${points[i + 1].x - dx} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    const areaPath = `${linePath} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;

    return (
        <div className="h-48 relative" onMouseLeave={() => setHovered(null)}>
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Target line */}
                <line x1="0" y1={targetYPct} x2="100" y2={targetYPct}
                    stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2 2" />
                <text x="1" y={targetYPct - 1.5} fill="#94a3b8" fontSize="3.5" fontWeight="bold" fontFamily="sans-serif">
                    {targetLabel || `Objetivo: ${targetY}`}
                </text>
                {/* Area */}
                <path d={areaPath} fill={color} fillOpacity="0.06" />
                {/* Line */}
                <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
                {/* Interaction zones */}
                {points.map((p, i) => (
                    <rect key={i} x={p.x - 5} y={0} width={10} height={100} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHovered(i)} />
                ))}
            </svg>
            {hovered !== null && points[hovered] && (
                <div className="absolute w-2.5 h-2.5 rounded-full border-2 bg-white pointer-events-none"
                    style={{ borderColor: color, left: `${points[hovered].x}%`, top: `${points[hovered].y}%`, transform: 'translate(-50%,-50%)' }}>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
                        {data[hovered].label}: {data[hovered].value >= 0 ? '+' : ''}{data[hovered].value}{valueSuffix}
                    </div>
                </div>
            )}
            <div className="absolute inset-x-0 bottom-[-1.5rem] flex justify-between px-2">
                {data.map((t, i) => (
                    <span key={i} className={`text-[9px] font-black uppercase tracking-tighter ${hovered === i ? 'text-slate-900' : 'text-slate-400'}`}>
                        {t.label.split('-')[1] || t.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Multi-line trend chart for CSAT ──────────────────────────────────────────
function ServiceMultiTrendChart({ data, targetCsat }: {
    data: { label: string; atencion: number; calidad: number; tiempo: number }[];
    targetCsat: number;
}) {
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin datos</div>;

    const yOf = (v: number) => 100 - (v / 10) * 85;
    const targetYPct = yOf(targetCsat);

    const buildPath = (values: number[]) => {
        const pts = values.map((v, i) => ({ x: (i / Math.max(values.length - 1, 1)) * 100, y: yOf(v) }));
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const dx = (pts[i + 1].x - pts[i].x) / 3;
            d += ` C ${pts[i].x + dx} ${pts[i].y}, ${pts[i + 1].x - dx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
        }
        return d;
    };

    const atencionPath = buildPath(data.map(d => d.atencion));
    const calidadPath = buildPath(data.map(d => d.calidad));
    const tiempoPth = buildPath(data.map(d => d.tiempo));

    return (
        <div className="space-y-3">
            <div className="h-40 relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Target line */}
                    <line x1="0" y1={targetYPct} x2="100" y2={targetYPct}
                        stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2 2" />
                    <text x="1" y={targetYPct - 1.5} fill="#94a3b8" fontSize="3.5" fontWeight="bold" fontFamily="sans-serif">
                        Objetivo {targetCsat}
                    </text>
                    <path d={atencionPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                    <path d={calidadPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                    <path d={tiempoPth} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-x-0 bottom-[-1.5rem] flex justify-between px-2">
                    {data.map((d, i) => (
                        <span key={i} className="text-[9px] font-black uppercase tracking-tighter text-slate-400">{d.label.split('-')[1] || d.label}</span>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-4 justify-center mt-4 pt-2">
                {[
                    { label: 'Atención', color: '#3b82f6' },
                    { label: 'Calidad', color: '#10b981' },
                    { label: 'Tiempo', color: '#f59e0b' },
                ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-[10px] font-bold text-slate-500">{l.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
function KpiCard({ title, value, icon, color, trend, tooltip }: { title: string; value: string | number; icon: any; color: string; trend: string; tooltip?: { def: string; purpose: string; calc: string } }) {
    return (
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group relative flex flex-col h-full">
            <div className="flex justify-between items-start mb-3 md:mb-4">
                <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                {tooltip && <MetricTooltip {...tooltip} />}
                {!tooltip && (
                    <div className="px-2 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                        KPI Global
                    </div>
                )}
            </div>
            <div className="space-y-0.5 md:space-y-1 flex-1">
                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest px-0.5 md:px-1 line-clamp-2">{title}</p>
                <h4 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">{value}</h4>
            </div>
            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-50 flex items-center gap-1.5">
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
            <div className="absolute top-0 right-full mr-3 w-64 p-4 bg-slate-900 text-white rounded-2xl text-[10px] leading-relaxed hidden group-hover/tooltip:block z-[9999] shadow-2xl animate-in fade-in slide-in-from-right-2 duration-200">
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
