'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Target } from 'lucide-react';

import DashboardEstrategicoTab from './components/DashboardEstrategicoTab';
import OkrTab from './components/OkrTab';
import KpiTab from './components/KpiTab';
import GraficosTab from './components/GraficosTab';
import PlanesAccionTab from './components/PlanesAccionTab';
import HistoricoTab from './components/HistoricoTab';
import ModuleHeader from '@/components/ModuleHeader';

type TabId = 'dashboard' | 'okr' | 'kpi' | 'graficos' | 'planes' | 'historico';

export default function OkrKpiPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');
    const [visitedTabs, setVisitedTabs] = useState<Record<TabId, boolean>>({ dashboard: true } as Record<TabId, boolean>);

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

    const tabs: { id: TabId; label: string; roles: string[] }[] = [
        { id: 'dashboard', label: 'Tablero Estratégico', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'okr', label: 'OKRs', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'kpi', label: 'KPIs', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'graficos', label: 'Gráficos', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'planes', label: 'Planes de Acción', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'historico', label: 'Historial', roles: ['supervisor', 'admin', 'qa'] },
    ];

    const allowedTabs = useMemo(() => tabs.filter(t => t.roles.includes(role)), [role]);

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
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <ModuleHeader
                title="Gestión de OKR y KPI"
                description="Objetivos Estratégicos, Indicadores y Seguimiento de Cumplimiento — ISO 9001:2015"
                icon={<Target className="w-5 h-5" />}
                tabs={allowedTabs}
                activeTabId={activeTab}
                onTabChange={(id) => setActiveTab(id as TabId)}
            />

            <div className="animate-in fade-in duration-300">
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
