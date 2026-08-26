'use client';

import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { PieChart } from 'lucide-react';

export default function ReportesPage() {
    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="reportes" />
            
            <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                <div className="p-6 bg-background text-foreground/50 rounded-full mb-6">
                    <PieChart className="w-12 h-12 opacity-20" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Centro de Reportes</h2>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
                    Esta vista está en construcción. Aquí podrás generar exportaciones a Excel/PDF de rentabilidad y tiempos de operadores.
                </p>
            </div>
        </div>
    );
}
