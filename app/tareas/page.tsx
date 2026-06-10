'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, isPast, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import ModuleHeader from '@/components/ModuleHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import SearchableSelect from '@/components/SearchableSelect';
import {
    ListTodo, Plus, X, Save, Trash2, Clock, Users as UsersIcon,
    AlertTriangle, Calendar as CalendarIcon, GripVertical,
    Bell, BellRing, Check, ChevronRight, Filter, Columns3, List,
    User, FolderKanban, Eye, Edit3, Timer, Flag, Briefcase,
    BellPlus, Loader2
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface Tarea {
    id: string;
    titulo: string;
    descripcion?: string;
    estado: string;
    prioridad: string;
    categoria?: string;
    fechaInicio?: string;
    fechaVencimiento?: string;
    fechaCompletada?: string;
    projectId?: string;
    project?: { id: string; nombre: string; codigoProyecto?: string };
    creadorId: string;
    creadorNombre: string;
    involucrados: TareaInvolucrado[];
    recordatorios: TareaRecordatorio[];
    notas?: string;
    createdAt: string;
}

interface TareaInvolucrado {
    id: string;
    operatorId: string;
    operator: { id: string; nombreCompleto: string; role: string };
    rol: string;
}

interface TareaRecordatorio {
    id: string;
    tipo: string;
    fechaDisparo: string;
    mensaje?: string;
    cronJobId?: number;
    cronJobActivo: boolean;
    disparado: boolean;
    fechaDisparado?: string;
}

const ESTADOS = [
    { value: 'pendiente', label: 'Pendiente', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', dot: 'bg-slate-400' },
    { value: 'en_progreso', label: 'En Progreso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500' },
    { value: 'completada', label: 'Completada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
    { value: 'cancelada', label: 'Cancelada', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', dot: 'bg-rose-400' },
];

const PRIORIDADES = [
    { value: 'baja', label: 'Baja', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700', icon: '○' },
    { value: 'media', label: 'Media', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30', icon: '◐' },
    { value: 'alta', label: 'Alta', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30', icon: '●' },
    { value: 'urgente', label: 'Urgente', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/30', icon: '🔴' },
];

const ROLES_INVOLUCRADO = [
    { value: 'responsable', label: 'Responsable' },
    { value: 'colaborador', label: 'Colaborador' },
    { value: 'observador', label: 'Observador' },
];

const TIPOS_RECORDATORIO = [
    { value: 'unico', label: 'Único (una sola vez)' },
    { value: 'diario', label: 'Diario' },
    { value: 'semanal', label: 'Semanal' },
];

// ── Page ───────────────────────────────────────────────────────────
export default function TareasPage() {
    const router = useRouter();
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'kanban' | 'lista'>('kanban');
    const [search, setSearch] = useState('');
    const [filterPrioridad, setFilterPrioridad] = useState('');
    const [filterMisTareas, setFilterMisTareas] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [editingTarea, setEditingTarea] = useState<Tarea | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({
        titulo: '',
        descripcion: '',
        estado: 'pendiente',
        prioridad: 'media',
        categoria: '',
        fechaInicio: '',
        fechaVencimiento: '',
        projectId: '',
        notas: '',
    });
    const [formInvolucrados, setFormInvolucrados] = useState<{ operatorId: string; rol: string }[]>([]);
    const [formRecordatorios, setFormRecordatorios] = useState<{ tipo: string; fechaDisparo: string; mensaje: string }[]>([]);

    const currentUser = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('currentUser');
        if (!stored) return null;
        try { return JSON.parse(stored); } catch { return null; }
    }, []);

    // ── Load Data ──────────────────────────────────────────────────
    const loadTareas = useCallback(async () => {
        try {
            const data = await safeApiRequest('/api/tareas').then(r => r.json());
            setTareas(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('[LOAD_TAREAS]', e);
        }
    }, []);

    const loadSupport = useCallback(async () => {
        try {
            const [ops, projs] = await Promise.all([
                safeApiRequest('/api/operators').then(r => r.json()),
                safeApiRequest('/api/projects').then(r => r.json()),
            ]);
            setOperators(ops.filter((o: any) => o.activo));
            setProjects(projs.filter((p: any) => p.activo && p.estado !== 'finalizado'));
        } catch (e) {
            console.error('[LOAD_SUPPORT]', e);
        }
    }, []);

    useEffect(() => {
        Promise.all([loadTareas(), loadSupport()]).finally(() => setIsLoading(false));
    }, [loadTareas, loadSupport]);

    // ── Filtered tareas ────────────────────────────────────────────
    const filteredTareas = useMemo(() => {
        return tareas.filter(t => {
            if (search) {
                const q = search.toLowerCase();
                const match = t.titulo.toLowerCase().includes(q) ||
                    t.descripcion?.toLowerCase().includes(q) ||
                    t.creadorNombre.toLowerCase().includes(q) ||
                    t.project?.nombre?.toLowerCase().includes(q) ||
                    t.involucrados.some(inv => inv.operator.nombreCompleto.toLowerCase().includes(q));
                if (!match) return false;
            }
            if (filterPrioridad && t.prioridad !== filterPrioridad) return false;
            if (filterMisTareas && currentUser?.id) {
                const isInvolved = t.involucrados.some(inv => inv.operatorId === currentUser.id);
                const isCreator = t.creadorId === currentUser.id;
                if (!isInvolved && !isCreator) return false;
            }
            return true;
        });
    }, [tareas, search, filterPrioridad, filterMisTareas, currentUser]);

    // ── Kanban columns ─────────────────────────────────────────────
    const kanbanColumns = useMemo(() => {
        const cols: Record<string, Tarea[]> = {
            pendiente: [],
            en_progreso: [],
            completada: [],
            cancelada: [],
        };
        filteredTareas.forEach(t => {
            if (cols[t.estado]) cols[t.estado].push(t);
        });
        return cols;
    }, [filteredTareas]);

    // ── Modal Handlers ─────────────────────────────────────────────
    const openNew = () => {
        setEditingTarea(null);
        setForm({
            titulo: '',
            descripcion: '',
            estado: 'pendiente',
            prioridad: 'media',
            categoria: '',
            fechaInicio: '',
            fechaVencimiento: '',
            projectId: '',
            notas: '',
        });
        setFormInvolucrados([]);
        setFormRecordatorios([]);
        setShowModal(true);
    };

    const openEdit = (t: Tarea) => {
        setEditingTarea(t);
        setForm({
            titulo: t.titulo,
            descripcion: t.descripcion || '',
            estado: t.estado,
            prioridad: t.prioridad,
            categoria: t.categoria || '',
            fechaInicio: t.fechaInicio ? t.fechaInicio.slice(0, 16) : '',
            fechaVencimiento: t.fechaVencimiento ? t.fechaVencimiento.slice(0, 16) : '',
            projectId: t.projectId || '',
            notas: t.notas || '',
        });
        setFormInvolucrados(t.involucrados.map(inv => ({ operatorId: inv.operatorId, rol: inv.rol })));
        setFormRecordatorios([]);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.titulo.trim()) {
            showToast('El título es obligatorio', 'error');
            return;
        }
        setIsSaving(true);
        try {
            if (editingTarea) {
                // Update
                const res = await safeApiRequest('/api/tareas', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingTarea.id,
                        ...form,
                        involucrados: formInvolucrados,
                    }),
                }).then(r => r.json());

                if (res.error) throw new Error(res.error);

                // Create new recordatorios if any
                for (const rec of formRecordatorios) {
                    if (rec.fechaDisparo) {
                        await safeApiRequest('/api/tareas/recordatorios', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                tareaId: editingTarea.id,
                                tipo: rec.tipo,
                                fechaDisparo: rec.fechaDisparo,
                                mensaje: rec.mensaje || form.titulo,
                            }),
                        });
                    }
                }

                showToast('Tarea actualizada', 'success');
            } else {
                // Create
                const res = await safeApiRequest('/api/tareas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...form,
                        creadorId: currentUser?.id || 'unknown',
                        creadorNombre: currentUser?.nombreCompleto || 'Sistema',
                        involucrados: formInvolucrados,
                    }),
                }).then(r => r.json());

                if (res.error) throw new Error(res.error);

                // Create recordatorios
                for (const rec of formRecordatorios) {
                    if (rec.fechaDisparo) {
                        await safeApiRequest('/api/tareas/recordatorios', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                tareaId: res.id,
                                tipo: rec.tipo,
                                fechaDisparo: rec.fechaDisparo,
                                mensaje: rec.mensaje || form.titulo,
                            }),
                        });
                    }
                }

                showToast('Tarea creada', 'success');
            }

            setShowModal(false);
            await loadTareas();
        } catch (error: any) {
            showToast(error.message || 'Error al guardar', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await safeApiRequest(`/api/tareas?id=${id}`, { method: 'DELETE' });
            showToast('Tarea eliminada', 'success');
            await loadTareas();
        } catch (e) {
            showToast('Error al eliminar', 'error');
        }
        setConfirmDelete(null);
    };

    const handleQuickStatusChange = async (tarea: Tarea, newEstado: string) => {
        try {
            await safeApiRequest('/api/tareas', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tarea.id, estado: newEstado }),
            });
            await loadTareas();
            showToast(`Estado actualizado a "${ESTADOS.find(e => e.value === newEstado)?.label}"`, 'success');
        } catch (e) {
            showToast('Error al actualizar estado', 'error');
        }
    };

    const handleDeleteRecordatorio = async (recId: string) => {
        try {
            await safeApiRequest(`/api/tareas/recordatorios?id=${recId}`, { method: 'DELETE' });
            showToast('Recordatorio eliminado', 'success');
            await loadTareas();
        } catch (e) {
            showToast('Error al eliminar recordatorio', 'error');
        }
    };

    // ── Helpers ────────────────────────────────────────────────────
    const getEstadoConfig = (estado: string) => ESTADOS.find(e => e.value === estado) || ESTADOS[0];
    const getPrioridadConfig = (prioridad: string) => PRIORIDADES.find(p => p.value === prioridad) || PRIORIDADES[1];

    const getVencimientoInfo = (fecha?: string) => {
        if (!fecha) return null;
        const d = new Date(fecha);
        const hoursLeft = differenceInHours(d, new Date());
        const isOverdue = isPast(d);
        const distStr = formatDistanceToNow(d, { locale: es, addSuffix: true });

        if (isOverdue) return { text: `Vencida ${distStr}`, class: 'text-rose-600 dark:text-rose-400 font-bold', urgent: true };
        if (hoursLeft <= 24) return { text: `Vence ${distStr}`, class: 'text-amber-600 dark:text-amber-400 font-bold', urgent: true };
        if (hoursLeft <= 72) return { text: `Vence ${distStr}`, class: 'text-amber-500 dark:text-amber-400', urgent: false };
        return { text: `Vence ${distStr}`, class: 'text-slate-500 dark:text-slate-400', urgent: false };
    };

    // ── Render ─────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20">
            <ModuleHeader
                title="Tareas"
                description="Planificación, involucrados y recordatorios"
                icon={<ListTodo />}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Buscar tareas..."
                actions={[
                    {
                        id: 'filter-mis-tareas',
                        label: filterMisTareas ? 'Todas' : 'Mis Tareas',
                        icon: <User />,
                        onClick: () => setFilterMisTareas(!filterMisTareas),
                        variant: filterMisTareas ? 'secondary' : 'ghost',
                        hideLabelOnMobile: true,
                    },
                    {
                        id: 'view-toggle',
                        label: view === 'kanban' ? 'Lista' : 'Kanban',
                        icon: view === 'kanban' ? <List /> : <Columns3 />,
                        onClick: () => setView(view === 'kanban' ? 'lista' : 'kanban'),
                        variant: 'outline',
                        hideLabelOnMobile: true,
                    },
                    {
                        id: 'new-tarea',
                        label: 'Nueva Tarea',
                        icon: <Plus />,
                        onClick: openNew,
                        variant: 'primary',
                        hideLabelOnMobile: true,
                    },
                ]}
                tabs={[
                    { id: '', label: 'Todas', icon: <ListTodo /> },
                    { id: 'baja', label: 'Baja', icon: <Flag /> },
                    { id: 'media', label: 'Media', icon: <Flag /> },
                    { id: 'alta', label: 'Alta', icon: <Flag /> },
                    { id: 'urgente', label: 'Urgente', icon: <AlertTriangle /> },
                ]}
                activeTabId={filterPrioridad}
                onTabChange={(tabId) => setFilterPrioridad(tabId)}
            />

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ESTADOS.filter(e => e.value !== 'cancelada').map(e => {
                    const count = tareas.filter(t => t.estado === e.value).length;
                    return (
                        <div key={e.value} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
                            <div className={`w-3 h-3 rounded-full ${e.dot}`}></div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{count}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{e.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Kanban View */}
            {view === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {ESTADOS.map(estadoConfig => {
                        const columnTareas = kanbanColumns[estadoConfig.value] || [];
                        return (
                            <div key={estadoConfig.value} className="space-y-3">
                                {/* Column Header */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${estadoConfig.dot}`}></div>
                                        <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">{estadoConfig.label}</h3>
                                    </div>
                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{columnTareas.length}</span>
                                </div>
                                {/* Column Cards */}
                                <div className="space-y-2.5 min-h-[100px]">
                                    {columnTareas.map(tarea => (
                                        <TareaCard
                                            key={tarea.id}
                                            tarea={tarea}
                                            onEdit={() => openEdit(tarea)}
                                            onDelete={() => setConfirmDelete(tarea.id)}
                                            onStatusChange={(s) => handleQuickStatusChange(tarea, s)}
                                            getEstadoConfig={getEstadoConfig}
                                            getPrioridadConfig={getPrioridadConfig}
                                            getVencimientoInfo={getVencimientoInfo}
                                        />
                                    ))}
                                    {columnTareas.length === 0 && (
                                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sin tareas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {view === 'lista' && (
                <div className="space-y-2">
                    {filteredTareas.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                            <ListTodo className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No hay tareas</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Crea una nueva tarea para comenzar</p>
                        </div>
                    ) : (
                        filteredTareas.map(tarea => (
                            <TareaListRow
                                key={tarea.id}
                                tarea={tarea}
                                onEdit={() => openEdit(tarea)}
                                onDelete={() => setConfirmDelete(tarea.id)}
                                onStatusChange={(s) => handleQuickStatusChange(tarea, s)}
                                getEstadoConfig={getEstadoConfig}
                                getPrioridadConfig={getPrioridadConfig}
                                getVencimientoInfo={getVencimientoInfo}
                            />
                        ))
                    )}
                </div>
            )}

            {/* ──── Create/Edit Modal ──── */}
            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto p-4 pt-[5vh]" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4 duration-300 my-4" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><ListTodo className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
                                {editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Título *</label>
                                <input
                                    type="text"
                                    value={form.titulo}
                                    onChange={e => setForm({ ...form, titulo: e.target.value })}
                                    className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                    placeholder="¿Qué hay que hacer?"
                                    autoFocus
                                />
                            </div>

                            {/* Estado + Prioridad row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Estado</label>
                                    <select
                                        value={form.estado}
                                        onChange={e => setForm({ ...form, estado: e.target.value })}
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none"
                                    >
                                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Prioridad</label>
                                    <select
                                        value={form.prioridad}
                                        onChange={e => setForm({ ...form, prioridad: e.target.value })}
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none"
                                    >
                                        {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Descripción</label>
                                <textarea
                                    value={form.descripcion}
                                    onChange={e => setForm({ ...form, descripcion: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 resize-none h-20"
                                    placeholder="Detalles de la tarea..."
                                />
                            </div>

                            {/* Dates row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Fecha Inicio</label>
                                    <input
                                        type="datetime-local"
                                        value={form.fechaInicio}
                                        onChange={e => setForm({ ...form, fechaInicio: e.target.value })}
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Fecha Vencimiento</label>
                                    <input
                                        type="datetime-local"
                                        value={form.fechaVencimiento}
                                        onChange={e => setForm({ ...form, fechaVencimiento: e.target.value })}
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none"
                                    />
                                </div>
                            </div>

                            {/* Project + Category */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Proyecto (opcional)</label>
                                    <select
                                        value={form.projectId}
                                        onChange={e => setForm({ ...form, projectId: e.target.value })}
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none"
                                    >
                                        <option value="">Sin proyecto</option>
                                        {projects.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.codigoProyecto ? `${p.codigoProyecto} | ` : ''}{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Categoría</label>
                                    <input
                                        type="text"
                                        value={form.categoria}
                                        onChange={e => setForm({ ...form, categoria: e.target.value })}
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                                        placeholder="ej: Mantenimiento"
                                    />
                                </div>
                            </div>

                            {/* ─── Involucrados ─── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <UsersIcon className="w-3.5 h-3.5" /> Involucrados
                                    </label>
                                    <button
                                        onClick={() => setFormInvolucrados([...formInvolucrados, { operatorId: '', rol: 'responsable' }])}
                                        className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 uppercase tracking-wider flex items-center gap-1 transition-colors"
                                    >
                                        <Plus className="w-3 h-3" /> Agregar
                                    </button>
                                </div>
                                {formInvolucrados.length === 0 && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin involucrados asignados</p>
                                )}
                                <div className="space-y-2">
                                    {formInvolucrados.map((inv, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <select
                                                value={inv.operatorId}
                                                onChange={e => {
                                                    const next = [...formInvolucrados];
                                                    next[i] = { ...next[i], operatorId: e.target.value };
                                                    setFormInvolucrados(next);
                                                }}
                                                className="flex-1 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {operators.map((op: any) => (
                                                    <option key={op.id} value={op.id}>{op.nombreCompleto}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={inv.rol}
                                                onChange={e => {
                                                    const next = [...formInvolucrados];
                                                    next[i] = { ...next[i], rol: e.target.value };
                                                    setFormInvolucrados(next);
                                                }}
                                                className="w-32 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                                            >
                                                {ROLES_INVOLUCRADO.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                            </select>
                                            <button
                                                onClick={() => setFormInvolucrados(formInvolucrados.filter((_, idx) => idx !== i))}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors shrink-0"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ─── Recordatorios ─── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <BellRing className="w-3.5 h-3.5" /> Recordatorios
                                    </label>
                                    <button
                                        onClick={() => setFormRecordatorios([...formRecordatorios, { tipo: 'unico', fechaDisparo: '', mensaje: '' }])}
                                        className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 uppercase tracking-wider flex items-center gap-1 transition-colors"
                                    >
                                        <BellPlus className="w-3 h-3" /> Agregar
                                    </button>
                                </div>

                                {/* Existing recordatorios for editing tarea */}
                                {editingTarea && editingTarea.recordatorios.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recordatorios activos</p>
                                        {editingTarea.recordatorios.map(rec => (
                                            <div key={rec.id} className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-2.5">
                                                <div className="flex items-center gap-2 text-xs">
                                                    {rec.disparado
                                                        ? <Check className="w-4 h-4 text-emerald-500" />
                                                        : <Bell className="w-4 h-4 text-purple-500 animate-pulse" />}
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{TIPOS_RECORDATORIO.find(t => t.value === rec.tipo)?.label}</span>
                                                    <span className="text-slate-400 dark:text-slate-500">—</span>
                                                    <span className="text-slate-600 dark:text-slate-300">{format(new Date(rec.fechaDisparo), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                                                    {rec.disparado && <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase">Disparado</span>}
                                                </div>
                                                <button onClick={() => handleDeleteRecordatorio(rec.id)} className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* New recordatorios to create */}
                                {formRecordatorios.map((rec, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={rec.tipo}
                                                onChange={e => {
                                                    const next = [...formRecordatorios];
                                                    next[i] = { ...next[i], tipo: e.target.value };
                                                    setFormRecordatorios(next);
                                                }}
                                                className="flex-1 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                                            >
                                                {TIPOS_RECORDATORIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                            <input
                                                type="datetime-local"
                                                value={rec.fechaDisparo}
                                                onChange={e => {
                                                    const next = [...formRecordatorios];
                                                    next[i] = { ...next[i], fechaDisparo: e.target.value };
                                                    setFormRecordatorios(next);
                                                }}
                                                className="flex-1 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none appearance-none"
                                            />
                                            <button
                                                onClick={() => setFormRecordatorios(formRecordatorios.filter((_, idx) => idx !== i))}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Mensaje del recordatorio (opcional)"
                                            value={rec.mensaje}
                                            onChange={e => {
                                                const next = [...formRecordatorios];
                                                next[i] = { ...next[i], mensaje: e.target.value };
                                                setFormRecordatorios(next);
                                            }}
                                            className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-700 dark:text-slate-200 outline-none"
                                        />
                                    </div>
                                ))}

                                {formRecordatorios.length === 0 && !editingTarea?.recordatorios.length && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin recordatorios programados</p>
                                )}
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notas</label>
                                <textarea
                                    value={form.notas}
                                    onChange={e => setForm({ ...form, notas: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 resize-none h-16"
                                    placeholder="Notas adicionales..."
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50 active:scale-95"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Guardando...' : editingTarea ? 'Guardar Cambios' : 'Crear Tarea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Dialog */}
            <ConfirmDialog
                isOpen={!!confirmDelete}
                onCancel={() => setConfirmDelete(null)}
                onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
                title="¿Eliminar tarea?"
                message="Esta acción eliminará la tarea y todos sus recordatorios asociados. Los cron jobs de cron-job.org también serán eliminados."
            />

            {/* Mobile FAB */}
            <div className="md:hidden fixed bottom-20 right-4 z-40">
                <button
                    onClick={openNew}
                    className="w-14 h-14 bg-purple-600 text-white rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center hover:bg-purple-700 active:scale-90 transition-all"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════
// TAREA CARD — Kanban view
// ═════════════════════════════════════════════════════════════════════

function TareaCard({
    tarea,
    onEdit,
    onDelete,
    onStatusChange,
    getEstadoConfig,
    getPrioridadConfig,
    getVencimientoInfo,
}: {
    tarea: Tarea;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (s: string) => void;
    getEstadoConfig: (s: string) => typeof ESTADOS[0];
    getPrioridadConfig: (s: string) => typeof PRIORIDADES[0];
    getVencimientoInfo: (f?: string) => { text: string; class: string; urgent: boolean } | null;
}) {
    const prioridad = getPrioridadConfig(tarea.prioridad);
    const vencimiento = getVencimientoInfo(tarea.fechaVencimiento);
    const hasReminders = tarea.recordatorios.length > 0;
    const activeReminders = tarea.recordatorios.filter(r => !r.disparado && r.cronJobActivo).length;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-200 group cursor-pointer" onClick={onEdit}>
            {/* Top: Priority + Actions */}
            <div className="flex items-start justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${prioridad.bg} ${prioridad.color}`}>
                    {prioridad.icon} {prioridad.label}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {tarea.estado === 'pendiente' && (
                        <button onClick={() => onStatusChange('en_progreso')} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Iniciar">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                    {tarea.estado === 'en_progreso' && (
                        <button onClick={() => onStatusChange('completada')} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Completar">
                            <Check className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={onDelete} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Title */}
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-2 line-clamp-2">{tarea.titulo}</h4>

            {/* Description preview */}
            {tarea.descripcion && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{tarea.descripcion}</p>
            )}

            {/* Project badge */}
            {tarea.project && (
                <div className="flex items-center gap-1.5 mb-3">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{tarea.project.codigoProyecto || tarea.project.nombre}</span>
                </div>
            )}

            {/* Vencimiento */}
            {vencimiento && (
                <div className={`flex items-center gap-1.5 mb-3 ${vencimiento.class}`}>
                    <Timer className="w-3 h-3" />
                    <span className="text-[10px] font-bold">{vencimiento.text}</span>
                </div>
            )}

            {/* Bottom: Avatars + Reminder */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex -space-x-1.5">
                    {tarea.involucrados.slice(0, 4).map(inv => (
                        <div
                            key={inv.id}
                            className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-[9px] font-black text-white border-2 border-white dark:border-slate-800 shadow-sm"
                            title={`${inv.operator.nombreCompleto} (${inv.rol})`}
                        >
                            {inv.operator.nombreCompleto.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {tarea.involucrados.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-800">
                            +{tarea.involucrados.length - 4}
                        </div>
                    )}
                </div>
                {hasReminders && (
                    <div className="flex items-center gap-1 text-purple-500" title={`${activeReminders} recordatorio(s) activo(s)`}>
                        <Bell className={`w-3.5 h-3.5 ${activeReminders > 0 ? 'animate-pulse' : 'opacity-50'}`} />
                        {activeReminders > 0 && <span className="text-[10px] font-bold">{activeReminders}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════
// TAREA LIST ROW — List view
// ═════════════════════════════════════════════════════════════════════

function TareaListRow({
    tarea,
    onEdit,
    onDelete,
    onStatusChange,
    getEstadoConfig,
    getPrioridadConfig,
    getVencimientoInfo,
}: {
    tarea: Tarea;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (s: string) => void;
    getEstadoConfig: (s: string) => typeof ESTADOS[0];
    getPrioridadConfig: (s: string) => typeof PRIORIDADES[0];
    getVencimientoInfo: (f?: string) => { text: string; class: string; urgent: boolean } | null;
}) {
    const estado = getEstadoConfig(tarea.estado);
    const prioridad = getPrioridadConfig(tarea.prioridad);
    const vencimiento = getVencimientoInfo(tarea.fechaVencimiento);
    const activeReminders = tarea.recordatorios.filter(r => !r.disparado && r.cronJobActivo).length;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all group">
            {/* Quick status toggle */}
            <div className="shrink-0" onClick={e => e.stopPropagation()}>
                {tarea.estado === 'completada' ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center cursor-pointer hover:bg-emerald-600 transition-colors" onClick={() => onStatusChange('pendiente')}>
                        <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                ) : (
                    <div
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-colors ${tarea.estado === 'en_progreso' ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/30' : 'border-slate-300 dark:border-slate-600 hover:border-purple-400'}`}
                        onClick={() => onStatusChange(tarea.estado === 'pendiente' ? 'en_progreso' : 'completada')}
                    />
                )}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`text-sm font-bold leading-snug truncate ${tarea.estado === 'completada' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                        {tarea.titulo}
                    </h4>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${prioridad.bg} ${prioridad.color} shrink-0`}>
                        {prioridad.label}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${estado.color} shrink-0`}>
                        {estado.label}
                    </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {tarea.project && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {tarea.project.codigoProyecto || tarea.project.nombre}
                        </span>
                    )}
                    {vencimiento && (
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${vencimiento.class}`}>
                            <Timer className="w-3 h-3" /> {vencimiento.text}
                        </span>
                    )}
                    {tarea.involucrados.length > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <UsersIcon className="w-3 h-3" /> {tarea.involucrados.length}
                        </span>
                    )}
                    {activeReminders > 0 && (
                        <span className="text-[10px] text-purple-500 flex items-center gap-1">
                            <Bell className="w-3 h-3 animate-pulse" /> {activeReminders}
                        </span>
                    )}
                </div>
            </div>

            {/* Avatars */}
            <div className="hidden md:flex -space-x-1.5 shrink-0">
                {tarea.involucrados.slice(0, 3).map(inv => (
                    <div
                        key={inv.id}
                        className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-[10px] font-black text-white border-2 border-white dark:border-slate-800"
                        title={inv.operator.nombreCompleto}
                    >
                        {inv.operator.nombreCompleto.charAt(0).toUpperCase()}
                    </div>
                ))}
                {tarea.involucrados.length > 3 && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-800">
                        +{tarea.involucrados.length - 3}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors">
                    <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
