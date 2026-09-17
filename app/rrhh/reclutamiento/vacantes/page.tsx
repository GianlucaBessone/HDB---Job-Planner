'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { Briefcase, Users, PieChart, Search, Plus, Building2, Calendar, ChevronRight, Trash2, UserPlus } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { formatDate } from '@/lib/formatDate';
import { getVacancies, deleteVacancy } from '@/app/rrhh/actions';
import AddCandidateModal from '@/components/rrhh/AddCandidateModal';
import ConfirmModal from '@/components/ConfirmModal';

export default function VacanciesPage() {
    const router = useRouter();
    const [vacancies, setVacancies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals state
    const [selectedVacancyForAdd, setSelectedVacancyForAdd] = useState<any>(null);
    const [selectedVacancyForDelete, setSelectedVacancyForDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    useEffect(() => {
        loadVacancies();
    }, []);

    const loadVacancies = async () => {
        setIsLoading(true);
        try {
            const res = await getVacancies();
            if (res.success && res.data) {
                setVacancies(res.data);
            }
        } catch (error) {
            console.error('Error loading vacancies:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteVacancy = async () => {
        if (!selectedVacancyForDelete) return;
        setIsDeleting(true);
        try {
            const res = await deleteVacancy(selectedVacancyForDelete.id);
            if (res.success) {
                setVacancies(prev => prev.filter(v => v.id !== selectedVacancyForDelete.id));
                setSelectedVacancyForDelete(null);
            } else {
                alert('Error al eliminar vacante: ' + res.error);
            }
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredVacancies = vacancies.filter(v => 
        v.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (v.branch && v.branch.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in">
            <ModuleHeader
                title="Vacantes"
                description="Listado de búsquedas laborales activas e históricas"
                icon={<Briefcase />}
                tabs={tabs}
                activeTabId="vacantes"
                onTabChange={handleTabChange}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                actions={[
                    {
                        id: 'new-vacancy',
                        label: 'Nueva Vacante',
                        icon: <Plus />,
                        variant: 'primary',
                        onClick: () => router.push('/rrhh/reclutamiento/vacantes/nueva')
                    }
                ]}
            />

            {isLoading ? (
                <div className="flex justify-center items-center min-h-[200px]">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredVacancies.map((vacancy) => (
                        <div 
                            key={vacancy.id} 
                            onClick={() => router.push(`/rrhh/reclutamiento/vacantes/${vacancy.id}/pipeline`)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all cursor-pointer group flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-4">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                            {vacancy.title}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            <Building2 className="w-4 h-4 shrink-0" />
                                            <span className="truncate">{vacancy.branch || 'Sin sucursal'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                            vacancy.status === 'ABIERTA' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' :
                                            'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                                        }`}>
                                            {vacancy.status}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedVacancyForDelete(vacancy);
                                            }}
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors"
                                            title="Eliminar vacante"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300 mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-slate-400" />
                                        <span>{vacancy._count?.candidates || 0} postulantes</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span>{formatDate(vacancy.startDate)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVacancyForAdd(vacancy);
                                    }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Cargar Postulante</span>
                                </button>

                                <div className="flex items-center gap-1 text-sm font-medium text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    <span>Ver Pipeline</span>
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredVacancies.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium text-slate-600 dark:text-slate-300">No se encontraron vacantes</p>
                            <p className="text-sm mt-1">Crea una nueva vacante para comenzar</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal para Cargar Postulante desde la tarjeta */}
            {selectedVacancyForAdd && (
                <AddCandidateModal
                    isOpen={!!selectedVacancyForAdd}
                    onClose={() => setSelectedVacancyForAdd(null)}
                    vacancyId={selectedVacancyForAdd.id}
                    vacancyTitle={selectedVacancyForAdd.title}
                    onCandidateAdded={() => {
                        loadVacancies();
                    }}
                />
            )}

            {/* Modal de confirmación para eliminar vacante */}
            <ConfirmModal
                isOpen={!!selectedVacancyForDelete}
                onClose={() => setSelectedVacancyForDelete(null)}
                onConfirm={handleDeleteVacancy}
                title="¿Eliminar Vacante?"
                message={`¿Estás seguro de que deseas eliminar la vacante "${selectedVacancyForDelete?.title || ''}"? Esta acción desvinculará sus postulantes en proceso. Los datos generales de los postulantes se mantendrán en la Base de Talentos.`}
                confirmText={isDeleting ? "Eliminando..." : "Eliminar"}
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
}
