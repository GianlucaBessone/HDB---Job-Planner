'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { createCandidate, getVacancies } from '@/app/rrhh/actions';

export default function NuevoPostulantePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [vacancies, setVacancies] = useState<any[]>([]);
    
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        city: '',
        linkedin: '',
        vacancyId: ''
    });

    useEffect(() => {
        getVacancies().then(res => {
            if (res.success && res.data) {
                setVacancies(res.data.filter((v: any) => v.status === 'ABIERTA'));
            }
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await createCandidate(formData);
            if (res.success) {
                router.push('/rrhh/reclutamiento/postulantes');
            } else {
                alert('Error al crear postulante: ' + res.error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in">
            <ModuleHeader
                title="Nuevo Postulante"
                description="Ingreso manual de candidato a la base de talentos"
                actions={[
                    {
                        id: 'back',
                        label: 'Cancelar',
                        variant: 'outline',
                        onClick: () => router.push('/rrhh/reclutamiento/postulantes')
                    }
                ]}
            />

            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nombre</label>
                        <input
                            required
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Apellido</label>
                        <input
                            required
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Teléfono</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Ciudad</label>
                        <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">LinkedIn (URL)</label>
                        <input
                            type="text"
                            value={formData.linkedin}
                            onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Asociar a Vacante (Opcional)</label>
                    <select
                        value={formData.vacancyId}
                        onChange={(e) => setFormData({ ...formData, vacancyId: e.target.value })}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">-- Sin Vacante (Solo Base de Talentos) --</option>
                        {vacancies.map(v => (
                            <option key={v.id} value={v.id}>{v.title} ({v.branch || 'Sin sucursal'})</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Guardando...' : 'Crear Postulante'}
                    </button>
                </div>
            </form>
        </div>
    );
}
