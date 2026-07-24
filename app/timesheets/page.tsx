'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Clock, Calendar, User, Layout, CheckCircle2, ShieldAlert, Plus, Trash2, Edit3, X, AlertCircle, Activity, FileSpreadsheet, Briefcase, UserX, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import * as XLSX from 'xlsx';
import SearchableSelect from '@/components/SearchableSelect';
import { formatDate, formatTime, formatSheetDates } from '@/lib/formatDate';
import { getProjectOptions, filterOperatorProjects } from '@/lib/projectSelectHelper';
import CodeBadge from '@/components/CodeBadge';
import HelpContextual from '@/components/HelpContextual';
import { useViewState } from '@/lib/hooks/useViewState';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { useRef } from 'react';
import { calculateHours } from '@/lib/timeUtils';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';

interface Assignment {
    id: string;
    type: 'proyecto' | 'causa';
    targetId: string;
    horas: number;
    isExtra: boolean;
    isDevolucion: boolean;
    descripcionDevolucion: string;
}

interface Project {
    id: string;
    nombre: string;
    estado: string;
}

interface Operator {
    id: string;
    nombreCompleto: string;
}

interface TimeEntry {
    id: string;
    operatorId: string;
    operator: { nombreCompleto: string };
    projectId: string | null;
    project: { nombre: string; cliente: string; codigoProyecto?: string } | null;
    causaRegistro: string | null;
    fecha: string;
    horaIngreso: string | null;
    horaEgreso: string | null;
    horasTrabajadas: number;
    estadoConfirmado: boolean;
    confirmadoPorSupervisor: string | null;
    isExtra: boolean;
    isDevolucion: boolean;
    descripcionDevolucion: string | null;
}

interface CausaOption {
    id: string;
    value: string;
    active: boolean;
}

