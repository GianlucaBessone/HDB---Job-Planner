'use client';

import Link from 'next/link';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
    Layout,
    Timer,
    FileText,
    Info,
    Users,
    CheckSquare,
    PieChart,
    MessageSquare,
    ClipboardList
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatDate } from '@/lib/formatDate';
import SearchableSelect from '@/components/SearchableSelect';
import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';

// ── Types ─────────────────────────────────────────────────────────────────────
type ProjectStatus = 'por_hacer' | 'planificado' | 'activo' | 'en_riesgo' | 'atrasado' | 'finalizado';

interface Project {
    id: string;
    nombre: string;
    activo: boolean;
    noEnMetricas: boolean;
    observaciones?: string;
    horasEstimadas: number;
    horasConsumidas: number;
    cliente?: string;
    clientId?: string;
    client?: { nombre: string }; // Relational client
    _count?: {
        clientDelays: number;
        checklistItems: number;
    };
    responsable?: string;
    responsableId?: string;
    responsableUser?: { nombreCompleto: string };
    categoria?: string;
    tipoActividad?: string;
    tags?: string[];
    checklistItems?: { id: string; completed: boolean; excluded: boolean; tag: string }[];
    finalizadoConPendientes?: boolean;
    estado: ProjectStatus;

    fechaInicio?: string;
    fechaFin?: string;
    publicToken?: string;
}


