'use client';

import { useState } from 'react';
import { Project, STATUS_CONFIG } from '@/lib/projectTypes';
import { 
    format, 
    addMonths, 
    subMonths,
    addWeeks,
    subWeeks,
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    parseISO,
    isToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid } from 'lucide-react';

export default function ProjectCalendarView({
    projects,
    onDetails
}: {
    projects: Project[];
    onDetails: (p: Project) => void;
}) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

    const nextPeriod = () => {
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
        else setCurrentDate(addWeeks(currentDate, 1));
    };
    const prevPeriod = () => {
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
        else setCurrentDate(subWeeks(currentDate, 1));
    };
    const goToday = () => setCurrentDate(new Date());

    const days = viewMode === 'month' 
        ? eachDayOfInterval({
            start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
            end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
          })
        : eachDayOfInterval({
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 }),
          });

    const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const getProjectsForDay = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return projects.filter(p => {
            if (!p.fechaInicio || !p.fechaFin) return false;
            return dateStr >= p.fechaInicio && dateStr <= p.fechaFin;
        });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-[600px]">
            {/* Header Toolbar */}
            <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-4">
                    <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <button onClick={prevPeriod} className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        </button>
                        <button onClick={goToday} className="px-4 py-2 bg-white dark:bg-slate-800 border-x border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            Hoy
                        </button>
                        <button onClick={nextPeriod} className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 capitalize">
                        {viewMode === 'month' 
                            ? format(currentDate, 'MMMM yyyy', { locale: es }) 
                            : `Semana del ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: es })}`
                        }
                    </h2>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex bg-primary/5 rounded-xl border border-primary/10 overflow-hidden shadow-sm p-0.5">
                        <button 
                            onClick={() => setViewMode('month')} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-primary text-white shadow-md' : 'text-primary/60 hover:text-primary hover:bg-primary/10'}`}
                        >
                            <CalendarIcon className="w-3.5 h-3.5" /> Mensual
                        </button>
                        <button 
                            onClick={() => setViewMode('week')} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-primary text-white shadow-md' : 'text-primary/60 hover:text-primary hover:bg-primary/10'}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Semanal
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50 dark:bg-slate-900/20">
                <div className="min-w-[800px] h-full flex flex-col">
                    {/* Weekdays Row */}
                    <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 shrink-0">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                        {days.map((day, idx) => {
                            const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
                            const dayProjects = getProjectsForDay(day);
                            const isTodayFlag = isToday(day);

                            return (
                                <div 
                                    key={day.toISOString()} 
                                    className={`min-h-[120px] ${viewMode === 'week' ? 'min-h-[400px]' : ''} border-r border-b border-slate-100 dark:border-slate-800/50 p-1 md:p-2 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800'} ${idx % 7 === 0 ? 'border-l' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1.5 px-1">
                                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${isTodayFlag ? 'bg-primary text-white shadow-md shadow-primary/20' : isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-1 flex flex-col px-0.5">
                                        {dayProjects.slice(0, viewMode === 'week' ? 20 : 4).map(p => {
                                            const cfg = STATUS_CONFIG[p.estado] || STATUS_CONFIG.activo;
                                            return (
                                                <button
                                                    key={p.id}
                                                    onClick={() => onDetails(p)}
                                                    className={`text-left px-2 py-1 rounded border text-[10px] font-bold truncate leading-tight shadow-sm hover:brightness-95 transition-all text-slate-800 dark:text-slate-100 w-full hover:z-10 relative`}
                                                    style={{ backgroundColor: `var(--tw-colors-${cfg.dot.split('-')[1]}-500)` }}
                                                    title={`${p.nombre} (${cfg.label})`}
                                                >
                                                    <span className="text-white mix-blend-difference opacity-90 drop-shadow-md">
                                                        {p.codigoProyecto && <span className="opacity-70 mr-1 font-mono">{p.codigoProyecto}</span>}
                                                        {p.nombre}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {dayProjects.length > (viewMode === 'week' ? 20 : 4) && (
                                            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 text-center py-0.5 uppercase tracking-widest bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                                                +{dayProjects.length - (viewMode === 'week' ? 20 : 4)} más
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
