'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Trash2,
    Edit3,
    CheckCircle2,
    XCircle,
    Briefcase,
    AlertCircle,
    Clock,
    Save,
    X
} from 'lucide-react';

export default function ProjectsPage() {
    const [projects, setProjects] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [formData, setFormData] = useState({
        nombre: '',
        activo: true,
        observaciones: '',
        horasEstimadas: 0,
        horasConsumidas: 0
    });

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await fetch('/api/projects').then(res => res.json());
            setProjects(data);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const openCreate = () => {
        setEditingProject(null);
        setFormData({ nombre: '', activo: true, observaciones: '', horasEstimadas: 0, horasConsumidas: 0 });
        setIsModalOpen(true);
    };

    const openEdit = (project: any) => {
        setEditingProject(project);
        setFormData({
            nombre: project.nombre,
            activo: project.activo,
            observaciones: project.observaciones || '',
            horasEstimadas: project.horasEstimadas || 0,
            horasConsumidas: project.horasConsumidas || 0
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre) return;

        const method = editingProject ? 'PATCH' : 'POST';
        const url = editingProject ? `/api/projects?id=${editingProject.id}` : '/api/projects';

        await fetch(url, {
            method,
            body: JSON.stringify(formData)
        });

        setIsModalOpen(false);
        loadProjects(true);
    };

    const updateConsumedHours = async (id: string, hours: number) => {
        await fetch(`/api/projects?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ horasConsumidas: hours })
        });
        // Optimistic update
        setProjects(prev => prev.map(p => p.id === id ? { ...p, horasConsumidas: hours } : p));
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        // Optimistic update
        setProjects(prev => prev.map(p => p.id === id ? { ...p, activo: !currentStatus } : p));
        await fetch(`/api/projects?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ activo: !currentStatus })
        });
    };

    const deleteProject = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;
        // Optimistic update
        setProjects(prev => prev.filter(p => p.id !== id));
        await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
    };

    const filteredProjects = projects.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Proyectos</h2>
                    <p className="text-slate-500 font-medium">Administra los lugares y carga de horas estimada</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary/90 shadow-xl shadow-primary/20 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Proyecto
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre de proyecto..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-800">
                                    {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Nombre</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Horas Estimadas</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        value={formData.horasEstimadas}
                                        onChange={e => setFormData({ ...formData, horasEstimadas: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Observaciones</label>
                                    <textarea
                                        rows={3}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium resize-none"
                                        value={formData.observaciones}
                                        onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all"
                                    >
                                        {editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="h-64 bg-slate-100/50 rounded-3xl animate-pulse"></div>
                    ))
                ) : (
                    <>
                        {filteredProjects.map((p: any) => {
                            const progress = p.horasEstimadas > 0 ? (p.horasConsumidas / p.horasEstimadas) * 100 : 0;
                            const isOver = p.horasConsumidas > p.horasEstimadas;

                            return (
                                <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/20 group transition-all duration-300 relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-2xl ${p.activo ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                                            <Briefcase className="w-6 h-6" />
                                        </div>
                                        <div className="flex gap-0.5">
                                            <button
                                                onClick={() => openEdit(p)}
                                                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-90"
                                            >
                                                <Edit3 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(p.id, p.activo)}
                                                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-green-500 transition-all active:scale-90"
                                            >
                                                {p.activo ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-slate-300" />}
                                            </button>
                                            <button
                                                onClick={() => deleteProject(p.id)}
                                                className="p-2.5 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all active:scale-90"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-lg text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">{p.nombre}</h4>

                                    <div className="mt-6 space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Horas Cargas</span>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                    <span className={`text-sm font-bold ${isOver ? 'text-red-500' : 'text-slate-700'}`}>
                                                        {p.horasConsumidas} / {p.horasEstimadas} <span className="text-[10px] font-medium text-slate-400">HRS</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    className="w-16 bg-slate-50 border border-slate-200 rounded-xl py-1 px-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center transition-all"
                                                    defaultValue={p.horasConsumidas}
                                                    onBlur={(e) => {
                                                        const newVal = parseInt(e.target.value) || 0;
                                                        if (newVal !== p.horasConsumidas) {
                                                            updateConsumedHours(p.id, newVal);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const newVal = parseInt((e.target as HTMLInputElement).value) || 0;
                                                            updateConsumedHours(p.id, newVal);
                                                            (e.target as HTMLElement).blur();
                                                        }
                                                    }}
                                                />
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        onClick={() => updateConsumedHours(p.id, p.horasConsumidas + 1)}
                                                        className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded-md text-[10px] text-slate-400 hover:text-primary hover:border-primary/30 transition-all shadow-sm active:scale-90"
                                                    >
                                                        +
                                                    </button>
                                                    <button
                                                        onClick={() => updateConsumedHours(p.id, Math.max(0, p.horasConsumidas - 1))}
                                                        className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded-md text-[10px] text-slate-400 hover:text-primary hover:border-primary/30 transition-all shadow-sm active:scale-90"
                                                    >
                                                        -
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-primary'}`}
                                                style={{ width: `${Math.min(100, progress)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${p.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {p.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {!isLoading && filteredProjects.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-3xl text-slate-400">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-semibold text-slate-600">No se encontraron proyectos</p>
                </div>
            )}
        </div>
    );
}
