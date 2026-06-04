'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    CheckCircle2,
    ClipboardCheck,
    AlertTriangle,
    Layout,
    ArrowRight,
    X,
    MessageSquare,
    Send,
    Loader2,
    Tag,
    AlertOctagon,
    Package,
    History,
    MinusCircle,
    PlusCircle,
    Edit3,
    FileSignature,
    Clock,
    QrCode
} from 'lucide-react';
import Link from 'next/link';
import { useModalScroll } from '@/lib/useModalScroll';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatDateTime } from '@/lib/formatDate';
import CodeBadge from '@/components/CodeBadge';

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
    codigoProyecto?: string;
    tags: string[];
    estado: string;
    generarOS?: boolean;
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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const search = params.get('search');
            if (search) {
                setSearchTerm(search);
                // Also set it to view all by default if coming from a link to find any project
                if (params.get('all') === 'true') {
                    setViewAll(true);
                }
            }
        }
    }, []);

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

    const [projectLogs, setProjectLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [newLog, setNewLog] = useState('');
    const [newLogCategoria, setNewLogCategoria] = useState<'Reporte' | 'Nota' | 'Bloqueante' | 'Consulta'>('Nota');
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);

    const [viewAll, setViewAll] = useState(false);

    // OS state per selected project
    const [projectOS, setProjectOS] = useState<any | null>(null);
    const [loadingOS, setLoadingOS] = useState(false);

    // Material state
    const [projectMaterials, setProjectMaterials] = useState<any[]>([]);
    const [loadingMaterials, setLoadingMaterials] = useState(false);

    // Material Report Modals
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [materialAction, setMaterialAction] = useState<'uso' | 'devolucion'>('uso');
    const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
    const [materialQuantity, setMaterialQuantity] = useState('');
    const [materialNote, setMaterialNote] = useState('');
    const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);

    // Material List State (Tabs & Search)
    const [activeMaterialTab, setActiveMaterialTab] = useState<'general' | 'devueltos'>('general');
    const [materialSearch, setMaterialSearch] = useState('');

    // Delegation State
    const [isDelegationModalOpen, setIsDelegationModalOpen] = useState(false);
    const [delegationQuantity, setDelegationQuantity] = useState('');
    const [delegationTargetId, setDelegationTargetId] = useState('');
    const [delegationNote, setDelegationNote] = useState('');
    const [operatorsList, setOperatorsList] = useState<{id: string, nombreCompleto: string, role: string}[]>([]);
    const [pendingDelegations, setPendingDelegations] = useState<any[]>([]);

    // Signature Canvas State
    const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    const filteredProjectMaterials = useMemo(() => {
        return projectMaterials.filter(m => {
            // Apply Search
            const searchLower = materialSearch.toLowerCase();
            const matchesSearch = !materialSearch || 
                                m.nombre.toLowerCase().includes(searchLower) || 
                                (m.codigo && m.codigo.toLowerCase().includes(searchLower));
            
            if (!matchesSearch) return false;

            // Apply Tabs
            const totalUsado = m.usos.reduce((acc: number, u: any) => acc + u.cantidadUtilizada, 0);
            const totalDevuelto = (m.devoluciones || []).filter((d: any) => d.estado !== 'pendiente' && d.estado !== 'delegacion_pendiente').reduce((acc: number, d: any) => acc + d.cantidadADevolver, 0);
            const pendingDevolucion = (m.devoluciones || []).filter((d: any) => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente').reduce((acc: number, d: any) => acc + d.cantidadADevolver, 0);
            const balance = m.cantidadEntregada - totalUsado - totalDevuelto - pendingDevolucion;

            const hasPending = pendingDevolucion > 0;
            const isDevuelto = ['cerrado_ok', 'cerrado_con_reserva'].includes(m.estado) || (balance <= 0 && !hasPending);

            if (activeMaterialTab === 'general' && isDevuelto) return false;
            if (activeMaterialTab === 'devueltos' && !isDevuelto) return false;

            return true;
        });
    }, [projectMaterials, activeMaterialTab, materialSearch]);

    // Lock body scroll when any modal is open
    const anyModalOpen = isJustifyModalOpen || isFinalizeModalOpen || isMaterialModalOpen || isDelegationModalOpen;
    useModalScroll(anyModalOpen);

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            loadMyProjects(parsed.id, viewAll, parsed.nombreCompleto);
            loadPendingDelegations(parsed.id);
            loadOperatorsList();
        }
    }, [viewAll]);

    const loadOperatorsList = async () => {
        try {
            const res = await safeApiRequest('/api/operators');
            const data = await res.json();
            if (Array.isArray(data)) {
                setOperatorsList(data.filter((op: any) => op.activo));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const loadPendingDelegations = async (userId: string) => {
        try {
            const res = await safeApiRequest(`/api/materiales-proyecto/delegaciones?userId=${userId}`);
            const data = await res.json();
            if (Array.isArray(data)) setPendingDelegations(data);
        } catch (error) {
            console.error(error);
        }
    };

    const loadMyProjects = async (userId: string, all = false, nombre = '') => {
        setLoading(true);
        try {
            const url = all
                ? `/api/projects/my-projects?all=true`
                : `/api/projects/my-projects?responsableId=${userId}&nombre=${encodeURIComponent(nombre)}`;
            const res = await safeApiRequest(url);
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
            const res = await safeApiRequest(`/api/projects/${projectId}/checklist`);
            const data = await res.json();
            if (Array.isArray(data)) setChecklistItems(data);
        } catch (error) {
            console.error(error);
            showToast('Error al cargar checklist', 'error');
        } finally {
            setLoadingChecklist(false);
        }
    };

    const loadLogs = async (projectId: string) => {
        setLoadingLogs(true);
        try {
            const res = await safeApiRequest(`/api/projects/${projectId}/logs`);
            const data = await res.json();
            if (Array.isArray(data)) setProjectLogs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const loadProjectOS = async (projectId: string) => {
        setLoadingOS(true);
        setProjectOS(null);
        try {
            const res = await safeApiRequest(`/api/ordenes-servicio?projectId=${projectId}`);
            const data = await res.json();
            // Take the most recent (first) OS if any exist
            if (Array.isArray(data) && data.length > 0) {
                setProjectOS(data[0]);
            } else {
                setProjectOS(null);
            }
        } finally {
            setLoadingOS(false);
        }
    };

    const loadMaterials = async (projectId: string) => {
        setLoadingMaterials(true);
        try {
            const res = await safeApiRequest(`/api/materiales-proyecto?proyectoId=${projectId}`);
            const data = await res.json();
            if (Array.isArray(data)) setProjectMaterials(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingMaterials(false);
        }
    };

    const openProjectView = (project: any) => {
        setSelectedProject(project);
        loadChecklist(project.id);
        loadLogs(project.id);
        if (project.generarOS) loadProjectOS(project.id);
        else setProjectOS(null);

        if (project.aprovisionamiento) loadMaterials(project.id);
        else setProjectMaterials([]);
    };

    const handleToggleItem = async (item: ChecklistItem) => {
        const isSupervisorOrAdmin = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'qa';

        if (item.confirmedBySupervisor && !isSupervisorOrAdmin) {
            setItemToChange(item);
            setJustification('');
            setIsJustifyModalOpen(true);
            return;
        }

        try {
            const res = await safeApiRequest(`/api/projects/${selectedProject?.id}/checklist`, {
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
            const res = await safeApiRequest(`/api/projects/${selectedProject?.id}/checklist`, {
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

    const submitMaterialAction = async () => {
        if (!selectedMaterial || !materialQuantity || isSubmittingMaterial) return;
        
        const qty = parseFloat(materialQuantity);
        if (isNaN(qty) || qty <= 0) {
            showToast('Ingrese una cantidad válida', 'error');
            return;
        }

        // Validations
        const totalUsado = (selectedMaterial.usos || []).reduce((acc: number, u: any) => acc + u.cantidadUtilizada, 0);
        const totalDevuelto = (selectedMaterial.devoluciones || []).reduce((acc: number, d: any) => acc + d.cantidadADevolver, 0);
        const balance = selectedMaterial.cantidadEntregada - totalUsado - totalDevuelto;

        if (materialAction === 'uso') {
            if (qty > (selectedMaterial.cantidadEntregada - totalUsado)) {
                showToast(`No puede informar más uso que el entregado (${(selectedMaterial.cantidadEntregada - totalUsado).toFixed(2)} ${selectedMaterial.unidad} restante)`, 'error');
                return;
            }
        } else {
            if (qty > balance) {
                showToast(`No puede devolver más del balance disponible (${balance.toFixed(2)} ${selectedMaterial.unidad})`, 'error');
                return;
            }
        }

        setIsSubmittingMaterial(true);
        try {
            const endpoint = materialAction === 'uso' 
                ? '/api/materiales-proyecto/uso' 
                : '/api/materiales-proyecto/devolucion';
            
            const body = materialAction === 'uso' 
                ? {
                    materialId: selectedMaterial.id,
                    cantidadUtilizada: qty,
                    operadorNombre: user.nombreCompleto
                  }
                : {
                    materialId: selectedMaterial.id,
                    cantidadADevolver: qty,
                    estado: 'pendiente',
                    comentario: materialNote
                  };

            const res = await safeApiRequest(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                showToast(materialAction === 'uso' ? 'Uso registrado' : 'Solicitud de devolución enviada', 'success');
                setIsMaterialModalOpen(false);
                setMaterialQuantity('');
                setMaterialNote('');
                loadMaterials(selectedProject?.id!);
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al registrar', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsSubmittingMaterial(false);
        }
    };

    const submitDelegation = async () => {
        if (!selectedMaterial || !delegationQuantity || !delegationTargetId || isSubmittingMaterial) return;

        const qty = parseFloat(delegationQuantity);
        if (isNaN(qty) || qty <= 0) {
            showToast('Ingrese una cantidad válida', 'error');
            return;
        }

        const totalUsado = (selectedMaterial.usos || []).reduce((acc: number, u: any) => acc + u.cantidadUtilizada, 0);
        const totalDevuelto = (selectedMaterial.devoluciones || []).reduce((acc: number, d: any) => acc + d.cantidadADevolver, 0);
        const balance = selectedMaterial.cantidadEntregada - totalUsado - totalDevuelto;

        if (qty > balance) {
            showToast(`No puede delegar más del balance disponible (${balance.toFixed(2)} ${selectedMaterial.unidad})`, 'error');
            return;
        }

        const targetUser = operatorsList.find(op => op.id === delegationTargetId);
        if (!targetUser) return;

        let firmaData = null;
        if (signatureCanvasRef.current && hasSignature) {
            firmaData = signatureCanvasRef.current.toDataURL('image/png');
        }

        if (!firmaData) {
            showToast('Debe firmar para autorizar la delegación', 'error');
            return;
        }

        setIsSubmittingMaterial(true);
        try {
            const res = await safeApiRequest('/api/materiales-proyecto/devolucion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    materialId: selectedMaterial.id,
                    cantidadADevolver: qty,
                    estado: 'delegacion_pendiente',
                    comentario: delegationNote,
                    delegadoAId: targetUser.id,
                    delegadoANombre: targetUser.nombreCompleto,
                    delegadoPorId: user?.id,
                    delegadoPorNombre: user?.nombreCompleto,
                    firmaDelegacion: firmaData
                })
            });

            if (res.ok) {
                showToast('Delegación solicitada con éxito', 'success');
                setIsDelegationModalOpen(false);
                setDelegationQuantity('');
                setDelegationNote('');
                setDelegationTargetId('');
                loadMaterials(selectedProject?.id!);
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al delegar', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsSubmittingMaterial(false);
        }
    };

    const acceptDelegation = async (delegacionId: string) => {
        try {
            const res = await safeApiRequest('/api/materiales-proyecto/devolucion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: delegacionId,
                    estado: 'pendiente' // Aceptarlo lo pasa a estado normal pendiente de devolución en almacén
                })
            });

            if (res.ok) {
                showToast('Delegación aceptada', 'success');
                loadPendingDelegations(user?.id!);
            } else {
                showToast('Error al aceptar la delegación', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        }
    };

    const rejectDelegation = async (delegacionId: string) => {
        try {
            const res = await safeApiRequest('/api/materiales-proyecto/devolucion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: delegacionId,
                    estado: 'delegacion_rechazada'
                })
            });

            if (res.ok) {
                showToast('Delegación rechazada', 'success');
                loadPendingDelegations(user?.id!);
            } else {
                showToast('Error al rechazar la delegación', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        }
    };

    const submitLog = async () => {
        if (!newLog.trim() || !selectedProject || !user) return;
        setIsSubmittingLog(true);
        try {
            const logData = {
                fecha: new Date().toISOString().split('T')[0],
                responsable: user.nombreCompleto,
                observacion: newLog,
                categoria: newLogCategoria
            };
            const res = await safeApiRequest(`/api/projects/${selectedProject.id}/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logData)
            });

            if (res.ok) {
                const createdLog = await res.json();
                setProjectLogs(prev => [createdLog, ...prev]);
                setNewLog('');
                setNewLogCategoria('Nota');
                showToast('Comentario añadido', 'success');

                // Notify supervisors — urgency depends on category
                const isBlocker = newLogCategoria === 'Bloqueante';
                await safeApiRequest('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        forSupervisors: true,
                        title: isBlocker
                            ? `🚨 Bloqueante en proyecto ${selectedProject.nombre}`
                            : `Nuevo comentario en proyecto`,
                        message: `Proyecto: ${selectedProject.nombre}\nOperador: ${user.nombreCompleto}\n[${newLogCategoria}] "${newLog}"`,
                        type: isBlocker ? 'BLOCKER_COMMENT' : 'NEW_COMMENT',
                        relatedId: selectedProject.id
                    })
                });
            } else {
                showToast('Error al añadir comentario', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    const handleRequestFinalization = async () => {
        if (!selectedProject || !user) return;
        setIsFinalizing(true);
        try {
            const res = await safeApiRequest('/api/notifications', {
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

        const isSupervisorOrAdmin = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'qa';
        if (!isSupervisorOrAdmin && !force) {
            handleRequestFinalization();
            return;
        }

        setIsFinalizing(true);
        try {
            const res = await safeApiRequest(`/api/projects/${selectedProject.id}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force, userId: user?.id })
            });

            if (res.ok) {
                showToast('Proyecto finalizado con éxito', 'success');
                setIsFinalizeModalOpen(false);
                setSelectedProject(null);
                loadMyProjects(user.id, viewAll, user.nombreCompleto);
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

    const filteredProjects = projects.filter(p => {
        const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const term = normalize(searchTerm);
        return normalize(p.nombre).includes(term) ||
               normalize(p.client?.nombre || '').includes(term) ||
               (p.codigoProyecto || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

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
    // Render Logic
    if (!user) {
        return <MyProjectsSkeleton viewAll={viewAll} />;
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {!selectedProject ? (
                <>
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                                <ClipboardCheck className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                                {viewAll ? 'Todos los Proyectos' : 'Mis Proyectos'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">Gestión técnica y cierre de obra</p>
                        </div>

                        {(user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'qa') && (
                            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl shadow-sm self-start md:self-auto">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${!viewAll ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>Mis Proyectos</span>
                                <button
                                    onClick={() => setViewAll(!viewAll)}
                                    className={`btn-icon-inline relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${viewAll ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-800 transition-transform ${viewAll ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${viewAll ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>Ver Todos</span>
                            </div>
                        )}
                    </header>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar en mis proyectos..."
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {pendingDelegations.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 space-y-4 shadow-sm">
                            <h3 className="flex items-center gap-2 text-sm font-black text-blue-800 uppercase tracking-wide">
                                <Package className="w-5 h-5 text-blue-600" />
                                Delegaciones Pendientes
                            </h3>
                            <div className="grid gap-3">
                                {pendingDelegations.map(del => (
                                    <div key={del.id} className="bg-white border border-blue-100 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">{del.material.nombre} <span className="text-slate-500 font-medium">({del.cantidadADevolver} {del.material.unidad})</span></h4>
                                            <p className="text-[10px] text-slate-500 font-medium uppercase mt-1">De: {del.delegadoPorNombre} • Obra: {del.material.proyecto.nombre}</p>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto mt-3 md:mt-0">
                                            <button
                                                onClick={() => rejectDelegation(del.id)}
                                                className="flex-1 md:flex-none bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95 border border-slate-200"
                                            >
                                                Rechazar
                                            </button>
                                            <button
                                                onClick={() => acceptDelegation(del.id)}
                                                className="flex-[2] md:flex-none bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                                            >
                                                Aceptar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => <div key={i} className="h-[200px] bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />)}
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredProjects.map(p => {
                                const progress = getProjectProgress(p);
                                return (
                                    <div
                                        key={p.id}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                        onClick={() => openProjectView(p)}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="space-y-1">
                                                <h3 className="font-black text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors flex items-center gap-2 flex-wrap text-lg">
                                                    {p.codigoProyecto ? (
                                                        <span className="text-primary font-mono">{p.codigoProyecto} |</span>
                                                    ) : (
                                                        <span className="text-slate-400 dark:text-slate-500 font-mono">#SIN-COD |</span>
                                                    )}
                                                    {p.nombre}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{p.client?.nombre || 'Sin cliente'}</p>
                                                    {viewAll && p.responsableUser && (
                                                        <>
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <p className="text-[10px] text-primary font-bold uppercase tracking-tight">PM: {p.responsableUser.nombreCompleto}</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.estado === 'activo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800'}`}>
                                                {p.estado}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-600 dark:text-slate-300">Avance Checklist</span>
                                                <span className={`font-black ${progress === 100 ? 'text-emerald-600' : 'text-slate-500 dark:text-slate-400'}`}>{progress}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-700 ${getProgressColor(progress)}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-1.5">
                                            {(p.tags as string[]).slice(0, 3).map(tag => (
                                                <span key={tag} className="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800 uppercase">
                                                    {tag}
                                                </span>
                                            ))}
                                            {(p.tags as string[]).length > 3 && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">+{(p.tags as string[]).length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredProjects.length === 0 && (
                                <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <Layout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">No tienes proyectos asignados como responsable</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-in slide-in-from-right-4 duration-300 space-y-6 pb-10">
                    <button
                        onClick={() => setSelectedProject(null)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors mb-2"
                    >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                        Volver a mis proyectos
                    </button>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-6">
                        <div className="flex justify-between items-start border-b border-slate-50 pb-5">
                            <div className="space-y-1">
                                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 leading-tight flex items-center gap-2 flex-wrap">
                                    {selectedProject.nombre}
                                    {selectedProject.codigoProyecto && <CodeBadge code={selectedProject.codigoProyecto} variant="project" />}
                                </h1>
                                <p className="text-sm font-bold text-primary">{selectedProject.client?.nombre}</p>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Avance Total</div>
                                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{getProjectProgress(selectedProject)}%</div>
                            </div>
                        </div>

                        {loadingChecklist ? (
                            <div className="flex flex-col items-center py-10 gap-3">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Sincronizando checklist...</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Array.from(new Set(checklistItems.map(i => i.tag))).map(tag => (
                                    <div key={tag} className="space-y-3">
                                        <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
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
                                                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                        } ${item.pendingChange ? 'opacity-70 bg-amber-50 border-amber-200' : ''}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${item.completed
                                                            ? 'bg-emerald-500 border-emerald-500'
                                                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                                                            }`}>
                                                            {item.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                        </div>
                                                        <span className={`text-sm font-semibold transition-all ${item.completed ? 'text-emerald-700' : 'text-slate-700 dark:text-slate-200'}`}>
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

                        {/* Materiales Section */}
                        {(selectedProject as any).aprovisionamiento && (
                            <div className="pt-6 border-t border-slate-50 space-y-5">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                        <Package className="w-4 h-4 text-primary" />
                                        Materiales en Obra
                                    </h3>
                                    
                                    {/* Tabs */}
                                    <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 self-start md:self-auto w-full md:w-auto">
                                        <button
                                            onClick={() => setActiveMaterialTab('general')}
                                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                                                activeMaterialTab === 'general'
                                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm shadow-slate-200/50 dark:shadow-none'
                                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            General
                                        </button>
                                        <button
                                            onClick={() => setActiveMaterialTab('devueltos')}
                                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                                                activeMaterialTab === 'devueltos'
                                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm shadow-slate-200/50 dark:shadow-none'
                                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            Devueltos
                                        </button>
                                    </div>
                                </div>

                                {/* Search Bar */}
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar material o código..."
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                                        value={materialSearch}
                                        onChange={e => setMaterialSearch(e.target.value)}
                                    />
                                </div>

                                {loadingMaterials ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400 dark:text-slate-500" />
                                    </div>
                                ) : filteredProjectMaterials.length === 0 ? (
                                    <p className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium py-4">No hay materiales encontrados en esta vista.</p>
                                ) : (
                                    <div className="grid gap-3">
                                        {filteredProjectMaterials.map(m => {
                                            const totalUsado = m.usos.reduce((acc: number, u: any) => acc + u.cantidadUtilizada, 0);
                                            const totalDevuelto = (m.devoluciones || []).filter((d: any) => d.estado !== 'pendiente' && d.estado !== 'delegacion_pendiente').reduce((acc: number, d: any) => acc + d.cantidadADevolver, 0);
                                            const pendingDevolucion = (m.devoluciones || []).filter((d: any) => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente').reduce((acc: number, d: any) => acc + d.cantidadADevolver, 0);
                                            const balance = m.cantidadEntregada - totalUsado - totalDevuelto - pendingDevolucion;

                                            return (
                                                <div key={m.id} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.nombre}</h4>
                                                            <p className="text-[10px] text-slate-500 font-medium uppercase">{m.codigo || 'S/C'} • {m.unidad}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En Poder</div>
                                                            <div className={`text-sm font-black ${balance > 0 ? 'text-primary' : 'text-slate-400'}`}>{balance.toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50">
                                                        <div className="text-center">
                                                            <div className="text-[8px] font-bold text-slate-400 uppercase">Entregado</div>
                                                            <div className="text-xs font-bold text-slate-600">{m.cantidadEntregada}</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[8px] font-bold text-slate-400 uppercase">Usado</div>
                                                            <div className="text-xs font-bold text-emerald-600">{totalUsado}</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-[8px] font-bold text-slate-400 uppercase">Devuelto</div>
                                                            <div className="text-xs font-bold text-blue-600">{totalDevuelto}</div>
                                                        </div>
                                                    </div>

                                                    {pendingDevolucion > 0 && (
                                                        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5 flex items-center justify-between anim-pulse">
                                                            <span className="text-[10px] font-bold text-amber-700">Devolución / Delegación pendiente: {pendingDevolucion}</span>
                                                            <History className="w-3 h-3 text-amber-500" />
                                                        </div>
                                                    )}

                                                    {activeMaterialTab === 'general' && balance > 0 && (
                                                        <div className="flex gap-2 pt-1">
                                                            <button 
                                                                onClick={() => {
                                                                    setSelectedMaterial(m);
                                                                    setMaterialAction('uso');
                                                                    setMaterialQuantity('');
                                                                    setIsMaterialModalOpen(true);
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                                                            >
                                                                <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                                INFORMAR USO
                                                            </button>
                                                            <div className="flex-1 flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden p-0.5">
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedMaterial(m);
                                                                        setMaterialAction('devolucion');
                                                                        setMaterialQuantity('');
                                                                        setIsMaterialModalOpen(true);
                                                                    }}
                                                                    className="flex-[2] flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all active:scale-95"
                                                                >
                                                                    <MinusCircle className="w-3.5 h-3.5 text-blue-500" />
                                                                    DEVOLVER
                                                                </button>
                                                                <div className="w-[1px] bg-slate-200 dark:bg-slate-700 my-1" />
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedMaterial(m);
                                                                        setDelegationQuantity('');
                                                                        setHasSignature(false);
                                                                        setIsDelegationModalOpen(true);
                                                                    }}
                                                                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
                                                                    title="Delegar material"
                                                                >
                                                                    <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Comments Section */}
                        <div className="pt-6 border-t border-slate-50 space-y-5">
                            <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                <MessageSquare className="w-4 h-4 text-primary" />
                                Comentarios
                            </h3>

                            <div className="space-y-4">
                                <div className="space-y-3">
                                    {/* Category selector */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            <Tag className="w-3 h-3" /> Categoría *
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {(['Nota', 'Reporte', 'Consulta', 'Bloqueante'] as const).map(cat => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setNewLogCategoria(cat)}
                                                    className={`btn-icon-inline px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                                        newLogCategoria === cat
                                                            ? cat === 'Bloqueante'
                                                                ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-200'
                                                                : 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                                            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                    }`}
                                                >
                                                    {cat === 'Bloqueante' && <AlertOctagon className="w-3 h-3 inline mr-1" />}
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                        {newLogCategoria === 'Bloqueante' && (
                                            <p className="text-xs font-bold text-red-600 flex items-center gap-1 mt-1">
                                                <AlertOctagon className="w-3.5 h-3.5" />
                                                Se notificará inmediatamente a los supervisores
                                            </p>
                                        )}
                                    </div>

                                    <textarea
                                        rows={3}
                                        placeholder="Escribe un comentario o actualización..."
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                                        value={newLog}
                                        onChange={e => setNewLog(e.target.value)}
                                    />
                                    <button
                                        onClick={submitLog}
                                        disabled={!newLog.trim() || isSubmittingLog}
                                        className={`w-full text-white py-3 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 ${
                                            newLogCategoria === 'Bloqueante'
                                                ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                                : 'bg-slate-800 hover:bg-slate-700'
                                        }`}
                                    >
                                        {isSubmittingLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Publicar Comentario
                                    </button>
                                </div>

                                <div className="space-y-3 mt-4 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                                    {loadingLogs ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="w-5 h-5 animate-spin text-slate-400 dark:text-slate-500" />
                                        </div>
                                    ) : projectLogs.length === 0 ? (
                                        <p className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium py-4">No hay comentarios aún.</p>
                                    ) : (
                                        projectLogs.map(log => {
                                            const cat = log.categoria || 'Nota';
                                            const catStyles: Record<string, string> = {
                                                Bloqueante: 'bg-red-100 text-red-700 border-red-200',
                                                Reporte:    'bg-emerald-100 text-emerald-700 border-emerald-200',
                                                Consulta:   'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
                                                Nota:       'bg-blue-100 text-blue-700 border-blue-200',
                                            };
                                            return (
                                                <div key={log.id} className={`border p-4 rounded-2xl space-y-2 ${
                                                    cat === 'Bloqueante' ? 'bg-red-50 border-red-100' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                                                }`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.responsable}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${catStyles[cat] || catStyles['Nota']}`}>
                                                                {cat === 'Bloqueante' && '🚨 '}{cat}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">{formatDateTime(log.createdAt)}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{log.observacion}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-50 space-y-3">
                            {/* OS Section */}
                            {selectedProject.generarOS && (
                                loadingOS ? (
                                    <div className="w-full h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                                ) : projectOS ? (
                                    /* OS ya existe */
                                    <div className="space-y-2">
                                        {/* OS status header */}
                                        <div className={`rounded-2xl px-4 py-3 flex items-center justify-between ${(projectOS.estado === 'firmada' || projectOS.estado === 'cobrada' || projectOS.estado === 'pagada')
                                                ? 'bg-emerald-50 border border-emerald-200'
                                                : 'bg-amber-50 border border-amber-200'
                                            }`}>
                                            <div className="flex items-center gap-2">
                                                <FileSignature className={`w-4 h-4 ${(projectOS.estado === 'firmada' || projectOS.estado === 'cobrada' || projectOS.estado === 'pagada') ? 'text-emerald-600' : 'text-amber-600'}`} />
                                                <span className={`text-sm font-black ${(projectOS.estado === 'firmada' || projectOS.estado === 'cobrada' || projectOS.estado === 'pagada') ? 'text-emerald-800' : 'text-amber-800'}`}>
                                                    Orden de Servicio
                                                </span>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                                projectOS.estado === 'firmada' ? 'bg-emerald-100 text-emerald-700' :
                                                projectOS.estado === 'cobrada' ? 'bg-indigo-100 text-indigo-700' :
                                                projectOS.estado === 'pagada' ? 'bg-blue-100 text-blue-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {projectOS.estado === 'firmada' ? '✓ Firmada' :
                                                 projectOS.estado === 'cobrada' ? 'OC Emitida' :
                                                 projectOS.estado === 'pagada' ? '✓ Pagada' :
                                                 'Pendiente de firma'}
                                            </span>
                                        </div>
                                        {/* Action buttons */}
                                        <div className={`grid gap-2 ${(projectOS.estado === 'firmada' || projectOS.estado === 'cobrada' || projectOS.estado === 'pagada') ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                            {(projectOS.estado !== 'firmada' && projectOS.estado !== 'cobrada' && projectOS.estado !== 'pagada') && (
                                                <Link
                                                    href={`/ordenes-servicio/qr/${projectOS.id}`}
                                                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-white bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                                                >
                                                    <QrCode className="w-5 h-5" />
                                                    VER QR
                                                </Link>
                                            )}
                                            <Link
                                                href={`/ordenes-servicio/generar?projectId=${selectedProject.id}&editId=${projectOS.id}`}
                                                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.98] ${(projectOS.estado === 'firmada' || projectOS.estado === 'cobrada' || projectOS.estado === 'pagada')
                                                        ? 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 border border-slate-200 dark:border-slate-700'
                                                        : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                                                    }`}
                                            >
                                                <Edit3 className="w-5 h-5" />
                                                {(projectOS.estado === 'firmada' || projectOS.estado === 'cobrada' || projectOS.estado === 'pagada') ? 'VER OS' : 'MODIFICAR OS'}
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    /* No OS creada todavía */
                                    <Link
                                        href={`/ordenes-servicio/generar?projectId=${selectedProject.id}`}
                                        className="w-full text-white py-4 rounded-2xl font-black text-base shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700"
                                    >
                                        <FileSignature className="w-6 h-6" />
                                        GENERAR ORDEN DE SERVICIO
                                    </Link>
                                )
                            )}
                            <button
                                onClick={() => handleFinalizeProject()}
                                disabled={isFinalizing}
                                className={`w-full text-white py-4 rounded-2xl font-black text-base shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${(user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'qa')
                                    ? 'bg-primary shadow-primary/20 hover:bg-primary/90'
                                    : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'
                                    }`}
                            >
                                {isFinalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ClipboardCheck className="w-6 h-6" />}
                                {(user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'qa')
                                    ? 'FINALIZAR PROYECTO'
                                    : 'SOLICITAR FINALIZACIÓN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Material Modal */}
            {isMaterialModalOpen && selectedMaterial && (
                <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl p-6 md:p-7 space-y-6 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl ${materialAction === 'uso' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                {materialAction === 'uso' ? <PlusCircle className="w-6 h-6" /> : <MinusCircle className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                                    {materialAction === 'uso' ? 'Informar Uso' : 'Devolver Material'}
                                </h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{selectedMaterial.nombre}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {(() => {
                                const totalUsado = (selectedMaterial.usos || []).reduce((acc: number, u: any) => acc + u.cantidadUtilizada, 0);
                                const totalDevuelto = (selectedMaterial.devoluciones || []).reduce((acc: number, d: any) => acc + d.cantidadADevolver, 0);
                                const maxAllowed = materialAction === 'uso' 
                                    ? selectedMaterial.cantidadEntregada - totalUsado 
                                    : selectedMaterial.cantidadEntregada - totalUsado - totalDevuelto;

                                return (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                Cantidad ({selectedMaterial.unidad}) *
                                            </label>
                                            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                                MÁX: {maxAllowed.toFixed(2)}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            autoFocus
                                            inputMode="decimal"
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                                            placeholder="0.00"
                                            value={materialQuantity}
                                            onChange={e => setMaterialQuantity(e.target.value)}
                                        />
                                    </div>
                                );
                            })()}

                            {materialAction === 'devolucion' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Observación (Opcional)</label>
                                    <textarea
                                        rows={2}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                                        placeholder="Ej: Material sobrante en buen estado..."
                                        value={materialNote}
                                        onChange={e => setMaterialNote(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsMaterialModalOpen(false)}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitMaterialAction}
                                disabled={!materialQuantity || isSubmittingMaterial}
                                className={`flex-[2] text-white py-3.5 rounded-2xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 ${
                                    materialAction === 'uso' ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'
                                }`}
                            >
                                {isSubmittingMaterial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                                {materialAction === 'uso' ? 'Confirmar Uso' : 'Solicitar Devolución'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delegation Modal */}
            {isDelegationModalOpen && selectedMaterial && (
                <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl p-6 md:p-7 space-y-6 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                                <Share2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Delegar Devolución</h3>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{selectedMaterial.nombre}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delegar a *</label>
                                <select
                                    value={delegationTargetId}
                                    onChange={(e) => setDelegationTargetId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-700"
                                >
                                    <option value="" disabled>Seleccione un operador</option>
                                    {operatorsList.map(op => (
                                        <option key={op.id} value={op.id}>{op.nombreCompleto} ({op.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={delegationQuantity}
                                    onChange={(e) => setDelegationQuantity(e.target.value)}
                                    placeholder="Ej. 1"
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-lg font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota / Observación</label>
                                <textarea
                                    value={delegationNote}
                                    onChange={(e) => setDelegationNote(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none"
                                    placeholder="Opcional..."
                                />
                            </div>
                            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-start gap-2 mt-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-amber-800 leading-tight">Al delegar, el material seguirá pendiente de devolución. Deberás firmar tu autorización.</p>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Firma del Responsable *</label>
                                    {hasSignature && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const ctx = signatureCanvasRef.current?.getContext('2d');
                                                if (ctx && signatureCanvasRef.current) {
                                                    ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
                                                    setHasSignature(false);
                                                }
                                            }}
                                            className="text-[10px] font-bold text-red-500 hover:underline"
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                </div>
                                <div className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden shadow-inner touch-none relative">
                                    <canvas
                                        ref={signatureCanvasRef}
                                        width={400}
                                        height={150}
                                        className="w-full h-[150px] cursor-crosshair touch-none"
                                        onPointerDown={(e) => {
                                            const canvas = signatureCanvasRef.current;
                                            if (!canvas) return;
                                            const rect = canvas.getBoundingClientRect();
                                            const scaleX = canvas.width / rect.width;
                                            const scaleY = canvas.height / rect.height;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) return;
                                            ctx.beginPath();
                                            ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                                            setIsDrawing(true);
                                        }}
                                        onPointerMove={(e) => {
                                            if (!isDrawing) return;
                                            const canvas = signatureCanvasRef.current;
                                            if (!canvas) return;
                                            const rect = canvas.getBoundingClientRect();
                                            const scaleX = canvas.width / rect.width;
                                            const scaleY = canvas.height / rect.height;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) return;
                                            ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                                            ctx.stroke();
                                            setHasSignature(true);
                                        }}
                                        onPointerUp={() => setIsDrawing(false)}
                                        onPointerCancel={() => setIsDrawing(false)}
                                        onPointerOut={() => setIsDrawing(false)}
                                    />
                                    {!hasSignature && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-sm font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest rotate-[-5deg]">Firmar Aquí</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDelegationModalOpen(false)}
                                className="flex-[1] py-3.5 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitDelegation}
                                disabled={!delegationTargetId || !delegationQuantity || isSubmittingMaterial}
                                className="flex-[2] py-3.5 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSubmittingMaterial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                                Solicitar Delegación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Justification Modal */}
            {isJustifyModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl p-6 md:p-7 space-y-6 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 text-amber-500">
                            <div className="p-3 bg-amber-50 rounded-2xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Solicitud de Cambio</h3>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            Este ítem ya ha sido confirmado por un supervisor. Para modificarlo, debes enviar una justificación:
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Motivo del cambio *</label>
                            <textarea
                                rows={4}
                                autoFocus
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                                placeholder="Explica por qué necesitas desmarcar o cambiar este ítem..."
                                value={justification}
                                onChange={e => setJustification(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsJustifyModalOpen(false)}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitChangeRequest}
                                disabled={!justification.trim() || isSubmittingChange}
                                className="flex-[2] bg-primary text-white py-3.5 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
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
                <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl p-6 md:p-7 space-y-6 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center gap-4 text-red-500 shrink-0">
                            <div className="p-3 bg-red-50 rounded-2xl">
                                <AlertTriangle className="w-7 h-7" />
                            </div>
                            <div className="space-y-0.5">
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">Pendientes detectados</h3>
                                <p className="text-xs font-bold text-red-600/70 uppercase tracking-wider">Checklist Incompleto</p>
                            </div>
                        </div>

                        <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100 flex flex-col min-h-0">
                            <p className="text-sm font-bold text-red-800 shrink-0 mb-4">No puedes finalizar formalmente porque faltan verificaciones:</p>
                            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                {Array.from(new Set(pendingItemsForFinalize.map(i => i.tag))).map(tag => (
                                    <div key={tag} className="space-y-1.5">
                                        <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">{tag}</div>
                                        <ul className="space-y-1">
                                            {pendingItemsForFinalize.filter(i => i.tag === tag).map((p, idx) => (
                                                <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-semibold">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                                    {p.description}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 shrink-0">
                            <button
                                onClick={() => handleFinalizeProject(true)}
                                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <AlertTriangle className="w-5 h-5" />
                                FINALIZAR DE TODOS MODOS
                            </button>
                            <button
                                onClick={() => setIsFinalizeModalOpen(false)}
                                className="w-full py-4 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Volver y completar checklist
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-medium shrink-0 pt-2">Si fuerza el cierre, se registrará trazabilidad completa de los pendientes.</p>
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

function MyProjectsSkeleton({ viewAll }: { viewAll: boolean }) {
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1 flex items-center gap-3">
                    <ClipboardCheck className="w-6 h-6 md:w-8 md:h-8 text-primary opacity-20" />
                    <div className="w-48 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                </div>
            </header>

            <div className="w-full h-[52px] bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl animate-pulse" />

            <div className="space-y-4">
                {[1, 2].map(i => <div key={i} className="h-[200px] bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />)}
            </div>
        </div>
    );
}
