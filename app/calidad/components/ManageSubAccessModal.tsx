'use client';

import { useState, useMemo } from 'react';
import {
    X,
    FolderPlus,
    Edit2,
    Trash2,
    Loader2,
    Crown,
    Compass,
    TrendingUp,
    ShieldAlert,
    FileSpreadsheet,
    ShoppingCart,
    Hammer,
    CheckCircle2,
    Users,
    Wrench,
    Gauge,
    FileText,
    Layers,
    Target,
    BookOpen,
    Settings,
    Award,
    ClipboardCheck,
    Briefcase,
    Truck,
    HardHat,
    FileCheck,
    Plus,
    Check,
    Search,
    Maximize2,
    Minimize2,
    Sparkles,
    SlidersHorizontal
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { useModalScroll } from '@/lib/useModalScroll';

// Icon Map helper
export const SUB_ACCESS_ICONS: Record<string, any> = {
    Crown,
    Compass,
    TrendingUp,
    ShieldAlert,
    FileSpreadsheet,
    ShoppingCart,
    Hammer,
    CheckCircle2,
    Users,
    Wrench,
    Gauge,
    FileText,
    Layers,
    Target,
    BookOpen,
    Settings,
    Award,
    ClipboardCheck,
    Briefcase,
    Truck,
    HardHat,
    FileCheck,
    Sparkles,
    SlidersHorizontal
};

export function getSubAccessIcon(iconName?: string | null) {
    if (!iconName) return FileText;
    return SUB_ACCESS_ICONS[iconName] || FileText;
}

interface SubAccessItem {
    id: string;
    moduleId: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    icon: string | null;
    orden: number;
    esPersonalizado: boolean;
    _count?: { documentos: number };
}

interface ModuleItem {
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    icon: string | null;
    color: string | null;
    orden: number;
    subAccesses: SubAccessItem[];
}

interface ManageSubAccessModalProps {
    modules: ModuleItem[];
    user: any;
    onClose: () => void;
    onRefresh: () => void;
    initialSubAccessToEdit?: SubAccessItem | null;
    initialModuleId?: string | null;
}

export default function ManageSubAccessModal({
    modules,
    user,
    onClose,
    onRefresh,
    initialSubAccessToEdit,
    initialModuleId
}: ManageSubAccessModalProps) {
    useModalScroll(true);

    // Mode & Form state
    const [editingSubAccess, setEditingSubAccess] = useState<SubAccessItem | null>(initialSubAccessToEdit || null);
    const [selectedModuleTab, setSelectedModuleTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    const isEditing = Boolean(editingSubAccess);

    const [formData, setFormData] = useState({
        moduleId: initialSubAccessToEdit?.moduleId || initialModuleId || (modules[0]?.id ?? ''),
        codigo: initialSubAccessToEdit?.codigo || '',
        nombre: initialSubAccessToEdit?.nombre || '',
        descripcion: initialSubAccessToEdit?.descripcion || '',
        icon: initialSubAccessToEdit?.icon || 'FileText',
        orden: initialSubAccessToEdit?.orden || 0
    });

    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // If initial module or sub-access changes
    const handleSelectEdit = (sub: SubAccessItem) => {
        setEditingSubAccess(sub);
        setFormData({
            moduleId: sub.moduleId,
            codigo: sub.codigo,
            nombre: sub.nombre,
            descripcion: sub.descripcion || '',
            icon: sub.icon || 'FileText',
            orden: sub.orden
        });
    };

    const handleResetForm = (targetModuleId?: string) => {
        setEditingSubAccess(null);
        setFormData({
            moduleId: targetModuleId || formData.moduleId || (modules[0]?.id ?? ''),
            codigo: '',
            nombre: '',
            descripcion: '',
            icon: 'FileText',
            orden: 0
        });
    };

    // Auto-calculate next code if empty when creating
    const calculateSuggestedCode = (modId: string) => {
        const mod = modules.find(m => m.id === modId);
        if (!mod) return '';
        const count = mod.subAccesses.length;
        return `${mod.codigo}.${count + 1}`;
    };

    const handleModuleChange = (newModuleId: string) => {
        const updated = { ...formData, moduleId: newModuleId };
        if (!isEditing && (!formData.codigo || formData.codigo.startsWith(modules.find(m => m.id === formData.moduleId)?.codigo || ''))) {
            updated.codigo = calculateSuggestedCode(newModuleId);
        }
        setFormData(updated);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            showToast('El nombre del sub-acceso es obligatorio', 'error');
            return;
        }

        setLoading(true);
        try {
            if (isEditing && editingSubAccess) {
                // Update
                const res = await safeApiRequest(`/api/documentos/accesos/${editingSubAccess.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...formData,
                        userId: user?.id,
                        userName: user?.nombreCompleto || user?.nombre
                    })
                });
                if (res.ok) {
                    showToast('Sub-acceso actualizado exitosamente', 'success');
                    onRefresh();
                    handleResetForm();
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Error al actualizar sub-acceso', 'error');
                }
            } else {
                // Create
                const res = await safeApiRequest('/api/documentos/accesos', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...formData,
                        userId: user?.id,
                        userName: user?.nombreCompleto || user?.nombre
                    })
                });
                if (res.ok) {
                    showToast('Nuevo sub-acceso creado exitosamente', 'success');
                    onRefresh();
                    handleResetForm();
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Error al crear sub-acceso', 'error');
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red al procesar solicitud', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (sub: SubAccessItem) => {
        const docCount = sub._count?.documentos || 0;
        let confirmMsg = `¿Deseas eliminar el sub-acceso "${sub.codigo} - ${sub.nombre}"?`;
        if (docCount > 0) {
            confirmMsg += `\n\nAtención: Tiene ${docCount} documento(s) asociado(s). Los documentos no se borrarán, quedarán en estado 'Sin Asignar'.`;
        }
        if (!window.confirm(confirmMsg)) return;

        setDeletingId(sub.id);
        try {
            const params = new URLSearchParams({
                userId: user?.id || '',
                userName: user?.nombreCompleto || user?.nombre || ''
            });
            const res = await safeApiRequest(`/api/documentos/accesos/${sub.id}?${params}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast('Sub-acceso eliminado', 'success');
                if (editingSubAccess?.id === sub.id) {
                    handleResetForm();
                }
                onRefresh();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al eliminar', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red al eliminar', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // Filtered modules and sub-accesses for the explorer tree
    const filteredModules = useMemo(() => {
        return modules
            .filter(m => selectedModuleTab === 'all' || m.id === selectedModuleTab || m.codigo === selectedModuleTab)
            .map(m => {
                const filteredSubs = m.subAccesses.filter(sub => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                        sub.nombre.toLowerCase().includes(q) ||
                        sub.codigo.toLowerCase().includes(q) ||
                        (sub.descripcion && sub.descripcion.toLowerCase().includes(q))
                    );
                });
                return {
                    ...m,
                    subAccesses: filteredSubs
                };
            });
    }, [modules, selectedModuleTab, searchQuery]);

    const totalSubAccesses = useMemo(() => {
        return modules.reduce((acc, m) => acc + m.subAccesses.length, 0);
    }, [modules]);

    const SelectedIconComponent = getSubAccessIcon(formData.icon);
    const currentSelectedModule = modules.find(m => m.id === formData.moduleId);

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md transition-all ${
                isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'
            }`}
        >
            <div
                className={`relative bg-card text-card-foreground shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 ${
                    isFullscreen
                        ? 'w-full h-full rounded-none'
                        : 'w-full h-[95vh] max-w-[98vw] 2xl:max-w-[1600px] rounded-3xl'
                }`}
            >
                {/* ════════════════════════════════════════════════════════════════════════
                   HEADER (EXPANDED DESKTOP WORKSPACE)
                   ════════════════════════════════════════════════════════════════════════ */}
                <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-muted/40 shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-xs">
                            <FolderPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                                    Gestor de Estructura y Sub-accesos SGI
                                </h2>
                                <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    {modules.length} Módulos • {totalSubAccesses} Sub-procesos
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-bold hidden sm:block">
                                Configuración integral de procesos, carpetas y accesos documentales normativos (ISO 9001:2015)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Fullscreen Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hidden sm:flex items-center gap-1.5 text-xs font-bold"
                            title={isFullscreen ? 'Restaurar tamaño normal' : 'Pantalla Completa'}
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 className="w-4 h-4" />
                                    <span>Ventana</span>
                                </>
                            ) : (
                                <>
                                    <Maximize2 className="w-4 h-4" />
                                    <span>Pantalla Completa</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ════════════════════════════════════════════════════════════════════════
                   WORKSPACE BODY (2-COLUMN LARGE DESKTOP SPLIT)
                   ════════════════════════════════════════════════════════════════════════ */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800 bg-background/50">
                    
                    {/* ────────────────────────────────────────────────────────────────
                       LEFT COLUMN: FORM TO CREATE / EDIT SUB-ACCESS
                       ──────────────────────────────────────────────────────────────── */}
                    <div className="lg:col-span-5 p-6 overflow-y-auto flex flex-col justify-between space-y-6">
                        <div className="space-y-4">
                            {/* Header Form */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
                                        {isEditing ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                                            {isEditing ? 'Editar Sub-acceso Seleccionado' : 'Crear Nuevo Sub-acceso'}
                                        </h3>
                                        <p className="text-[11px] text-slate-400">
                                            {isEditing ? `Modificando registro ${editingSubAccess?.codigo}` : 'Agrega un nuevo proceso al SGI'}
                                        </p>
                                    </div>
                                </div>

                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => handleResetForm()}
                                        className="text-xs font-bold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                                    >
                                        + Modo Creación
                                    </button>
                                )}
                            </div>

                            {/* Live Preview Badge */}
                            <div className="p-3.5 rounded-2xl bg-card border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <SelectedIconComponent className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-mono font-black text-slate-500">
                                                {formData.codigo || 'X.X'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                                {formData.nombre || 'Nombre del Sub-acceso'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate">
                                            {currentSelectedModule ? `Módulo ${currentSelectedModule.codigo}: ${currentSelectedModule.nombre}` : 'Módulo'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-muted text-slate-500 shrink-0">
                                    Vista Previa
                                </span>
                            </div>

                            {/* Form */}
                            <form id="subAccessForm" onSubmit={handleSave} className="space-y-4 bg-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                                {/* Module Selector */}
                                <div>
                                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        Módulo Principal Padre *
                                    </label>
                                    <select
                                        value={formData.moduleId}
                                        onChange={e => handleModuleChange(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary cursor-pointer hover:border-primary/50 transition-colors"
                                        required
                                    >
                                        {modules.map(m => (
                                            <option key={m.id} value={m.id}>
                                                Módulo {m.codigo}: {m.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Codigo & Nombre */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                            Código
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="ej. 1.4"
                                            value={formData.codigo}
                                            onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary font-mono"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                            Nombre del Sub-acceso *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="ej. Gestión Ambiental y Sostenibilidad"
                                            value={formData.nombre}
                                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Descripcion / Documentos Tipicos */}
                                <div>
                                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                        Descripción y Documentos Típicos / Referencias Normativas
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="ej. Procedimiento de Gestión Ambiental (PG-140-01), Matrices de aspectos e impactos ambientales, registros de disposición de residuos y manifiestos."
                                        value={formData.descripcion}
                                        onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-primary resize-none leading-relaxed"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Esta descripción servirá como guía visual y de inducción en la biblioteca documental.
                                    </p>
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span>Icono de Lucide</span>
                                        <span className="text-[11px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md">
                                            <SelectedIconComponent className="w-3.5 h-3.5" /> {formData.icon}
                                        </span>
                                    </label>
                                    <div className="grid grid-cols-8 gap-2 p-2.5 bg-background rounded-xl border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto">
                                        {Object.keys(SUB_ACCESS_ICONS).map(iconKey => {
                                            const IconComp = SUB_ACCESS_ICONS[iconKey];
                                            const isSelected = formData.icon === iconKey;
                                            return (
                                                <button
                                                    key={iconKey}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, icon: iconKey })}
                                                    className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                                                        isSelected
                                                            ? 'bg-primary text-white shadow-md scale-105 ring-2 ring-primary/30'
                                                            : 'text-slate-500 hover:bg-muted hover:text-slate-800 dark:hover:text-slate-200'
                                                    }`}
                                                    title={iconKey}
                                                >
                                                    <IconComp className="w-4 h-4" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Submit Actions */}
                        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => handleResetForm()}
                                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-muted rounded-xl transition-colors"
                                >
                                    Cancelar Edición
                                </button>
                            )}
                            <button
                                type="submit"
                                form="subAccessForm"
                                disabled={loading}
                                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isEditing ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                <span>{isEditing ? 'Guardar Cambios' : 'Crear Sub-acceso'}</span>
                            </button>
                        </div>
                    </div>

                    {/* ────────────────────────────────────────────────────────────────
                       RIGHT COLUMN: STRUCTURE EXPLORER & TREE
                       ──────────────────────────────────────────────────────────────── */}
                    <div className="lg:col-span-7 p-6 overflow-y-auto flex flex-col space-y-4">
                        {/* Top Filters / Search Bar */}
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            {/* Module Tabs */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                <button
                                    type="button"
                                    onClick={() => setSelectedModuleTab('all')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                        selectedModuleTab === 'all'
                                            ? 'bg-primary text-white shadow-xs'
                                            : 'bg-card text-slate-500 hover:bg-muted border border-slate-200 dark:border-slate-800'
                                    }`}
                                >
                                    Todos ({totalSubAccesses})
                                </button>
                                {modules.map(mod => (
                                    <button
                                        key={mod.id}
                                        type="button"
                                        onClick={() => setSelectedModuleTab(mod.id)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                            selectedModuleTab === mod.id
                                                ? 'bg-primary text-white shadow-xs'
                                                : 'bg-card text-slate-500 hover:bg-muted border border-slate-200 dark:border-slate-800'
                                        }`}
                                    >
                                        Módulo {mod.codigo} ({mod.subAccesses.length})
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative min-w-[200px]">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar sub-acceso..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Modules & Sub-access Cards Tree */}
                        <div className="space-y-4 flex-1">
                            {filteredModules.map(mod => {
                                const modColor = mod.color || 'indigo';
                                return (
                                    <div
                                        key={mod.id}
                                        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xs"
                                    >
                                        {/* Module Header */}
                                        <div
                                            className={`px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between ${
                                                modColor === 'emerald'
                                                    ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                                    : modColor === 'amber'
                                                    ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                                                    : 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xs font-black uppercase font-mono px-2.5 py-0.5 rounded-lg bg-white/80 dark:bg-slate-900/60 shadow-xs">
                                                    Módulo {mod.codigo}
                                                </span>
                                                <h4 className="text-sm font-black truncate">{mod.nombre}</h4>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold opacity-80">
                                                    {mod.subAccesses.length} sub-accesos
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleResetForm(mod.id);
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            moduleId: mod.id,
                                                            codigo: calculateSuggestedCode(mod.id)
                                                        }));
                                                    }}
                                                    className="p-1 rounded-lg hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors text-xs font-bold"
                                                    title={`Agregar sub-acceso al Módulo ${mod.codigo}`}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Sub-access items */}
                                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                            {mod.subAccesses.map(sub => {
                                                const SubIcon = getSubAccessIcon(sub.icon);
                                                const isCurrentEdit = editingSubAccess?.id === sub.id;
                                                return (
                                                    <div
                                                        key={sub.id}
                                                        className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                                                            isCurrentEdit
                                                                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40'
                                                                : 'border-slate-200/70 dark:border-slate-800/90 bg-muted/20 hover:bg-muted/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-card border border-slate-200 dark:border-slate-800 flex items-center justify-center text-primary shrink-0 shadow-xs">
                                                                <SubIcon className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-mono font-black text-slate-500">
                                                                        {sub.codigo}
                                                                    </span>
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                                                        {sub.nombre}
                                                                    </p>
                                                                </div>
                                                                {sub.descripcion && (
                                                                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                                                                        {sub.descripcion}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Actions & Stats */}
                                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/60">
                                                            <span className="text-[10px] font-bold bg-card border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-md text-slate-500">
                                                                {sub._count?.documentos || 0} docs vinculados
                                                            </span>

                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectEdit(sub)}
                                                                    className="px-2 py-1 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                                                                    title="Editar sub-acceso"
                                                                >
                                                                    <Edit2 className="w-3 h-3" />
                                                                    <span>Editar</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(sub)}
                                                                    disabled={deletingId === sub.id}
                                                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Eliminar sub-acceso"
                                                                >
                                                                    {deletingId === sub.id ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {mod.subAccesses.length === 0 && (
                                                <div className="col-span-full py-6 text-center text-xs text-slate-400 italic">
                                                    No se encontraron sub-accesos para este criterio
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredModules.length === 0 && (
                                <div className="py-16 text-center text-slate-400 space-y-2">
                                    <FolderPlus className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                                    <p className="text-xs font-bold">No hay módulos o sub-accesos para mostrar</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════════════════════════════════════════════════
                   FOOTER
                   ════════════════════════════════════════════════════════════════════════ */}
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-muted/20 shrink-0">
                    <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">
                        Consejo: Puedes alternar entre vista de ventana amplia y pantalla completa con el botón superior.
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-black bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-700 dark:text-slate-200 ml-auto"
                    >
                        Cerrar Gestor
                    </button>
                </div>
            </div>
        </div>
    );
}
