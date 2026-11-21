'use client';

import Link from 'next/link';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
    QrCode,
    Save,
    Pin
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

import { 
    ProjectStatus, 
    Project, 
    FormData, 
    Filters, 
    STATUS_CONFIG, 
    getProgressColor, 
    ALL_STATUSES, 
    MANUAL_STATUSES,
    EMPTY_FORM, 
    EMPTY_FILTERS, 
    normalize,
    ViewType,
    VIEW_STORAGE_KEY
} from '@/lib/projectTypes';

import { TIPOS_PROYECTO, TIPO_PROYECTO_INFO, tipoPorInterruptores } from '@/lib/proyectos/tipos';
import { estadoManual } from '@/lib/proyectos/salud';
import { useViewState } from '@/lib/hooks/useViewState';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { useRef } from 'react';

import ProjectViewSelector from '@/components/projects/ProjectViewSelector';
import ProjectCardView from '@/components/projects/ProjectCardView';
import ProjectSpreadsheetView from '@/components/projects/ProjectSpreadsheetView';
import ProjectGanttView from '@/components/projects/ProjectGanttView';
import ProjectCalendarView from '@/components/projects/ProjectCalendarView';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import ProjectCostModal from '@/components/projects/ProjectCostModal';

/** Mensaje de error que devuelve la API (p. ej. un 403 por permisos). */
async function mensajeError(res: Response, porDefecto: string): Promise<string> {
    try {
        const data = await res.json();
        return data?.error || porDefecto;
    } catch {
        return porDefecto;
    }
}

