'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import ProjectGanttView from '@/components/projects/ProjectGanttView';
import { Loader2 } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { Project } from '@/lib/projectTypes';

export default function CronogramaPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (e) {
            console.error('Error loading projects:', e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const handleDetails = (p: Project) => {
        // Redirect to main projects view and search for this project to open its details
        router.push(`/projects?search=${encodeURIComponent(p.codigoProyecto || p.nombre)}`);
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="cronograma" />
            
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando Cronograma...</p>
                </div>
            ) : (
                <div className="h-[75vh] w-full">
                    <ProjectGanttView 
                        projects={projects} 
                        onRefresh={async () => { await loadData(true); }}
                        onDetails={handleDetails}
                    />
                </div>
            )}
        </div>
    );
}
