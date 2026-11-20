'use client';

import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { Layout, Plus } from 'lucide-react';
import { useAcceso } from '@/lib/store/useAccessStore';

interface ProjectsHeaderProps {
    activeTabId: string;
    searchValue?: string;
    onSearchChange?: (v: string) => void;
    onNewProject?: () => void;
}

export default function ProjectsHeader({ 
    activeTabId, 
    searchValue, 
    onSearchChange,
    onNewProject
}: ProjectsHeaderProps) {
    const router = useRouter();
    // Ajustes: los catálogos que usan los proyectos (antes en Configuración)
    const { puede } = useAcceso();

    const handleTabChange = (tabId: string) => {
        if (tabId === 'proyectos') {
            router.push('/projects');
        } else {
            router.push(`/projects/${tabId}`);
        }
    };

    const actions = onNewProject ? [{
        id: 'nuevo',
        label: 'Nuevo Proyecto',
        icon: <Plus className="w-4 h-4" />,
        variant: 'primary' as const,
        onClick: onNewProject,
        hideLabelOnMobile: true
    }] : [];

    return (
        <ModuleHeader
            title="Proyectos"
            description="Control y seguimiento de proyectos activos"
            icon={<Layout className="w-5 h-5" />}
            helpSlug="gestion-proyectos"
            tabs={[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'proyectos', label: 'Proyectos' },
                { id: 'cronograma', label: 'Cronograma' },
                { id: 'recursos', label: 'Recursos' },
                { id: 'riesgos', label: 'Bloqueos' },
                { id: 'documentacion', label: 'Documentación' },
                { id: 'reportes', label: 'Reportes' },
                ...(puede('config.administrar') ? [{ id: 'ajustes', label: 'Ajustes' }] : []),
            ]}
            activeTabId={activeTabId}
            onTabChange={handleTabChange}
            actions={actions}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            searchPlaceholder="Buscar proyecto..."
        />
    );
}
