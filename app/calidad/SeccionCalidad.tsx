'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileCheck, Lightbulb, ShieldAlert, GraduationCap } from 'lucide-react';
import { useViewState } from '@/lib/hooks/useViewState';
import ModuleHeader from '@/components/ModuleHeader';

import DashboardTab from './components/DashboardTab';
import LibraryTab from './components/LibraryTab';
import TemplatesTab from './components/TemplatesTab';
import ExpirationsTab from './components/ExpirationsTab';
import HistoryTab from './components/HistoryTab';
import LmsTab from './components/LmsTab';
import CompetenciesTab from './components/CompetenciesTab';
import NcTab from './components/NcTab';
import CapaTab from './components/CapaTab';
import { RiesgosTab } from './components/RiesgosTab';
import { OportunidadesTab } from './components/OportunidadesTab';

/**
 * Calidad en cuatro entradas (auditoría, P29 / SE2): antes una sola pantalla con 12 pestañas. Cada entrada usa
 * las mismas pestañas de siempre; los roles por pestaña no cambian.
 */
export type SeccionId = 'documentos' | 'mejora' | 'riesgos' | 'formacion';
type TabId = 'dashboard' | 'library' | 'templates' | 'expirations' | 'history' | 'training' | 'competencies' | 'nc' | 'capa' | 'riesgos' | 'oportunidades' | 'sugerencias';

const GESTION = ['supervisor', 'admin', 'qa'];
const TODOS = ['operador', ...GESTION];

const SECCIONES: Record<SeccionId, { titulo: string; descripcion: string; icono: React.ReactNode; tabs: { id: TabId; label: string; roles: string[] }[] }> = {
    documentos: {
        titulo: 'Documentos',
        descripcion: 'Biblioteca documental, vencimientos, plantillas de checklist e historial del SGI',
        icono: <FileCheck className="w-5 h-5" />,
        tabs: [
            { id: 'dashboard', label: 'Tablero del SGI', roles: GESTION },
            { id: 'library', label: 'Biblioteca', roles: TODOS },
            { id: 'expirations', label: 'Vencimientos', roles: GESTION },
            { id: 'templates', label: 'Plantillas de checklist', roles: GESTION },
            { id: 'history', label: 'Historial', roles: GESTION },
        ],
    },
    mejora: {
        titulo: 'Mejora',
        descripcion: 'No conformidades, acciones correctivas y preventivas, oportunidades y sugerencias',
        icono: <Lightbulb className="w-5 h-5" />,
        tabs: [
            { id: 'nc', label: 'No conformidades', roles: GESTION },
            { id: 'capa', label: 'Acciones (CAPA)', roles: GESTION },
            { id: 'oportunidades', label: 'Oportunidades', roles: GESTION },
            { id: 'sugerencias', label: 'Sugerencias', roles: GESTION },
        ],
    },
    riesgos: {
        titulo: 'Riesgos',
        descripcion: 'Matriz de riesgos del SGI',
        icono: <ShieldAlert className="w-5 h-5" />,
        tabs: [{ id: 'riesgos', label: 'Matriz de riesgos', roles: GESTION }],
    },
    formacion: {
        titulo: 'Formación y competencias',
        descripcion: 'Capacitación obligatoria y matriz de competencias del personal',
        icono: <GraduationCap className="w-5 h-5" />,
        tabs: [
            { id: 'training', label: 'Capacitación', roles: TODOS },
            { id: 'competencies', label: 'Matriz de competencias', roles: TODOS },
        ],
    },
};

/** Pestaña vieja de /calidad?tab= → entrada nueva (enlaces guardados, avisos y documentos). */
export const DESTINO_TAB_VIEJA: Record<string, string> = {
    nc: '/calidad/mejora?tab=nc',
    capa: '/calidad/mejora?tab=capa',
    oportunidades: '/calidad/mejora?tab=oportunidades',
    riesgos: '/calidad/riesgos',
    training: '/calidad/formacion?tab=training',
    competencies: '/calidad/formacion?tab=competencies',
    objetivos: '/okr-kpi?tab=objetivos',
};

export default function SeccionCalidad({ seccion }: { seccion: SeccionId }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const cfg = SECCIONES[seccion];
    const docIdParam = searchParams.get('docId');
    const tabParam = searchParams.get('tab');

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [filters, setFilters] = useViewState(`calidad-${seccion}-filters`, { activeTab: cfg.tabs[0].id as TabId });
    const { activeTab } = filters;
    const setActiveTab = (val: TabId) => {
        // Sugerencias tiene su propia pantalla (con su formulario público)
        if (val === 'sugerencias') return router.push('/gestion-sugerencias');
        setFilters({ activeTab: val });
    };
    const [visitedTabs, setVisitedTabs] = useState<Partial<Record<TabId, boolean>>>({});

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) setCurrentUser(JSON.parse(stored));
        else router.replace('/');
    }, [router]);

    // ?tab= abre esa pestaña; en /calidad, una pestaña que ahora vive en otra entrada redirige
    useEffect(() => {
        if (!tabParam) return;
        if (seccion === 'documentos' && DESTINO_TAB_VIEJA[tabParam]) {
            router.replace(DESTINO_TAB_VIEJA[tabParam]);
            return;
        }
        if (cfg.tabs.some((t) => t.id === tabParam)) setFilters({ activeTab: tabParam as TabId });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabParam, seccion]);

    useEffect(() => {
        if (activeTab) setVisitedTabs((prev) => (prev[activeTab] ? prev : { ...prev, [activeTab]: true }));
    }, [activeTab]);

    const role = currentUser?.role?.toLowerCase() || 'operador';
    const allowedTabs = useMemo(() => cfg.tabs.filter((t) => t.roles.includes(role)), [cfg, role]);

    useEffect(() => {
        if (!currentUser) return;
        if (!allowedTabs.find((t) => t.id === activeTab) && allowedTabs.length > 0) setFilters({ activeTab: allowedTabs[0].id });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, allowedTabs, activeTab]);

    if (!currentUser) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    const panel = (id: TabId, contenido: React.ReactNode) =>
        visitedTabs[id] ? (
            <div key={id} className={activeTab === id ? '' : 'hidden'}>
                {contenido}
            </div>
        ) : null;

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 pb-12">
            <ModuleHeader
                title={cfg.titulo}
                description={cfg.descripcion}
                icon={cfg.icono}
                helpSlug="calidad-documentacion"
                tabs={allowedTabs}
                activeTabId={activeTab}
                onTabChange={(id) => setActiveTab(id as TabId)}
            />

            <div className="animate-in fade-in duration-200">
                {panel('dashboard', <DashboardTab user={currentUser} />)}
                {panel('library', <LibraryTab user={currentUser} initialDocId={docIdParam} />)}
                {panel('expirations', <ExpirationsTab user={currentUser} />)}
                {panel('templates', <TemplatesTab user={currentUser} />)}
                {panel('history', <HistoryTab user={currentUser} />)}
                {panel('nc', <NcTab user={currentUser} />)}
                {panel('capa', <CapaTab user={currentUser} />)}
                {panel('oportunidades', <OportunidadesTab currentUser={currentUser} />)}
                {panel('riesgos', <RiesgosTab currentUser={currentUser} />)}
                {panel('training', <LmsTab user={currentUser} />)}
                {panel('competencies', <CompetenciesTab user={currentUser} />)}
            </div>
        </div>
    );
}
