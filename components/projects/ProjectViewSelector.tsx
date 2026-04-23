'use client';

import { LayoutGrid, Table2, GanttChartSquare, CalendarDays } from 'lucide-react';
import { ViewType } from '@/lib/projectTypes';

const VIEW_OPTIONS: { value: ViewType; label: string; Icon: React.ElementType }[] = [
    { value: 'card', label: 'Cards', Icon: LayoutGrid },
    { value: 'spreadsheet', label: 'Planilla', Icon: Table2 },
    { value: 'gantt', label: 'Gantt', Icon: GanttChartSquare },
    { value: 'calendar', label: 'Calendario', Icon: CalendarDays },
];

export default function ProjectViewSelector({
    value,
    onChange,
}: {
    value: ViewType;
    onChange: (v: ViewType) => void;
}) {
    return (
        <div className="flex items-center bg-white/50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
            {VIEW_OPTIONS.map(opt => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${
                            active
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                        title={opt.label}
                    >
                        <opt.Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
