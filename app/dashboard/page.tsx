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
    Building2
} from 'lucide-react';

interface DashboardData {
    kpis: {
        totalProjects: number;
        activeProjects: number;
        activeOperatorsCount: number;
        overallEfficiency: number;
    };
    statusDistribution: {
        activo: number;
        en_riesgo: number;
        atrasado: number;
        finalizado: number;
    };
    topClients: { name: string; count: number }[];
    topOperators: { name: string; count: number }[];
    criticalProjects: { nombre: string; percentage: number; estado: string }[];
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
                    title="Proyectos Totales"
                    value={data.kpis.totalProjects}
                    icon={<Briefcase className="w-6 h-6" />}
                    color="bg-primary"
                    trend={`${data.kpis.activeProjects} activos`}
                />
                <KpiCard
                    title="Operadores Activos"
                    value={data.kpis.activeOperatorsCount}
                    icon={<Users className="w-6 h-6" />}
                    color="bg-indigo-500"
                    trend="En terreno"
                />
                <KpiCard
                    title="Eficiencia de Horas"
                    value={`${data.kpis.overallEfficiency}%`}
                    icon={<Clock className="w-6 h-6" />}
                    color="bg-emerald-500"
                    trend="Consumo total"
                />
                <KpiCard
                    title="Estado Crítico"
                    value={data.statusDistribution.en_riesgo + data.statusDistribution.atrasado}
                    icon={<AlertTriangle className="w-6 h-6" />}
                    color="bg-rose-500"
                    trend="Requieren atención"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Status & Critical Projects */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Status Distribution */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                <PieChart className="w-5 h-5 text-primary" />
                                Distribución por Estado
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <StatusPill label="Activos" count={data.statusDistribution.activo} color="primary" />
                            <StatusPill label="En Riesgo" count={data.statusDistribution.en_riesgo} color="amber" />
                            <StatusPill label="Atrasados" count={data.statusDistribution.atrasado} color="rose" />
                            <StatusPill label="Finalizados" count={data.statusDistribution.finalizado} color="slate" />
                        </div>
                    </div>

                    {/* Critical Projects List */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                <TrendingUp className="w-5 h-5 text-rose-500" />
                                Proyectos en Alerta (Consumo de Horas)
                            </h3>
                        </div>
                        <div className="space-y-4">
                            {data.criticalProjects.map((project, idx) => (
                                <div key={idx} className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="font-bold text-slate-700">{project.nombre}</span>
                                        <span className={`text-sm font-black ${project.percentage > 100 ? 'text-rose-500' : 'text-slate-500'}`}>
                                            {Math.round(project.percentage)}%
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${project.percentage > 100 ? 'bg-rose-500' :
                                                    project.percentage > 80 ? 'bg-amber-500' : 'bg-primary'
                                                }`}
                                            style={{ width: `${Math.min(project.percentage, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Concentration Metrics */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Top Clients */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-6">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            Principales Clientes
                        </h3>
                        <div className="space-y-4">
                            {data.topClients.map((client, idx) => (
                                <div key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">
                                            {idx + 1}
                                        </div>
                                        <span className="font-bold text-slate-600 group-hover:text-primary transition-colors line-clamp-1">
                                            {client.name}
                                        </span>
                                    </div>
                                    <span className="px-2.5 py-1 bg-primary/5 text-primary text-xs font-black rounded-lg">
                                        {client.count} Proj
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Operators */}
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-6">
                            <User2 className="w-5 h-5 text-slate-400" />
                            Mayor Actividad
                        </h3>
                        <div className="space-y-4">
                            {data.topOperators.map((op, idx) => (
                                <div key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-400">
                                            <ArrowUpRight className="w-4 h-4" />
                                        </div>
                                        <span className="font-bold text-slate-600 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                            {op.name}
                                        </span>
                                    </div>
                                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg">
                                        {op.count} Asig
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ title, value, icon, color, trend }: { title: string; value: string | number; icon: any; color: string; trend: string }) {
    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${color} text-white shadow-lg shadow-${color.split('-')[1]}/20 group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                <div className="px-2 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    KPI Global
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{title}</p>
                <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{value}</h4>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{trend}</p>
            </div>
        </div>
    );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
    const colors: Record<string, string> = {
        primary: 'bg-primary/10 text-primary border-primary/20',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        rose: 'bg-rose-50 text-rose-500 border-rose-100',
        slate: 'bg-slate-50 text-slate-500 border-slate-200'
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[color]} flex flex-col items-center justify-center gap-1 hover:scale-105 transition-transform cursor-default`}>
            <span className="text-2xl font-black leading-none">{count}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-center">{label}</span>
        </div>
    );
}
