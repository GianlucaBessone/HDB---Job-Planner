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
import OperadoresTab from './OperadoresTab';
import { TrendChart, BasicBarChart, DonutChart, DivergentBarChart, TargetBarChart, MultiTrendChart } from './EChartsComponents';

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
    const [activeTab, setActiveTab] = useState<'proyectos' | 'servicios' | 'operadores'>('proyectos');

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
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Panel de Análisis
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">Resumen del estado operativo y métricas de rendimiento</p>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('proyectos')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                        activeTab === 'proyectos'
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
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
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Star className="w-4 h-4" />
                        Servicios
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('operadores')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                        activeTab === 'operadores'
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-200'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Operadores
                    </span>
                </button>
            </div>

            {activeTab === 'servicios' && <ServiciosTab clients={clients} />}
            {activeTab === 'operadores' && <OperadoresTab />}
            {activeTab === 'proyectos' && <>

            {/* Advanced Filters (Requirement 2) */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl md:rounded-[2rem] p-3 md:p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
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
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Desde
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 md:h-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-3 text-[13px] font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none"
                            value={filterFrom}
                            onChange={e => setFilterFrom(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Hasta
                        </label>
                        <input
                            type="date"
                            className="w-full h-11 md:h-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-3 text-[13px] font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none"
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
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Estado <MetricTooltip def="Filtra proyectos por su estado de finalización." purpose="Permite comparar el rendimiento histórico con el operativo actual." calc="N/A" />
                        </label>
                        <select
                            className="w-full h-11 md:h-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-3 text-[13px] font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none cursor-pointer"
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-fr relative z-20">
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
                <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative group overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">IPT por Proyecto</h3>
                        </div>
                        <MetricTooltip
                            def="Muestra la eficiencia individual de cada proyecto."
                            purpose="Permite identificar qué proyectos están performando por encima o debajo de la media."
                            calc="La línea roja indica el punto neutro (IPT = 1.0)."
                        />
                    </div>
                    {data.performance.projects.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sin datos de proyectos</div>
                    ) : (
                        <div className="mt-4">
                            <BasicBarChart 
                                data={data.performance.projects.map(p => ({ name: p.nombre, value: p.ipt, code: p.codigoProyecto, isHighlight: p.ipt >= 1 }))} 
                                height={224} 
                            />
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tendencia de Performance</h3>
                        </div>
                        <MetricTooltip
                            def="Evolución del IPT promedio en el tiempo."
                            purpose="Detectar si la eficiencia operativa está mejorando o deteriorándose mes a mes."
                            calc="Promedio de IPT de todos los proyectos por mes (últimos 6 meses)."
                        />
                    </div>
                    {data.performance.trend.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sin datos históricos</div>
                    ) : (
                        <TrendChart 
                            data={data.performance.trend.map(t => ({ label: t.label, value: t.ipt }))} 
                            color="#3b82f6" 
                            height={224} 
                        />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-visible">
                {/* Classification Donut */}
                <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center overflow-visible">
                    <div className="flex items-center justify-between w-full mb-6">
                        <div className="flex items-center gap-3">
                            <PieChart className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Clasificación</h3>
                        </div>
                        <MetricTooltip
                            def="Segmentación de proyectos por su nivel de eficiencia."
                            purpose="Evaluar rápidamente el balance de la operación."
                            calc="Eficiente (IPT > 1.05), Exacto (0.95-1.05), Desvío (< 0.95)."
                        />
                    </div>

                    <div className="w-full h-48 mb-4 mt-2">
                        <DonutChart 
                            data={[
                                { name: 'Eficientes', value: data.performance.classification.eficiente },
                                { name: 'Exactos', value: data.performance.classification.exacto },
                                { name: 'Con Desvío', value: data.performance.classification.desvio }
                            ]}
                            colors={['#10b981', '#3b82f6', '#f43f5e']}
                            centerText={data.performance.classification.eficiente}
                            centerSubtext="Eficientes"
                            height={192}
                        />
                    </div>

                    <div className="w-full space-y-2 mt-auto">
                        <LegendItem label="Eficientes" count={data.performance.classification.eficiente} color="bg-emerald-500" />
                        <LegendItem label="Exactos" count={data.performance.classification.exacto} color="bg-primary" />
                        <LegendItem label="Con Desvío" count={data.performance.classification.desvio} color="bg-rose-500" />
                    </div>
                </div>

                {/* Savings Deviation (Bar Divergent) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Briefcase className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Balance de Horas por Proyecto</h3>
                        </div>
                        <MetricTooltip
                            def="Muestra el desvío absoluto en horas."
                            purpose="Determinar el impacto financiero (ahorro de costos vs sobrecostos)."
                            calc="Horas Estimadas - Horas Consumidas. Positivo = Ahorro, Negativo = Desvío."
                        />
                    </div>
                    <div className="mt-4">
                        <DivergentBarChart 
                            data={data.performance.projects.slice(0, 6).map(p => ({ name: p.nombre, value: p.savings }))} 
                            height={280} 
                        />
                    </div>
                </div>
            </div>

            {/* Operational Foundations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Status Distribution */}
                    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5">
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
                    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5">
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                            Alertas de Consumo
                        </h3>
                        {data.criticalProjects.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">Sin proyectos críticos activos</div>
                        ) : (
                            <div className="space-y-4">
                                {data.criticalProjects.map((project, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-2 flex-wrap max-w-[70%]">
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{project.nombre}</span>
                                                {project.codigoProyecto && <CodeBadge code={project.codigoProyecto} variant="project" size="sm" showCopy={false} />}
                                            </div>
                                            <span className={`text-xs font-black px-2 py-1 rounded-lg ${project.percentage > 100 ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600'}`}>
                                                {Math.round(project.percentage)}%
                                            </span>
                                        </div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden border border-slate-50">
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
                    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4">
                            <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                            Top Clientes
                        </h3>
                        {data.topClients.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">Sin datos</div>
                        ) : (
                            <div className="space-y-2.5">
                                {data.topClients.map((client, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-slate-100 transition-all group">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors text-sm truncate">{client.name}</span>
                                        <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-primary text-[10px] font-black rounded-xl shadow-sm shrink-0">{client.count} Proj</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Top Operators */}
                    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-4">
                            <Users className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                            Mayor Actividad
                        </h3>
                        {data.topOperators.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">Sin datos</div>
                        ) : (
                            <div className="space-y-2.5">
                                {data.topOperators.map((op, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/30 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-indigo-100 transition-all group">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 transition-colors text-sm truncate">{op.name}</span>
                                        <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-indigo-100 text-indigo-600 text-[10px] font-black rounded-xl shadow-sm shrink-0">{op.count} Asig</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Client Delays Analysis Section (NEW) */}
            <div className="space-y-6 pt-8 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/20">
                        <Timer className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">Análisis de Demoras Externas</h3>
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 px-0.5">Responsabilidad del Cliente</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 auto-rows-fr relative z-20">
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
                    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative group overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-amber-500" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Demoras por Área del Cliente</h3>
                            </div>
                            <MetricTooltip
                                def="Distribución de horas perdidas según el departamento responsable del cliente."
                                purpose="Identificar qué áreas del cliente son los cuellos de botella más críticos."
                                calc="Horas totales acumuladas por cada etiqueta de área."
                            />
                        </div>
                        <div className="mt-4">
                            {data.delays.topAreas.length === 0 ? (
                                <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sin datos de áreas</div>
                            ) : (
                                <BasicBarChart 
                                    data={data.delays.topAreas.slice(0, 5).map(area => ({ name: area.name, value: area.hours }))} 
                                    height={224} 
                                    isHorizontal={true}
                                    colors={['#f59e0b', '#f59e0b']}
                                    valueSuffix="h"
                                />
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="w-5 h-5 text-amber-500" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Evolución de Demoras</h3>
                            </div>
                            <MetricTooltip
                                def="Muestra si las demoras del cliente están aumentando o disminuyendo mensualmente."
                                purpose="Validar si las gestiones para reducir tiempos muertos externos están siendo efectivas."
                                calc="Suma de horas de demora agrupadas por mes."
                            />
                        </div>
                        {data.delays.trend.length === 0 ? (
                            <div className="h-56 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sin datos históricos</div>
                        ) : (
                            <TrendChart 
                                data={data.delays.trend.map(t => ({ label: t.label, value: t.hours }))} 
                                color="#f59e0b" 
                                height={224} 
                                valueSuffix="h"
                            />
                        )}
                    </div>
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
    const npsColor = npsScore === null ? 'text-slate-400 dark:text-slate-500' : npsScore >= TARGET_NPS ? 'text-emerald-600' : npsScore >= 0 ? 'text-amber-500' : 'text-rose-500';

    // Donut helpers
    const total3 = (m?.nps.promotores ?? 0) + (m?.nps.pasivos ?? 0) + (m?.nps.detractores ?? 0);
    const promoPct = total3 > 0 ? ((m?.nps.promotores || 0) / total3) * 100 : 33;
    const pasivoPct = total3 > 0 ? ((m?.nps.pasivos || 0) / total3) * 100 : 33;
    const detracPct = total3 > 0 ? ((m?.nps.detractores || 0) / total3) * 100 : 34;

    // SVG donut: circumference = 2 * pi * 16 approx 100.5
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
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Métricas de Servicios</h3>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Satisfacción del cliente · NPS · Desempeño por operador</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl md:rounded-[2rem] p-3 md:p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
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
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Desde</label>
                        <input type="date" className="w-full h-11 md:h-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-3 text-[13px] font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none appearance-none" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Hasta</label>
                        <input type="date" className="w-full h-11 md:h-9 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-3 text-[13px] font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-indigo-100 outline-none appearance-none" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
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
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-16 text-center space-y-3">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto">
                        <Star className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-bold text-slate-500 dark:text-slate-400">Aún no hay encuestas de satisfacción</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Las métricas aparecerán aquí una vez que los clientes completen la encuesta post-firma.</p>
                </div>
            )}

            {m && m.total > 0 && (
                <>
                    {/* KPI Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-fr relative z-20">
                        <KpiCard
                            title="NPS Global"
                            value={npsScore !== null ? (npsScore >= 0 ? `+${npsScore}` : npsScore) : '—'}
                            icon={<TrendingUp className="w-5 h-5" />}
                            color={npsScore !== null ? (npsScore >= TARGET_NPS ? 'bg-emerald-500' : npsScore >= 0 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-slate-500'}
                            trend={`Objetivo: >${TARGET_NPS}`}
                            tooltip={{
                                def: "Net Promoter Score Global.",
                                purpose: "Mide la lealtad y probabilidad de recomendación.",
                                calc: "% Promotores (9-10) − % Detractores (0-6)"
                            }}
                        />
                        <KpiCard
                            title="Atención"
                            value={m.promedios.atencion ?? '—'}
                            icon={<Users className="w-5 h-5" />}
                            color={(m.promedios.atencion ?? 0) >= TARGET_CSAT ? 'bg-emerald-500' : 'bg-amber-500'}
                            trend={`Objetivo: >${TARGET_CSAT}`}
                        />
                        <KpiCard
                            title="Calidad"
                            value={m.promedios.calidad ?? '—'}
                            icon={<Award className="w-5 h-5" />}
                            color={(m.promedios.calidad ?? 0) >= TARGET_CSAT ? 'bg-emerald-500' : 'bg-amber-500'}
                            trend={`Objetivo: >${TARGET_CSAT}`}
                        />
                        <KpiCard
                            title="Tiempo"
                            value={m.promedios.tiempo ?? '—'}
                            icon={<Clock className="w-5 h-5" />}
                            color={(m.promedios.tiempo ?? 0) >= TARGET_CSAT ? 'bg-emerald-500' : 'bg-amber-500'}
                            trend={`Objetivo: >${TARGET_CSAT}`}
                        />
                    </div>

                    {/* Charts row: NPS Donut + Trend */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* NPS Donut */}
                        <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center">
                            <div className="flex items-center justify-between w-full mb-4">
                                <div className="flex items-center gap-3">
                                    <PieChart className="w-5 h-5 text-indigo-500" />
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Distribución NPS</h3>
                                </div>
                            </div>

                            <div className="w-full h-48 my-2">
                                <DonutChart 
                                    data={[
                                        { name: 'Promotores', value: m.nps.promotores },
                                        { name: 'Pasivos', value: m.nps.pasivos },
                                        { name: 'Detractores', value: m.nps.detractores }
                                    ]}
                                    colors={['#10b981', '#f59e0b', '#f43f5e']}
                                    centerText={npsScore !== null ? (npsScore >= 0 ? `+${npsScore}` : npsScore) : '—'}
                                    centerSubtext="NPS Global"
                                    height={192}
                                />
                            </div>

                            <div className="w-full space-y-2 mt-auto">
                                <LegendItem label={`Promotores (${m.nps.pctPromo}%)`} count={m.nps.promotores} color="bg-emerald-500" />
                                <LegendItem label={`Pasivos (${m.nps.pctPasivos}%)`} count={m.nps.pasivos} color="bg-amber-400" />
                                <LegendItem label={`Detractores (${m.nps.pctDetrac}%)`} count={m.nps.detractores} color="bg-rose-500" />
                            </div>
                        </div>

                        {/* Promedios de servicio (bar chart with target line) */}
                        <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <BarChart3 className="w-5 h-5 text-indigo-500" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Promedios de Servicio</h3>
                            </div>
                            <div className="mt-4">
                                <TargetBarChart 
                                    data={[
                                        { name: 'Atención', value: m.promedios.atencion ?? 0 },
                                        { name: 'Calidad', value: m.promedios.calidad ?? 0 },
                                        { name: 'Tiempo', value: m.promedios.tiempo ?? 0 },
                                    ]}
                                    target={TARGET_CSAT}
                                    height={200}
                                />
                            </div>
                        </div>
                    </div>

                    {/* NPS trend + service averages over time */}
                    {m.porMes.length >= 2 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* NPS trend */}
                            <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Evolución del NPS</h3>
                                </div>
                                <TrendChart 
                                    data={m.porMes.map(p => ({ label: p.label, value: p.nps }))} 
                                    color="#6366f1" 
                                    height={224} 
                                />
                            </div>
                            {/* CSAT trend */}
                            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Evolución de CSAT</h3>
                                </div>
                                <div className="mt-4">
                                    <MultiTrendChart data={m.porMes} target={TARGET_CSAT} height={224} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Metrics per operator */}
                    {m.porOperador.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <Users className="w-5 h-5 text-indigo-500" />
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Métricas por Operador</h3>
                                <span className="ml-auto text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                    {m.total} encuesta{m.total !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operador</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Atención</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Calidad</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tiempo</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">NPS</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Encuestas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {m.porOperador.map(op => {
                                            const ratingColor = (v: number | null) => {
                                                if (v === null) return 'text-slate-400 dark:text-slate-500';
                                                if (v >= TARGET_CSAT) return 'text-emerald-700 font-black';
                                                if (v >= 6) return 'text-amber-600 font-black';
                                                return 'text-rose-600 font-black';
                                            };
                                            const npsOpColor = (v: number | null) => {
                                                if (v === null) return 'text-slate-400 dark:text-slate-500';
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
                                                            <span className="font-bold text-slate-700 dark:text-slate-200">{op.nombre}</span>
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
                                                                <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
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
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">Sin datos</div>;

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
                <div className="absolute w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-800 pointer-events-none"
                    style={{ borderColor: color, left: `${points[hovered].x}%`, top: `${points[hovered].y}%`, transform: 'translate(-50%,-50%)' }}>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
                        {data[hovered].label}: {data[hovered].value >= 0 ? '+' : ''}{data[hovered].value}{valueSuffix}
                    </div>
                </div>
            )}
            <div className="absolute inset-x-0 bottom-[-1.5rem] flex justify-between px-2">
                {data.map((t, i) => (
                    <span key={i} className={`text-[9px] font-black uppercase tracking-tighter ${hovered === i ? 'text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'}`}>
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
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">Sin datos</div>;

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
                        <span key={i} className="text-[9px] font-black uppercase tracking-tighter text-slate-400 dark:text-slate-500">{d.label.split('-')[1] || d.label}</span>
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
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{l.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
function KpiCard({ title, value, icon, color, trend, tooltip }: { title: string; value: string | number; icon: any; color: string; trend: string; tooltip?: { def: string; purpose: string; calc: string } }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-2.5 md:p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between h-[64px] md:h-[72px] gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0 ${color} text-white shadow-sm`}>
                    {/* El ícono ya viene como prop, aseguramos que encaje */}
                    <div className="[&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-5 md:[&>svg]:h-5">
                        {icon}
                    </div>
                </div>
                <div className="flex flex-col justify-center min-w-0 py-0.5">
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest line-clamp-1">{title}</p>
                    <h4 className="text-lg md:text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter truncate leading-none mt-0.5">{value}</h4>
                </div>
            </div>
            
            <div className="flex flex-col items-end justify-between shrink-0 h-full py-0.5">
                {tooltip ? <MetricTooltip {...tooltip} /> : <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900/50 rounded-md">KPI</div>}
                <div className="flex items-center gap-1.5 mt-auto">
                    <div className={`w-1.5 h-1.5 rounded-full ${color.replace('bg-', 'bg-').replace('500', '400')} animate-pulse`} />
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase max-w-[60px] lg:max-w-[80px] truncate" title={trend}>{trend}</p>
                </div>
            </div>
        </div>
    );
}

function MetricTooltip({ def, purpose, calc }: { def: string; purpose: string; calc: string }) {
    return (
        <div className="group/tooltip relative">
            <Info className="w-5 h-5 text-slate-300 hover:text-primary transition-colors cursor-pointer" />
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
                        <p className="font-mono text-[9px] text-slate-400 dark:text-slate-500">{calc}</p>
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
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl group hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all border border-transparent hover:border-slate-100">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{count}</span>
        </div>
    );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
    const colors: Record<string, string> = {
        primary: 'bg-primary/10 text-primary border-primary/20',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        rose: 'bg-rose-50 text-rose-500 border-rose-100',
        slate: 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
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

