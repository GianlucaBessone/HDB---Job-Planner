'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { Briefcase, Users, PieChart, Activity, Building, TrendingUp } from 'lucide-react';

export default function RecruitmentDashboardPage() {
    const router = useRouter();

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <PieChart /> },
        { id: 'vacantes', label: 'Vacantes', icon: <Briefcase /> },
        { id: 'postulantes', label: 'Base de Talentos', icon: <Users /> }
    ];

    const handleTabChange = (tabId: string) => {
        if (tabId === 'dashboard') router.push('/rrhh/reclutamiento');
        if (tabId === 'vacantes') router.push('/rrhh/reclutamiento/vacantes');
        if (tabId === 'postulantes') router.push('/rrhh/reclutamiento/postulantes');
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in">
            <ModuleHeader
                title="Reclutamiento (ATS)"
                description="Gestión inteligente de vacantes y postulantes"
                icon={<Briefcase />}
                tabs={tabs}
                activeTabId="dashboard"
                onTabChange={handleTabChange}
                actions={[
                    {
                        id: 'new-vacancy',
                        label: 'Nueva Vacante',
                        icon: <Briefcase />,
                        variant: 'primary',
                        onClick: () => router.push('/rrhh/reclutamiento/vacantes/nueva')
                    }
                ]}
            />

            {/* Dashboard Content Placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Vacantes Abiertas', value: '0', icon: <Briefcase className="text-blue-500" /> },
                    { label: 'Nuevos Postulantes', value: '0', icon: <Users className="text-indigo-500" /> },
                    { label: 'Entrevistas Hoy', value: '0', icon: <Activity className="text-rose-500" /> },
                    { label: 'Tiempo Promedio (Días)', value: '0', icon: <TrendingUp className="text-emerald-500" /> },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{stat.value}</h3>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm min-h-[300px] flex items-center justify-center">
                    <p className="text-slate-400 text-sm font-medium">Gráfico de Embudo (Próximamente)</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm min-h-[300px] flex items-center justify-center">
                    <p className="text-slate-400 text-sm font-medium">Actividad Reciente (Próximamente)</p>
                </div>
            </div>
        </div>
    );
}
