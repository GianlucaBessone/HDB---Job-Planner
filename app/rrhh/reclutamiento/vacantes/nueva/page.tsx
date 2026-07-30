'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { createVacancy } from '@/app/rrhh/actions';

export default function NuevaVacantePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        branch: '',
        positionsCount: 1,
        priority: 'MEDIA',
        description: '',
        requirements: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await createVacancy(formData);
            if (res.success) {
                router.push('/rrhh/reclutamiento/vacantes');
            } else {
                alert('Error al crear vacante: ' + res.error);
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
                title="Nueva Vacante"
                description="Crear una nueva búsqueda laboral"
                actions={[
                    {
                        id: 'back',
                        label: 'Cancelar',
                        variant: 'outline',
                        onClick: () => router.push('/rrhh/reclutamiento/vacantes')
                    }
                ]}
            />

            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Título del Puesto</label>
                        <input
                            required
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ej. Técnico Electromecánico"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Sucursal / Ubicación</label>
                        <input
                            type="text"
                            value={formData.branch}
                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ej. Sede Central"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Vacantes Disponibles</label>
                        <input
                            required
                            type="number"
                            min="1"
                            value={formData.positionsCount}
                            onChange={(e) => setFormData({ ...formData, positionsCount: parseInt(e.target.value) || 1 })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Prioridad</label>
                        <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="BAJA">Baja</option>
                            <option value="MEDIA">Media</option>
                            <option value="ALTA">Alta</option>
                            <option value="URGENTE">Urgente</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Descripción General</label>
                    <textarea
                        rows={4}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        placeholder="Descripción de tareas y responsabilidades..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Requisitos</label>
                    <textarea
                        rows={4}
                        value={formData.requirements}
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 border focus:ring-2 focus:ring-indigo-500"
                        placeholder="Habilidades requeridas, educación, experiencia..."
                    />
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Guardando...' : 'Crear Vacante'}
                    </button>
                </div>
            </form>
        </div>
    );
}
