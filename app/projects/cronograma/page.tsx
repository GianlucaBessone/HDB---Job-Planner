'use client';

import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { GanttChartSquare } from 'lucide-react';

export default function CronogramaPage() {
    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="cronograma" />
            
            <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                <div className="p-6 bg-background text-foreground/50 rounded-full mb-6">
                    <GanttChartSquare className="w-12 h-12 opacity-20" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Cronograma Maestro</h2>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
                    Esta vista está en construcción. Aquí podrás ver y editar un diagrama de Gantt maestro cruzando todos los proyectos activos.
                </p>
            </div>
        </div>
    );
}
