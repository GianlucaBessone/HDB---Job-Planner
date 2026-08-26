'use client';

import { useState, useEffect, useMemo } from 'react';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { LayoutDashboard, TrendingUp, AlertTriangle, Clock, Target, Loader2 } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { Project, STATUS_CONFIG } from '@/lib/projectTypes';
import ReactECharts from 'echarts-for-react';

export default function DashboardPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await safeApiRequest('/api/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (e) {
            console.error('Error loading projects:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // -- Metrics & Calculations --
    const stats = useMemo(() => {
        const activeProjects = projects.filter(p => p.estado === 'activo');
        const atRiskProjects = projects.filter(p => p.estado === 'en_riesgo' || p.estado === 'atrasado');
        const totalEstimated = projects.reduce((acc, p) => acc + (p.horasEstimadas || 0), 0);
        const totalConsumed = projects.reduce((acc, p) => acc + (p.horasConsumidas || 0), 0);
        
        // Status distribution for pie chart
        const statusCount: Record<string, number> = {};
        projects.forEach(p => {
            statusCount[p.estado] = (statusCount[p.estado] || 0) + 1;
        });

        // Top 5 active projects by consumed hours
        const topProjects = [...activeProjects]
            .sort((a, b) => b.horasConsumidas - a.horasConsumidas)
            .slice(0, 5);

        return {
            total: projects.length,
            active: activeProjects.length,
            atRisk: atRiskProjects.length,
            totalEstimated,
            totalConsumed,
            statusCount,
            topProjects
        };
    }, [projects]);

    // -- ECharts Configurations --
    const pieOptions = {
        tooltip: { trigger: 'item' },
        legend: { top: '5%', left: 'center', textStyle: { color: '#64748b' } },
        series: [
            {
                name: 'Proyectos',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: { show: false, position: 'center' },
                emphasis: {
                    label: { show: true, fontSize: 18, fontWeight: 'bold' }
                },
                labelLine: { show: false },
                data: Object.entries(stats.statusCount).map(([status, count]) => ({
                    value: count,
                    name: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status,
                    itemStyle: { 
                        // Try to parse out the raw color from config, or use generic
                        color: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.dot.includes('emerald') ? '#10b981' : 
                               STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.dot.includes('blue') ? '#3b82f6' :
                               STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.dot.includes('amber') ? '#fbbf24' :
                               STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.dot.includes('red') ? '#ef4444' :
                               STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.dot.includes('violet') ? '#8b5cf6' : '#94a3b8'
                    }
                }))
            }
        ]
    };

    const barOptions = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { textStyle: { color: '#64748b' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { 
            type: 'category', 
            data: stats.topProjects.map(p => p.nombre.length > 15 ? p.nombre.substring(0, 15) + '...' : p.nombre),
            axisLabel: { color: '#64748b' }
        },
        series: [
            {
                name: 'Consumidas',
                type: 'bar',
                stack: 'total',
                itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] },
                data: stats.topProjects.map(p => p.horasConsumidas)
            },
            {
                name: 'Restantes',
                type: 'bar',
                stack: 'total',
                itemStyle: { color: '#e2e8f0', borderRadius: [0, 4, 4, 0] },
                data: stats.topProjects.map(p => Math.max(0, p.horasEstimadas - p.horasConsumidas))
            }
        ]
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="dashboard" />
            
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando Dashboard...</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                    <div className="p-6 bg-background text-foreground/50 rounded-full mb-6">
                        <LayoutDashboard className="w-12 h-12 opacity-20" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">No hay proyectos</h2>
                    <p className="text-sm text-slate-500 mt-2 text-center">Crea tu primer proyecto para ver las métricas del dashboard.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Tarjetas de Métricas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-card border border-slate-200 dark:border-slate-700 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Proyectos</p>
                                    <h3 className="text-4xl font-black text-slate-800 dark:text-slate-100 mt-2">{stats.total}</h3>
                                </div>
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                                    <Target className="w-6 h-6" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-slate-200 dark:border-slate-700 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Proyectos Activos</p>
                                    <h3 className="text-4xl font-black text-emerald-600 mt-2">{stats.active}</h3>
                                </div>
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-slate-200 dark:border-slate-700 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">En Riesgo / Atrasados</p>
                                    <h3 className="text-4xl font-black text-amber-500 mt-2">{stats.atRisk}</h3>
                                </div>
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-slate-200 dark:border-slate-700 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Eficiencia Global</p>
                                    <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-2">
                                        {stats.totalEstimated > 0 
                                            ? Math.round((stats.totalConsumed / stats.totalEstimated) * 100) 
                                            : 0}%
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">{stats.totalConsumed}h de {stats.totalEstimated}h</p>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                                    <Clock className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-card border border-slate-200 dark:border-slate-700 p-6 rounded-[2.5rem] shadow-sm">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6">Estado del Portafolio</h3>
                            <ReactECharts option={pieOptions} style={{ height: '350px' }} />
                        </div>
                        
                        <div className="bg-card border border-slate-200 dark:border-slate-700 p-6 rounded-[2.5rem] shadow-sm">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-6">Top 5: Consumo de Horas (Activos)</h3>
                            <ReactECharts option={barOptions} style={{ height: '350px' }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