// ── Content Component ──────────────────────────────────────────────────────────
function ProjectsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    // Presupuesto de servicio de origen por proyecto (vacío si el módulo no está instalado).
    const [presupuestos, setPresupuestos] = useState<Record<string, { id: string; numero: string }>>({});
    const [costTabInicial, setCostTabInicial] = useState<'costo' | 'pvr'>('costo');
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<{ id: string; nombreCompleto: string; role?: string }[]>([]);
    const [clients, setClients] = useState<{ id: string; nombre: string; listaPrecioId?: string | null; listaPrecio?: any }[]>([]);
    const [listasPrecios, setListasPrecios] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useViewState<ViewType>(VIEW_STORAGE_KEY, 'card');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pendingFilters, setPendingFilters] = useViewState<Filters>('projects-pendingFilters', EMPTY_FILTERS);
    const [appliedFilters, setAppliedFilters] = useViewState<Filters>('projects-appliedFilters', EMPTY_FILTERS);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

    const [selectedProjectForCost, setSelectedProjectForCost] = useState<Project | null>(null);
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);

    const openCostModal = (project: Project, tab: 'costo' | 'pvr' = 'costo') => {
        setCostTabInicial(tab);
        setSelectedProjectForCost(project);
        setIsCostModalOpen(true);
    };

    const [configOptions, setConfigOptions] = useState<any[]>([]);
    const [systemTags, setSystemTags] = useState<any[]>([]);

    const categoryOptions = configOptions.filter((o: any) => o.category === 'CATEGORIA' && o.active).map((o: any) => o.value);
    const activityOptions = configOptions.filter((o: any) => o.category === 'TIPO_ACTIVIDAD' && o.active).map((o: any) => o.value);

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

    // ?alta=clasica abre el formulario de siempre; ?editar=<id> abre la edición (desde la ficha);
    // ?proyecto=<id> (enlaces viejos) lleva a la ficha del proyecto.
    const enlaceAtendido = useRef('');
    useEffect(() => {
        const alta = searchParams.get('alta');
        const proyectoId = searchParams.get('proyecto');
        const editarId = searchParams.get('editar');
        const clave = `${alta}|${proyectoId}|${editarId}`;
        if (enlaceAtendido.current === clave) return;
        if (alta === 'clasica') {
            enlaceAtendido.current = clave;
            openCreate();
        } else if (proyectoId) {
            enlaceAtendido.current = clave;
            router.replace(`/projects/ficha/${proyectoId}`);
        } else if (editarId && projects.length) {
            enlaceAtendido.current = clave;
            const p = projects.find(x => x.id === editarId);
            if (p) openEdit(p);
        }
    }, [searchParams, projects]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [projectsData, operatorsData, clientsData, configOptionsData, tagsData, listasData] = await Promise.all([
                safeApiRequest('/api/projects').then(res => res.json()),
                safeApiRequest('/api/operators').then(res => res.json()),
                safeApiRequest('/api/clients').then(res => res.json()),
                safeApiRequest('/api/config/options').then(res => res.json()), // Fixed path
                safeApiRequest('/api/config/tags').then(res => res.json()),
                safeApiRequest('/api/ventas/listas-precios').then(res => res.json()).catch(() => []),
            ]);
            setProjects(projectsData);
            setOperators(operatorsData);
            setClients(clientsData);
            setConfigOptions(configOptionsData);
            setSystemTags(Array.isArray(tagsData) ? tagsData.filter((t: any) => t.active) : []);
            setListasPrecios(Array.isArray(listasData) ? listasData : []);
            fetch('/api/presupuestos-servicio/vinculos', { cache: 'no-store' })
                .then((r) => (r.ok ? r.json() : {}))
                .then((m: any) => setPresupuestos(m && typeof m === 'object' ? m : {}))
                .catch(() => undefined);
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
            cliente: project.cliente || '',
            clientId: project.clientId || '',
            responsable: project.responsable || '',
            responsableId: project.responsableId || '',
            tags: project.tags || [],
            categoria: project.categoria || '',
            tipoActividad: project.tipoActividad || '',
            tipo: project.tipo || tipoPorInterruptores(project),
            // El estado calculado ("en riesgo", "atrasado") no se edita: se edita el que eligió una persona
            estado: project.estadoBase || estadoManual(project.estado),
            fechaInicio: project.fechaInicio || '',
            fechaFin: project.fechaFin || '',
            generarOS: (project as any).generarOS || false,
            aprovisionamiento: (project as any).aprovisionamiento || false,
            listaPrecioId: (project as any).listaPrecioId || '',
            geofenceLat: project.geofenceLat || null,
            geofenceLng: project.geofenceLng || null,
            geofenceRadius: project.geofenceRadius || null,
            qrToken: project.qrToken || null,
            fichajeHabilitado: (project as any).fichajeHabilitado || false,
            proyectoFijo: (project as any).proyectoFijo || false,
        });

        setIsModalOpen(true);
    };

    /** El detalle del proyecto es su ficha (antes un modal con su propia versión de la bitácora y el checklist). */
    const openDetails = (project: Project) => router.push(`/projects/ficha/${project.id}`);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim()) return;
        const method = editingProject ? 'PATCH' : 'POST';
        const url = editingProject ? `/api/projects?id=${editingProject.id}` : '/api/projects';

        const submissionData = {
            ...formData,
            horasEstimadas: Number(formData.horasEstimadas) || 0,
            qrToken: formData.qrToken || null, // Explicitly ensure it's passed
        };
        const res = await safeApiRequest(url, { method, body: JSON.stringify(submissionData), headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) {
            showToast(await mensajeError(res, 'No se pudo guardar el proyecto'), 'error');
            return;
        }
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
        const res = await safeApiRequest(`/api/projects?id=${id}`, { method: 'DELETE' });
        setIsConfirmOpen(false);
        setProjectToDelete(null);
        if (!res.ok) {
            showToast(await mensajeError(res, 'No se pudo eliminar el proyecto'), 'error');
            return;
        }
        const data = await res.json().catch(() => null);
        if (data?.modo === 'desactivado') {
            // Tiene horas, fichadas u órdenes: queda inactivo para no perder ese historial.
            setProjects(prev => prev.map(p => p.id === id ? { ...p, activo: false } : p));
            showToast('Tiene historial: quedó desactivado en lugar de eliminarse', 'info');
            return;
        }
        setProjects(prev => prev.filter(p => p.id !== id));
        showToast('Proyecto eliminado', 'success');
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
                const matchCode = normalize(p.codigoProyecto || '').includes(term);
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

    const registerCommand = useCommandStore((state) => state.registerCommand);
    const unregisterCommand = useCommandStore((state) => state.unregisterCommand);
    const abrirWizard = () => router.push('/projects/nuevo');
    const latestActions = useRef({ openCreate: abrirWizard });
    
    useEffect(() => {
        latestActions.current = { openCreate: abrirWizard };
    });

    useEffect(() => {
        registerCommand({
            id: 'proj-nuevo',
            label: 'Nuevo Proyecto',
            category: 'Contextual',
            keys: ['ctrl', 'n'],
            action: () => latestActions.current.openCreate()
        });
        return () => {
            unregisterCommand('proj-nuevo');
        };
    }, [registerCommand, unregisterCommand]);

    const validViews: ViewType[] = ['card', 'spreadsheet', 'gantt', 'calendar'];
    const activeView: ViewType = (typeof viewType === 'string' && validViews.includes(viewType)) ? viewType : 'card';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200">

            {/* ── Page Header ── */}
            <div className="flex flex-col gap-6 mb-8">
                <ProjectsHeader
                    activeTabId="proyectos"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    onNewProject={abrirWizard}
                />
                
                {/* View Selector and Filter Row */}
                <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
                    <ProjectViewSelector 
                        value={activeView} 
                        onChange={setViewType} 
                    />

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
                                className="w-full h-[56px] bg-card border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-3 text-[11px] font-semibold uppercase tracking-tight text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                title="Fecha Inicio"
                            />
                        </div>
                        <div className="hidden sm:block text-slate-300 font-bold">/</div>
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
                                className="w-full h-[56px] bg-card border border-slate-200 dark:border-slate-700 rounded-2xl pl-9 pr-3 text-[11px] font-semibold uppercase tracking-tight text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                title="Fecha Fin"
                            />
                        </div>
                        {(appliedFilters.fechaInicio || appliedFilters.fechaFin) && (
                            <button 
                                onClick={() => {
                                    setAppliedFilters(f => ({ ...f, fechaInicio: '', fechaFin: '' }));
                                    setPendingFilters(f => ({ ...f, fechaInicio: '', fechaFin: '' }));
                                }}
                                className="p-4 bg-muted text-slate-500 dark:text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                                title="Limpiar fechas"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Status Pills Filter */}
                <div className="flex flex-wrap items-center gap-2 bg-white/50 p-2 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm border-dashed">
                    <button
                        onClick={() => {
                            setAppliedFilters(f => ({ ...f, estados: [] }));
                            setPendingFilters(f => ({ ...f, estados: [] }));
                        }}
                        className={`px-5 py-3 rounded-2xl text-[11px] font-semibold transition-all flex items-center gap-2 uppercase tracking-wider ${appliedFilters.estados.length === 0 
                            ? 'bg-primary text-white shadow-lg' 
                            : 'bg-card text-slate-400 dark:text-slate-500 hover:text-slate-600 border border-slate-100 dark:border-slate-800'}`}
                    >
                        Todos
                        <span className={`px-2 py-0.5 rounded-md text-[11px] ${appliedFilters.estados.length === 0 ? 'bg-white/20 text-white' : 'bg-muted text-slate-500 dark:text-slate-400'}`}>
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
                                className={`px-5 py-3 rounded-2xl text-[11px] font-semibold transition-all flex items-center gap-2.5 border uppercase tracking-wider ${isActive 
                                    ? `${cfg.bg} ${cfg.color} border-${cfg.dot.split('-')[1]}-200 shadow-md` 
                                    : 'bg-card text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                                <span className={`px-2 py-0.5 rounded-md text-[11px] ${isActive ? 'bg-white/50' : 'bg-muted text-slate-500 dark:text-slate-400'}`}>
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
                            <div key={i} className="bg-slate-100/60 rounded-3xl animate-pulse h-64" />
                        ))}
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center bg-card border border-slate-200 dark:border-slate-700 rounded-3xl text-slate-400 dark:text-slate-500 shadow-sm border-dashed">
                        <div className="p-6 bg-background text-foreground rounded-full mb-6">
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
                ) : activeView === 'card' ? (
                    <ProjectCardView projects={filteredProjects} onEdit={openEdit} onDetails={openDetails} handleDeleteClick={handleDeleteClick} onViewCost={openCostModal} presupuestos={presupuestos} />
                ) : activeView === 'spreadsheet' ? (
                    <ProjectSpreadsheetView projects={filteredProjects} onRefresh={loadData} onViewCost={openCostModal} />
                ) : activeView === 'gantt' ? (
                    <ProjectGanttView projects={filteredProjects} onRefresh={loadData} onDetails={openDetails} />
                ) : activeView === 'calendar' ? (
                    <ProjectCalendarView projects={filteredProjects} onDetails={openDetails} />
                ) : (
                    <ProjectCardView projects={filteredProjects} onEdit={openEdit} onDetails={openDetails} handleDeleteClick={handleDeleteClick} onViewCost={openCostModal} presupuestos={presupuestos} />
                )}
            </div>

            {isCostModalOpen && selectedProjectForCost && (
                <ProjectCostModal
                    projectId={selectedProjectForCost.id}
                    tabInicial={costTabInicial}
                    onClose={() => setIsCostModalOpen(false)}
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
                    systemTags={systemTags}
                    listasPrecios={listasPrecios}
                    onSubmit={handleSubmit}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Proyecto"
                message="Si tiene horas, fichadas, órdenes o materiales, queda desactivado para conservar ese historial. Si no tiene nada, se elimina y no se puede deshacer."
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
        <div className="w-full space-y-4 md:space-y-8 animate-in fade-in duration-200 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-title text-slate-900 dark:text-slate-50 flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"></div> 
                        <div className="w-48 h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                    </h2>
                    <div className="w-64 h-4 bg-muted text-muted-foreground/50 rounded animate-pulse hidden md:block mt-2"></div>
                </div>
            </div>

            <div className="bg-card text-card-foreground p-4 md:p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="w-full h-[50px] bg-muted text-muted-foreground/50 rounded-2xl animate-pulse" />
                </div>
                <div className="w-full md:w-auto flex gap-2">
                    <div className="flex-1 md:w-32 h-[50px] bg-muted text-muted-foreground/50 rounded-2xl animate-pulse" />
                    <div className="w-[50px] h-[50px] bg-muted text-muted-foreground/50 rounded-2xl animate-pulse" />
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
// ── ProjectModal ──────────────────────────────────────────────────────────────
function ProjectModal({
    formData,
    setFormData,
    editingProject,
    operators,
    clients,
    categoryOptions,
    activityOptions,
    systemTags,
    listasPrecios = [],
    onSubmit,
    onClose,
}: {
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    editingProject: Project | null;
    operators: { id: string; nombreCompleto: string }[];
    clients: { id: string; nombre: string; listaPrecioId?: string | null; listaPrecio?: any }[];
    categoryOptions: string[];
    activityOptions: string[];
    systemTags: any[];
    listasPrecios?: any[];
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}) {
    const set = (field: keyof FormData, value: any) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    const [modalTab, setModalTab] = useState<'general' | 'config' | 'gps'>('general');

    const MODAL_TABS = [
        { id: 'general' as const, label: 'General' },
        { id: 'config' as const, label: 'Configuración' },
        { id: 'gps' as const, label: 'GPS / QR' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-950/50 animate-in fade-in duration-200">
            <div className="bg-card text-card-foreground w-full max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 md:zoom-in-95 duration-200 max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 md:p-7 pb-0 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">
                        {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                    </h3>
                    <button onClick={onClose} className="btn-icon-inline p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {/* Tab Bar */}
                <div className="px-5 md:px-7 pt-4 flex gap-1 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    {MODAL_TABS.map(tab => (
                        <button key={tab.id} type="button" onClick={() => setModalTab(tab.id)}
                            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${modalTab === tab.id ? 'text-primary border-primary bg-primary/5' : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0">
                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-4 custom-scrollbar">
                        {/* ── GENERAL TAB ── */}
                        {modalTab === 'general' && <>
                        {/* Nombre + Toggle Metricas */}
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Nombre del Proyecto *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.nombre}
                                    onChange={e => set('nombre', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col space-y-2 pb-1">
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Activo</label>
                                <button
                                    type="button"
                                    onClick={() => set('activo', !formData.activo)}
                                    className={`relative inline-flex h-10 w-20 items-center rounded-xl transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-primary/20 ${formData.activo ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-6 w-6 transform rounded-lg bg-card text-card-foreground shadow-md transition-transform duration-300 ${formData.activo ? 'translate-x-11' : 'translate-x-3'}`} />
                                    <span className={`absolute text-[11px] font-semibold uppercase tracking-tight transition-opacity duration-300 ${formData.activo ? 'left-3 opacity-100 text-white' : 'right-3 opacity-100 text-slate-500 dark:text-slate-400'}`}>
                                        {formData.activo ? 'SÍ' : 'NO'}
                                    </span>
                                </button>
                            </div>
                            <div className="flex flex-col space-y-2 pb-1">
                                <label className="flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                    En Métricas <MetricTooltip def="Define si el proyecto se incluye en los cálculos del Panel de Análisis." />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => set('noEnMetricas', !formData.noEnMetricas)}
                                    className={`relative inline-flex h-10 w-20 items-center rounded-xl transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-primary/20 ${!formData.noEnMetricas ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-6 w-6 transform rounded-lg bg-card text-card-foreground shadow-md transition-transform duration-300 ${!formData.noEnMetricas ? 'translate-x-11' : 'translate-x-3'}`} />
                                    <span className={`absolute text-[11px] font-semibold uppercase tracking-tight transition-opacity duration-300 ${!formData.noEnMetricas ? 'left-3 opacity-100 text-white' : 'right-3 opacity-100 text-slate-500 dark:text-slate-400'}`}>
                                        {!formData.noEnMetricas ? 'SÍ' : 'NO'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Categoria + Tipo Actividad */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Categoría del Proyecto</label>
                                <SearchableSelect
                                    options={categoryOptions.map(c => ({ id: c, label: c }))}
                                    value={formData.categoria}
                                    onChange={(val) => set('categoria', val)}
                                    placeholder="Seleccionar..."
                                    className="!space-y-0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Tipo de Actividad</label>
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
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Cliente</label>
                                <SearchableSelect
                                    options={clients.map(c => ({ id: c.id, label: c.nombre }))}
                                    value={formData.clientId}
                                    onChange={(val) => {
                                        const client = clients.find(c => c.id === val) as any;
                                        setFormData(prev => {
                                            const next = {
                                                ...prev,
                                                clientId: val,
                                                cliente: client ? client.nombre : ''
                                            };
                                            // Si el cliente tiene una lista de precios predeterminada y el proyecto no tiene una seleccionada (o es nuevo proyecto):
                                            if (client?.listaPrecioId && (!prev.listaPrecioId || !editingProject)) {
                                                next.listaPrecioId = client.listaPrecioId;
                                                next.aprovisionamiento = true;
                                            }
                                            return next;
                                        });
                                    }}
                                    placeholder="Seleccionar cliente..."
                                    className="!space-y-0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Responsable</label>
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
                            <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-200">Etiquetas Técnicas / Especialidades</label>
                            <div className="flex flex-wrap gap-2 p-3 bg-background text-foreground rounded-2xl border border-slate-200 dark:border-slate-700">
                                {systemTags.map(tagObj => {
                                    const tag = tagObj.name;
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
                                                : 'bg-card text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tipo de proyecto: propone los valores de Configuración (P27) */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Tipo de proyecto</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {TIPOS_PROYECTO.map(t => {
                                    const info = TIPO_PROYECTO_INFO[t];
                                    const active = formData.tipo === t;
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            title={info.descripcion}
                                            onClick={() => setFormData(prev => ({ ...prev, tipo: t, ...info.valores }))}
                                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${active
                                                ? 'bg-primary/10 text-primary ring-1 ring-primary/30 border-transparent'
                                                : 'bg-card text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                        >
                                            {info.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {TIPO_PROYECTO_INFO[formData.tipo].descripcion} Al elegirlo se ajustan OS, provisión, fichaje, proyecto fijo y métricas (pestaña Configuración); después podés cambiarlos.
                            </p>
                        </div>

                        {/* Estado: "en riesgo" y "atrasado" se calculan (P27) */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Estado</label>
                            {editingProject?.alertaMotivo && (
                                <p className={`text-[11px] font-medium ${editingProject.estado === 'atrasado' ? 'text-danger-700 dark:text-danger-300' : 'text-warning-700 dark:text-warning-300'}`}>
                                    {STATUS_CONFIG[editingProject.estado].label}: {editingProject.alertaMotivo}
                                </p>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {MANUAL_STATUSES.map(s => {
                                    const cfg = STATUS_CONFIG[s];
                                    const active = formData.estado === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => set('estado', s)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${active
                                                ? `${cfg.bg} ${cfg.color} ring-1 ${cfg.ring} border-transparent`
                                                : 'bg-card text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
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
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Horas Estimadas</label>
                                <input
                                    type="number"
                                    min={0}
                                    inputMode="decimal"
                                    className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.horasEstimadas}
                                    onChange={e => set('horasEstimadas', e.target.value)}
                                />
                            </div>
                            {/* Solo lectura: lo mantiene el registro de tiempos (app/api/time-entries) */}
                            <div>
                                <span id="horas-consumidas-label" className="field-label">Horas Consumidas</span>
                                <div
                                    aria-labelledby="horas-consumidas-label"
                                    aria-describedby="horas-consumidas-hint"
                                    className="w-full bg-muted text-foreground border border-border rounded-2xl py-3 px-4 font-medium tabular-nums"
                                >
                                    {editingProject ? editingProject.horasConsumidas : 0} h
                                </div>
                                <p id="horas-consumidas-hint" className="field-hint">Se calcula desde el registro de tiempos.</p>
                            </div>
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Fecha Inicio</label>
                                <input
                                    type="date"
                                    className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.fechaInicio}
                                    onChange={e => set('fechaInicio', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Fecha Fin</label>
                                <input
                                    type="date"
                                    className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    value={formData.fechaFin}
                                    onChange={e => set('fechaFin', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Observaciones</label>
                            <textarea
                                rows={3}
                                className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium resize-none"
                                value={formData.observaciones}
                                onChange={e => set('observaciones', e.target.value)}
                                placeholder="Notas adicionales..."
                            />
                        </div>
                        </>}

                        {/* ── CONFIGURACIÓN TAB ── */}
                        {modalTab === 'config' && <>
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
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-card text-card-foreground shadow-md transition-transform duration-300 ${
                                    (formData as any).generarOS ? 'translate-x-8' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>

                        {/* Aprovisionamiento Switch */}
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-sm font-bold text-primary">Aprovisionamiento de Materiales</p>
                                    <p className="text-xs text-primary/70 font-medium">Habilita la gestión y trazabilidad de materiales vinculados a Gestión Comercial</p>
                                </div>
                                <button type="button" onClick={() => set('aprovisionamiento', !(formData as any).aprovisionamiento)}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 ${(formData as any).aprovisionamiento ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-card text-card-foreground shadow-md transition-transform duration-300 ${(formData as any).aprovisionamiento ? 'translate-x-8' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {(formData as any).aprovisionamiento && (
                                <div className="pt-3 border-t border-primary/10 space-y-1.5 animate-in fade-in duration-200">
                                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                        Lista de Precios Aplicable (Gestión Comercial)
                                    </label>
                                    <select
                                        value={(formData as any).listaPrecioId || ''}
                                        onChange={(e) => set('listaPrecioId', e.target.value)}
                                        className="w-full bg-card border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="">Precio Base (Predeterminado de Gestión Comercial)</option>
                                        {listasPrecios.filter((lp: any) => lp.activo).map((lp: any) => (
                                            <option key={lp.id} value={lp.id}>
                                                {lp.nombre} {lp.valorAjuste ? `(${lp.tipoAjuste?.includes('DESCUENTO') ? '-' : '+'}${lp.valorAjuste}%)` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                        Aplica a los materiales de las órdenes de servicio generadas para este proyecto. Puede modificarse individualmente en cada OS.
                                    </p>
                                    {(() => {
                                        const selectedClient = clients.find(c => c.id === formData.clientId) as any;
                                        if (selectedClient?.listaPrecio) {
                                            return (
                                                <div className="flex items-center gap-1.5 text-[11px] text-primary/80 font-semibold bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10">
                                                    <span>ℹ️ Lista predeterminada del cliente: <strong>{selectedClient.listaPrecio.nombre}</strong>. Este proyecto respeta la lista seleccionada aquí independientemente de la del cliente.</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Proyecto Fijo Switch */}
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
                            <div className="space-y-0.5 flex items-start gap-3">
                                <Pin className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-amber-800">Proyecto Fijo</p>
                                    <p className="text-xs text-amber-700 font-medium">Cualquier operador puede fichar en este proyecto aunque no esté planificado. El supervisor será notificado.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => set('proyectoFijo', !(formData as any).proyectoFijo)}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 ml-4 ${(formData as any).proyectoFijo ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-card text-card-foreground shadow-md transition-transform duration-300 ${(formData as any).proyectoFijo ? 'translate-x-8' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        </>}

                        {/* ── GPS / QR TAB ── */}
                        {modalTab === 'gps' && <>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5" /> Fichaje GPS/QR
                                    </h4>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Habilita fichado con geovalla y código QR para este proyecto</p>
                                </div>
                                <button type="button" onClick={() => set('fichajeHabilitado', !(formData as any).fichajeHabilitado)}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 ${(formData as any).fichajeHabilitado ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-card text-card-foreground shadow-md transition-transform duration-300 ${(formData as any).fichajeHabilitado ? 'translate-x-8' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {(formData as any).fichajeHabilitado && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider italic px-1">Haz clic en el mapa para posicionar el centro de la geovalla</p>
                                    <MapPicker lat={(formData as any).geofenceLat} lng={(formData as any).geofenceLng} radius={(formData as any).geofenceRadius}
                                        onChange={(lat, lng, radius) => { set('geofenceLat', lat); set('geofenceLng', lng); set('geofenceRadius', radius); }} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Latitud</label>
                                            <input type="number" step="any" placeholder="-34.123456" className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm" value={(formData as any).geofenceLat || ''} onChange={e => set('geofenceLat', e.target.value === '' ? null : parseFloat(e.target.value))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Longitud</label>
                                            <input type="number" step="any" placeholder="-58.123456" className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm" value={(formData as any).geofenceLng || ''} onChange={e => set('geofenceLng', e.target.value === '' ? null : parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Radio (Metros)</label>
                                            <input type="number" placeholder="Ej: 100" className="w-full bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm" value={(formData as any).geofenceRadius || ''} onChange={e => set('geofenceRadius', e.target.value === '' ? null : parseInt(e.target.value))} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">QR Token (Validación)</label>
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Token único..." className="flex-1 bg-card text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm" value={(formData as any).qrToken || ''} onChange={e => set('qrToken', e.target.value)} />
                                                <button type="button" onClick={() => set('qrToken', Math.random().toString(36).substring(2, 10).toUpperCase())} className="px-3 bg-muted hover:bg-slate-200 rounded-2xl text-slate-600 dark:text-slate-300 transition-all" title="Generar Token"><Play className="w-4 h-4 rotate-90" /></button>
                                            </div>
                                        </div>
                                    </div>
                                    {(formData as any).qrToken && (
                                        <div className="p-4 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
                                            <div id="project-qr" className="p-4 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                                                <QRCodeCanvas value={(formData as any).qrToken} size={160} level="H" includeMargin={true} />
                                            </div>
                                            <button type="button" onClick={() => { const canvas = document.querySelector('#project-qr canvas') as HTMLCanvasElement; if (canvas) { const win = window.open('', '_blank'); if (win) { win.document.write(`<html><head><title>Imprimir QR - ${formData.nombre}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}.container{text-align:center;border:2px solid #000;padding:40px;border-radius:20px;}h1{margin-bottom:20px;font-size:24px;}h2{margin-bottom:10px;font-size:20px;}p{margin-top:20px;font-weight:bold;font-size:18px;color:#666;}img{width:300px;height:300px;}</style></head><body><div class="container"><h1>HDB SERVICIOS ELÉCTRICOS</h1><h2>PROYECTO: ${formData.nombre}</h2>${editingProject?.codigoProyecto ? `<h3>CÓDIGO: ${editingProject.codigoProyecto}</h3>` : ''}<img src="${canvas.toDataURL()}" /><p>TOKEN: ${(formData as any).qrToken}</p></div><script>window.onload=()=>{setTimeout(()=>{window.print();window.onafterprint=()=>window.close();},500);};</script></body></html>`); } } }} className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"><QrCode className="w-4 h-4" /> Imprimir QR para Obra</button>
                                        </div>
                                    )}
                                    <button type="button" onClick={async () => {
                                        if (!editingProject) return;
                                        try {
                                            await safeApiRequest(`/api/projects/${editingProject.id}`, {
                                                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ fichajeHabilitado: (formData as any).fichajeHabilitado, geofenceLat: (formData as any).geofenceLat, geofenceLng: (formData as any).geofenceLng, geofenceRadius: (formData as any).geofenceRadius, qrToken: (formData as any).qrToken })
                                            });
                                            showToast('Configuración de fichaje guardada correctamente.', 'success');
                                        } catch (e) { showToast('Error al guardar configuración de fichaje.', 'error'); }
                                    }} className="w-full bg-emerald-600 text-white font-bold rounded-xl py-3 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                                        <Save className="w-4 h-4" /> Guardar Config. Fichaje
                                    </button>
                                </div>
                            )}
                        </div>
                        </>}
                    </div>

                    {/* Footer - Fixed */}
                    <div className="p-5 md:p-7 border-t border-slate-100 dark:border-slate-800 flex gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-muted hover:bg-slate-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary-hover transition-all"
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
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 text-white rounded-xl text-[11px] leading-snug hidden group-hover/tooltip:block z-[9999] shadow-2xl animate-in zoom-in-95 duration-200 pointer-events-none">
                <p className="font-medium">{def}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900" />
            </div>
        </div>
    );
}
