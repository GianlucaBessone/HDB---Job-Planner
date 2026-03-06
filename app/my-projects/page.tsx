'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Search,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    MoreVertical,
    AlertTriangle,
    Layout,
    BarChart3,
    ArrowRight,
    X,
    MessageSquare,
    Send,
    Loader2
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ChecklistItem {
    id: string;
    tag: string;
    description: string;
    completed: boolean;
    confirmedBySupervisor: boolean;
    pendingChange: boolean;
    justification?: string;
}

interface Project {
    id: string;
    nombre: string;
    tags: string[];
    estado: string;
    client?: { nombre: string };
    responsableUser?: { nombreCompleto: string };
    _count?: {
        checklistItems: number;
    };
    checklistItems: { completed: boolean }[];
}

export default function MyProjectsPage() {
    const [user, setUser] = useState<any>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [loadingChecklist, setLoadingChecklist] = useState(false);

    const [isJustifyModalOpen, setIsJustifyModalOpen] = useState(false);
    const [itemToChange, setItemToChange] = useState<ChecklistItem | null>(null);
    const [justification, setJustification] = useState('');
    const [isSubmittingChange, setIsSubmittingChange] = useState(false);

    const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
    const [pendingItemsForFinalize, setPendingItemsForFinalize] = useState<{ tag: string, description: string }[]>([]);
    const [isFinalizing, setIsFinalizing] = useState(false);

    const [viewAll, setViewAll] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            loadMyProjects(parsed.id, viewAll);
        }
    }, [viewAll]);

    const loadMyProjects = async (userId: string, all = false) => {
        setLoading(true);
        try {
            const url = all
                ? `/api/projects/my-projects?all=true`
                : `/api/projects/my-projects?responsableId=${userId}`;
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data)) setProjects(data);
        } catch (error) {
            console.error(error);
            showToast('Error al cargar proyectos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadChecklist = async (projectId: string) => {
        setLoadingChecklist(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/checklist`);
            const data = await res.json();
            if (Array.isArray(data)) setChecklistItems(data);
        } catch (error) {
            console.error(error);
            showToast('Error al cargar checklist', 'error');
        } finally {
            setLoadingChecklist(false);
        }
    };

    const openProjectView = (project: Project) => {
        setSelectedProject(project);
        loadChecklist(project.id);
    };

    const handleToggleItem = async (item: ChecklistItem) => {
        const isSupervisorOrAdmin = user?.role === 'supervisor' || user?.role === 'admin';

        if (item.confirmedBySupervisor && !isSupervisorOrAdmin) {
            setItemToChange(item);
            setJustification('');
            setIsJustifyModalOpen(true);
            return;
        }

        try {
            const res = await fetch(`/api/projects/${selectedProject?.id}/checklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: item.id,
                    completed: !item.completed
                })
            });

            if (res.ok) {
                const newStatus = !item.completed;
                const updatedChecklist = checklistItems.map(i => i.id === item.id ? { ...i, completed: newStatus } : i);
                setChecklistItems(updatedChecklist);

                const mappedChecklist = updatedChecklist.map(c => ({ completed: c.completed }));
                setSelectedProject(prev => prev ? { ...prev, checklistItems: mappedChecklist } : prev);
                setProjects(prevProjects => prevProjects.map(p =>
                    p.id === selectedProject?.id ? { ...p, checklistItems: mappedChecklist } : p
                ));
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al actualizar', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        }
    };

    const submitChangeRequest = async () => {
        if (!justification.trim() || !itemToChange) return;
        setIsSubmittingChange(true);
        try {
            const res = await fetch(`/api/projects/${selectedProject?.id}/checklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: itemToChange.id,
                    requestChange: true,
                    justification
                })
            });

            if (res.ok) {
                showToast('Solicitud enviada al supervisor', 'success');
                setIsJustifyModalOpen(false);
                setChecklistItems(prev => prev.map(i => i.id === itemToChange.id ? { ...i, pendingChange: true, justification } : i));
            }
        } catch (error) {
            showToast('Error al enviar solicitud', 'error');
        } finally {
            setIsSubmittingChange(false);
        }
    };

    const handleRequestFinalization = async () => {
        if (!selectedProject || !user) return;
        setIsFinalizing(true);
        try {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operatorId: user.id,
                    forSupervisors: true,
                    title: 'Solicitud de Finalización de Proyecto',
                    message: `El responsable ${user.nombreCompleto} solicita finalizar el proyecto "${selectedProject.nombre}".\nPor favor, revise el avance técnico para autorizar el cierre.`,
                    type: 'PROJECT_FINALIZE_REQUEST',
                    relatedId: selectedProject.id
                })
            });

            if (res.ok) {
                showToast('Solicitud enviada a los supervisores', 'success');
                setSelectedProject(null);
            } else {
                showToast('Error al enviar solicitud', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsFinalizing(false);
        }
    };

    const handleFinalizeProject = async (force = false) => {
        if (!selectedProject) return;

        const isSupervisorOrAdmin = user?.role === 'supervisor' || user?.role === 'admin';
        if (!isSupervisorOrAdmin && !force) {
            handleRequestFinalization();
            return;
        }

        setIsFinalizing(true);
        try {
            const res = await fetch(`/api/projects/${selectedProject.id}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force, userId: user?.id })
            });

            if (res.ok) {
                showToast('Proyecto finalizado con éxito', 'success');
                setIsFinalizeModalOpen(false);
                setSelectedProject(null);
                loadMyProjects(user.id, viewAll);
            } else {
                const data = await res.json();
                if (data.pendingItems) {
                    setPendingItemsForFinalize(data.pendingItems);
                    setIsFinalizeModalOpen(true);
                } else {
                    showToast(data.error || 'Error al finalizar', 'error');
                }
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsFinalizing(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.client?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getProjectProgress = (p: Project) => {
        const total = p.checklistItems.length;
        if (total === 0) return 0;
        const completed = p.checklistItems.filter(i => i.completed).length;
        return Math.round((completed / total) * 100);
    };

    const getProgressColor = (percent: number) => {
        if (percent === 100) return 'bg-emerald-500';
        if (percent >= 60) return 'bg-amber-500';
        return 'bg-red-500';
    };

    // Render Logic
    if (!user) return <div className="p-8 text-center">Cargando usuario...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {!selectedProject ? (
                <>
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                                <ClipboardCheck className="w-8 h-8 text-primary" />
                                {viewAll ? 'Todos los Proyectos' : 'Mis Proyectos'}
                            </h2>
                            <p className="text-sm text-slate-500 font-medium">Gestión técnica y cierre de obra</p>
                        </div>

                        {(user?.role === 'supervisor' || user?.role === 'admin') && (
                            <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-2xl shadow-sm self-start md:self-auto">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${!viewAll ? 'text-primary' : 'text-slate-400'}`}>Mis Proyectos</span>
                                <button
                                    onClick={() => setViewAll(!viewAll)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${viewAll ? 'bg-primary' : 'bg-slate-200'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${viewAll ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${viewAll ? 'text-primary' : 'text-slate-400'}`}>Ver Todos</span>
                            </div>
                        )}
                    </header>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar en mis proyectos..."
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => <div key={i} className="h-40 bg-slate-100 rounded-3xl animate-pulse" />)}
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredProjects.map(p => {
                                const progress = getProjectProgress(p);
                                return (
                                    <div
                                        key={p.id}
                                        className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                        onClick={() => openProjectView(p)}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors">{p.nombre}</h3>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{p.client?.nombre || 'Sin cliente'}</p>
                                                    {viewAll && p.responsableUser && (
                                                        <>
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <p className="text-[10px] text-primary font-bold uppercase tracking-tight">PM: {p.responsableUser.nombreCompleto}</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.estado === 'activo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                                {p.estado}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-600">Avance Checklist</span>
                                                <span className={`font-black ${progress === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>{progress}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-700 ${getProgressColor(progress)}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-1.5">
                                            {(p.tags as string[]).slice(0, 3).map(tag => (
                                                <span key={tag} className="px-2 py-0.5 rounded-lg bg-slate-50 text-[10px] font-bold text-slate-400 border border-slate-100 uppercase">
                                                    {tag}
                                                </span>
                                            ))}
                                            {(p.tags as string[]).length > 3 && (
                                                <span className="text-[10px] text-slate-400">+{(p.tags as string[]).length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredProjects.length === 0 && (
                                <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                    <Layout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">No tienes proyectos asignados como responsable</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-in slide-in-from-right-4 duration-300 space-y-6 pb-10">
                    <button
                        onClick={() => setSelectedProject(null)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-2"
                    >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                        Volver a mis proyectos
                    </button>

                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                        <div className="flex justify-between items-start border-b border-slate-50 pb-5">
                            <div className="space-y-1">
                                <h1 className="text-2xl font-black text-slate-900 leading-tight">{selectedProject.nombre}</h1>
                                <p className="text-sm font-bold text-primary">{selectedProject.client?.nombre}</p>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance Total</div>
                                <div className="text-2xl font-black text-slate-800">{getProjectProgress(selectedProject)}%</div>
                            </div>
                        </div>

                        {loadingChecklist ? (
                            <div className="flex flex-col items-center py-10 gap-3">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                <p className="text-sm text-slate-500 font-medium">Sincronizando checklist...</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Array.from(new Set(checklistItems.map(i => i.tag))).map(tag => (
                                    <div key={tag} className="space-y-3">
                                        <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            {tag}
                                        </h3>
                                        <div className="grid gap-2">
                                            {checklistItems.filter(i => i.tag === tag).map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleToggleItem(item)}
                                                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${item.completed
                                                        ? 'bg-emerald-50/50 border-emerald-100'
                                                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                                        } ${item.pendingChange ? 'opacity-70 bg-amber-50 border-amber-200' : ''}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${item.completed
                                                            ? 'bg-emerald-500 border-emerald-500'
                                                            : 'bg-white border-slate-300'
                                                            }`}>
                                                            {item.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                        </div>
                                                        <span className={`text-sm font-semibold transition-all ${item.completed ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                            {item.description}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {item.confirmedBySupervisor && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold border border-blue-200 uppercase">
                                                                Confirmado
                                                            </span>
                                                        )}
                                                        {item.pendingChange && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold border border-amber-200 uppercase anim-pulse">
                                                                Pendiente Aprobación
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pt-6 border-t border-slate-50">
                            <button
                                onClick={() => handleFinalizeProject()}
                                disabled={isFinalizing}
                                className={`w-full text-white py-4 rounded-2xl font-black text-base shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${(user?.role === 'supervisor' || user?.role === 'admin')
                                        ? 'bg-primary shadow-primary/20 hover:bg-primary/90'
                                        : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'
                                    }`}
                            >
                                {isFinalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ClipboardCheck className="w-6 h-6" />}
                                {(user?.role === 'supervisor' || user?.role === 'admin')
                                    ? 'FINALIZAR PROYECTO'
                                    : 'SOLICITAR FINALIZACIÓN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Justification Modal */}
            {isJustifyModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-7 space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 text-amber-500">
                            <div className="p-3 bg-amber-50 rounded-2xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800">Solicitud de Cambio</h3>
                        </div>

                        <p className="text-sm text-slate-500 font-medium">
                            Este ítem ya ha sido confirmado por un supervisor. Para modificarlo, debes enviar una justificación:
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motivo del cambio *</label>
                            <textarea
                                rows={4}
                                autoFocus
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                                placeholder="Explica por qué necesitas desmarcar o cambiar este ítem..."
                                value={justification}
                                onChange={e => setJustification(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsJustifyModalOpen(false)}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitChangeRequest}
                                disabled={!justification.trim() || isSubmittingChange}
                                className="flex-[2] bg-primary text-white py-3.5 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmittingChange ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Enviar Solicitud
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Finalize Warning Modal */}
            {isFinalizeModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-7 space-y-6 animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center gap-4 text-red-500">
                            <div className="p-3 bg-red-50 rounded-2xl">
                                <AlertTriangle className="w-7 h-7" />
                            </div>
                            <div className="space-y-0.5">
                                <h3 className="text-xl font-black text-slate-800 leading-tight">Pendientes detectados</h3>
                                <p className="text-xs font-bold text-red-600/70 uppercase tracking-wider">Checklist Incompleto</p>
                            </div>
                        </div>

                        <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100 space-y-4">
                            <p className="text-sm font-bold text-red-800">No puedes finalizar formalmente porque faltan verificaciones:</p>
                            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                                {Array.from(new Set(pendingItemsForFinalize.map(i => i.tag))).map(tag => (
                                    <div key={tag} className="space-y-1.5">
                                        <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">{tag}</div>
                                        <ul className="space-y-1">
                                            {pendingItemsForFinalize.filter(i => i.tag === tag).map((p, idx) => (
                                                <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 font-semibold">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                                    {p.description}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleFinalizeProject(true)}
                                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                            >
                                <AlertTriangle className="w-5 h-5" />
                                FINALIZAR DE TODOS MODOS
                            </button>
                            <button
                                onClick={() => setIsFinalizeModalOpen(false)}
                                className="w-full py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                            >
                                Volver y completar checklist
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 font-medium">Si fuerza el cierre, se registrará trazabilidad completa de los pendientes.</p>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes pulse-soft {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .anim-pulse {
                    animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>
        </div>
    );
}
