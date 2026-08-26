'use client';

import { useState, useEffect } from 'react';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { FileText, Loader2, Download, ExternalLink } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';

interface TechnicalReport {
    id: string;
    reportNumber: string;
    status: string;
    createdAt: string;
    project?: {
        nombre: string;
        codigoProyecto: string | null;
    } | null;
    client?: {
        nombre: string;
    } | null;
    responsable?: {
        nombreCompleto: string;
    } | null;
    template: {
        name: string;
    };
}

export default function DocumentacionPage() {
    const [reports, setReports] = useState<TechnicalReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Fetch all technical reports
            const res = await safeApiRequest('/api/informes-tecnicos');
            if (res.ok) {
                const data = await res.json();
                // Filter only those linked to a project
                const projectReports = data.filter((r: TechnicalReport) => r.project != null);
                setReports(projectReports);
            }
        } catch (e) {
            console.error('Error loading documents:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = (id: string) => {
        window.open(`/api/informes-tecnicos/${id}/pdf`, '_blank');
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="documentacion" />
            
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando Documentación...</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                    <div className="p-6 bg-background text-foreground/50 rounded-full mb-6">
                        <FileText className="w-12 h-12 opacity-20" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Sin documentos</h2>
                    <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
                        No hay informes técnicos ni documentos asociados a los proyectos actualmente.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-card border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Documento</th>
                                    <th className="px-6 py-4 font-bold">Proyecto</th>
                                    <th className="px-6 py-4 font-bold">Plantilla</th>
                                    <th className="px-6 py-4 font-bold">Responsable</th>
                                    <th className="px-6 py-4 font-bold">Fecha</th>
                                    <th className="px-6 py-4 font-bold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {reports.map(report => (
                                    <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700 dark:text-slate-200">{report.reportNumber}</p>
                                                    <p className="text-xs text-slate-400">{report.status}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                {report.project?.codigoProyecto && <span className="font-mono text-primary mr-1.5">{report.project.codigoProyecto}</span>}
                                                {report.project?.nombre}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                            {report.template.name}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                                            {report.responsable?.nombreCompleto || 'Sin asignar'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {new Date(report.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleDownload(report.id)}
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-colors"
                                                title="Descargar PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => window.open(`/informes-tecnicos/${report.id}`, '_blank')}
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-colors ml-1"
                                                title="Ver detalle"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
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
