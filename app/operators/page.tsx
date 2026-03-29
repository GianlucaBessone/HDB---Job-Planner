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
    XCircle,
    LayoutGrid,
    List
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { safeApiRequest } from '@/lib/offline';
import SearchableSelect from '@/components/SearchableSelect';

const PREDEFINED_TAGS = ['Electricista', 'Ayudante', 'Técnico CCTV', 'Supervisor', 'Otro'];

export default function OperatorsPage() {
    const [operators, setOperators] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [editingOperator, setEditingOperator] = useState<any>(null);
    const [formData, setFormData] = useState({
        nombreCompleto: '',
        activo: true,
        enVacaciones: false,
        role: 'operador',
        pin: '1234',
        etiquetas: [] as string[]
    });
    const [customTag, setCustomTag] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [operatorToDelete, setOperatorToDelete] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        let parsed = null;
        if (stored) {
            try {
                parsed = JSON.parse(stored);
                setCurrentUser(parsed);
            } catch (e) { }
        }
        loadOperators(false, parsed);
    }, []);

    const loadOperators = async (silent = false, userObj?: any) => {
        if (!silent) setIsLoading(true);
        try {
            const user = userObj || currentUser;
            let data = await safeApiRequest('/api/operators').then(res => res.json());
            if (user?.role === 'operador' || user?.role === 'vendedor') {
                data = data.filter((op: any) => op.id === user.id);
            }
            setOperators(data);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const openCreate = () => {
        setEditingOperator(null);
        setFormData({ nombreCompleto: '', activo: true, enVacaciones: false, etiquetas: [], role: 'operador', pin: '1234' });
        setIsModalOpen(true);
    };

    const openEdit = (op: any) => {
        setEditingOperator(op);
        setFormData({
            nombreCompleto: op.nombreCompleto,
            activo: op.activo,
            enVacaciones: op.enVacaciones || false,
            etiquetas: op.etiquetas || [],
            role: op.role || 'operador',
            pin: op.pin || '1234'
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombreCompleto) return;

        const method = editingOperator ? 'PATCH' : 'POST';
        const url = editingOperator ? `/api/operators?id=${editingOperator.id}` : '/api/operators';

        await safeApiRequest(url, {
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
        await safeApiRequest(`/api/operators?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ activo: !currentStatus })
        });
    };

    const handleDeleteClick = (id: string) => {
        setOperatorToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!operatorToDelete) return;
        const id = operatorToDelete;
        setOperators(prev => prev.filter(op => op.id !== id));
        await safeApiRequest(`/api/operators?id=${id}`, { method: 'DELETE' });
        setIsConfirmOpen(false);
        setOperatorToDelete(null);
    };

    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const filteredOperators = operators.filter(op =>
        normalize(op.nombreCompleto).includes(normalize(searchTerm))
    );

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <UsersIcon className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Gestión de Operadores
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">Controla el equipo técnico disponible</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all w-full md:w-auto justify-center text-sm"
                >
                    <UserPlus className="w-4 h-4" />
                    Nuevo Operador
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        className="w-full h-[42px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-slate-700 dark:text-slate-200 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl shrink-0">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`btn-icon-inline p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`btn-icon-inline p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                    >
                        <List className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        {/* Header - Fixed */}
                        <div className="p-5 md:p-8 flex justify-between items-center border-b flex-shrink-0">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                {editingOperator ? 'Editar Operador' : 'Alta de Operador'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="btn-icon-inline p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 custom-scrollbar">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nombre Completo</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium disabled:opacity-50"
                                        value={formData.nombreCompleto}
                                        onChange={e => setFormData({ ...formData, nombreCompleto: e.target.value })}
                                        disabled={currentUser?.role === 'operador' || currentUser?.role === 'vendedor'}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Rol</label>
                                        <SearchableSelect
                                            options={[
                                                { id: 'operador', label: 'Operador' },
                                                { id: 'supervisor', label: 'Supervisor' },
                                                { id: 'admin', label: 'Administrador' },
                                                { id: 'vendedor', label: 'Vendedor' }
                                            ]}
                                            value={formData.role}
                                            onChange={(val) => setFormData({ ...formData, role: val })}
                                            disabled={currentUser?.role === 'operador' || currentUser?.role === 'vendedor'}
                                            className="!space-y-0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">PIN / Contraseña</label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={8}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium tracking-widest"
                                            value={formData.pin}
                                            onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                                            placeholder="Ej: 1234"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Modo Ausente / Vacaciones</h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Evita recibir alertas diarias de carga de horas.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.enVacaciones}
                                            onChange={e => setFormData({ ...formData, enVacaciones: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>

                                {currentUser?.role !== 'operador' && currentUser?.role !== 'vendedor' && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
                                            <TagIcon className="w-3 h-3" />
                                            Especialidades (Presiona Enter para nueva)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Escribe y presiona Enter..."
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm outline-none focus:ring-1 focus:ring-primary/20"
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
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/40'
                                                        }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer - Fixed */}
                            <div className="p-5 md:p-8 border-t flex gap-3 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 transition-all"
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
            )}

            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
                {isLoading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className={`bg-slate-100/50 rounded-3xl animate-pulse ${viewMode === 'grid' ? 'h-40' : 'h-16'}`}></div>
                    ))
                ) : (
                    <>
                        {filteredOperators.map((op: any) => {
                            const tags = op.etiquetas || [];
                            if (viewMode === 'list') {
                                return (
                                    <div key={op.id} className="bg-white dark:bg-slate-800 px-4 md:px-6 py-3 md:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-primary/30 transition-all group">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${op.activo ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500'}`}>
                                                <UsersIcon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{op.nombreCompleto}</h4>
                                                <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                                    <span className={`px-2 py-[2px] rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                                        op.role === 'admin' || op.role === 'supervisor' ? 'bg-indigo-100 text-indigo-700' : 
                                                        op.role === 'vendedor' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        {op.role || 'operador'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1 overflow-hidden">
                                                    {tags.slice(0, 2).map((t: string) => (
                                                        <span key={t} className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{t}</span>
                                                    ))}
                                                    {tags.length > 2 && <span className="text-[9px] font-bold text-primary italic">+{tags.length - 2}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => openEdit(op)}
                                                className="btn-icon-inline p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 hover:text-primary transition-all active:scale-95"
                                            >
                                                <Edit3 className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>
                                            {currentUser?.role !== 'operador' && currentUser?.role !== 'vendedor' && (
                                                <>
                                                    <button
                                                        onClick={() => toggleStatus(op.id, op.activo)}
                                                        className="btn-icon-inline p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 transition-all active:scale-95"
                                                    >
                                                        {op.activo ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <XCircle className="w-4 h-4 md:w-5 md:h-5 text-slate-300" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(op.id)}
                                                        className="btn-icon-inline p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all active:scale-95"
                                                    >
                                                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={op.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm group hover:border-primary/30 hover:shadow-xl transition-all duration-300 overflow-hidden relative">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className={`p-3 rounded-2xl transition-all duration-300 ${op.activo ? 'bg-slate-50 dark:bg-slate-900/50 group-hover:bg-primary group-hover:text-white' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500'}`}>
                                            <UsersIcon className="w-6 h-6" />
                                        </div>
                                        <div className="flex gap-0.5">
                                            <button
                                                onClick={() => openEdit(op)}
                                                className="btn-icon-inline p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 hover:text-primary transition-all active:scale-90"
                                            >
                                                <Edit3 className="w-5 h-5" />
                                            </button>
                                            {currentUser?.role !== 'operador' && currentUser?.role !== 'vendedor' && (
                                                <>
                                                    <button
                                                        onClick={() => toggleStatus(op.id, op.activo)}
                                                        className="btn-icon-inline p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 transition-all active:scale-90"
                                                    >
                                                        {op.activo ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-slate-300" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(op.id)}
                                                        className="btn-icon-inline p-2.5 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all active:scale-90"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="relative z-10">
                                        <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                            <span className={`px-2 py-[2px] rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                                op.role === 'admin' || op.role === 'supervisor' ? 'bg-indigo-100 text-indigo-700' : 
                                                op.role === 'vendedor' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400'
                                            }`}>
                                                {op.role || 'operador'}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-primary transition-colors">{op.nombreCompleto}</h4>
                                        <div className="flex flex-wrap gap-1.5 mt-3 min-h-[32px]">
                                            {tags.map((t: string) => (
                                                <span key={t} className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 group-hover:border-primary/10 transition-colors">
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
                <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[40px] text-slate-400 dark:text-slate-500">
                    <ShieldAlert className="w-16 h-16 mb-4 opacity-10 text-slate-900 dark:text-slate-50" />
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-lg">Equipo de trabajo vacío</p>
                </div>
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Operador"
                message="¿Estás seguro de que deseas eliminar este operador? Esta acción no se puede deshacer."
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}
