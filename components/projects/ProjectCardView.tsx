'use client';

import Link from 'next/link';
import {
    Edit3,
    Trash2,
    Building2,
    User,
    TrendingUp,
    Clock,
    Calendar,
    FileText,
    PieChart,
    ClipboardList,
    ChevronRight,
    Timer,
    AlertTriangle,
} from 'lucide-react';
import { Project, STATUS_CONFIG, getProgressColor } from '@/lib/projectTypes';

export function ProjectCard({
    project,
    onEdit,
    onDetails,
    handleDeleteClick,
}: {
    project: Project;
    onEdit: (p: Project) => void;
    onDetails: (p: Project) => void;
    handleDeleteClick: (id: string) => void;
}) {
    const { horasConsumidas, horasEstimadas, estado } = project;
    const progress = (horasEstimadas || 0) > 0 ? Math.min(100, Math.round((horasConsumidas / horasEstimadas) * 100)) : 0;
    const cfg = STATUS_CONFIG[estado] || STATUS_CONFIG.activo;
    const StatusIcon = cfg.Icon;
    const progressColor = getProgressColor(progress);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 p-5 flex flex-col gap-4 group">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight group-hover:text-primary transition-colors">
                        {project.codigoProyecto ? (
                            <span className="text-primary font-mono mr-1.5">{project.codigoProyecto} |</span>
                        ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-mono mr-1.5">#SIN-COD |</span>
                        )}
                        {project.nombre}
                    </h4>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => onEdit(project)}
                        className="btn-icon-inline p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/5 transition-all active:scale-90"
                        title="Editar"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(project.id)}
                        className="btn-icon-inline p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">Cliente:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {project.client?.nombre || project.cliente || '—'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">Resp:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{project.responsableUser?.nombreCompleto || project.responsable || '—'}</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {project.tags && project.tags.length > 0 ? (
                    project.tags.map((tag: any) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-tighter">
                            {tag}
                        </span>
                    ))
                ) : (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 italic">Sin etiquetas técnicas</span>
                )}
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Avance: {progress}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{horasConsumidas}h / {horasEstimadas}h</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-50">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <span>Avance Técnico (Checklist)</span>
                    <span className="text-slate-600 dark:text-slate-300">
                        {project.checklistItems?.filter((i: any) => i.completed && !i.excluded).length} / {project.checklistItems?.filter((i: any) => !i.excluded).length}
                    </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{
                            width: `${(project.checklistItems?.filter((i: any) => !i.excluded).length || 0) > 0
                                ? Math.round((project.checklistItems?.filter((i: any) => i.completed && !i.excluded).length || 0) / (project.checklistItems?.filter((i: any) => !i.excluded).length || 0) * 100)
                                : 0}%`
                        }}
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-50 overflow-hidden">
                <div className="flex flex-wrap gap-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${cfg.bg} ring-1 ${cfg.ring}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {project._count && (project._count.clientDelays || 0) > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
                            <Timer className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-tight">{project._count.clientDelays} Demoras</span>
                        </div>
                    )}
                    {project.finalizadoConPendientes && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-tight">Cierre con Pendientes</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <button onClick={() => onDetails(project)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap">
                        Ver Detalle <ChevronRight className="w-3 h-3" />
                    </button>
                    <Link href="/planning" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap">
                        <Calendar className="w-3 h-3" /> Planificación
                    </Link>
                    {project.estado === 'finalizado' && (
                        <Link href={`/projects/${project.id}/report`} target="_blank" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all whitespace-nowrap" title="Descargar Reporte PDF">
                            <FileText className="w-3 h-3" /> PDF
                        </Link>
                    )}
                    <Link
                        href={`/projects/${project.id}/report?token=${project.publicToken || ''}`}
                        target="_blank"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all whitespace-nowrap"
                        title="Seguimiento Público"
                    >
                        <PieChart className="w-3 h-3" /> Seguimiento
                    </Link>
                    {project.generarOS && (
                        <Link
                            href={`/ordenes-servicio/generar?projectId=${project.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all whitespace-nowrap"
                            title="Generar Orden de Servicio"
                        >
                            <ClipboardList className="w-3 h-3" /> OS
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ProjectCardView({
    projects,
    onEdit,
    onDetails,
    handleDeleteClick,
}: {
    projects: Project[];
    onEdit: (p: Project) => void;
    onDetails: (p: Project) => void;
    handleDeleteClick: (id: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {projects.map(p => (
                <ProjectCard 
                    key={p.id} 
                    project={p} 
                    onEdit={onEdit} 
                    onDetails={onDetails} 
                    handleDeleteClick={handleDeleteClick} 
                />
            ))}
        </div>
    );
}
