'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Project, STATUS_CONFIG, getProgressColor } from '@/lib/projectTypes';
import { 
    differenceInDays, 
    addDays, 
    subDays, 
    parseISO, 
    isValid, 
    format, 
    startOfWeek,
    addWeeks,
    differenceInWeeks,
    isToday,
    startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { Loader2, Calendar, AlertCircle } from 'lucide-react';

export default function ProjectGanttView({
    projects,
    onRefresh,
    onDetails
}: {
    projects: Project[];
    onRefresh: (silent?: boolean) => Promise<void>;
    onDetails: (p: Project) => void;
}) {
    const [savingId, setSavingId] = useState<string | null>(null);

    // Filter projects that actually have valid dates
    const { withDates, withoutDates } = useMemo(() => {
        const withDates: Project[] = [];
        const withoutDates: Project[] = [];
        
        projects.forEach(p => {
            if (p.fechaInicio && p.fechaFin && isValid(parseISO(p.fechaInicio)) && isValid(parseISO(p.fechaFin))) {
                // Ensure end date is >= start date
                if (parseISO(p.fechaFin) >= parseISO(p.fechaInicio)) {
                    withDates.push(p);
                } else {
                    withoutDates.push(p);
                }
            } else {
                withoutDates.push(p);
            }
        });
        
        // Sort by start date
        withDates.sort((a, b) => {
            return parseISO(a.fechaInicio!).getTime() - parseISO(b.fechaInicio!).getTime();
        });

        return { withDates, withoutDates };
    }, [projects]);

    // Calculate timeline bounds
    const timeline = useMemo(() => {
        if (withDates.length === 0) {
            const now = new Date();
            return {
                start: subDays(now, 15),
                end: addDays(now, 45),
                totalDays: 60
            };
        }

        let minDate = parseISO(withDates[0].fechaInicio!);
        let maxDate = parseISO(withDates[0].fechaFin!);

        withDates.forEach(p => {
            const start = parseISO(p.fechaInicio!);
            const end = parseISO(p.fechaFin!);
            if (start < minDate) minDate = start;
            if (end > maxDate) maxDate = end;
        });

        // Add padding: 2 weeks before, 2 weeks after
        const timelineStart = subDays(minDate, 14);
        const timelineEnd = addDays(maxDate, 14);
        
        // Ensure at least a 30-day view
        const diff = differenceInDays(timelineEnd, timelineStart);
        const adjustedEnd = diff < 30 ? addDays(timelineEnd, 30 - diff) : timelineEnd;

        return {
            start: timelineStart,
            end: adjustedEnd,
            totalDays: differenceInDays(adjustedEnd, timelineStart)
        };
    }, [withDates]);

    // Generate week ticks
    const weeks = useMemo(() => {
        const w = [];
        let curr = startOfWeek(timeline.start, { weekStartsOn: 1 }); // Monday
        while (curr <= timeline.end) {
            w.push(curr);
            curr = addWeeks(curr, 1);
        }
        return w;
    }, [timeline]);

    // Save date changes
    const updateDates = async (project: Project, newStart: string, newEnd: string) => {
        if (project.fechaInicio === newStart && project.fechaFin === newEnd) return;
        
        setSavingId(project.id);
        try {
            const res = await safeApiRequest(`/api/projects?id=${project.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ fechaInicio: newStart, fechaFin: newEnd }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                await onRefresh(true);
            } else {
                showToast('Error al actualizar fechas del proyecto', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red', 'error');
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {withDates.length === 0 ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-lg">No hay proyectos con fechas definidas</p>
                    <p className="text-sm mt-1">Configura las fechas de inicio y fin en los proyectos para verlos en el Gantt.</p>
                </div>
            ) : (
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    {/* Left Panel: Project Names */}
                    <div className="w-[300px] shrink-0 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 z-10">
                        <div className="h-10 border-b border-slate-100 dark:border-slate-800 flex items-center px-4">
                            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">Proyectos ({withDates.length})</span>
                        </div>
                        <div className="py-2">
                            {withDates.map(p => (
                                <div key={p.id} className="h-14 px-4 flex items-center justify-between group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => onDetails(p)}>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate group-hover:text-primary transition-colors">
                                            {p.codigoProyecto ? <span className="font-mono text-primary mr-1.5">{p.codigoProyecto}</span> : null}
                                            {p.nombre}
                                        </div>
                                        <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                            {p.responsableUser?.nombreCompleto || p.responsable || 'Sin asignar'}
                                        </div>
                                    </div>
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0 ml-2 shadow-sm" style={{ backgroundColor: STATUS_CONFIG[p.estado] ? `var(--tw-colors-${STATUS_CONFIG[p.estado].bg.replace('bg-', '')})` : '#cbd5e1' }}>
                                        <div className={`w-full h-full rounded-full ${STATUS_CONFIG[p.estado]?.dot || 'bg-slate-400'}`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel: Timeline */}
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <div className="min-w-[800px] h-full relative" style={{ width: `${timeline.totalDays * 12}px` }}> {/* 12px per day min-width */}
                            
                            {/* Header (Weeks) */}
                            <div className="h-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 sticky top-0 z-10 flex">
                                {weeks.map((w, i) => {
                                    const leftPct = (differenceInDays(w, timeline.start) / timeline.totalDays) * 100;
                                    if (leftPct > 100) return null;
                                    return (
                                        <div key={i} className="absolute h-full border-l border-slate-100 dark:border-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex flex-col justify-center" style={{ left: `${leftPct}%` }}>
                                            <span>{format(w, 'MMM', { locale: es })}</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-mono">{format(w, 'dd')}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Grid / Today Line */}
                            <div className="absolute top-10 bottom-0 left-0 right-0 pointer-events-none z-0">
                                {weeks.map((w, i) => {
                                    const leftPct = (differenceInDays(w, timeline.start) / timeline.totalDays) * 100;
                                    if (leftPct > 100) return null;
                                    return <div key={i} className="absolute top-0 bottom-0 border-l border-slate-100 dark:border-slate-800/50 border-dashed" style={{ left: `${leftPct}%` }} />;
                                })}
                                
                                {/* Today indicator */}
                                {differenceInDays(new Date(), timeline.start) >= -1 && differenceInDays(new Date(), timeline.start) <= timeline.totalDays && (
                                    <div 
                                        className="absolute top-0 bottom-0 w-[1px] bg-red-400 z-20" 
                                        style={{ left: `${((Date.now() - timeline.start.getTime()) / (1000 * 60 * 60 * 24) / timeline.totalDays) * 100}%` }}
                                    >
                                        <div className="absolute -top-1 -ml-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-white dark:ring-slate-800" />
                                    </div>
                                )}
                            </div>

                            {/* Bars */}
                            <div className="py-2 relative z-10">
                                {withDates.map((p, index) => {
                                    const start = parseISO(p.fechaInicio!);
                                    const end = parseISO(p.fechaFin!);
                                    const leftPct = Math.max(0, (differenceInDays(start, timeline.start) / timeline.totalDays) * 100);
                                    let widthPct = (differenceInDays(end, start) / timeline.totalDays) * 100;
                                    // Make sure it doesn't overflow the right bound visually
                                    if (leftPct + widthPct > 100) widthPct = 100 - leftPct;

                                    const progress = (p.horasEstimadas || 0) > 0 ? Math.min(100, Math.round((p.horasConsumidas / p.horasEstimadas) * 100)) : 0;
                                    const cfg = STATUS_CONFIG[p.estado];
                                    const isSaving = savingId === p.id;

                                    return (
                                        <div key={p.id} className="h-14 relative group flex items-center w-full">
                                            <GanttBar 
                                                project={p}
                                                leftPct={leftPct}
                                                widthPct={widthPct}
                                                progress={progress}
                                                cfg={cfg}
                                                isSaving={isSaving}
                                                onDatesChange={(newStart, newEnd) => updateDates(p, newStart, newEnd)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {withoutDates.length > 0 && (
                <div className="mt-8 border-t border-slate-100 dark:border-slate-800 p-6 bg-slate-50 dark:bg-slate-900/50">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Proyectos Sin Planificar ({withoutDates.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {withoutDates.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => onDetails(p)}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-primary/50 transition-colors shadow-sm"
                            >
                                {p.codigoProyecto && <span className="text-primary mr-1">{p.codigoProyecto}</span>}
                                {p.nombre}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Internal component to handle interactions on the bar
function GanttBar({
    project,
    leftPct,
    widthPct,
    progress,
    cfg,
    isSaving,
    onDatesChange
}: {
    project: Project;
    leftPct: number;
    widthPct: number;
    progress: number;
    cfg: any;
    isSaving: boolean;
    onDatesChange: (start: string, end: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempStart, setTempStart] = useState("");
    const [tempEnd, setTempEnd] = useState("");

    // Start editing
    const openEditor = () => {
        setTempStart(project.fechaInicio!);
        setTempEnd(project.fechaFin!);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!tempStart || !tempEnd) return;
        if (parseISO(tempEnd) < parseISO(tempStart)) {
            showToast('La fecha de fin no puede ser menor a la de inicio', 'error');
            return;
        }
        setIsEditing(false);
        onDatesChange(tempStart, tempEnd);
    };

    return (
        <div className="absolute h-8 min-w-[20px] shadow-sm rounded-full cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-transform flex items-center group/bar" 
             style={{ 
                 left: `${leftPct}%`, 
                 width: `max(0.5rem, ${widthPct}%)`,
             }}
             title={`${project.nombre}\nAsignado a: ${project.responsableUser?.nombreCompleto || '—'}\nF. Inicio: ${format(parseISO(project.fechaInicio!), 'dd/MM/yyyy')} | F. Fin: ${format(parseISO(project.fechaFin!), 'dd/MM/yyyy')}\nAvance Consumido: ${progress}%`}
        >
            {/* The Bar background and progress overlay */}
            <div className={`absolute inset-0 rounded-full border opacity-30 ${cfg.bg} ${cfg.ring} ${(cfg.dot.replace('bg-', 'border-'))}`} />
            
            <div className={`absolute left-0 top-0 bottom-0 rounded-full ${cfg.dot} opacity-20`} style={{ width: `${progress}%` }} />
            
            <div className="absolute inset-0 border border-transparent hover:border-slate-300 dark:hover:border-slate-500 rounded-full z-10" onClick={openEditor} />
            
            {!isEditing && (
                <div className="relative px-3 z-10 text-[10px] font-black tracking-widest text-slate-800 dark:text-slate-100 truncate pointer-events-none drop-shadow-md mix-blend-difference opacity-80">
                    {format(parseISO(project.fechaInicio!), 'd MMM')} - {format(parseISO(project.fechaFin!), 'd MMM')}
                </div>
            )}
            
            {isSaving && (
                <div className="absolute right-2 z-20">
                    <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                </div>
            )}

            {/* Quick Edit Popover */}
            {isEditing && (
                <div className="absolute top-full mt-2 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 w-72 flex flex-col gap-2 cursor-default" onClick={e => e.stopPropagation()}>
                    <div className="font-bold text-xs text-slate-700 dark:text-slate-200 mb-1 flex justify-between">
                        <span>Minicontrol Fechas</span>
                        <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary flex-1 min-w-0" 
                            value={tempStart} 
                            onChange={e => setTempStart(e.target.value)} 
                        />
                        <span className="text-slate-400">→</span>
                        <input 
                            type="date" 
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary flex-1 min-w-0" 
                            value={tempEnd} 
                            onChange={e => setTempEnd(e.target.value)} 
                        />
                    </div>
                    <button 
                        onClick={handleSave} 
                        className="w-full bg-primary text-white text-[10px] font-black uppercase tracking-widest py-1.5 rounded-lg hover:bg-primary/90 mt-1"
                    >
                        Guardar Fechas
                    </button>
                </div>
            )}
        </div>
    );
}
