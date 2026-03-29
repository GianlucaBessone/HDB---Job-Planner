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
    ClipboardList,
    Bell,
    Play,
    MapPin,
    QrCode
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatDate } from '@/lib/formatDate';
import SearchableSelect from '@/components/SearchableSelect';
import { CHECKLIST_TEMPLATES } from '@/lib/checklistTemplates';
import CodeBadge from '@/components/CodeBadge';
import { QRCodeCanvas } from 'qrcode.react';

// ── Types ─────────────────────────────────────────────────────────────────────
type ProjectStatus = 'por_hacer' | 'planificado' | 'activo' | 'en_riesgo' | 'atrasado' | 'finalizado';

interface Project {
    id: string;
    codigoProyecto?: string;
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
    geofenceLat?: number | null;
    geofenceLng?: number | null;
    geofenceRadius?: number | null;
    qrToken?: string | null;
    estado: ProjectStatus;

    fechaInicio?: string;
    fechaFin?: string;
    publicToken?: string;
    generarOS?: boolean;
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
    generarOS: boolean;
    aprovisionamiento: boolean;
    geofenceLat: number | null;
    geofenceLng: number | null;
    geofenceRadius: number | null;
    qrToken: string | null;
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
    finalizado: { label: 'Finalizado', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/50', ring: 'ring-slate-200', dot: 'bg-slate-400', Icon: MinusCircle },
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
    generarOS: false,
    aprovisionamiento: false,
    geofenceLat: null,
    geofenceLng: null,
    geofenceRadius: null,
    qrToken: null,
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
            generarOS: (project as any).generarOS || false,
            aprovisionamiento: (project as any).aprovisionamiento || false,
            geofenceLat: project.geofenceLat || null,
            geofenceLng: project.geofenceLng || null,
            geofenceRadius: project.geofenceRadius || null,
            qrToken: project.qrToken || null,
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
            qrToken: formData.qrToken || null, // Explicitly ensure it's passed
        };
        await safeApiRequest(url, { method, body: JSON.stringify(submissionData), headers: { 'Content-Type': 'application/json' } });
        setIsModalOpen(false);
        await loadData(true);
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
        const reset = { ...EMPTY_FILTERS, estados: appliedFilters.estados };
        setPendingFilters(reset);
        setAppliedFilters(reset);
    };

    const activeFilterCount = useMemo(() => {
        let n = 0;
        if (appliedFilters.responsable) n++;
        if (appliedFilters.cliente) n++;
        if (appliedFilters.fechaInicio || appliedFilters.fechaFin) n++;
        return n;
    }, [appliedFilters]);

    // ── Derived list ──────────────────────────────────────────────────────────
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            if (searchTerm) {
                const term = normalize(searchTerm);
                const matchName = normalize(p.nombre).includes(term);
                const matchCode = (p.codigoProyecto || '').toLowerCase().includes(searchTerm.toLowerCase());
                const matchClient = normalize(p.cliente || p.client?.nombre || '').includes(term);
                const matchResponsable = normalize(p.responsable || p.responsableUser?.nombreCompleto || '').includes(term);
                
                if (!matchName && !matchCode && !matchClient && !matchResponsable) return false;
            }
            if (appliedFilters.estados.length > 0 && !appliedFilters.estados.includes(p.estado)) return false;
            if (appliedFilters.fechaInicio && p.fechaInicio && p.fechaInicio < appliedFilters.fechaInicio) return false;
            if (appliedFilters.fechaFin && p.fechaFin && p.fechaFin > appliedFilters.fechaFin) return false;
            return true;
        });
    }, [projects, searchTerm, appliedFilters]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Page Header ── */}
            <div className="flex flex-col gap-6 mb-8">
                {/* Title row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                            <Layout className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                            Gestión de Proyectos
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">Control y seguimiento de proyectos activos</p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-1.5 bg-primary text-white px-3 md:px-5 py-2.5 md:py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all shrink-0"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">Nuevo Proyecto</span>
                            <span className="sm:hidden">Nuevo</span>
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
                    {/* Search Field */}
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, código, cliente o responsable..."
                            className="w-full h-[56px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-12 pr-4 text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Date Filters Area */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full sm:w-44">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                            <input 
                                type="date"
                                value={appliedFilters.fechaInicio}
                                onChange={e => {
                                    const val = e.target.value;
                                    setAppliedFilters(f => ({ ...f, fechaInicio: val }));
                                    setPendingFilters(f => ({ ...f, fechaInicio: val }));
                                }}
                                className="w-full h-[56px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-3 text-[11px] font-black uppercase tracking-tighter text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                title="Fecha Inicio"
                            />
                        </div>
                        <div className="hidden sm:block text-slate-300 font-black">/</div>
                        <div className="relative w-full sm:w-44">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                            <input 
                                type="date"
                                value={appliedFilters.fechaFin}
                                onChange={e => {
                                    const val = e.target.value;
                                    setAppliedFilters(f => ({ ...f, fechaFin: val }));
                                    setPendingFilters(f => ({ ...f, fechaFin: val }));
                                }}
                                className="w-full h-[56px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-3 text-[11px] font-black uppercase tracking-tighter text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                title="Fecha Fin"
                            />
                        </div>
                        {(appliedFilters.fechaInicio || appliedFilters.fechaFin) && (
                            <button 
                                onClick={() => {
                                    setAppliedFilters(f => ({ ...f, fechaInicio: '', fechaFin: '' }));
                                    setPendingFilters(f => ({ ...f, fechaInicio: '', fechaFin: '' }));
                                }}
                                className="p-4 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                                title="Limpiar fechas"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Status Pills Filter */}
                <div className="flex flex-wrap items-center gap-2 bg-white/50 p-2 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm border-dashed">
                    <button
                        onClick={() => {
                            setAppliedFilters(f => ({ ...f, estados: [] }));
                            setPendingFilters(f => ({ ...f, estados: [] }));
                        }}
                        className={`px-5 py-3 rounded-2xl text-[10px] font-black transition-all flex items-center gap-2 uppercase tracking-widest ${appliedFilters.estados.length === 0 
                            ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                            : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 border border-slate-100 dark:border-slate-800'}`}
                    >
                        Todos
                        <span className={`px-2 py-0.5 rounded-md text-[9px] ${appliedFilters.estados.length === 0 ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400'}`}>
                            {projects.length}
                        </span>
                    </button>

                    {ALL_STATUSES.map(s => {
                        const cfg = STATUS_CONFIG[s];
                        const isActive = appliedFilters.estados.length === 1 && appliedFilters.estados[0] === s;
                        const count = projects.filter(p => p.estado === s).length;
                        
                        return (
                            <button
                                key={s}
                                onClick={() => {
                                    const next = [s];
                                    setAppliedFilters(f => ({ ...f, estados: next }));
                                    setPendingFilters(f => ({ ...f, estados: next }));
                                }}
                                className={`px-5 py-3 rounded-2xl text-[10px] font-black transition-all flex items-center gap-2.5 border uppercase tracking-widest ${isActive 
                                    ? `${cfg.bg} ${cfg.color} border-${cfg.dot.split('-')[1]}-200 shadow-md` 
                                    : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                                <span className={`px-2 py-0.5 rounded-md text-[9px] ${isActive ? 'bg-white/50' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Body: Cards grid only ── */}
            <div className="w-full space-y-6">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array(6).fill(0).map((_, i) => (
                            <div key={i} className="bg-slate-100/60 rounded-[2.5rem] animate-pulse h-64" />
                        ))}
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] text-slate-400 dark:text-slate-500 shadow-sm border-dashed">
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-full mb-6">
                            <AlertCircle className="w-12 h-12 opacity-20" />
                        </div>
                        <p className="font-bold text-slate-600 dark:text-slate-300 text-lg">
                            {appliedFilters.estados.length === 1 ? (
                                (() => {
                                    const s = appliedFilters.estados[0];
                                    if (s === 'en_riesgo') return 'No hay proyectos en riesgo';
                                    if (s === 'atrasado') return 'No hay proyectos atrasados';
                                    if (s === 'finalizado') return 'No hay proyectos finalizados';
                                    if (s === 'planificado') return 'No hay proyectos planificados';
                                    if (s === 'por_hacer') return 'No hay proyectos por hacer';
                                    if (s === 'activo') return 'No hay proyectos activos';
                                    return 'No hay proyectos activos en esta etapa';
                                })()
                            ) : (
                                'No se han encontrado proyectos'
                            )}
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 font-medium">Aún no se han registrado proyectos en este estado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map(p => (
                            <ProjectCard key={p.id} project={p} onEdit={openEdit} onDetails={openDetails} handleDeleteClick={handleDeleteClick} />
                        ))}
                    </div>
                )}
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
        <Suspense fallback={<ProjectsSkeleton />}>
            <ProjectsContent />
        </Suspense>
    );
}

