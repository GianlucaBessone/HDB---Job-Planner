'use client';

import { useState, useEffect, useMemo } from 'react';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { Users, Loader2, Target, Briefcase } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { Project, STATUS_CONFIG } from '@/lib/projectTypes';

export default function RecursosPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<{ id: string; nombreCompleto: string; role?: string; activo?: boolean }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [projRes, opRes] = await Promise.all([
                safeApiRequest('/api/projects'),
                safeApiRequest('/api/operators')
            ]);
            
            if (projRes.ok && opRes.ok) {
                setProjects(await projRes.json());
                setOperators(await opRes.json());
            }
        } catch (e) {
            console.error('Error loading data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate workload per operator (Active Projects)
    const workload = useMemo(() => {
        const activeProjects = projects.filter(p => p.estado === 'activo' || p.estado === 'en_riesgo' || p.estado === 'atrasado');
        
        return operators
            .filter(op => op.activo)
            .map(op => {
                const assigned = activeProjects.filter(p => p.responsableId === op.id || p.responsable === op.nombreCompleto);
                return {
                    ...op,
                    assignedProjects: assigned,
                    load: assigned.length
                };
            })
            .filter(op => op.load > 0) // Only show operators with projects for now, or you can remove this to show everyone
            .sort((a, b) => b.load - a.load);
    }, [projects, operators]);

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="recursos" />
            
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Calculando carga de recursos...</p>
                </div>
            ) : workload.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                    <div className="p-6 bg-background text-foreground/50 rounded-full mb-6">
                        <Users className="w-12 h-12 opacity-20" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Sin recursos asignados</h2>
                    <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
                        No hay operadores con proyectos activos asignados en este momento.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workload.map(op => (
                        <div key={op.id} className="bg-card border border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-lg shrink-0">
                                    {op.nombreCompleto.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{op.nombreCompleto}</h3>
                                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{op.role || 'Operador'}</p>
                                </div>
                                <div className={`px-3 py-1.5 rounded-xl text-xs font-black ${
                                    op.load > 3 ? 'bg-red-50 text-red-600' : 
                                    op.load > 1 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                    {op.load} Proy.
                                </div>
                            </div>

                            <div className="space-y-3 flex-1">
                                {op.assignedProjects.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CONFIG[p.estado]?.dot || 'bg-slate-400'}`} />
                                            <div className="truncate">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-primary transition-colors">
                                                    {p.codigoProyecto && <span className="font-mono text-primary mr-1.5">{p.codigoProyecto}</span>}
                                                    {p.nombre}
                                                </p>
                                                <p className="text-xs text-slate-400 truncate">{p.client?.nombre || p.cliente || 'Sin cliente'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
