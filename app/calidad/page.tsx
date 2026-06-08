'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    FileCheck, BookOpen, AlertTriangle, History, LayoutDashboard, GraduationCap, Award
} from 'lucide-react';

import DashboardTab from './components/DashboardTab';
import LibraryTab from './components/LibraryTab';
import TemplatesTab from './components/TemplatesTab';
import ExpirationsTab from './components/ExpirationsTab';
import HistoryTab from './components/HistoryTab';
import LmsTab from './components/LmsTab';
import CompetenciesTab from './components/CompetenciesTab';
import NcTab from './components/NcTab';
import CapaTab from './components/CapaTab';
import ModuleHeader from '@/components/ModuleHeader';

type TabId = 'dashboard' | 'library' | 'templates' | 'expirations' | 'history' | 'training' | 'competencies' | 'nc' | 'capa';

export default function CalidadPageWrapper() {
    return (
        <CalidadPage />
    );
}

function CalidadPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabId) || 'library';

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);
    const [visitedTabs, setVisitedTabs] = useState<Record<TabId, boolean>>(() => {
        return { [initialTab]: true } as Record<TabId, boolean>;
    });

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
        { id: 'dashboard', label: 'Dashboard QMS', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'library', label: 'Biblioteca Documental', roles: ['operador', 'supervisor', 'admin', 'qa'] },
        { id: 'nc', label: 'No Conformidades (NC)', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'capa', label: 'Sistema CAPA', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'training', label: 'Capacitación LMS', roles: ['operador', 'supervisor', 'admin', 'qa'] },
        { id: 'competencies', label: 'Matriz de Competencias', roles: ['operador', 'supervisor', 'admin', 'qa'] },
        { id: 'templates', label: 'Plantillas de Checklist', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'expirations', label: 'Vencimientos', roles: ['supervisor', 'admin', 'qa'] },
        { id: 'history', label: 'Historial QMS', roles: ['supervisor', 'admin', 'qa'] },
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
                title="Gestión Operativa y Calidad"
                description="Plataforma de Cumplimiento, Capacitación Obligatoria (LMS) y Competencias QMS"
                icon={<FileCheck className="w-5 h-5" />}
                helpSlug="calidad-documentacion"
                tabs={allowedTabs}
                activeTabId={activeTab}
                onTabChange={(id) => setActiveTab(id as TabId)}
            />

            <div className="animate-in fade-in duration-300">
                {visitedTabs['dashboard'] && (
                    <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
                        <DashboardTab user={currentUser} />
                    </div>
                )}
                { visitedTabs['library'] && (
                    <div className={activeTab === 'library' ? '' : 'hidden'}>
                        <LibraryTab user={currentUser} />
                    </div>
                )}
                {visitedTabs['nc'] && (
                    <div className={activeTab === 'nc' ? '' : 'hidden'}>
                        <NcTab user={currentUser} />
                    </div>
                )}
                {visitedTabs['capa'] && (
                    <div className={activeTab === 'capa' ? '' : 'hidden'}>
                        <CapaTab user={currentUser} />
                    </div>
                )}
                {visitedTabs['training'] && (
                    <div className={activeTab === 'training' ? '' : 'hidden'}>
                        <LmsTab user={currentUser} />
                    </div>
                )}
                {visitedTabs['competencies'] && (
                    <div className={activeTab === 'competencies' ? '' : 'hidden'}>
                        <CompetenciesTab user={currentUser} />
                    </div>
                )}
                {visitedTabs['templates'] && (
                    <div className={activeTab === 'templates' ? '' : 'hidden'}>
                        <TemplatesTab user={currentUser} />
                    </div>
                )}
                {visitedTabs['expirations'] && (
                    <div className={activeTab === 'expirations' ? '' : 'hidden'}>
                        <ExpirationsTab user={currentUser} />
                    </div>
                )}
                {visitedTabs['history'] && (
                    <div className={activeTab === 'history' ? '' : 'hidden'}>
                        <HistoryTab user={currentUser} />
                    </div>
                )}
            </div>
        </div>
    );
}
