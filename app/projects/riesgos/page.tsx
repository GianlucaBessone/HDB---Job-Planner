'use client';

import { useState, useEffect } from 'react';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { AlertTriangle, Loader2, Calendar } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';

interface RiskLog {
    id: string;
    projectId: string;
    fecha: string;
    responsable: string;
    observacion: string;
    categoria: string;
    createdAt: string;
    project: {
        id: string;
        nombre: string;
        codigoProyecto: string | null;
    };
    responsableRel?: {
        nombreCompleto: string;
    } | null;
}

export default function RiesgosPage() {
    const [risks, setRisks] = useState<RiskLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/riesgos');
            if (res.ok) {
                setRisks(await res.json());
            }
        } catch (e) {
            console.error('Error loading risks:', e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="riesgos" />
            
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando Riesgos...</p>
                </div>
            ) : risks.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                    <div className="p-6 bg-background text-foreground/50 rounded-full mb-6">
                        <AlertTriangle className="w-12 h-12 text-emerald-500 opacity-50" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Sin riesgos activos</h2>
                    <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
                        ¡Excelente! No hay bloqueantes ni reportes críticos en los proyectos activos.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-card border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Proyecto</th>
                                    <th className="px-6 py-4 font-bold">Tipo</th>
                                    <th className="px-6 py-4 font-bold">Observación / Riesgo</th>
                                    <th className="px-6 py-4 font-bold">Reportado Por</th>
                                    <th className="px-6 py-4 font-bold">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {risks.map(risk => (
                                    <tr key={risk.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                {risk.project.codigoProyecto && <span className="font-mono text-primary mr-1.5">{risk.project.codigoProyecto}</span>}
                                                {risk.project.nombre}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                                risk.categoria === 'Bloqueante' 
                                                    ? 'bg-red-50 text-red-600 border border-red-100' 
                                                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                                            }`}>
                                                {risk.categoria}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-600 dark:text-slate-400 max-w-md line-clamp-2" title={risk.observacion}>
                                                {risk.observacion}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-slate-600">
                                                {risk.responsableRel?.nombreCompleto || risk.responsable}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-slate-500 font-medium">
                                                <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                                {risk.fecha}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