function ProjectsSkeleton() {
    return (
        <div className="w-full space-y-4 md:space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"></div> 
                        <div className="w-48 h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                    </h2>
                    <div className="w-64 h-4 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse hidden md:block mt-2"></div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="w-full h-[50px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                </div>
                <div className="w-full md:w-auto flex gap-2">
                    <div className="flex-1 md:w-32 h-[50px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                    <div className="w-[50px] h-[50px] bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 min-w-0 w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array(4).fill(0).map((_, i) => (
                            <div key={i} className="bg-slate-100/60 rounded-2xl animate-pulse h-[220px]" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
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
            <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-t-3xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="space-y-1">
                            {project.codigoProyecto && (
                                <CodeBadge code={project.codigoProyecto} variant="project" size="sm" showCopy={true} />
                            )}
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                {project.codigoProyecto ? (
                                    <span className="text-primary group-hover:text-primary transition-colors font-mono">{project.codigoProyecto} | </span>
                                ) : (
                                    <span className="text-slate-400 dark:text-slate-500 font-mono">#SIN-COD | </span>
                                )}
                                {project.nombre}
                            </h3>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                            <Building2 className="w-4 h-4" /> {project.client?.nombre || project.cliente || 'Sin cliente'}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-icon-inline p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 transition-all active:scale-95">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Activity className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando detalles...</p>
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
                                    <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">
                                        <Users className="w-4 h-4 text-primary" /> Personal Asignado
                                    </h4>
                                    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-x-auto shadow-sm">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operador</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Horas Totales</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {statsArray.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={2} className="px-4 py-8 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">No hay registros aún</td>
                                                    </tr>
                                                ) : (
                                                    statsArray.map((stat: any) => (
                                                        <tr key={stat.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{stat.name}</div>
                                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Carga: {stat.lastSeen}</div>
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
                                            <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">
                                                <Activity className="w-4 h-4 text-primary" /> Historial Reciente
                                            </h4>
                                            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-x-auto shadow-sm">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                        <tr>
                                                            <th className="px-4 py-3">Fecha</th>
                                                            <th className="px-4 py-3">Operador</th>
                                                            <th className="px-4 py-3 text-right">Horas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {entries.slice(0, 10).map((entry: any) => (
                                                            <tr key={entry.id}>
                                                                <td className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium">{formatDate(entry.fecha)}</td>
                                                                <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-200">{entry.operator.nombreCompleto}</td>
                                                                <td className="px-4 py-2 text-right font-black text-slate-900 dark:text-slate-50">{entry.horasTrabajadas}h</td>
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
                                    <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">
                                        <CheckCircle2 className="w-4 h-4 text-primary" /> Avance Técnico (Checklist)
                                    </h4>
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                                        {visibleItems.length === 0 ? (
                                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-8 border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">Sin tareas definidas para este proyecto</div>
                                        ) : (
                                            visibleItems.map((item: any) => (
                                                <div key={item.id} className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${item.excluded ? 'opacity-40 grayscale border-dashed border-slate-300 dark:border-slate-600' : item.completed ? 'bg-emerald-50/40 border-emerald-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                                    {!item.excluded ? (
                                                        <button
                                                            disabled={item.confirmedBySupervisor}
                                                            onClick={() => onUpdateChecklist(item.id, { completed: !item.completed })}
                                                            className={`btn-icon-inline mt-0.5 shrink-0 w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/40'}`}
                                                        >
                                                            {item.completed && <CheckCircle2 className="w-4 h-4" />}
                                                        </button>
                                                    ) : (
                                                        <div className="mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center">
                                                            <MinusCircle className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold leading-snug ${item.excluded ? 'text-slate-400 dark:text-slate-500 line-through' : item.completed ? 'text-emerald-900' : 'text-slate-700 dark:text-slate-200'}`}>{item.description}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{item.tag}</span>
                                                            {item.excluded && <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase italic">(Excluido)</span>}
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
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Comparte este enlace con el cliente para que vea los avances en tiempo real.</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto overflow-hidden">
                                        <input
                                            readOnly
                                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/projects/${project.id}/report?token=${project.publicToken || ''}`}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-medium text-slate-500 dark:text-slate-400 flex-1 md:w-64 outline-none truncate"
                                        />
                                        <button
                                            onClick={() => {
                                                const url = `${window.location.origin}/projects/${project.id}/report?token=${project.publicToken || ''}`;
                                                navigator.clipboard.writeText(url);
                                                showToast('Link copiado al portapapeles', 'success');
                                            }}
                                            className="btn-icon-inline bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-primary border border-primary/20 p-2 rounded-xl transition-all shadow-sm active:scale-90 shrink-0"
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
                                        <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">
                                            <MessageSquare className="w-4 h-4 text-primary" /> Registrar Seguimiento / Observación
                                        </h4>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-6 space-y-4 border border-slate-100 dark:border-slate-800">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Fecha</label>
                                                    <input
                                                        type="date"
                                                        value={newLog.fecha}
                                                        onChange={e => setNewLog(prev => ({ ...prev, fecha: e.target.value }))}
                                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Responsable</label>
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
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Observación</label>
                                                <textarea
                                                    value={newLog.observacion}
                                                    placeholder="Describe el avance o comentario..."
                                                    onChange={e => setNewLog(prev => ({ ...prev, observacion: e.target.value }))}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 outline-none min-h-[100px] resize-none"
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
                                        <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">
                                            <Activity className="w-4 h-4 text-primary" /> Historial de Seguimiento
                                        </h4>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                            {logs.length === 0 ? (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-10 text-center text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">No hay registros aún</div>
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
                                                    <div key={log.id} className={`bg-white dark:bg-slate-800 border p-4 rounded-2xl shadow-sm space-y-2 ${cat === 'Bloqueante' ? 'border-red-100' : 'border-slate-100 dark:border-slate-800'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">{formatDate(log.fecha)}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest ${catStyles[cat] || catStyles['Nota']}`}>
                                                                    {cat === 'Bloqueante' && '🚨 '}{cat}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">Por: {log.responsable}</span>
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed italic">"{log.observacion}"</p>
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
                                    <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">
                                        <FileText className="w-4 h-4 text-primary" /> Observaciones y Notas
                                    </h4>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
                                        <p className="text-slate-600 dark:text-slate-300 text-sm italic font-medium leading-relaxed">
                                            "{project.observaciones}"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95">
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 p-5 flex flex-col gap-4 group">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-black text-lg text-slate-800 dark:text-slate-100 leading-tight group-hover:text-primary transition-colors">
                        {project.codigoProyecto ? (
                            <span className="text-primary font-mono mr-1.5">{project.codigoProyecto} |</span>
                        ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-mono mr-1.5">#SIN-COD |</span>
                        )}
                        {project.nombre}
                    </h4>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => onEdit(project)}
                        className="btn-icon-inline p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/5 transition-all active:scale-90"
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
                    <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">Cliente:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {project.client?.nombre || project.cliente || '—'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">Resp:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{project.responsableUser?.nombreCompleto || project.responsable || '—'}</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {project.tags && project.tags.length > 0 ? (
                    project.tags.map((tag: any) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-tighter">
                            {tag}
                        </span>
                    ))
                ) : (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 italic">Sin etiquetas técnicas</span>
                )}
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Avance: {progress}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{horasConsumidas}h / {horasEstimadas}h</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-50">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <span>Avance Técnico (Checklist)</span>
                    <span className="text-slate-600 dark:text-slate-300">
                        {project.checklistItems?.filter((i: any) => i.completed && !i.excluded).length} / {project.checklistItems?.filter((i: any) => !i.excluded).length}
                    </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-1.5 rounded-full overflow-hidden">
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

                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <button onClick={() => onDetails(project)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap">
                        Ver Detalle <ChevronRight className="w-3 h-3" />
                    </button>
                    <Link href="/planning" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap">
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
                    {(project as any).generarOS && (
                        <Link
                            href={`/ordenes-servicio/generar?projectId=${project.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all whitespace-nowrap"
                            title="Generar Orden de Servicio"
                        >
                            <ClipboardList className="w-3 h-3" /> OS
                        </Link>
                    )}
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
            <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header - Fixed */}
                <div className="p-5 md:p-7 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">
                        {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                    </h3>
                    <button onClick={onClose} className="btn-icon-inline p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0">
                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-4 custom-scrollbar">
                        {/* Nombre + Toggle Metricas */}
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nombre del Proyecto *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.nombre}
                                    onChange={e => set('nombre', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col space-y-2 pb-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Activo</label>
                                <button
                                    type="button"
                                    onClick={() => set('activo', !formData.activo)}
                                    className={`relative inline-flex h-10 w-20 items-center rounded-xl transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-primary/20 ${formData.activo ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-6 w-6 transform rounded-lg bg-white dark:bg-slate-800 shadow-md transition-transform duration-300 ${formData.activo ? 'translate-x-11' : 'translate-x-3'}`} />
                                    <span className={`absolute text-[9px] font-black uppercase tracking-tighter transition-opacity duration-300 ${formData.activo ? 'left-3 opacity-100 text-white' : 'right-3 opacity-100 text-slate-500 dark:text-slate-400'}`}>
                                        {formData.activo ? 'SÍ' : 'NO'}
                                    </span>
                                </button>
                            </div>
                            <div className="flex flex-col space-y-2 pb-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    En Métricas <MetricTooltip def="Define si el proyecto se incluye en los cálculos del Panel de Análisis." />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => set('noEnMetricas', !formData.noEnMetricas)}
                                    className={`relative inline-flex h-10 w-20 items-center rounded-xl transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-primary/20 ${!formData.noEnMetricas ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-6 w-6 transform rounded-lg bg-white dark:bg-slate-800 shadow-md transition-transform duration-300 ${!formData.noEnMetricas ? 'translate-x-11' : 'translate-x-3'}`} />
                                    <span className={`absolute text-[9px] font-black uppercase tracking-tighter transition-opacity duration-300 ${!formData.noEnMetricas ? 'left-3 opacity-100 text-white' : 'right-3 opacity-100 text-slate-500 dark:text-slate-400'}`}>
                                        {!formData.noEnMetricas ? 'SÍ' : 'NO'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Categoria + Tipo Actividad */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Categoría del Proyecto</label>
                                <SearchableSelect
                                    options={categoryOptions.map(c => ({ id: c, label: c }))}
                                    value={formData.categoria}
                                    onChange={(val) => set('categoria', val)}
                                    placeholder="Seleccionar..."
                                    className="!space-y-0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tipo de Actividad</label>
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
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cliente</label>
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
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Responsable</label>
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
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Etiquetas Técnicas (Checklist)</label>
                            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
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
                                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
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
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estado</label>
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
                                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
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
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Horas Estimadas</label>
                                <input
                                    type="number"
                                    min={0}
                                    inputMode="decimal"
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.horasEstimadas}
                                    onChange={e => set('horasEstimadas', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Horas Consumidas</label>
                                <input
                                    type="number"
                                    min={0}
                                    inputMode="decimal"
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.horasConsumidas}
                                    onChange={e => set('horasConsumidas', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fecha Inicio</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.fechaInicio}
                                    onChange={e => set('fechaInicio', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fecha Fin</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.fechaFin}
                                    onChange={e => set('fechaFin', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Observaciones</label>
                            <textarea
                                rows={3}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium resize-none"
                                value={formData.observaciones}
                                onChange={e => set('observaciones', e.target.value)}
                                placeholder="Notas adicionales..."
                            />
                        </div>

                        {/* Generar OS Switch */}
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold text-emerald-800">Generar Orden de Servicio</p>
                                <p className="text-xs text-emerald-600 font-medium">Habilita el flujo de Orden de Servicio para este proyecto</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => set('generarOS', !(formData as any).generarOS)}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 ${
                                    (formData as any).generarOS ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-800 shadow-md transition-transform duration-300 ${
                                    (formData as any).generarOS ? 'translate-x-8' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        {/* Geovalla y QR */}
                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5" /> Validación por Geovalla y QR
                            </h4>
                            <div className="space-y-4">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest italic px-1">Haz clic en el mapa para posicionar el centro de la geovalla</p>
                                <MapPicker 
                                    lat={(formData as any).geofenceLat} 
                                    lng={(formData as any).geofenceLng} 
                                    radius={(formData as any).geofenceRadius} 
                                    onChange={(lat, lng, radius) => {
                                        set('geofenceLat', lat);
                                        set('geofenceLng', lng);
                                        set('geofenceRadius', radius);
                                    }}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Latitud</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="-34.123456"
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm"
                                        value={(formData as any).geofenceLat || ''}
                                        onChange={e => set('geofenceLat', e.target.value === '' ? null : parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Longitud</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="-58.123456"
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm"
                                        value={(formData as any).geofenceLng || ''}
                                        onChange={e => set('geofenceLng', e.target.value === '' ? null : parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Radio (Metros)</label>
                                    <input
                                        type="number"
                                        placeholder="Ej: 100"
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm"
                                        value={(formData as any).geofenceRadius || ''}
                                        onChange={e => set('geofenceRadius', e.target.value === '' ? null : parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">QR Token (Validación)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Token único..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm"
                                            value={(formData as any).qrToken || ''}
                                            onChange={e => set('qrToken', e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => set('qrToken', Math.random().toString(36).substring(2, 10).toUpperCase())}
                                            className="px-3 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 rounded-2xl text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                                            title="Generar Token"
                                        >
                                            <Play className="w-4 h-4 rotate-90" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {(formData as any).qrToken && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                                    <div id="project-qr" className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                                        <QRCodeCanvas 
                                            value={(formData as any).qrToken} 
                                            size={160}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const canvas = document.querySelector('#project-qr canvas') as HTMLCanvasElement;
                                            if (canvas) {
                                                const win = window.open('', '_blank');
                                                if (win) {
                                                    win.document.write(`
                                                        <html>
                                                            <head>
                                                                <title>Imprimir QR - ${formData.nombre}</title>
                                                                <style>
                                                                    body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                                                                    .container { text-align: center; border: 2px solid #000; padding: 40px; border-radius: 20px; }
                                                                    h1 { margin-bottom: 20px; font-size: 24px; }
                                                                    h2 { margin-bottom: 10px; font-size: 20px; }
                                                                    p { margin-top: 20px; font-weight: bold; font-size: 18px; color: #666; }
                                                                    img { width: 300px; height: 300px; }
                                                                </style>
                                                            </head>
                                                            <body>
                                                                <div class="container">
                                                                    <h1>HDB SERVICIOS ELÉCTRICOS</h1>
                                                                    <h2>PROYECTO: ${formData.nombre}</h2>
                                                                    ${editingProject?.codigoProyecto ? `<h3>CÓDIGO: ${editingProject.codigoProyecto}</h3>` : ''}
                                                                    <img src="${canvas.toDataURL()}" />
                                                                    <p>TOKEN: ${(formData as any).qrToken}</p>
                                                                </div>
                                                                    <script>
                                                                        window.onload = () => {
                                                                            setTimeout(() => {
                                                                                window.print();
                                                                                window.onafterprint = () => window.close();
                                                                            }, 500);
                                                                        };
                                                                    </script>
                                                                </body>
                                                            </html>
                                                    `);
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all active:scale-95"
                                    >
                                        <QrCode className="w-4 h-4" /> Imprimir QR para Obra
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Aprovisionamiento Switch */}
                        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3.5">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold text-primary">Aprovisionamiento de Materiales</p>
                                <p className="text-xs text-primary/70 font-medium">Habilita la gestión y trazabilidad de materiales para este proyecto</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => set('aprovisionamiento', !(formData as any).aprovisionamiento)}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 ${
                                    (formData as any).aprovisionamiento ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-800 shadow-md transition-transform duration-300 ${
                                    (formData as any).aprovisionamiento ? 'translate-x-8' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>
                    </div>

                    {/* Footer - Fixed */}
                    <div className="p-5 md:p-7 border-t border-slate-100 dark:border-slate-800 flex gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 transition-all active:scale-95"
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
