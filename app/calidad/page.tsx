'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    FileCheck, BookOpen, AlertTriangle, History, LayoutDashboard, Search
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';

import DashboardTab from './components/DashboardTab';
import LibraryTab from './components/LibraryTab';
import ExpirationsTab from './components/ExpirationsTab';
import HistoryTab from './components/HistoryTab';

type TabId = 'dashboard' | 'library' | 'expirations' | 'history';

export default function CalidadPageWrapper() {
    return (
        <CalidadPage />
    );
}

function CalidadPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabId) || 'dashboard';

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            setCurrentUser(JSON.parse(stored));
        } else {
            router.replace('/');
        }
    }, [router]);

    const role = currentUser?.role?.toLowerCase() || 'operador';

    const tabs: { id: TabId; label: string; icon: React.ReactNode; roles: string[] }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['supervisor', 'admin'] },
        { id: 'library', label: 'Biblioteca Documental', icon: <BookOpen className="w-4 h-4" />, roles: ['operador', 'supervisor', 'admin'] },
        { id: 'expirations', label: 'Vencimientos', icon: <AlertTriangle className="w-4 h-4" />, roles: ['supervisor', 'admin'] },
        { id: 'history', label: 'Historial', icon: <History className="w-4 h-4" />, roles: ['supervisor', 'admin'] },
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <FileCheck className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Calidad y Documentación
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">
                        Sistema de Gestión de Calidad (QMS) y Control Documental
                    </p>
                </div>
            </div>

            <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
                {allowedTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-black transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                        }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in duration-300">
                {activeTab === 'dashboard' && <DashboardTab user={currentUser} />}
                {activeTab === 'library' && <LibraryTab user={currentUser} />}
                {activeTab === 'expirations' && <ExpirationsTab user={currentUser} />}
                {activeTab === 'history' && <HistoryTab user={currentUser} />}
            </div>
        </div>
    );
}
