'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { Briefcase, Users, PieChart, Search, Filter, BrainCircuit, Plus } from 'lucide-react';
import { getCandidates } from '@/app/rrhh/actions';

export default function TalentPoolPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <PieChart /> },
        { id: 'vacantes', label: 'Vacantes', icon: <Briefcase /> },
        { id: 'postulantes', label: 'Base de Talentos', icon: <Users /> }
    ];

    useEffect(() => {
        getCandidates().then(res => {
            if (res.success && res.data) {
                setCandidates(res.data);
            }
            setIsLoading(false);
        });
    }, []);

    const handleTabChange = (tabId: string) => {
        if (tabId === 'dashboard') router.push('/rrhh/reclutamiento');
        if (tabId === 'vacantes') router.push('/rrhh/reclutamiento/vacantes');
        if (tabId === 'postulantes') router.push('/rrhh/reclutamiento/postulantes');
    };

    const filteredCandidates = candidates.filter(c => 
        c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.tags && c.tags.some((t: any) => t.name.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in">
            <ModuleHeader
                title="Base de Talentos"
                description="Búsqueda global de postulantes pasados y actuales"
                icon={<Users />}
                tabs={tabs}
                activeTabId="postulantes"
                onTabChange={handleTabChange}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Buscar por nombre, puesto, habilidades..."
                actions={[
                    {
                        id: 'filter',
                        label: 'Filtros',
                        icon: <Filter />,
                        onClick: () => {},
                        variant: 'outline'
                    }
                ]}
            />

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 uppercase font-bold text-xs border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4">Candidato</th>
                                <th className="px-6 py-4">Puesto / Rol</th>
                                <th className="px-6 py-4">Etiquetas IA</th>
                                <th className="px-6 py-4 text-center">Mejor Match</th>
                                <th className="px-6 py-4">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredCandidates.map((candidate) => (
                                <tr 
                                    key={candidate.id} 
                                    onClick={() => router.push(`/rrhh/reclutamiento/postulantes/${candidate.id}`)}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 dark:text-slate-100">{candidate.firstName} {candidate.lastName}</div>
                                        <div className="text-xs text-slate-500">{candidate.email || '--'}</div>
                                    </td>
                                    <td className="px-6 py-4">--</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {candidate.tags && candidate.tags.slice(0, 3).map((tag: any) => (
                                                <span key={tag.id} className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                                    {tag.name}
                                                </span>
                                            ))}
                                            {candidate.tags && candidate.tags.length > 3 && (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                                    +{candidate.tags.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                            <div className="flex items-center gap-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                                                <BrainCircuit className="w-3.5 h-3.5" />
                                                {candidate.aiScore || 0}%
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                            candidate.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' :
                                            'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                        }`}>
                                            {candidate.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredCandidates.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No se encontraron candidatos con esos criterios.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
