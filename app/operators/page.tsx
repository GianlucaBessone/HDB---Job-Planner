'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Trash2,
    Users as UsersIcon,
    Tag as TagIcon,
    X,
    UserPlus,
    CheckCircle2,
    ShieldAlert,
    AlertCircle,
    Edit3,
    XCircle
} from 'lucide-react';

const PREDEFINED_TAGS = ['Electricista', 'Ayudante', 'Técnico CCTV', 'Supervisor', 'Otro'];

export default function OperatorsPage() {
    const [operators, setOperators] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingOperator, setEditingOperator] = useState<any>(null);
    const [formData, setFormData] = useState({
        nombreCompleto: '',
        activo: true,
        etiquetas: [] as string[]
    });
    const [customTag, setCustomTag] = useState('');

    useEffect(() => {
        loadOperators();
    }, []);

    const loadOperators = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await fetch('/api/operators').then(res => res.json());
            setOperators(data);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const openCreate = () => {
        setEditingOperator(null);
        setFormData({ nombreCompleto: '', activo: true, etiquetas: [] });
        setIsModalOpen(true);
    };

    const openEdit = (op: any) => {
        setEditingOperator(op);
        setFormData({
            nombreCompleto: op.nombreCompleto,
            activo: op.activo,
            etiquetas: op.etiquetas || []
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombreCompleto) return;

        const method = editingOperator ? 'PATCH' : 'POST';
        const url = editingOperator ? `/api/operators?id=${editingOperator.id}` : '/api/operators';

        await fetch(url, {
            method,
            body: JSON.stringify(formData)
        });

        setIsModalOpen(false);
        loadOperators(true);
    };

    const toggleTag = (tag: string) => {
        const current = formData.etiquetas;
        if (current.includes(tag)) {
            setFormData({ ...formData, etiquetas: current.filter(t => t !== tag) });
        } else {
            setFormData({ ...formData, etiquetas: [...current, tag] });
        }
    };

    const handleAddCustomTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && customTag.trim()) {
            e.preventDefault();
            if (!formData.etiquetas.includes(customTag.trim())) {
                setFormData({ ...formData, etiquetas: [...formData.etiquetas, customTag.trim()] });
            }
            setCustomTag('');
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        // Optimistic update
        setOperators(prev => prev.map(op => op.id === id ? { ...op, activo: !currentStatus } : op));
        await fetch(`/api/operators?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ activo: !currentStatus })
        });
    };

    const deleteOperator = async (id: string) => {
        if (!confirm('¿Eliminar operador?')) return;
        // Optimistic update
        setOperators(prev => prev.filter(op => op.id !== id));
        await fetch(`/api/operators?id=${id}`, { method: 'DELETE' });
    };

    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const filteredOperators = operators.filter(op =>
        normalize(op.nombreCompleto).includes(normalize(searchTerm))
    );

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Operadores</h2>
                    <p className="text-slate-500 font-medium">Controla el equipo técnico disponible</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary/90 shadow-xl shadow-primary/20 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <UserPlus className="w-5 h-5" />
                    Nuevo Operador
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre de operador..."
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
                            <div className="flex justify-between items-center border-b pb-4">
                                <h3 className="text-xl font-bold text-slate-800">
                                    {editingOperator ? 'Editar Operador' : 'Alta de Operador'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 trasition-all">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nombre Completo</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        value={formData.nombreCompleto}
                                        onChange={e => setFormData({ ...formData, nombreCompleto: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                        <TagIcon className="w-3 h-3" />
                                        Especialidades (Presiona Enter para nueva)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Escribe y presiona Enter..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:ring-1 focus:ring-primary/20"
                                        value={customTag}
                                        onChange={e => setCustomTag(e.target.value)}
                                        onKeyDown={handleAddCustomTag}
                                    />
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {Array.from(new Set([...PREDEFINED_TAGS, ...formData.etiquetas])).map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => toggleTag(tag)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${formData.etiquetas.includes(tag)
                                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40'
                                                    }`}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] bg-primary text-white px-6 py-4 rounded-2xl font-bold hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all"
                                    >
                                        {editingOperator ? 'Guardar Cambios' : 'Registrar Operador'}
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
                        <div key={i} className="h-40 bg-slate-100/50 rounded-3xl animate-pulse"></div>
                    ))
                ) : (
                    <>
                        {filteredOperators.map((op: any) => {
                            const tags = op.etiquetas || [];
                            return (
                                <div key={op.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-primary/30 hover:shadow-xl transition-all duration-300 overflow-hidden relative">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className={`p-3 rounded-2xl transition-all duration-300 ${op.activo ? 'bg-slate-50 group-hover:bg-primary group-hover:text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <UsersIcon className="w-6 h-6" />
                                        </div>
                                        <div className="flex gap-0.5">
                                            <button
                                                onClick={() => openEdit(op)}
                                                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-primary transition-all active:scale-90"
                                            >
                                                <Edit3 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(op.id, op.activo)}
                                                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-all active:scale-90"
                                            >
                                                {op.activo ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-slate-300" />}
                                            </button>
                                            <button
                                                onClick={() => deleteOperator(op.id)}
                                                className="p-2.5 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all active:scale-90"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative z-10">
                                        <h4 className="font-bold text-lg text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">{op.nombreCompleto}</h4>
                                        <div className="flex flex-wrap gap-1.5 mt-3 min-h-[32px]">
                                            {tags.map((t: string) => (
                                                <span key={t} className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-slate-100 group-hover:border-primary/10 transition-colors">
                                                    {t}
                                                </span>
                                            ))}
                                            {tags.length === 0 && <span className="text-xs text-slate-300 italic font-medium">Sin etiquetas</span>}
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-50">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${op.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {op.activo ? 'Activo' : 'Baja'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {!isLoading && filteredOperators.length === 0 && (
                <div className="py-24 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-[40px] text-slate-400">
                    <ShieldAlert className="w-16 h-16 mb-4 opacity-10 text-slate-900" />
                    <p className="font-bold text-slate-700 text-lg">Equipo de trabajo vacío</p>
                </div>
            )}
        </div>
    );
}