interface FormData {
    nombre: string;
    activo: boolean;
    noEnMetricas: boolean;
    observaciones: string;
    horasEstimadas: number | string;
    horasConsumidas: number | string;
    cliente: string;
    clientId: string;
    responsable: string;
    responsableId: string;
    tags: string[];
    categoria: string;
    tipoActividad: string;
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
    noEnMetricas: false,
    observaciones: '',
    horasEstimadas: '',
    horasConsumidas: '',
    cliente: '',
    clientId: '',
    responsable: '',
    responsableId: '',
    tags: [],
    categoria: '',
    tipoActividad: '',
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

// ── Content Component ──────────────────────────────────────────────────────────
function ProjectsContent() {
    const searchParams = useSearchParams();
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<{ id: string; nombreCompleto: string; role?: string }[]>([]);
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
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (user) setCurrentUser(JSON.parse(user));
    }, []);

    // Details Modal State
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<Project | null>(null);
    const [projectEntries, setProjectEntries] = useState<any[]>([]);
    const [projectChecklist, setProjectChecklist] = useState<any[]>([]);
    const [projectLogs, setProjectLogs] = useState<any[]>([]);
    const [projectDelays, setProjectDelays] = useState<any[]>([]);
    const [configOptions, setConfigOptions] = useState<any[]>([]);

    const categoryOptions = configOptions.filter((o: any) => o.category === 'CATEGORIA' && o.active).map((o: any) => o.value);
    const activityOptions = configOptions.filter((o: any) => o.category === 'TIPO_ACTIVIDAD' && o.active).map((o: any) => o.value);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isSavingLog, setIsSavingLog] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const status = searchParams.get('status');
        if (status && ALL_STATUSES.includes(status as ProjectStatus)) {
            const filterStatus = status as ProjectStatus;
            setAppliedFilters(prev => ({ ...prev, estados: [filterStatus] }));
            setPendingFilters(prev => ({ ...prev, estados: [filterStatus] }));
        }
    }, [searchParams]);

    const loadData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [projectsData, operatorsData, clientsData, configOptionsData] = await Promise.all([
                safeApiRequest('/api/projects').then(res => res.json()),
                safeApiRequest('/api/operators').then(res => res.json()),
                safeApiRequest('/api/clients').then(res => res.json()),
                safeApiRequest('/api/config/options').then(res => res.json()), // Fixed path
            ]);
            setProjects(projectsData);
            setOperators(operatorsData);
            setClients(clientsData);
            setConfigOptions(configOptionsData);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setIsLoading(false);
        }
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
            noEnMetricas: project.noEnMetricas || false,
            observaciones: project.observaciones || '',
            horasEstimadas: project.horasEstimadas || 0,
            horasConsumidas: project.horasConsumidas || 0,
            cliente: project.cliente || '',
            clientId: project.clientId || '',
            responsable: project.responsable || '',
            responsableId: project.responsableId || '',
            tags: project.tags || [],
            categoria: project.categoria || '',
            tipoActividad: project.tipoActividad || '',
            estado: project.estado,
            fechaInicio: project.fechaInicio || '',
            fechaFin: project.fechaFin || '',
        });

        setIsModalOpen(true);
    };

    const openDetails = async (project: Project) => {
        setSelectedProjectForDetails(project);
        setIsDetailsOpen(true);
        setIsDetailsLoading(true);
        try {
            const [entries, checklist, logs, delays] = await Promise.all([
                safeApiRequest(`/api/time-entries?projectId=${project.id}`).then(res => res.json()),
                safeApiRequest(`/api/projects/${project.id}/checklist`).then(res => res.json()),
                safeApiRequest(`/api/projects/${project.id}/logs`).then(res => res.json()),
                safeApiRequest(`/api/delays?projectId=${project.id}`).then(res => res.json())
            ]);
            setProjectEntries(Array.isArray(entries) ? entries : []);
            setProjectChecklist(Array.isArray(checklist) ? checklist : []);
            setProjectLogs(Array.isArray(logs) ? logs : []);
            setProjectDelays(Array.isArray(delays) ? delays : []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDetailsLoading(false);
        }
    };

    const handleSaveLog = async (logData: { fecha: string; responsable: string; observacion: string }) => {
        if (!selectedProjectForDetails) return;
        setIsSavingLog(true);
        try {
            const res = await safeApiRequest(`/api/projects/${selectedProjectForDetails.id}/logs`, {
                method: 'POST',
                body: JSON.stringify(logData),
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const newLog = await res.json();
                setProjectLogs(prev => [newLog, ...prev]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingLog(false);
        }
    };

    const handleDeleteLog = async (logId: string) => {
        if (!selectedProjectForDetails) return;
        try {
            const res = await safeApiRequest(`/api/projects/${selectedProjectForDetails.id}/logs?logId=${logId}`, { method: 'DELETE' });
            if (res.ok) {
                setProjectLogs(prev => prev.filter(l => l.id !== logId));
                showToast('Comentario eliminado', 'success');
            } else {
                showToast('Error al eliminar comentario', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    };

    const handleUpdateChecklist = async (itemId: string, updates: any) => {
        if (!selectedProjectForDetails) return;
        try {
            const res = await safeApiRequest(`/api/projects/${selectedProjectForDetails.id}/checklist`, {
                method: 'PATCH',
                body: JSON.stringify({ itemId, ...updates }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const updatedItem = await res.json();
                setProjectChecklist(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
                loadData(true); // reload to update main card metrics
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim()) return;
        const method = editingProject ? 'PATCH' : 'POST';
        const url = editingProject ? `/api/projects?id=${editingProject.id}` : '/api/projects';

        const submissionData = {
            ...formData,
            horasEstimadas: Number(formData.horasEstimadas) || 0,
            horasConsumidas: Number(formData.horasConsumidas) || 0,
        };
        await safeApiRequest(url, { method, body: JSON.stringify(submissionData) });
        setIsModalOpen(false);
        loadData(true);
    };

    const handleDeleteClick = (id: string) => {
        setProjectToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;
        const id = projectToDelete;
        setProjects(prev => prev.filter(p => p.id !== id));
        await safeApiRequest(`/api/projects?id=${id}`, { method: 'DELETE' });
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
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                        <Layout className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Gestión de Proyectos
                    </h2>
                    <p className="text-sm text-slate-500 font-medium hidden md:block">Control y seguimiento de proyectos activos</p>
                </div>
                {/* Actions row */}
                <div className="flex items-center gap-2">
                    {/* Search – takes all remaining space */}
                    <div className="relative flex-1 min-w-0 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium shadow-sm"
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
                        className="flex items-center gap-1.5 bg-primary text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all shrink-0"
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
                                className="w-full h-[48px] bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                                value={pendingFilters.responsable}
                                onChange={e => setPendingFilters(f => ({ ...f, responsable: e.target.value }))}
                            >
                                <option value="">Todos los Responsables</option>
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
                                className="w-full h-[48px] bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                value={pendingFilters.cliente}
                                onChange={e => setPendingFilters(f => ({ ...f, cliente: e.target.value }))}
                            />
                        </div>

                        {/* Fechas */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fechas</p>
                            <input
                                type="date"
                                className="w-full h-[48px] bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none"
                                value={pendingFilters.fechaInicio}
                                onChange={e => setPendingFilters(f => ({ ...f, fechaInicio: e.target.value }))}
                            />
                            <input
                                type="date"
                                className="w-full h-[48px] bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none"
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
                                <ProjectCard key={p.id} project={p} onEdit={openEdit} onDetails={openDetails} handleDeleteClick={handleDeleteClick} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isDetailsOpen && selectedProjectForDetails && (
                <ProjectDetailsModal
                    project={selectedProjectForDetails!}
                    operators={operators}
                    entries={projectEntries}
                    checklist={projectChecklist}
                    logs={projectLogs}
                    delays={projectDelays}
                    isLoading={isDetailsLoading}
                    isSavingLog={isSavingLog}
                    currentUser={currentUser}
                    onSaveLog={handleSaveLog}
                    onDeleteLog={handleDeleteLog}
                    onUpdateChecklist={handleUpdateChecklist}
                    onClose={() => setIsDetailsOpen(false)}
                />
            )}
            {isModalOpen && (
                <ProjectModal
                    formData={formData}
                    setFormData={setFormData}
                    editingProject={editingProject}
                    operators={operators}
                    clients={clients}
                    categoryOptions={categoryOptions}
                    activityOptions={activityOptions}
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProjectsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando Proyectos...</p>
            </div>
        }>
            <ProjectsContent />
        </Suspense>
    );
}

// ── ProjectDetailsModal ──────────────────────────────────────────────────────
function ProjectDetailsModal({
    project,
    operators,
    entries,
    checklist,
    logs,
    delays,
    isLoading,
    isSavingLog,
    currentUser,
    onSaveLog,
    onDeleteLog,
    onUpdateChecklist,
    onClose,
}: {
    project: Project;
    operators: { id: string; nombreCompleto: string; role?: string }[];
    entries: any[];
    checklist: any[];
    logs: any[];
    delays: any[];
    isLoading: boolean;
    isSavingLog: boolean;
    currentUser: any;
    onSaveLog: (data: { fecha: string; responsable: string; observacion: string }) => void;
    onDeleteLog: (logId: string) => void;
    onUpdateChecklist: (itemId: string, updates: any) => void;
    onClose: () => void;
}) {
    const isSupervisor = currentUser?.role === 'supervisor' || currentUser?.role === 'admin';
    const [newLog, setNewLog] = useState({ fecha: new Date().toISOString().split('T')[0], responsable: '', observacion: '' });

    const visibleItems = checklist.filter(i => !i.excluded || isSupervisor);
    const completedVisible = checklist.filter(i => i.completed && !i.excluded).length;
    const totalVisible = checklist.filter(i => !i.excluded).length;
    const checklistProgress = totalVisible > 0 ? Math.round((completedVisible / totalVisible) * 100) : 0;

    const hoursRemaining = Math.max(0, project.horasEstimadas - project.horasConsumidas);
    const progress = project.horasEstimadas > 0 ? Math.min(100, Math.round((project.horasConsumidas / project.horasEstimadas) * 100)) : 0;
    const totalDemoras = delays?.length || 0;
    const hoursDemoras = delays?.reduce((acc: number, d: any) => acc + (d.duracion || 0), 0) || 0;

    // Group entries by operator
    const operatorStats = entries.reduce((acc: any, entry: any) => {
        const opId = entry.operatorId;
        if (!acc[opId]) {
            acc[opId] = {
                name: entry.operator?.nombreCompleto || 'Desconocido',
                totalHours: 0,
                lastSeen: entry.fecha
            };
        }
        acc[opId].totalHours += entry.horasTrabajadas;
        if (entry.fecha > acc[opId].lastSeen) acc[opId].lastSeen = entry.fecha;
        return acc;
    }, {});

    const statsArray = Object.values(operatorStats);

    return (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-t-3xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${STATUS_CONFIG[project.estado]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[project.estado]?.color || 'text-slate-500'}`}>
                                {STATUS_CONFIG[project.estado]?.label || project.estado}
                            </span>
                            <span className="text-slate-400 text-xs font-medium">#{project.id.slice(-6).toUpperCase()}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{project.nombre}</h3>
                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                            <Building2 className="w-4 h-4" /> {project.client?.nombre || project.cliente || 'Sin cliente'}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-icon-inline p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-all active:scale-95">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Activity className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando detalles...</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <Link href={`/timesheets?proyecto=${encodeURIComponent(project.nombre)}`} className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-3xl space-y-2 hover:bg-indigo-100 transition-colors shadow-sm block">
                                    <div className="flex items-center justify-between">
                                        <Clock className="w-5 h-5 text-indigo-500" />
                                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Horas</span>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-indigo-900">{project.horasConsumidas}h / {project.horasEstimadas}h</p>
                                        <p className="text-xs font-bold text-indigo-600/70 uppercase">Consumidas vs Estimadas</p>
                                    </div>
                                    <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                                    </div>
                                </Link>

                                <Link href={`/timesheets?proyecto=${encodeURIComponent(project.nombre)}`} className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-3xl space-y-2 hover:bg-emerald-100 transition-colors shadow-sm block">
                                    <div className="flex items-center justify-between">
                                        <Timer className="w-5 h-5 text-emerald-500" />
                                        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Restante</span>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-emerald-900">{hoursRemaining}h</p>
                                        <p className="text-xs font-bold text-emerald-600/70 uppercase">Tiempo disponible</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600/50 uppercase tracking-tight">
                                        <Activity className="w-3 h-3" /> Eficiencia: {100 - progress > 0 ? 'En rango' : 'Límite'}
                                    </div>
                                </Link>

                                <Link href={`/my-projects?search=${encodeURIComponent(project.nombre)}&all=true`} className="bg-amber-50/50 border border-amber-100 p-5 rounded-3xl space-y-2 hover:bg-amber-100 transition-colors shadow-sm block">
                                    <div className="flex items-center justify-between">
                                        <CheckSquare className="w-5 h-5 text-amber-500" />
                                        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Tareas</span>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-amber-900">
                                            {completedVisible} / {totalVisible}
                                        </p>
                                        <p className="text-xs font-bold text-amber-600/70 uppercase">Checklist completado</p>
                                    </div>
                                    <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${checklistProgress}%` }} />
                                    </div>
                                </Link>

                                <Link href={`/delays?proyecto=${encodeURIComponent(project.nombre)}`} className="bg-red-50/50 border border-red-100 p-5 rounded-3xl space-y-2 hover:bg-red-100 transition-colors shadow-sm block">
                                    <div className="flex items-center justify-between">
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                        <span className="text-xs font-black text-red-400 uppercase tracking-widest">Demoras</span>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-red-900">{totalDemoras}</p>
                                        <p className="text-xs font-bold text-red-600/70 uppercase">{hoursDemoras}h en total</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-red-600/50 uppercase tracking-tight">
                                        <MessageSquare className="w-3 h-3" /> {totalDemoras > 0 ? 'Con incidencias' : 'Sin demoras'}
                                    </div>
                                </Link>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Personnel List */}
                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                        <Users className="w-4 h-4 text-primary" /> Personal Asignado
                                    </h4>
                                    <div className="bg-white border border-slate-100 rounded-3xl overflow-x-auto shadow-sm">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Horas Totales</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {statsArray.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={2} className="px-4 py-8 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">No hay registros aún</td>
                                                    </tr>
                                                ) : (
                                                    statsArray.map((stat: any) => (
                                                        <tr key={stat.name} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-slate-700 text-sm">{stat.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-medium">Carga: {stat.lastSeen}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className="inline-block px-3 py-1 rounded-xl bg-primary/5 text-primary font-black text-sm border border-primary/10">
                                                                    {stat.totalHours.toLocaleString()}h
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Recent Activity Table */}
                                    {entries.length > 0 && (
                                        <div className="space-y-4 pt-4">
                                            <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                                <Activity className="w-4 h-4 text-primary" /> Historial Reciente
                                            </h4>
                                            <div className="bg-white border border-slate-100 rounded-3xl overflow-x-auto shadow-sm">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-400 uppercase tracking-widest">
                                                        <tr>
                                                            <th className="px-4 py-3">Fecha</th>
                                                            <th className="px-4 py-3">Operador</th>
                                                            <th className="px-4 py-3 text-right">Horas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {entries.slice(0, 10).map((entry: any) => (
                                                            <tr key={entry.id}>
                                                                <td className="px-4 py-2 text-slate-500 font-medium">{formatDate(entry.fecha)}</td>
                                                                <td className="px-4 py-2 font-bold text-slate-700">{entry.operator.nombreCompleto}</td>
                                                                <td className="px-4 py-2 text-right font-black text-slate-900">{entry.horasTrabajadas}h</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Checklist Detail */}
                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                        <CheckCircle2 className="w-4 h-4 text-primary" /> Avance Técnico (Checklist)
                                    </h4>
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                                        {visibleItems.length === 0 ? (
                                            <div className="bg-slate-50 rounded-3xl p-8 border border-dashed border-slate-200 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sin tareas definidas para este proyecto</div>
                                        ) : (
                                            visibleItems.map((item: any) => (
                                                <div key={item.id} className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${item.excluded ? 'opacity-40 grayscale border-dashed border-slate-300' : item.completed ? 'bg-emerald-50/40 border-emerald-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'}`}>
                                                    {!item.excluded ? (
                                                        <button
                                                            disabled={item.confirmedBySupervisor}
                                                            onClick={() => onUpdateChecklist(item.id, { completed: !item.completed })}
                                                            className={`btn-icon-inline mt-0.5 shrink-0 w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'border-slate-200 bg-white hover:border-primary/40'}`}
                                                        >
                                                            {item.completed && <CheckCircle2 className="w-4 h-4" />}
                                                        </button>
                                                    ) : (
                                                        <div className="mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center">
                                                            <MinusCircle className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold leading-snug ${item.excluded ? 'text-slate-400 line-through' : item.completed ? 'text-emerald-900' : 'text-slate-700'}`}>{item.description}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{item.tag}</span>
                                                            {item.excluded && <span className="text-[9px] font-black text-slate-400 uppercase italic">(Excluido)</span>}
                                                        </div>
                                                    </div>
                                                    {isSupervisor && (
                                                        <button
                                                            onClick={() => onUpdateChecklist(item.id, { excluded: !item.excluded })}
                                                            className={`btn-icon-inline shrink-0 p-1.5 rounded-lg transition-all ${item.excluded ? 'text-blue-500 hover:bg-blue-50' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                                                            title={item.excluded ? "Incluir en proyecto" : "Excluir de proyecto"}
                                                        >
                                                            {item.excluded ? <Plus className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>


                            {/* Public Tracking Link & Logs */}
                            <div className="space-y-6 lg:col-span-2">
                                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="space-y-1 text-center md:text-left">
                                        <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start">
                                            <TrendingUp className="w-4 h-4" /> Link de Seguimiento Público
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">Comparte este enlace con el cliente para que vea los avances en tiempo real.</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto overflow-hidden">
                                        <input
                                            readOnly
                                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/projects/${project.id}/report?token=${project.publicToken || ''}`}
                                            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-medium text-slate-500 flex-1 md:w-64 outline-none truncate"
                                        />
                                        <button
                                            onClick={() => {
                                                const url = `${window.location.origin}/projects/${project.id}/report?token=${project.publicToken || ''}`;
                                                navigator.clipboard.writeText(url);
                                                showToast('Link copiado al portapapeles', 'success');
                                            }}
                                            className="btn-icon-inline bg-white hover:bg-slate-50 text-primary border border-primary/20 p-2 rounded-xl transition-all shadow-sm active:scale-90 shrink-0"
                                            title="Copiar Link"
                                        >
                                            <ClipboardList className="w-5 h-5" />
                                        </button>
                                        <Link
                                            href={`/projects/${project.id}/report?token=${project.publicToken || ''}`}
                                            target="_blank"
                                            className="btn-icon-inline bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-90 shrink-0"
                                            title="Ver Vista Pública"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </Link>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Add Log Form */}
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                            <MessageSquare className="w-4 h-4 text-primary" /> Registrar Seguimiento / Observación
                                        </h4>
                                        <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                                                    <input
                                                        type="date"
                                                        value={newLog.fecha}
                                                        onChange={e => setNewLog(prev => ({ ...prev, fecha: e.target.value }))}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Responsable</label>
                                                    <SearchableSelect
                                                        options={operators
                                                            .filter(op => op.role !== 'admin')
                                                            .map(op => ({ id: op.nombreCompleto, label: op.nombreCompleto }))}
                                                        value={newLog.responsable}
                                                        onChange={(val) => setNewLog(prev => ({ ...prev, responsable: val }))}
                                                        placeholder="Cargado por..."
                                                        className="!space-y-0 h-10"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observación</label>
                                                <textarea
                                                    value={newLog.observacion}
                                                    placeholder="Describe el avance o comentario..."
                                                    onChange={e => setNewLog(prev => ({ ...prev, observacion: e.target.value }))}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 outline-none min-h-[100px] resize-none"
                                                />
                                            </div>
                                            <button
                                                disabled={isSavingLog || !newLog.responsable || !newLog.observacion}
                                                onClick={() => {
                                                    onSaveLog(newLog);
                                                    setNewLog({ fecha: new Date().toISOString().split('T')[0], responsable: '', observacion: '' });
                                                }}
                                                className="w-full bg-primary text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isSavingLog ? 'Guardando...' : 'Registrar Comentario'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Logs List */}
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                            <Activity className="w-4 h-4 text-primary" /> Historial de Seguimiento
                                        </h4>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                            {logs.length === 0 ? (
                                                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No hay registros aún</div>
                                            ) : (
                                                logs.map((log: any) => {
                                                    const cat = log.categoria || 'Nota';
                                                    const catStyles: Record<string, string> = {
                                                        Bloqueante: 'bg-red-100 text-red-700 border-red-200',
                                                        Reporte:    'bg-emerald-100 text-emerald-700 border-emerald-200',
                                                        Consulta:   'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
                                                        Nota:       'bg-blue-100 text-blue-700 border-blue-200',
                                                    };
                                                    return (
                                                    <div key={log.id} className={`bg-white border p-4 rounded-2xl shadow-sm space-y-2 ${cat === 'Bloqueante' ? 'border-red-100' : 'border-slate-100'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">{formatDate(log.fecha)}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest ${catStyles[cat] || catStyles['Nota']}`}>
                                                                    {cat === 'Bloqueante' && '🚨 '}{cat}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-slate-400">Por: {log.responsable}</span>
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-600 leading-relaxed italic">"{log.observacion}"</p>
                                                    </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Observations */}
                            {project.observaciones && (
                                <div className="space-y-3">
                                    <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                        <FileText className="w-4 h-4 text-primary" /> Observaciones y Notas
                                    </h4>
                                    <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                                        <p className="text-slate-600 text-sm italic font-medium leading-relaxed">
                                            "{project.observaciones}"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95">
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────
function ProjectCard({
    project,
    onEdit,
    onDetails,
    handleDeleteClick,
}: {
    project: Project;
    onEdit: (p: Project) => void;
    onDetails: (p: Project) => void;
    handleDeleteClick: (id: string) => void;
}) {
    const { horasConsumidas, horasEstimadas, estado } = project;
    const progress = (horasEstimadas || 0) > 0 ? Math.min(100, Math.round((horasConsumidas / horasEstimadas) * 100)) : 0;
    const cfg = STATUS_CONFIG[estado] || STATUS_CONFIG.activo;
    const StatusIcon = cfg.Icon;
    const progressColor = getProgressColor(progress);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300 p-5 flex flex-col gap-4 group">
            <div className="flex items-start justify-between gap-3">
                <h4 className="font-bold text-lg text-slate-800 leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {project.nombre}
                </h4>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => onEdit(project)}
                        className="btn-icon-inline p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all active:scale-90"
                        title="Editar"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(project.id)}
                        className="btn-icon-inline p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

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
                    <span className="font-semibold text-slate-700 truncate">{project.responsableUser?.nombreCompleto || project.responsable || '—'}</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {project.tags && project.tags.length > 0 ? (
                    project.tags.map((tag: any) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200 uppercase tracking-tighter">
                            {tag}
                        </span>
                    ))
                ) : (
                    <span className="text-[10px] font-medium text-slate-400 italic">Sin etiquetas técnicas</span>
                )}
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Avance: {progress}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{horasConsumidas}h / {horasEstimadas}h</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-50">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Avance Técnico (Checklist)</span>
                    <span className="text-slate-600">
                        {project.checklistItems?.filter((i: any) => i.completed && !i.excluded).length} / {project.checklistItems?.filter((i: any) => !i.excluded).length}
                    </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{
                            width: `${(project.checklistItems?.filter((i: any) => !i.excluded).length || 0) > 0
                                ? Math.round((project.checklistItems?.filter((i: any) => i.completed && !i.excluded).length || 0) / (project.checklistItems?.filter((i: any) => !i.excluded).length || 0) * 100)
                                : 0}%`
                        }}
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-50">
                <div className="flex flex-wrap gap-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${cfg.bg} ring-1 ${cfg.ring}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {project._count && (project._count.clientDelays || 0) > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
                            <Timer className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-tight">{project._count.clientDelays} Demoras</span>
                        </div>
                    )}
                    {project.finalizadoConPendientes && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-tight">Cierre con Pendientes</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    <button onClick={() => onDetails(project)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap">
                        Ver Detalle <ChevronRight className="w-3 h-3" />
                    </button>
                    <Link href="/planning" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap">
                        <Calendar className="w-3 h-3" /> Planificación
                    </Link>
                    {project.estado === 'finalizado' && (
                        <Link href={`/projects/${project.id}/report`} target="_blank" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all whitespace-nowrap" title="Descargar Reporte PDF">
                            <FileText className="w-3 h-3" /> PDF
                        </Link>
                    )}
                    <Link
                        href={`/projects/${project.id}/report?token=${project.publicToken || ''}`}
                        target="_blank"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all whitespace-nowrap"
                        title="Seguimiento Público"
                    >
                        <PieChart className="w-3 h-3" /> Seguimiento
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
    categoryOptions,
    activityOptions,
    onSubmit,
    onClose,
}: {
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    editingProject: Project | null;
    operators: { id: string; nombreCompleto: string }[];
    clients: { id: string; nombre: string }[];
    categoryOptions: string[];
    activityOptions: string[];
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}) {
    const set = (field: keyof FormData, value: any) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header - Fixed */}
                <div className="p-5 md:p-7 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
                    <h3 className="text-lg md:text-xl font-bold text-slate-800">
                        {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                    </h3>
                    <button onClick={onClose} className="btn-icon-inline p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0">
                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-4 custom-scrollbar">
                        {/* Nombre + Toggle Metricas */}
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
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Activo</label>
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
                            <div className="flex flex-col space-y-2 pb-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    En Métricas <MetricTooltip def="Define si el proyecto se incluye en los cálculos del Panel de Análisis." />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => set('noEnMetricas', !formData.noEnMetricas)}
                                    className={`relative inline-flex h-10 w-20 items-center rounded-xl transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-primary/20 ${!formData.noEnMetricas ? 'bg-indigo-500' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-6 w-6 transform rounded-lg bg-white shadow-md transition-transform duration-300 ${!formData.noEnMetricas ? 'translate-x-11' : 'translate-x-3'}`} />
                                    <span className={`absolute text-[9px] font-black uppercase tracking-tighter transition-opacity duration-300 ${!formData.noEnMetricas ? 'left-3 opacity-100 text-white' : 'right-3 opacity-100 text-slate-500'}`}>
                                        {!formData.noEnMetricas ? 'SÍ' : 'NO'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Categoria + Tipo Actividad */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoría del Proyecto</label>
                                <SearchableSelect
                                    options={categoryOptions.map(c => ({ id: c, label: c }))}
                                    value={formData.categoria}
                                    onChange={(val) => set('categoria', val)}
                                    placeholder="Seleccionar..."
                                    className="!space-y-0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Actividad</label>
                                <SearchableSelect
                                    options={activityOptions.map(t => ({ id: t, label: t }))}
                                    value={formData.tipoActividad}
                                    onChange={(val) => set('tipoActividad', val)}
                                    placeholder="Seleccionar..."
                                    className="!space-y-0"
                                />
                            </div>
                        </div>

                        {/* Cliente + Responsable */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</label>
                                <SearchableSelect
                                    options={clients.map(c => ({ id: c.id, label: c.nombre }))}
                                    value={formData.clientId}
                                    onChange={(val) => {
                                        const client = clients.find(c => c.id === val);
                                        setFormData(prev => ({
                                            ...prev,
                                            clientId: val,
                                            cliente: client ? client.nombre : ''
                                        }));
                                    }}
                                    placeholder="Seleccionar cliente..."
                                    className="!space-y-0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsable</label>
                                <SearchableSelect
                                    options={operators.map(o => ({ id: o.id, label: o.nombreCompleto }))}
                                    value={formData.responsableId}
                                    onChange={(val) => {
                                        const op = operators.find(o => o.id === val);
                                        setFormData(prev => ({
                                            ...prev,
                                            responsableId: val,
                                            responsable: op ? op.nombreCompleto : ''
                                        }));
                                    }}
                                    placeholder="Sin asignar"
                                    className="!space-y-0"
                                />
                            </div>
                        </div>

                        {/* Etiquetas Técnicas */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Etiquetas Técnicas (Checklist)</label>
                            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                                {Object.keys(CHECKLIST_TEMPLATES).map(tag => {
                                    const active = formData.tags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => {
                                                const newTags = active
                                                    ? formData.tags.filter(t => t !== tag)
                                                    : [...formData.tags, tag];
                                                set('tags', newTags);
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${active
                                                ? 'bg-primary text-white border-primary shadow-sm'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
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
                                    inputMode="decimal"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.horasEstimadas}
                                    onChange={e => set('horasEstimadas', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horas Consumidas</label>
                                <input
                                    type="number"
                                    min={0}
                                    inputMode="decimal"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.horasConsumidas}
                                    onChange={e => set('horasConsumidas', e.target.value)}
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
                    </div>

                    {/* Footer - Fixed */}
                    <div className="p-5 md:p-7 border-t border-slate-100 flex gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95"
                        >
                            {editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MetricTooltip({ def }: { def: string }) {
    return (
        <div className="group/tooltip relative inline-block">
            <Info className="w-3.5 h-3.5 text-slate-300 hover:text-primary transition-colors cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 text-white rounded-xl text-[10px] leading-snug hidden group-hover/tooltip:block z-[9999] shadow-2xl animate-in zoom-in-95 duration-200 pointer-events-none">
                <p className="font-medium">{def}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900" />
            </div>
        </div>
    );
}
