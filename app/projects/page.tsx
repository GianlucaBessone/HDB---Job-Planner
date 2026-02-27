'use client';

import Link from 'next/link';

import { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Search,
    Trash2,
    Edit3,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Clock,
    X,
    Filter,
    ChevronRight,
    Calendar,
    User,
    Building2,
    TrendingUp,
    AlertTriangle,
    MinusCircle,
    Activity,
    SlidersHorizontal,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

// ── Types ─────────────────────────────────────────────────────────────────────
type ProjectStatus = 'por_hacer' | 'planificado' | 'activo' | 'en_riesgo' | 'atrasado' | 'finalizado';

interface Project {
    id: string;
    nombre: string;
    activo: boolean;
    observaciones?: string;
    horasEstimadas: number;
    horasConsumidas: number;
    cliente?: string;
    clientId?: string;
    client?: { id: string; nombre: string };
    responsable?: string;
    estado: ProjectStatus;
    fechaInicio?: string;
    fechaFin?: string;
}

interface FormData {
    nombre: string;
    activo: boolean;
    observaciones: string;
    horasEstimadas: number;
    horasConsumidas: number;
    cliente: string;
    clientId: string;
    responsable: string;
    estado: ProjectStatus;
    fechaInicio: string;
    fechaFin: string;
}

interface Filters {
    estados: ProjectStatus[];
    responsable: string;
    cliente: string;
    fechaInicio: string;
    fechaFin: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; ring: string; dot: string; Icon: React.ElementType }> = {
    por_hacer: { label: 'Por Hacer', color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200', dot: 'bg-blue-500', Icon: Clock },
    planificado: { label: 'Planificado', color: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-200', dot: 'bg-violet-500', Icon: Calendar },
    activo: { label: 'Activo', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-500', Icon: CheckCircle2 },
    en_riesgo: { label: 'En Riesgo', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', dot: 'bg-amber-400', Icon: AlertTriangle },
    atrasado: { label: 'Atrasado', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', dot: 'bg-red-500', Icon: XCircle },
    finalizado: { label: 'Finalizado', color: 'text-slate-500', bg: 'bg-slate-100', ring: 'ring-slate-200', dot: 'bg-slate-400', Icon: MinusCircle },
};

const getProgressColor = (progress: number): string => {
    if (progress >= 85) return 'bg-red-500';
    if (progress >= 60) return 'bg-amber-400';
    return 'bg-emerald-500';
};

const ALL_STATUSES: ProjectStatus[] = ['por_hacer', 'planificado', 'activo', 'en_riesgo', 'atrasado', 'finalizado'];

const EMPTY_FORM: FormData = {
    nombre: '',
    activo: true,
    observaciones: '',
    horasEstimadas: 0,
    horasConsumidas: 0,
    cliente: '',
    clientId: '',
    responsable: '',
    estado: 'activo',
    fechaInicio: '',
    fechaFin: '',
};

const EMPTY_FILTERS: Filters = {
    estados: [],
    responsable: '',
    cliente: '',
    fechaInicio: '',
    fechaFin: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<{ id: string; nombreCompleto: string }[]>([]);
    const [clients, setClients] = useState<{ id: string; nombre: string }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadProjects();
        loadOperators();
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            const data = await fetch('/api/clients').then(res => res.json());
            if (Array.isArray(data)) setClients(data);
        } catch (e) { /* ignore */ }
    };

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

    const loadOperators = async () => {
        try {
            const data = await fetch('/api/operators').then(res => res.json());
            setOperators(data);
        } catch (e) { /* ignore */ }
    };

    // ── CRUD ──────────────────────────────────────────────────────────────────
    const openCreate = () => {
        setEditingProject(null);
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (project: Project) => {
        setEditingProject(project);
        setFormData({
            nombre: project.nombre,
            activo: project.activo,
            observaciones: project.observaciones || '',
            horasEstimadas: project.horasEstimadas || 0,
            horasConsumidas: project.horasConsumidas || 0,
            cliente: project.cliente || '',
            clientId: project.clientId || '',
            responsable: project.responsable || '',
            estado: project.estado || 'activo',
            fechaInicio: project.fechaInicio || '',
            fechaFin: project.fechaFin || '',
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim()) return;
        const method = editingProject ? 'PATCH' : 'POST';
        const url = editingProject ? `/api/projects?id=${editingProject.id}` : '/api/projects';
        await fetch(url, { method, body: JSON.stringify(formData) });
        setIsModalOpen(false);
        loadProjects(true);
    };

    const handleDeleteClick = (id: string) => {
        setProjectToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;
        const id = projectToDelete;
        setProjects(prev => prev.filter(p => p.id !== id));
        await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
        setIsConfirmOpen(false);
        setProjectToDelete(null);
    };

    // ── Filters ───────────────────────────────────────────────────────────────
    const togglePendingStatus = (s: ProjectStatus) => {
        setPendingFilters(prev => ({
            ...prev,
            estados: prev.estados.includes(s)
                ? prev.estados.filter(e => e !== s)
                : [...prev.estados, s],
        }));
    };

    const applyFilters = () => setAppliedFilters({ ...pendingFilters });

    const clearFilters = () => {
        setPendingFilters(EMPTY_FILTERS);
        setAppliedFilters(EMPTY_FILTERS);
    };

    const activeFilterCount = useMemo(() => {
        let n = appliedFilters.estados.length > 0 ? 1 : 0;
        if (appliedFilters.responsable) n++;
        if (appliedFilters.cliente) n++;
        if (appliedFilters.fechaInicio || appliedFilters.fechaFin) n++;
        return n;
    }, [appliedFilters]);

    // ── Derived list ──────────────────────────────────────────────────────────
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            if (searchTerm && !normalize(p.nombre).includes(normalize(searchTerm))) return false;
            if (appliedFilters.estados.length > 0 && !appliedFilters.estados.includes(p.estado)) return false;
            if (appliedFilters.responsable && !normalize(p.responsable || '').includes(normalize(appliedFilters.responsable))) return false;
            if (appliedFilters.cliente && !normalize(p.cliente || '').includes(normalize(appliedFilters.cliente))) return false;
            return true;
        });
    }, [projects, searchTerm, appliedFilters]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Page Header ── */}
            <div className="flex flex-col gap-4 mb-6">
                {/* Title row */}
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Proyectos</h2>
                    <p className="text-sm text-slate-500 font-medium">Control y seguimiento de proyectos activos</p>
                </div>
                {/* Actions row */}
                <div className="flex items-center gap-2">
                    {/* Search – takes all remaining space */}
                    <div className="relative flex-1 min-w-0 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar proyectos..."
                            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Filter toggle – icon only on mobile */}
                    <button
                        onClick={() => setIsSidebarOpen(o => !o)}
                        className={`flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all shadow-sm relative shrink-0 ${isSidebarOpen
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary/30 hover:text-primary'
                            }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">Filtros</span>
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    {/* New project – icon + short label on mobile */}
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-1.5 bg-primary text-white px-3 md:px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nuevo Proyecto</span>
                        <span className="sm:hidden">Nuevo</span>
                    </button>
                </div>
            </div>

            {/* ── Body: Sidebar + Cards ── */}
            {/* On mobile: sidebar shows ABOVE cards (full width). On desktop: side-by-side */}
            <div className="flex flex-col md:flex-row gap-5 items-start">

                {/* ── Filter Sidebar ── */}
                {isSidebarOpen && (
                    <aside className="w-full md:w-60 md:shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6 md:sticky md:top-24 animate-in slide-in-from-top-2 md:slide-in-from-left-4 duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-sm">Filtros</h3>
                            {activeFilterCount > 0 && (
                                <button onClick={clearFilters} className="text-[10px] font-bold text-primary hover:underline">Limpiar</button>
                            )}
                        </div>

                        {/* Estado */}
                        <div className="space-y-2.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</p>
                            {ALL_STATUSES.map(s => {
                                const cfg = STATUS_CONFIG[s];
                                const checked = pendingFilters.estados.includes(s);
                                return (
                                    <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={checked}
                                            onChange={() => togglePendingStatus(s)}
                                        />
                                        <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${checked ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary/50'}`}>
                                            {checked && <span className="w-2 h-2 bg-white rounded-sm block" />}
                                        </span>
                                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                                        <span className={`text-sm font-medium ${checked ? 'text-slate-800' : 'text-slate-600'}`}>{cfg.label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Responsable */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsable</p>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                value={pendingFilters.responsable}
                                onChange={e => setPendingFilters(f => ({ ...f, responsable: e.target.value }))}
                            >
                                <option value="">Todos</option>
                                {operators.map(op => (
                                    <option key={op.id} value={op.nombreCompleto}>{op.nombreCompleto}</option>
                                ))}
                            </select>
                        </div>

                        {/* Cliente */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</p>
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                value={pendingFilters.cliente}
                                onChange={e => setPendingFilters(f => ({ ...f, cliente: e.target.value }))}
                            />
                        </div>

                        {/* Fechas */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fechas</p>
                            <input
                                type="date"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                value={pendingFilters.fechaInicio}
                                onChange={e => setPendingFilters(f => ({ ...f, fechaInicio: e.target.value }))}
                            />
                            <input
                                type="date"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                value={pendingFilters.fechaFin}
                                onChange={e => setPendingFilters(f => ({ ...f, fechaFin: e.target.value }))}
                            />
                        </div>

                        <button
                            onClick={applyFilters}
                            className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                            Aplicar filtros
                        </button>
                    </aside>
                )}

                {/* ── Cards Grid ── */}
                <div className="flex-1 min-w-0 w-full">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Array(4).fill(0).map((_, i) => (
                                <div key={i} className="bg-slate-100/60 rounded-2xl animate-pulse h-56" />
                            ))}
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-semibold text-slate-600">No se encontraron proyectos</p>
                            {activeFilterCount > 0 && (
                                <button onClick={clearFilters} className="mt-3 text-sm text-primary font-semibold hover:underline">Limpiar filtros</button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredProjects.map(p => (
                                <ProjectCard key={p.id} project={p} onEdit={openEdit} handleDeleteClick={handleDeleteClick} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal ── */}
            {isModalOpen && (
                <ProjectModal
                    formData={formData}
                    setFormData={setFormData}
                    editingProject={editingProject}
                    operators={operators}
                    clients={clients}
                    onSubmit={handleSubmit}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Proyecto"
                message="¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer."
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────
function ProjectCard({
    project,
    onEdit,
    handleDeleteClick,
}: {
    project: Project;
    onEdit: (p: Project) => void;
    handleDeleteClick: (id: string) => void;
}) {
    const { horasConsumidas, horasEstimadas, estado } = project;
    const progress = horasEstimadas > 0 ? Math.min(100, Math.round((horasConsumidas / horasEstimadas) * 100)) : 0;
    const cfg = STATUS_CONFIG[estado] || STATUS_CONFIG.activo;
    const StatusIcon = cfg.Icon;
    const progressColor = getProgressColor(progress);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300 p-5 flex flex-col gap-4 group">

            {/* Top row: name + actions */}
            <div className="flex items-start justify-between gap-3">
                <h4 className="font-bold text-lg text-slate-800 leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {project.nombre}
                </h4>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => onEdit(project)}
                        className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all active:scale-90"
                        title="Editar"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(project.id)}
                        className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Meta: cliente + responsable */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-400 shrink-0">Cliente:</span>
                    <span className="font-semibold text-slate-700 truncate">
                        {project.client?.nombre || project.cliente || '—'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-400 shrink-0">Resp:</span>
                    <span className="font-semibold text-slate-700 truncate">{project.responsable || '—'}</span>
                </div>
            </div>

            {/* Progress */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Avance:</span>
                        <span className="font-bold text-slate-700">{progress}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold text-slate-600">{horasConsumidas}h / {horasEstimadas}h</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Footer: status + actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-50">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${cfg.bg} ring-1 ${cfg.ring}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                </div>
                {/* Metric Status indicator */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${project.activo ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-tight">{project.activo ? 'En Métricas' : 'Oculto de Métricas'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => onEdit(project)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary transition-all active:scale-95 whitespace-nowrap"
                    >
                        Ver Detalle
                        <ChevronRight className="w-3 h-3" />
                    </button>
                    <Link
                        href="/"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Calendar className="w-3 h-3" />
                        Planificación
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ── ProjectModal ──────────────────────────────────────────────────────────────
function ProjectModal({
    formData,
    setFormData,
    editingProject,
    operators,
    clients,
    onSubmit,
    onClose,
}: {
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    editingProject: Project | null;
    operators: { id: string; nombreCompleto: string }[];
    clients: { id: string; nombre: string }[];
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}) {
    const set = (field: keyof FormData, value: any) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <div className="p-7 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-800">
                            {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                        {/* Nombre + Toggle Activo */}
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre del Proyecto *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.nombre}
                                    onChange={e => set('nombre', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col space-y-2 pb-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Incluir en Dashboard</label>
                                <button
                                    type="button"
                                    onClick={() => set('activo', !formData.activo)}
                                    className={`relative inline-flex h-10 w-20 items-center rounded-xl transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-primary/20 ${formData.activo ? 'bg-primary' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-6 w-6 transform rounded-lg bg-white shadow-md transition-transform duration-300 ${formData.activo ? 'translate-x-11' : 'translate-x-3'}`} />
                                    <span className={`absolute text-[9px] font-black uppercase tracking-tighter transition-opacity duration-300 ${formData.activo ? 'left-3 opacity-100 text-white' : 'right-3 opacity-100 text-slate-500'}`}>
                                        {formData.activo ? 'SÍ' : 'NO'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Cliente + Responsable */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.clientId}
                                    onChange={e => {
                                        const selectedId = e.target.value;
                                        const client = clients.find(c => c.id === selectedId);
                                        setFormData(prev => ({
                                            ...prev,
                                            clientId: selectedId,
                                            cliente: client ? client.nombre : ''
                                        }));
                                    }}
                                >
                                    <option value="">— Seleccionar cliente —</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsable</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.responsable}
                                    onChange={e => set('responsable', e.target.value)}
                                >
                                    <option value="">— Sin asignar —</option>
                                    {operators.map(op => (
                                        <option key={op.id} value={op.nombreCompleto}>{op.nombreCompleto}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Estado */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {ALL_STATUSES.map(s => {
                                    const cfg = STATUS_CONFIG[s];
                                    const active = formData.estado === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => set('estado', s)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${active
                                                ? `${cfg.bg} ${cfg.color} ring-1 ${cfg.ring} border-transparent`
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Horas */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horas Estimadas</label>
                                <input
                                    type="number"
                                    min={0}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.horasEstimadas}
                                    onChange={e => set('horasEstimadas', parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horas Consumidas</label>
                                <input
                                    type="number"
                                    min={0}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.horasConsumidas}
                                    onChange={e => set('horasConsumidas', parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Inicio</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.fechaInicio}
                                    onChange={e => set('fechaInicio', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Fin</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.fechaFin}
                                    onChange={e => set('fechaFin', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Observaciones</label>
                            <textarea
                                rows={3}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium resize-none"
                                value={formData.observaciones}
                                onChange={e => set('observaciones', e.target.value)}
                                placeholder="Notas adicionales..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
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
    );
}
