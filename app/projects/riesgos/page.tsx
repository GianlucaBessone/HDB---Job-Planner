'use client';

import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { AlertTriangle } from 'lucide-react';

export default function RiesgosPage() {
    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="riesgos" />
            
            <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                <div className="p-6 bg-background text-foreground/50 rounded-full mb-6">
                    <AlertTriangle className="w-12 h-12 opacity-20" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Matriz de Riesgos</h2>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
                    Esta vista está en construcción. Aquí podrás listar contingencias por proyecto y definir planes de mitigación.
                </p>
            </div>
        </div>
    );
}
