'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useViewState } from '@/lib/hooks/useViewState';
import { Target } from 'lucide-react';

import DashboardEstrategicoTab from './components/DashboardEstrategicoTab';
import OkrTab from './components/OkrTab';
import KpiTab from './components/KpiTab';
import GraficosTab from './components/GraficosTab';
import PlanesAccionTab from './components/PlanesAccionTab';
import HistoricoTab from './components/HistoricoTab';
import ModuleHeader from '@/components/ModuleHeader';
import { useAcceso } from '@/lib/store/useAccessStore';
import type { FuncionId } from '@/lib/permisos';

type TabId = 'dashboard' | 'okr' | 'kpi' | 'objetivos' | 'graficos' | 'planes' | 'historico';

export default function OkrKpiPageWrapper() {
    return (
        <Suspense fallback={null}>
            <OkrKpiPage />
        </Suspense>
    );
}

function OkrKpiPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [filters, setFilters] = useViewState('okr-kpi-filters', { activeTab: 'dashboard' as TabId });
    const { activeTab } = filters;
    const setActiveTab = (val: TabId) => setFilters({ activeTab: val });
    const [visitedTabs, setVisitedTabs] = useState<Record<TabId, boolean>>({ dashboard: true } as Record<TabId, boolean>);

    // ?tab=planes (desde "Mis tareas" de Inicio) abre esa pestaña
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab') as TabId | null;
    useEffect(() => {
        if (tabParam && ['dashboard', 'okr', 'kpi', 'objetivos', 'graficos', 'planes', 'historico'].includes(tabParam)) setActiveTab(tabParam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabParam]);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            setCurrentUser(JSON.parse(stored));
        } else {
            router.replace('/');
        }
    }, [router]);

    useEffect(() => {
        if (activeTab) {
            setVisitedTabs(prev => {
                if (prev[activeTab]) return prev;
                return { ...prev, [activeTab]: true };
            });
        }
    }, [activeTab]);

    const role = currentUser?.role?.toLowerCase() || 'operador';

    // P17: pestañas por función del catálogo (antes, lista de roles)
    const { puede } = useAcceso();
    const tabs: { id: TabId; label: string; funcion: FuncionId }[] = [
        { id: 'dashboard', label: 'Tablero Estratégico', funcion: 'okr.ver' },
        { id: 'okr', label: 'OKRs', funcion: 'okr.ver' },
        { id: 'kpi', label: 'KPIs', funcion: 'okr.ver' },
        { id: 'objetivos', label: 'Objetivos de calidad', funcion: 'okr.ver' },
        { id: 'graficos', label: 'Gráficos', funcion: 'okr.ver' },
        { id: 'planes', label: 'Planes de Acción', funcion: 'okr.ver' },
        { id: 'historico', label: 'Historial', funcion: 'okr.ver' },
    ];

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const allowedTabs = useMemo(() => tabs.filter(t => puede(t.funcion)), [puede]);

    useEffect(() => {
        if (!allowedTabs.find(t => t.id === activeTab) && allowedTabs.length > 0) {
            setActiveTab(allowedTabs[0].id);
        }
    }, [role, allowedTabs, activeTab]);

    if (!currentUser) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 pb-12">
            <ModuleHeader
                title="Objetivos e indicadores"
                description="Objetivos Estratégicos, Indicadores y Seguimiento de Cumplimiento — ISO 9001:2015"
                icon={<Target className="w-5 h-5" />}
                tabs={allowedTabs}
                activeTabId={activeTab}
                onTabChange={(id) => setActiveTab(id as TabId)}
            />

            <div className="animate-in fade-in duration-200">
                {visitedTabs['dashboard'] && (
                    <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
                        <DashboardEstrategicoTab user={currentUser} isActive={activeTab === 'dashboard'} />
                    </div>
                )}
                {visitedTabs['okr'] && (
                    <div className={activeTab === 'okr' ? '' : 'hidden'}>
                        <OkrTab user={currentUser} isActive={activeTab === 'okr'} onNavigateToKpi={() => setActiveTab('kpi')} />
                    </div>
                )}
                {visitedTabs['kpi'] && (
                    <div className={activeTab === 'kpi' ? '' : 'hidden'}>
                        <KpiTab user={currentUser} isActive={activeTab === 'kpi'} />
                    </div>
                )}
                {visitedTabs['graficos'] && (
                    <div className={activeTab === 'graficos' ? '' : 'hidden'}>
                        <GraficosTab user={currentUser} isActive={activeTab === 'graficos'} />
                    </div>
                )}
                {visitedTabs['objetivos'] && (
                    <div className={activeTab === 'objetivos' ? '' : 'hidden'}>
                        {/* Objetivos de calidad = KPI marcados como SGI (P30) */}
                        <KpiTab user={currentUser} isActive={activeTab === 'objetivos'} soloSgi />
                    </div>
                )}
                {visitedTabs['planes'] && (
                    <div className={activeTab === 'planes' ? '' : 'hidden'}>
                        <PlanesAccionTab user={currentUser} isActive={activeTab === 'planes'} />
                    </div>
                )}
                {visitedTabs['historico'] && (
                    <div className={activeTab === 'historico' ? '' : 'hidden'}>
                        <HistoricoTab user={currentUser} isActive={activeTab === 'historico'} />
                    </div>
                )}
            </div>
        </div>
    );
}