export default function TimesheetsPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [recentProjects, setRecentProjects] = useState<string[]>([]);
    const [causas, setCausas] = useState<CausaOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formatEntryDate = (dateStr: string) => formatDate(dateStr);


    // Filters and View Mode
    const [filters, setFilters] = useViewState('timesheets-filters', {
        viewMode: 'tarjetas' as 'tarjetas' | 'planilla' | 'resumen',
        filterDateFrom: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        filterDateTo: new Date().toISOString().split('T')[0],
        filterOperator: '',
        filterProject: ''
    });

    const { viewMode, filterDateFrom, filterDateTo, filterOperator, filterProject } = filters;
    const setViewMode = (val: 'tarjetas' | 'planilla' | 'resumen') => setFilters({ viewMode: val });
    const setFilterDateFrom = (val: string) => setFilters({ filterDateFrom: val });
    const setFilterDateTo = (val: string) => setFilters({ filterDateTo: val });
    const setFilterOperator = (val: string) => setFilters({ filterOperator: val });
    const setFilterProject = (val: string) => setFilters({ filterProject: val });
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
    const [formData, setFormData] = useState({
        operatorId: '',
        fecha: new Date().toISOString().split('T')[0],
        horaIngreso: '',
        horaEgreso: ''
    });
    const [assignments, setAssignments] = useState<Assignment[]>([]);

    const [pendingAction, setPendingAction] = useState<any>(null);

    // Request Modification Modal
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestMessage, setRequestMessage] = useState('');

    // Confirm dialog
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        let parsedUser = null;
        if (stored) {
            try {
                parsedUser = JSON.parse(stored);
                setCurrentUser(parsedUser);
            } catch (e) { }
        }

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const proy = params.get('proyecto');
            if (proy) setFilterProject(proy);
        }

        loadData(parsedUser);
    }, []);

    const loadData = async (userObj?: any) => {
        setIsLoading(true);
        try {
            const user = userObj || currentUser;
            let entriesUrl = '/api/time-entries';
            if (user?.role === 'operador') {
                entriesUrl += `?operatorId=${user.id}`;
            }

            const [entriesData, projectsData, operatorsData, causasData] = await Promise.all([
                safeApiRequest(entriesUrl).then(res => res.json()),
                safeApiRequest('/api/projects').then(res => res.json()),
                safeApiRequest('/api/operators').then(res => res.json()),
                safeApiRequest('/api/config/options?category=CAUSA_REGISTRO').then(res => res.json())
            ]);
            setEntries(Array.isArray(entriesData) ? entriesData.filter(Boolean) : []);
            setProjects(Array.isArray(projectsData) ? projectsData.filter(Boolean) : []);
            setOperators(Array.isArray(operatorsData) ? operatorsData.filter(Boolean) : []);
            setCausas(Array.isArray(causasData) ? causasData.filter((c: any) => c.active) : []);
            
            if (user?.id || user?.nombreCompleto) {
                try {
                    const url = new URL('/api/projects/recent', window.location.origin);
                    if (user.id) url.searchParams.append('userId', user.id);
                    if (user.nombreCompleto) url.searchParams.append('userName', user.nombreCompleto);
                    const recentData = await safeApiRequest(url.toString()).then(res => res.json());
                    setRecentProjects(Array.isArray(recentData) ? recentData : []);
                } catch(e) {}
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const handleConfirmDay = async (id: string) => {
        try {
            await safeApiRequest('/api/time-entries', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    estadoConfirmado: true,
                    requestUserId: currentUser?.id,
                    requestUserRole: currentUser?.role
                })
            });
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const openEditModal = (entry?: TimeEntry) => {
        if (entry) {
            setEditingEntry(entry);
            setFormData({
                operatorId: entry.operatorId,
                fecha: entry.fecha,
                horaIngreso: entry.horaIngreso || '',
                horaEgreso: entry.horaEgreso || ''
            });
            const isCausaMode = !!entry.causaRegistro;
            setAssignments([{
                id: 'edit-1',
                type: isCausaMode ? 'causa' : 'proyecto',
                targetId: (isCausaMode ? entry.causaRegistro : entry.projectId) || '',
                horas: entry.horasTrabajadas,
                isExtra: entry.isExtra || false,
                isDevolucion: entry.isDevolucion || false,
                descripcionDevolucion: entry.descripcionDevolucion || ''
            }]);

            if (entry.estadoConfirmado) {
                if (currentUser?.role === 'operador') {
                    setPendingAction({ type: 'request_modification', entry });
                    setIsRequestModalOpen(true);
                    return;
                }
            }
        } else {
            setEditingEntry(null);
            setFormData({
                operatorId: currentUser?.role === 'operador' ? currentUser.id : '',
                fecha: new Date().toISOString().split('T')[0],
                horaIngreso: '',
                horaEgreso: ''
            });
            setAssignments([{
                id: Math.random().toString(36).substring(7),
                type: 'proyecto',
                targetId: '',
                horas: 0,
                isExtra: false,
                isDevolucion: false,
                descripcionDevolucion: ''
            }]);
        }
        setIsModalOpen(true);
    };

    const handleAddAssignment = () => {
        setAssignments([...assignments, {
            id: Math.random().toString(36).substring(7),
            type: 'proyecto',
            targetId: '',
            horas: 0,
            isExtra: false,
            isDevolucion: false,
            descripcionDevolucion: ''
        }]);
    };

    const handleRemoveAssignment = (id: string) => {
        setAssignments(assignments.filter(a => a.id !== id));
    };

    const handleAssignmentChange = (id: string, field: keyof Assignment, value: any) => {
        setAssignments(prev => prev.map(a => {
            if (a.id === id) {
                const updated = { ...a, [field]: value };
                if (field === 'type') {
                    updated.targetId = '';
                    updated.isExtra = false;
                    updated.isDevolucion = false;
                }
                if (field === 'targetId' && updated.type === 'causa') {
                    // Causa auto-fill logic (informational)
                }
                return updated as Assignment;
            }
            return a;
        }));
    };

    const totalJornada = formData.horaIngreso && formData.horaEgreso ? calculateHours(formData.horaIngreso, formData.horaEgreso) : 0;
    const horasAsignadas = assignments.reduce((sum, a) => sum + (Number(a.horas) || 0), 0);
    const horasRestantes = Math.round((totalJornada - horasAsignadas) * 100) / 100;

    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();

        if (assignments.length === 0) {
            showToast('Debe agregar al menos una asignación.', 'error');
            return;
        }

        const invalidAssignment = assignments.find(a => !a.targetId || a.horas <= 0);
        if (invalidAssignment) {
            showToast('Todas las asignaciones deben tener un proyecto/causa y horas mayor a 0.', 'error');
            return;
        }

        const devMissing = assignments.find(a => a.isDevolucion && !a.descripcionDevolucion.trim());
        const adminMissing = assignments.find(a => a.type === 'causa' && a.targetId === 'Administrativo' && !a.descripcionDevolucion.trim());
        if (devMissing || adminMissing) {
            showToast('Las devoluciones o causas Administrativas requieren una descripción.', 'error');
            return;
        }

        if (horasRestantes !== 0) {
            showToast('Las horas asignadas deben coincidir exactamente con el total de la jornada.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingEntry) {
                // Editing a single entry
                const a = assignments[0];
                const payload = {
                    id: editingEntry.id,
                    operatorId: formData.operatorId,
                    fecha: formData.fecha,
                    horaIngreso: formData.horaIngreso,
                    horaEgreso: formData.horaEgreso,
                    projectId: a.type === 'proyecto' ? a.targetId : null,
                    causaRegistro: a.type === 'causa' ? a.targetId : null,
                    isExtra: a.isDevolucion || a.type === 'causa' ? false : a.isExtra,
                    isDevolucion: a.type === 'causa' ? false : a.isDevolucion,
                    descripcionDevolucion: a.isDevolucion || (a.type === 'causa' && a.targetId === 'Administrativo') ? a.descripcionDevolucion.trim() : null,
                    requestUserId: currentUser?.id,
                    requestUserRole: currentUser?.role
                };
                
                const res = await safeApiRequest('/api/time-entries', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Error al actualizar');
                }
            } else {
                // New entries (split jornada)
                let currentStartTime = formData.horaIngreso;
                
                const addHoursToTime = (timeStr: string, hoursToAdd: number) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const totalMins = h * 60 + m + hoursToAdd * 60;
                    const newH = Math.floor(totalMins / 60) % 24;
                    const newM = Math.round(totalMins % 60);
                    return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
                };
                
                const promises = assignments.map(a => {
                    const sliceStart = currentStartTime;
                    const sliceEnd = addHoursToTime(sliceStart, a.horas);
                    currentStartTime = sliceEnd;

                    const payload = {
                        operatorId: formData.operatorId,
                        fecha: formData.fecha,
                        horaIngreso: sliceStart,
                        horaEgreso: sliceEnd,
                        projectId: a.type === 'proyecto' ? a.targetId : null,
                        causaRegistro: a.type === 'causa' ? a.targetId : null,
                        isExtra: a.isDevolucion || a.type === 'causa' ? false : a.isExtra,
                        isDevolucion: a.type === 'causa' ? false : a.isDevolucion,
                        descripcionDevolucion: a.isDevolucion || (a.type === 'causa' && a.targetId === 'Administrativo') ? a.descripcionDevolucion.trim() : null,
                        requestUserId: currentUser?.id,
                        requestUserRole: currentUser?.role
                    };

                    return safeApiRequest('/api/time-entries', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).then(async res => {
                        if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.error || 'Error al crear');
                        }
                        return res.json();
                    });
                });

                await Promise.all(promises);
            }

            setIsModalOpen(false);
            loadData();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Error al guardar.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (entry: TimeEntry) => {
        if (entry.estadoConfirmado) {
            if (currentUser?.role === 'operador') {
                setPendingAction({ type: 'request_deletion', entry });
                setIsRequestModalOpen(true);
                return;
            }
            // Admin/Supervisor can delete directly without PIN
        }
        setEntryToDelete(entry.id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        const id = entryToDelete || pendingAction?.id;
        if (!id) return;
        try {
            let url = `/api/time-entries?id=${id}`;
            if (currentUser?.id) url += `&requestUserId=${currentUser.id}`;
            if (currentUser?.role) url += `&requestUserRole=${currentUser.role}`;

            const res = await safeApiRequest(url, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                showToast(data.error, 'error');
                return;
            }

            loadData();
            setIsConfirmOpen(false);
            setEntryToDelete(null);
            setPendingAction(null);
        } catch (error) {
            console.error(error);
        }
    };

    const submitModificationRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingAction || !pendingAction.entry || !currentUser) return;

        try {
            const isDelete = pendingAction.type === 'request_deletion';
            const actionText = isDelete ? 'eliminar' : 'modificar';

            const a = assignments[0];
            const metadata = isDelete ? null : {
                horaIngreso: formData.horaIngreso,
                horaEgreso: formData.horaEgreso,
                isExtra: a?.isDevolucion ? false : a?.isExtra,
                isDevolucion: a?.isDevolucion,
                descripcionDevolucion: a?.isDevolucion ? a?.descripcionDevolucion : null
            };

            const res = await safeApiRequest('/api/notifications', {
                method: 'POST',
                body: JSON.stringify({
                    operatorId: currentUser.id,
                    forSupervisors: true,
                    title: `Solicitud para ${actionText} registro`,
                    message: `El operador ${currentUser.nombreCompleto} solicita ${actionText} su registro de horas del ${formatDate(pendingAction.entry.fecha)} (${pendingAction.entry.causaRegistro ? `Causa: ${pendingAction.entry.causaRegistro}` : (pendingAction.entry.project?.nombre || 'Sin proyecto')}).\nMotivo: ${requestMessage}`,
                    type: 'TIME_MODIFICATION_REQUEST',
                    relatedId: pendingAction.entry.id,
                    metadata
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al crear notificación interna');
            }

            showToast('Solicitud enviada a los supervisores exitosamente.', 'success');
            setIsRequestModalOpen(false);
            setRequestMessage('');
            setPendingAction(null);
        } catch (error: any) {
            console.error('Error enviando solicitud:', error);
            showToast(error.message || 'Error al enviar la solicitud.', 'error');
        }
    };


    // Derived Data
    // Restricted projects list for operators (filters out planned/old finalized)
    const operatorVisibleProjects = currentUser?.role === 'operador' ? filterOperatorProjects(projects) : projects;
    const activeProjects = operatorVisibleProjects.filter(p => p.estado !== 'finalizado' || (new Date(p.updatedAt || 0) > new Date(Date.now() - 24*60*60*1000)));
    const activeOperators = operators;

    // Compute View Data
    const completedEntries = entries.filter(e => e.horaEgreso);
    let filteredCompleted = completedEntries.filter(e => {
        if (filterDateFrom && e.fecha < filterDateFrom) return false;
        if (filterDateTo && e.fecha > filterDateTo) return false;
        if (filterOperator && e.operatorId !== filterOperator) return false;
        if (filterProject && e.project?.nombre !== filterProject) return false;
        return true;
    }).sort((a, b) => {
        if (a.fecha !== b.fecha) {
            return b.fecha.localeCompare(a.fecha); // descendente por fecha
        }
        const nameA = a.operator?.nombreCompleto || '';
        const nameB = b.operator?.nombreCompleto || '';
        return nameA.localeCompare(nameB); // alfabético por operador
    });

    const exportToExcel = () => {
        const aoa: any[][] = [];

        if (viewMode === 'tarjetas') {
            aoa.push(['Fecha', 'Operador', 'Proyecto', 'Ingreso', 'Egreso', 'Horas', 'Tipo', 'Estado', 'Comentario Devolución']);
            filteredCompleted.forEach(e => {
                aoa.push([
                    formatDate(e.fecha),
                    e.operator?.nombreCompleto || '',
                    e.causaRegistro ? `[CAUSA] ${e.causaRegistro}` : (e.project?.nombre || ''),
                    e.horaIngreso || '',
                    e.horaEgreso || '',
                    e.horasTrabajadas,
                    e.isDevolucion ? 'DEVOLUCIÓN' : (e.isExtra ? 'EXTRA' : 'NORMAL'),
                    e.estadoConfirmado ? 'Confirmado' : 'Pendiente',
                    e.isDevolucion && e.descripcionDevolucion ? e.descripcionDevolucion : ''
                ]);
            });
        } else if (viewMode === 'planilla') {
            aoa.push(['Fecha', 'Operador', 'Obra', 'Normal Inicio', 'Normal Fin', 'Normal Subtotal', 'Extra Inicio', 'Extra Fin', 'Extra Subtotal']);
            groupedPlanilla.forEach((r: any) => {
                aoa.push([
                    formatDate(r.fecha),
                    r.operatorName,
                    r.projectName,
                    r.normalStart,
                    r.normalEnd,
                    r.normalTotal,
                    r.extraStart,
                    r.extraEnd,
                    r.extraTotal
                ]);
            });
        } else if (viewMode === 'resumen') {
            aoa.push(['Fecha', 'Operador', 'Total Normales', 'Total Extras', 'Total Día']);
            groupedResumen.forEach((r: any) => {
                aoa.push([
                    formatDate(r.fecha),
                    r.operatorName,
                    r.normalTotal,
                    r.extraTotal,
                    r.normalTotal + r.extraTotal
                ]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        formatSheetDates(ws);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Reporte-${viewMode.toUpperCase()}`);
        XLSX.writeFile(wb, `Reporte_Jornadas_${filterDateFrom}_${filterDateTo}.xlsx`);
    };

    const groupedPlanilla = Object.values(filteredCompleted.reduce((acc, entry) => {
        const key = `${entry.fecha}_${entry.operatorId}_${entry.projectId || entry.causaRegistro || 'base'}`;
        if (!acc[key]) {
            acc[key] = {
                id: key,
                fecha: entry.fecha,
                operatorName: entry.operator?.nombreCompleto || 'Sistema / Central',
                projectName: entry.causaRegistro ? `[CAUSA] ${entry.causaRegistro}` : (entry.project?.nombre || 'BASE / EMPRESA'),
                isCausa: !!entry.causaRegistro,
                normalStart: "-", normalEnd: "-", normalTotal: 0,
                extraStart: "-", extraEnd: "-", extraTotal: 0,
            };
        }
        if (entry.isExtra) {
            acc[key].extraStart = entry.horaIngreso || "-";
            acc[key].extraEnd = entry.horaEgreso || "-";
            acc[key].extraTotal += entry.horasTrabajadas;
        } else {
            acc[key].normalStart = entry.horaIngreso || "-";
            acc[key].normalEnd = entry.horaEgreso || "-";
            acc[key].normalTotal += entry.horasTrabajadas;
        }
        return acc;
    }, {} as Record<string, any>));

    const groupedResumen = Object.values(filteredCompleted.reduce((acc, entry) => {
        const key = `${entry.fecha}_${entry.operatorId}`;
        if (!acc[key]) {
            acc[key] = {
                id: key,
                fecha: entry.fecha,
                operatorName: entry.operator?.nombreCompleto || 'Sistema / Central',
                normalTotal: 0,
                extraTotal: 0,
            };
        }
        if (entry.isExtra) {
            acc[key].extraTotal += entry.horasTrabajadas;
        } else {
            acc[key].normalTotal += entry.horasTrabajadas;
        }
        return acc;
    }, {} as Record<string, any>));

    const totalFilteredNormales = filteredCompleted.filter(e => !e.isExtra).reduce((sum, e) => sum + e.horasTrabajadas, 0);
    const totalFilteredExtras = filteredCompleted.filter(e => e.isExtra).reduce((sum, e) => sum + e.horasTrabajadas, 0);

    const registerCommand = useCommandStore((state) => state.registerCommand);
    const unregisterCommand = useCommandStore((state) => state.unregisterCommand);
    const latestActions = useRef({ openEditModal, exportToExcel });
    
    useEffect(() => {
        latestActions.current = { openEditModal, exportToExcel };
    });

    useEffect(() => {
        registerCommand({
            id: 'ts-carga-manual',
            label: 'Carga Manual',
            category: 'Contextual',
            keys: ['ctrl', 'n'],
            action: () => latestActions.current.openEditModal()
        });
        registerCommand({
            id: 'ts-export-excel',
            label: 'Exportar Excel',
            category: 'Contextual',
            keys: ['ctrl', 'e'],
            action: () => latestActions.current.exportToExcel()
        });
        return () => {
            unregisterCommand('ts-carga-manual');
            unregisterCommand('ts-export-excel');
        };
    }, [registerCommand, unregisterCommand]);

    return (
        <div className="w-full space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <Clock className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
                        Registro de Tiempos
                        <HelpContextual slug="registro-tiempos-ausencias" />
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic hidden md:block">Gestión de jornadas de los operadores e ingresos por proyecto</p>
                </div>
                <button
                    onClick={() => openEditModal()}
                    className="bg-muted text-muted-foreground text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-bold flex items-center gap-2 hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm hover:shadow-primary/20 hover:shadow-lg active:scale-95 transition-all text-sm w-full md:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" />
                    Carga Manual
                </button>
            </div>

            {/* Past Entries / Reports Content */}
            <div className="bg-card text-card-foreground rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm relative">
                <div className="p-4 md:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base md:text-lg">Historial y Reportes</h3>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value as any)}
                            className="bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl h-[42px] px-3 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700 dark:text-slate-200 text-xs md:text-sm appearance-none cursor-pointer flex-1 md:flex-none"
                        >
                            <option value="tarjetas">Vista Detallada (Tarjetas)</option>
                            <option value="planilla">Formato Planilla</option>
                            <option value="resumen">Resumen Rápido</option>
                        </select>
                    </div>
                </div>

                <div className="p-3 md:p-4 bg-slate-50/50 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 md:gap-4 items-end">
                    <div className="flex items-center gap-1.5 w-[calc(50%-4px)] md:w-auto">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">Desde:</label>
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={e => setFilterDateFrom(e.target.value)}
                            className="h-[42px] bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-2 md:px-4 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none flex-1 min-w-0"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 w-[calc(50%-4px)] md:w-auto">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">Hasta:</label>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={e => setFilterDateTo(e.target.value)}
                            className="h-[42px] bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-2 md:px-4 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none flex-1 min-w-0"
                        />
                    </div>
                    {currentUser?.role !== 'operador' && (
                        <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[200px]">
                            <SearchableSelect
                                label="Filtrar Operador"
                                options={activeOperators.filter(op => op?.id && op?.nombreCompleto).map(op => ({ id: op.id, label: op.nombreCompleto }))}
                                value={filterOperator}
                                onChange={setFilterOperator}
                                placeholder="Todos"
                                className="!space-y-1 w-full"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[200px]">
                        <SearchableSelect
                            label="Filtrar Proyecto"
                            options={getProjectOptions(activeProjects.filter(p => p?.id && p?.nombre).map(p => ({ ...p, id: p.nombre })), recentProjects.map(id => projects.find(p => p?.id === id)?.nombre || '').filter(Boolean))}
                            value={filterProject}
                            onChange={setFilterProject}
                            placeholder="Todos"
                            className="!space-y-1 w-full"
                        />
                    </div>

                    {(filterOperator || filterProject) && (
                        <button
                            onClick={() => { setFilterOperator(''); setFilterProject(''); }}
                            className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline h-10 px-2 whitespace-nowrap"
                        >
                            <X className="w-3 h-3" /> Limpiar filtros
                        </button>
                    )}

                    {currentUser?.role !== 'operador' && (
                        <button
                            onClick={exportToExcel}
                            className="ml-auto bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold py-2 px-3 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar</span> Excel
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    {viewMode === 'tarjetas' && (
                        <>
                            {/* Desktop: Table */}
                            <table className="w-full text-left border-collapse hidden md:table min-w-[1100px]">
                                <thead>
                                    <tr className="bg-background text-foreground/50 border-b border-slate-100 dark:border-slate-800">
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Operador</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Proyecto / Causa</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Horario</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Horas</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Tipo</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Estado</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right whitespace-nowrap">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCompleted.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-sm uppercase tracking-widest">No hay registros completados</td>
                                        </tr>
                                    ) : (
                                        filteredCompleted.map(entry => (
                                            <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors [&>td]:align-middle">
                                                <td className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">{formatEntryDate(entry.fecha)}</td>
                                                <td className="p-4 text-sm font-black text-primary whitespace-nowrap">{entry.operator?.nombreCompleto || 'Sistema / Central'}</td>
                                                <td className="p-4">
                                                    {entry.causaRegistro ? (
                                                        <div className="flex items-center gap-2 text-xs font-bold whitespace-nowrap">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg border border-orange-200 dark:border-orange-800">
                                                                <UserX className="w-3 h-3" />
                                                                {entry.causaRegistro}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                            <span className="truncate max-w-[280px]" title={entry.project?.nombre || 'Sin proyecto'}>
                                                                {entry.project?.nombre || 'Sin proyecto'}
                                                            </span>
                                                            {entry.project?.codigoProyecto && <CodeBadge code={entry.project.codigoProyecto} variant="project" size="sm" showCopy={false} />}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                                                    {entry.horaIngreso} - {entry.horaEgreso}
                                                </td>
                                                <td className="p-4 text-center whitespace-nowrap">
                                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 font-black rounded-xl text-sm border border-indigo-100">{entry.horasTrabajadas}h</span>
                                                </td>
                                                <td className="p-4 text-center whitespace-nowrap">
                                                    {entry.isDevolucion ? (
                                                        <button
                                                            onClick={() => showToast(entry.descripcionDevolucion || 'Sin comentario', 'info')}
                                                            className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-md cursor-pointer hover:bg-purple-200 hover:ring-2 hover:ring-purple-300 transition-all"
                                                            title="Click para ver comentario"
                                                        >DEVOLUCIÓN</button>
                                                    ) : entry.isExtra ? (
                                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md">EXTRA</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold bg-muted text-muted-foreground/50 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md">NORMAL</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center whitespace-nowrap">
                                                    {entry.estadoConfirmado ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">
                                                            <CheckCircle2 className="w-3 h-3" /> Confirmado
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleConfirmDay(entry.id)}
                                                            className="btn-icon-inline inline-flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-emerald-500 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                                                        >
                                                            <ShieldAlert className="w-3 h-3" /> Pendiente
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="p-4 flex items-center justify-end gap-2 whitespace-nowrap">
                                                    <button
                                                        onClick={() => openEditModal(entry)}
                                                        className={`btn-icon-inline p-2 rounded-xl transition-all ${entry.estadoConfirmado ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-500 hover:bg-indigo-50'}`}
                                                        title={entry.estadoConfirmado ? "Requiere Clave Supervisor" : "Editar"}
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(entry)}
                                                        className={`btn-icon-inline p-2 rounded-xl transition-all ${entry.estadoConfirmado ? 'text-amber-500 hover:bg-amber-50' : 'text-rose-400 hover:bg-rose-50 hover:text-rose-600'}`}
                                                        title={entry.estadoConfirmado ? "Requiere Clave Supervisor" : "Eliminar"}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Mobile: Cards */}
                            <div className="md:hidden p-3 space-y-2.5">
                                {filteredCompleted.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-bold text-sm uppercase tracking-widest">No hay registros completados</div>
                                ) : (
                                    filteredCompleted.map((entry, idx) => (
                                        <div key={entry.id} className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm animate-card-in" style={{ animationDelay: `${idx * 30}ms` }}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">{formatEntryDate(entry.fecha)}</p>
                                                    <h4 className="font-extrabold text-primary text-sm truncate">{entry.operator?.nombreCompleto || 'Sistema / Central'}</h4>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                    <button
                                                        onClick={() => openEditModal(entry)}
                                                        className={`btn-icon-inline p-2 rounded-xl transition-all ${entry.estadoConfirmado ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(entry)}
                                                        className={`btn-icon-inline p-2 rounded-xl transition-all ${entry.estadoConfirmado ? 'text-amber-500' : 'text-rose-400'}`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                {entry.causaRegistro ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg border border-orange-200 dark:border-orange-800 text-xs font-bold">
                                                        <UserX className="w-3 h-3" />
                                                        {entry.causaRegistro}
                                                    </span>
                                                ) : (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{entry.project?.nombre || 'BASE / EMPRESA'}</p>
                                                        {entry.project?.codigoProyecto && <CodeBadge code={entry.project.codigoProyecto} variant="project" size="sm" showCopy={false} />}
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{entry.horaIngreso} - {entry.horaEgreso}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 font-black rounded-lg text-xs border border-indigo-100">{entry.horasTrabajadas}h</span>
                                                    {entry.isDevolucion && <button onClick={() => showToast(entry.descripcionDevolucion || 'Sin comentario', 'info')} className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-purple-200 transition-all" title="Ver comentario">DEV</button>}
                                                    {entry.isExtra && !entry.isDevolucion && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">EXTRA</span>}
                                                    {entry.estadoConfirmado ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <button onClick={() => handleConfirmDay(entry.id)} className="btn-icon-inline">
                                                            <ShieldAlert className="w-4 h-4 text-slate-300" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {viewMode === 'planilla' && (
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-background text-foreground/50 border-b border-slate-100 dark:border-slate-800">
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fecha</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operador</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Obra</th>
                                    <th className="p-4 border-l border-slate-200 dark:border-slate-700 text-center bg-indigo-50/30 text-[10px] font-black text-indigo-400 uppercase tracking-widest" colSpan={3}>Normales</th>
                                    <th className="p-4 border-l border-slate-200 dark:border-slate-700 text-center bg-amber-50/30 text-[10px] font-black text-amber-400 uppercase tracking-widest" colSpan={3}>Extras</th>
                                </tr>
                                <tr className="bg-background text-foreground/50 border-b border-slate-200 dark:border-slate-700">
                                    <th colSpan={3}></th>
                                    <th className="p-2 border-l border-slate-200 dark:border-slate-700 text-center text-xs font-bold text-slate-500 dark:text-slate-400">Inicio</th>
                                    <th className="p-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400">Fin</th>
                                    <th className="p-2 text-center text-xs font-black text-slate-800 dark:text-slate-100">Subtotal</th>
                                    <th className="p-2 border-l border-slate-200 dark:border-slate-700 text-center text-xs font-bold text-slate-500 dark:text-slate-400">Inicio</th>
                                    <th className="p-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400">Fin</th>
                                    <th className="p-2 text-center text-xs font-black text-slate-800 dark:text-slate-100">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedPlanilla.length === 0 ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-sm uppercase">Sin resultados</td></tr>
                                ) : (
                                    groupedPlanilla.map((row: any) => (
                                        <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 [&>td]:align-middle">
                                            <td className="p-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">{formatEntryDate(row.fecha)}</td>
                                            <td className="p-4 text-sm font-black text-primary">{row.operatorName}</td>
                                            <td className="p-4 text-xs font-bold truncate max-w-[200px]" title={row.projectName}>
                                                {row.isCausa ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg border border-orange-200 dark:border-orange-800">
                                                        <UserX className="w-3 h-3" />
                                                        {row.projectName.replace('[CAUSA] ', '')}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600 dark:text-slate-300">{row.projectName}</span>
                                                )}
                                            </td>
                                            <td className="p-4 border-l border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">{row.normalStart}</td>
                                            <td className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">{row.normalEnd}</td>
                                            <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/30">{row.normalTotal > 0 ? `${row.normalTotal}h` : '-'}</td>
                                            <td className="p-4 border-l border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">{row.extraStart}</td>
                                            <td className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">{row.extraEnd}</td>
                                            <td className="p-4 text-center font-black text-amber-600 bg-amber-50/30">{row.extraTotal > 0 ? `${row.extraTotal}h` : '-'}</td>
                                        </tr>
                                    ))
                                )}
                                {groupedPlanilla.length > 0 && (
                                    <tr className="bg-muted text-muted-foreground/50 border-t-2 border-slate-300 dark:border-slate-600">
                                        <td colSpan={5} className="p-4 text-right text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Total Global Filtrado:</td>
                                        <td className="p-4 text-center font-black text-indigo-700">{totalFilteredNormales > 0 ? `${totalFilteredNormales}h` : '-'}</td>
                                        <td colSpan={2}></td>
                                        <td className="p-4 text-center font-black text-amber-700">{totalFilteredExtras > 0 ? `${totalFilteredExtras}h` : '-'}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {viewMode === 'resumen' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background text-foreground/50 border-b border-slate-100 dark:border-slate-800">
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fecha</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">Operador</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Total Normales</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Total Extras</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Total Día</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedResumen.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-sm uppercase">Sin resultados</td></tr>
                                ) : (
                                    groupedResumen.map((row: any) => (
                                        <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 [&>td]:align-middle">
                                            <td className="p-4 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{formatEntryDate(row.fecha)}</td>
                                            <td className="p-4 text-sm font-black text-primary">{row.operatorName}</td>
                                            <td className="p-4 text-right font-black text-indigo-600">{row.normalTotal > 0 ? `${row.normalTotal}h` : '-'}</td>
                                            <td className="p-4 text-right font-black text-amber-600">{row.extraTotal > 0 ? `${row.extraTotal}h` : '-'}</td>
                                            <td className="p-4 text-right font-black text-slate-800 dark:text-slate-100 bg-slate-50/50">{row.normalTotal + row.extraTotal}h</td>
                                        </tr>
                                    ))
                                )}
                                {groupedResumen.length > 0 && (
                                    <tr className="bg-muted text-muted-foreground/50 border-t-2 border-slate-300 dark:border-slate-600">
                                        <td colSpan={2} className="p-4 text-right text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Total Global Filtrado:</td>
                                        <td className="p-4 text-right font-black text-indigo-700">{totalFilteredNormales > 0 ? `${totalFilteredNormales}h` : '-'}</td>
                                        <td className="p-4 text-right font-black text-amber-700">{totalFilteredExtras > 0 ? `${totalFilteredExtras}h` : '-'}</td>
                                        <td className="p-4 text-right font-black text-slate-800 dark:text-slate-100">{totalFilteredNormales + totalFilteredExtras}h</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal de Carga Manual / Edición */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card text-card-foreground w-full max-w-xl rounded-t-3xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header - Fixed */}
                        <div className="p-5 md:p-7 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">
                                {editingEntry ? 'Editar Registro de Tiempo' : 'Nuevo Registro de Tiempo'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); }} className="btn-icon-inline p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitForm} className="flex-1 flex flex-col min-h-0">
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-5 md:space-y-6 custom-scrollbar">
                                {/* Alerta si está editando un registro confirmado (ya ingresó la clave) */}
                                {editingEntry?.estadoConfirmado && (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                                        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                                        <p className="text-xs font-bold text-amber-800">Modificando registro confirmado mediante override de supervisor.</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 md:col-span-2">
                                        <SearchableSelect
                                            label="Operador"
                                            options={operators.filter(op => op?.id && op?.nombreCompleto).map(op => ({ id: op.id, label: op.nombreCompleto }))}
                                            value={formData.operatorId}
                                            onChange={(val) => setFormData({ ...formData, operatorId: val })}
                                            placeholder="Seleccionar operador..."
                                            disabled={!!editingEntry || currentUser?.role === 'operador'}
                                        />
                                    </div>

                                    {/* Información General */}
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100">1. Información de la Jornada</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2 md:col-span-2">
                                                <DatePicker
                                                    label="Fecha"
                                                    value={formData.fecha}
                                                    onChange={val => setFormData({ ...formData, fecha: val })}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <TimePicker
                                                    label="Hora Inicio"
                                                    value={formData.horaIngreso}
                                                    onChange={val => setFormData({ ...formData, horaIngreso: val })}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <TimePicker
                                                    label="Hora Fin"
                                                    value={formData.horaEgreso}
                                                    onChange={val => setFormData({ ...formData, horaEgreso: val })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Indicadores */}
                                    <div className="md:col-span-2 sticky -top-5 md:-top-7 z-20 pt-5 md:pt-7 pb-2 -mt-5 md:-mt-7 bg-card/95 backdrop-blur-sm">
                                        <div className="flex bg-slate-100 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 justify-between items-center shadow-lg shadow-slate-200/20 dark:shadow-none">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Jornada</p>
                                                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{totalJornada}h</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Asignadas</p>
                                                <p className="text-lg font-black text-slate-700 dark:text-slate-200">{horasAsignadas}h</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Restantes</p>
                                                <p className={`text-lg font-black ${horasRestantes === 0 ? 'text-emerald-500' : horasRestantes > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                    {horasRestantes > 0 ? `+${horasRestantes}` : horasRestantes}h
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Asignaciones */}
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100">2. Distribución de Horas</h4>
                                            </div>
                                            {!editingEntry && (
                                                <button
                                                    type="button"
                                                    onClick={handleAddAssignment}
                                                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar fila
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            {assignments.map((a, idx) => (
                                                <div key={a.id} className="p-4 bg-background border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4 relative group">
                                                    {!editingEntry && assignments.length > 1 && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleRemoveAssignment(a.id)}
                                                            className="absolute -top-2.5 -right-2.5 bg-rose-100 text-rose-500 p-1.5 rounded-full hover:bg-rose-500 hover:text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    
                                                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                                                        <div className="w-full md:w-[140px] flex-shrink-0 space-y-2">
                                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tipo</label>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAssignmentChange(a.id, 'type', a.type === 'proyecto' ? 'causa' : 'proyecto')}
                                                                className={`flex items-center justify-center gap-2 w-full h-[46px] rounded-xl font-bold text-xs transition-all border ${
                                                                    a.type === 'proyecto'
                                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                                        : 'bg-orange-50 border-orange-200 text-orange-700'
                                                                }`}
                                                            >
                                                                {a.type === 'proyecto' ? <Briefcase className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                                                {a.type === 'proyecto' ? 'Proyecto' : 'Causa'}
                                                            </button>
                                                        </div>

                                                        <div className="w-full flex-1 min-w-0">
                                                            {a.type === 'proyecto' ? (
                                                                <SearchableSelect
                                                                    label="Proyecto"
                                                                    options={getProjectOptions(activeProjects, recentProjects)}
                                                                    value={a.targetId}
                                                                    onChange={(val) => handleAssignmentChange(a.id, 'targetId', val)}
                                                                    placeholder="Seleccionar..."
                                                                />
                                                            ) : (
                                                                <SearchableSelect
                                                                    label="Causa / Ausencia"
                                                                    options={causas.map(c => ({ id: c.value, label: c.value }))}
                                                                    value={a.targetId}
                                                                    onChange={(val) => handleAssignmentChange(a.id, 'targetId', val)}
                                                                    placeholder="Seleccionar..."
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="w-full md:w-[100px] flex-shrink-0 space-y-2">
                                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Horas</label>
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                min="0.5"
                                                                max="24"
                                                                required
                                                                value={a.horas || ''}
                                                                onChange={e => handleAssignmentChange(a.id, 'horas', parseFloat(e.target.value))}
                                                                className="w-full h-[46px] bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-center"
                                                            />
                                                        </div>
                                                    </div>

                                                    {a.type === 'proyecto' ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => { handleAssignmentChange(a.id, 'isExtra', false); handleAssignmentChange(a.id, 'isDevolucion', false); }}
                                                                className={`flex-1 py-2 px-2 rounded-xl font-bold transition-all text-xs ${!a.isExtra && !a.isDevolucion ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-background text-slate-500 border-2 border-slate-200'}`}
                                                            >
                                                                Normal
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { handleAssignmentChange(a.id, 'isExtra', true); handleAssignmentChange(a.id, 'isDevolucion', false); }}
                                                                className={`flex-1 py-2 px-2 rounded-xl font-bold transition-all text-xs ${a.isExtra && !a.isDevolucion ? 'bg-amber-100 text-amber-700 border-2 border-amber-500' : 'bg-background text-slate-500 border-2 border-slate-200'}`}
                                                            >
                                                                Extra
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { handleAssignmentChange(a.id, 'isExtra', false); handleAssignmentChange(a.id, 'isDevolucion', true); }}
                                                                className={`flex-1 py-2 px-2 rounded-xl font-bold transition-all text-xs ${a.isDevolucion ? 'bg-purple-100 text-purple-700 border-2 border-purple-500' : 'bg-background text-slate-500 border-2 border-slate-200'}`}
                                                            >
                                                                Devolución
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full bg-red-50 border-2 border-red-200 rounded-xl py-2 px-3 text-red-600 font-black flex items-center justify-center text-xs">
                                                            Ausencia
                                                        </div>
                                                    )}

                                                    {(a.isDevolucion || (a.type === 'causa' && a.targetId === 'Administrativo')) && (
                                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 pt-2">
                                                            <textarea
                                                                required
                                                                placeholder="Descripción obligatoria..."
                                                                value={a.descripcionDevolucion}
                                                                onChange={e => handleAssignmentChange(a.id, 'descripcionDevolucion', e.target.value)}
                                                                className="w-full bg-purple-50/50 border-2 border-purple-300 rounded-xl py-2 px-3 resize-none h-16 outline-none focus:border-purple-500 text-xs font-medium"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer - Fixed */}
                            <div className="p-5 md:p-7 border-t border-slate-100 dark:border-slate-800 flex gap-3 flex-shrink-0">
                                <button type="button" onClick={() => { setIsModalOpen(false); }} disabled={isSubmitting} className="flex-1 bg-muted text-muted-foreground/50 text-slate-600 dark:text-slate-300 py-3.5 md:py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50">Cancelar</button>
                                <button type="submit" disabled={isSubmitting || (!editingEntry && horasRestantes !== 0)} className="flex-[2] bg-muted text-muted-foreground text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-3.5 md:py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm hover:shadow-primary/20 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50">{isSubmitting ? 'Guardando...' : 'Guardar Registro'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Registro"
                message="¿Estás seguro de eliminar este registro de tiempo? Esta acción descontará las horas del proyecto (si las hubiera)."
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                onConfirm={confirmDelete}
                onCancel={() => {
                    setIsConfirmOpen(false);
                    setEntryToDelete(null);
                }}
            />

            {/* Modal de Solicitud de Modificación (Para Operadores) */}
            {isRequestModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card text-card-foreground w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300 p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-500">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <button onClick={() => { setIsRequestModalOpen(false); setPendingAction(null); setRequestMessage(''); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500"><X className="w-5 h-5" /></button>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-2">Solicitar {pendingAction?.type === 'request_deletion' ? 'Eliminación' : 'Modificación'}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">Este registro ya fue confirmado. Por favor, indica el motivo para solicitar la modificación a tus supervisores.</p>
                        <form onSubmit={submitModificationRequest} className="space-y-6">
                            {pendingAction?.type === 'request_modification' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <TimePicker
                                                label="Hora Inicio Sugerida"
                                                value={formData.horaIngreso}
                                                onChange={val => setFormData({ ...formData, horaIngreso: val })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <TimePicker
                                                label="Hora Fin Sugerida"
                                                value={formData.horaEgreso}
                                                onChange={val => setFormData({ ...formData, horaEgreso: val })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">Tipo de Horas</label>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => { handleAssignmentChange(assignments[0]?.id, 'isExtra', false); handleAssignmentChange(assignments[0]?.id, 'isDevolucion', false); }}
                                                className={`flex-1 py-3 px-3 rounded-2xl font-bold transition-all text-sm ${!assignments[0]?.isExtra && !assignments[0]?.isDevolucion ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-background text-foreground/50 text-slate-500 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700'}`}
                                            >
                                                Normal
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { handleAssignmentChange(assignments[0]?.id, 'isExtra', true); handleAssignmentChange(assignments[0]?.id, 'isDevolucion', false); }}
                                                className={`flex-1 py-3 px-3 rounded-2xl font-bold transition-all text-sm ${assignments[0]?.isExtra && !assignments[0]?.isDevolucion ? 'bg-amber-100 text-amber-700 border-2 border-amber-500' : 'bg-background text-foreground/50 text-slate-500 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700'}`}
                                            >
                                                Extra
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { handleAssignmentChange(assignments[0]?.id, 'isExtra', false); handleAssignmentChange(assignments[0]?.id, 'isDevolucion', true); }}
                                                className={`flex-1 py-3 px-3 rounded-2xl font-bold transition-all text-sm ${assignments[0]?.isDevolucion ? 'bg-purple-100 text-purple-700 border-2 border-purple-500' : 'bg-background text-foreground/50 text-slate-500 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700'}`}
                                            >
                                                Devolución
                                            </button>
                                        </div>
                                        {assignments[0]?.isDevolucion && (
                                            <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-2 px-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Descripción de Devolución (obligatoria)
                                                </label>
                                                <textarea
                                                    required
                                                    placeholder="Describa el motivo de la devolución de horas..."
                                                    value={assignments[0]?.descripcionDevolucion || ''}
                                                    onChange={e => handleAssignmentChange(assignments[0]?.id, 'descripcionDevolucion', e.target.value)}
                                                    className="w-full bg-purple-50/50 dark:bg-purple-900/10 border-2 border-purple-300 dark:border-purple-700 rounded-2xl py-3 px-4 resize-none h-20 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 font-medium text-slate-700 dark:text-slate-200 transition-all text-sm placeholder:text-purple-300 dark:placeholder:text-purple-600"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">Motivo / Detalles</label>
                                <textarea
                                    required
                                    autoFocus
                                    placeholder="Explica qué necesitas cambiar y por qué..."
                                    value={requestMessage}
                                    onChange={e => setRequestMessage(e.target.value)}
                                    className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 resize-none h-24 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200 transition-all text-sm"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setIsRequestModalOpen(false); setPendingAction(null); setRequestMessage(''); }} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all bg-muted text-muted-foreground/50 hover:bg-slate-200 text-slate-600 dark:text-slate-300 active:scale-95">Cancelar</button>
                                <button type="submit" className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 bg-muted text-muted-foreground border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm hover:shadow-primary/20 hover:shadow-xl">Enviar Solicitud</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
