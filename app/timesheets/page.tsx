'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Clock, Calendar, User, Layout, CheckCircle2, ShieldAlert, Plus, Trash2, Edit3, X, AlertCircle, Activity, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import * as XLSX from 'xlsx';
import SearchableSelect from '@/components/SearchableSelect';

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
    projectId: string;
    project: { nombre: string; cliente: string };
    fecha: string;
    horaIngreso: string | null;
    horaEgreso: string | null;
    horasTrabajadas: number;
    estadoConfirmado: boolean;
    confirmadoPorSupervisor: string | null;
    isExtra: boolean;
}

export default function TimesheetsPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const formatEntryDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr + 'T12:00:00');
            const dayName = format(date, "EEEE", { locale: es });
            const formatted = format(date, "dd/MM/yyyy");
            return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${formatted}`;
        } catch (e) {
            return dateStr;
        }
    };

    // Quick Actions State
    const [selectedOperator, setSelectedOperator] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [isExtraQuick, setIsExtraQuick] = useState(false);
    const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

    // Filters and View Mode
    const [viewMode, setViewMode] = useState<'tarjetas' | 'planilla' | 'resumen'>('tarjetas');
    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [filterOperator, setFilterOperator] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
    const [formData, setFormData] = useState({
        operatorId: '',
        projectId: '',
        fecha: new Date().toISOString().split('T')[0],
        horaIngreso: '',
        horaEgreso: '',
        isExtra: false
    });

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
                if (parsedUser.role === 'operador') {
                    setSelectedOperator(parsedUser.id);
                }
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

            const [entriesData, projectsData, operatorsData] = await Promise.all([
                fetch(entriesUrl).then(res => res.json()),
                fetch('/api/projects').then(res => res.json()),
                fetch('/api/operators').then(res => res.json())
            ]);
            setEntries(Array.isArray(entriesData) ? entriesData : []);
            setProjects(Array.isArray(projectsData) ? projectsData : []);
            setOperators(Array.isArray(operatorsData) ? operatorsData : []);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClockIn = async () => {
        if (!selectedOperator || !selectedProject) {
            showToast('Por favor selecciona operador y proyecto para iniciar jornada.', 'error');
            return;
        }

        setIsSubmittingQuick(true);

        try {
            // Check if operator already has an open entry today
            const today = new Date().toISOString().split('T')[0];
            const hasOpen = entries.find(e => e.operatorId === selectedOperator && e.fecha === today && !e.horaEgreso);
            if (hasOpen) {
                showToast('El operador ya tiene una jornada iniciada sin finalizar hoy.', 'error');
                setIsSubmittingQuick(false);
                return;
            }

            const now = new Date();
            const timeString = now.toTimeString().slice(0, 5);

            const res = await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operatorId: selectedOperator,
                    projectId: selectedProject,
                    fecha: today,
                    horaIngreso: timeString,
                    horaEgreso: null,
                    isExtra: isExtraQuick,
                    requestUserId: currentUser?.id,
                    requestUserRole: currentUser?.role
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al iniciar jornada');
            }

            showToast('Jornada iniciada con éxito', 'success');
            await loadData();

            if (currentUser?.role !== 'operador') {
                setSelectedOperator('');
            }
            setSelectedProject('');
            setIsExtraQuick(false);
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Error de conexión', 'error');
        } finally {
            setIsSubmittingQuick(false);
        }
    };

    const handleClockOut = async (id: string, requiereAutorizacion = false) => {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);

        try {
            const res = await fetch('/api/time-entries', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    horaEgreso: timeString,
                    requestUserId: currentUser?.id,
                    requestUserRole: currentUser?.role
                })
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error, 'error');
                return;
            }

            setPendingAction(null);
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleConfirmDay = async (id: string) => {
        try {
            await fetch('/api/time-entries', {
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
                projectId: entry.projectId,
                fecha: entry.fecha,
                horaIngreso: entry.horaIngreso || '',
                horaEgreso: entry.horaEgreso || '',
                isExtra: entry.isExtra || false
            });

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
                projectId: '',
                fecha: new Date().toISOString().split('T')[0],
                horaIngreso: '',
                horaEgreso: '',
                isExtra: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.horaIngreso && formData.horaEgreso) {
            if (formData.horaEgreso < formData.horaIngreso) {
                showToast('La hora de egreso no puede ser menor a la de ingreso', 'error');
                return;
            }
        }

        try {
            const payload: any = {
                ...formData,
                requestUserId: currentUser?.id,
                requestUserRole: currentUser?.role
            };

            let url = '/api/time-entries';
            let method = 'POST';

            if (editingEntry) {
                payload.id = editingEntry.id;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                showToast(errorData.error, 'error');
                return;
            }

            setIsModalOpen(false);
            loadData();
        } catch (error) {
            console.error(error);
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

            const res = await fetch(url, { method: 'DELETE' });
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

            const metadata = isDelete ? null : {
                horaIngreso: formData.horaIngreso,
                horaEgreso: formData.horaEgreso,
                isExtra: formData.isExtra
            };

            const res = await fetch('/api/notifications', {
                method: 'POST',
                body: JSON.stringify({
                    operatorId: currentUser.id,
                    forSupervisors: true,
                    title: `Solicitud para ${actionText} registro`,
                    message: `El operador ${currentUser.nombreCompleto} solicita ${actionText} su registro de horas del ${pendingAction.entry.fecha} (${pendingAction.entry.project?.nombre || 'Sin proyecto'}).\nMotivo: ${requestMessage}`,
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
    const activeProjects = projects.filter(p => p.estado !== 'finalizado');
    const activeOperators = operators;

    // Compute View Data
    const completedEntries = entries.filter(e => e.horaEgreso);
    let filteredCompleted = completedEntries.filter(e => {
        if (filterDateFrom && e.fecha < filterDateFrom) return false;
        if (filterDateTo && e.fecha > filterDateTo) return false;
        if (filterOperator && e.operatorId !== filterOperator) return false;
        if (filterProject && e.project?.nombre !== filterProject) return false;
        return true;
    });

    const exportToExcel = () => {
        const aoa: any[][] = [];

        if (viewMode === 'tarjetas') {
            aoa.push(['Fecha', 'Operador', 'Proyecto', 'Ingreso', 'Egreso', 'Horas', 'Tipo', 'Estado']);
            filteredCompleted.forEach(e => {
                aoa.push([
                    e.fecha,
                    e.operator?.nombreCompleto || '',
                    e.project?.nombre || '',
                    e.horaIngreso || '',
                    e.horaEgreso || '',
                    e.horasTrabajadas,
                    e.isExtra ? 'EXTRA' : 'NORMAL',
                    e.estadoConfirmado ? 'Confirmado' : 'Pendiente'
                ]);
            });
        } else if (viewMode === 'planilla') {
            aoa.push(['Fecha', 'Operador', 'Obra', 'Normal Inicio', 'Normal Fin', 'Normal Subtotal', 'Extra Inicio', 'Extra Fin', 'Extra Subtotal']);
            groupedPlanilla.forEach((r: any) => {
                aoa.push([
                    r.fecha,
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
                    r.fecha,
                    r.operatorName,
                    r.normalTotal,
                    r.extraTotal,
                    r.normalTotal + r.extraTotal
                ]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Reporte-${viewMode.toUpperCase()}`);
        XLSX.writeFile(wb, `Reporte_Jornadas_${filterDateFrom}_${filterDateTo}.xlsx`);
    };

    const groupedPlanilla = Object.values(filteredCompleted.reduce((acc, entry) => {
        const key = `${entry.fecha}_${entry.operatorId}_${entry.projectId}`;
        if (!acc[key]) {
            acc[key] = {
                id: key,
                fecha: entry.fecha,
                operatorName: entry.operator.nombreCompleto,
                projectName: entry.project.nombre,
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
                operatorName: entry.operator.nombreCompleto,
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

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <Clock className="w-8 h-8 text-indigo-500" />
                        Registro de Tiempos
                    </h2>
                    <p className="text-slate-500 font-medium italic">Gestión de jornadas de los operadores e ingresos por proyecto</p>
                </div>
                <button
                    onClick={() => openEditModal()}
                    className="bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Carga Manual
                </button>
            </div>

            {/* Quick Logging Box */}
            <div className="bg-white border border-slate-200 shadow-sm p-6 md:p-8 rounded-[2.5rem] flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-8">
                <div className="w-full md:w-1/3">
                    <SearchableSelect
                        label="Operador"
                        icon={<User className="w-3 h-3" />}
                        options={activeOperators.map(op => ({ id: op.id, label: op.nombreCompleto }))}
                        value={selectedOperator}
                        onChange={(val) => setSelectedOperator(val)}
                        placeholder="Seleccionar operador..."
                        disabled={currentUser?.role === 'operador'}
                    />
                </div>

                <div className="w-full md:w-1/3">
                    <SearchableSelect
                        label="Proyecto Activo"
                        icon={<Layout className="w-3 h-3" />}
                        options={activeProjects.map(p => ({ id: p.id, label: p.nombre }))}
                        value={selectedProject}
                        onChange={(val) => setSelectedProject(val)}
                        placeholder="Buscar proyecto..."
                    />
                </div>

                <div className="w-full md:w-auto shrink-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1 mb-2">Horas Extras</label>
                    <button
                        onClick={() => setIsExtraQuick(!isExtraQuick)}
                        className={`w-full h-[50px] px-6 rounded-2xl font-bold transition-all active:scale-95 ${isExtraQuick ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500 shadow-sm' : 'bg-slate-50 text-slate-500 border-2 border-slate-200'
                            }`}
                    >
                        {isExtraQuick ? 'Sí' : 'No'}
                    </button>
                </div>

                <div className="w-full md:w-auto shrink-0 flex items-end">
                    <button
                        onClick={handleClockIn}
                        disabled={!selectedOperator || !selectedProject || isSubmittingQuick}
                        className="w-full md:w-auto bg-emerald-500 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all justify-center disabled:shadow-none"
                    >
                        {isSubmittingQuick ? (
                            <Activity className="w-5 h-5 animate-spin" />
                        ) : (
                            <Play className="w-5 h-5 fill-current" />
                        )}
                        {isSubmittingQuick ? 'Iniciando...' : 'Iniciar Jornada'}
                    </button>
                </div>
            </div>

            {/* In Progress Entries */}
            {entries.filter(e => !e.horaEgreso).length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-slate-700"><Activity className="w-5 h-5 text-emerald-500" /> Jornadas en curso</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {entries.filter(e => !e.horaEgreso).map(entry => (
                            <div key={entry.id} className="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Clock className="w-24 h-24" />
                                </div>
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div className="space-y-1 mb-6">
                                        <h4 className="font-extrabold text-emerald-900 text-lg">{entry.operator.nombreCompleto}</h4>
                                        <p className="text-sm font-bold text-emerald-700 uppercase tracking-tighter truncate">{entry.project.nombre}</p>
                                        <p className="text-xs font-bold text-emerald-600/70">{entry.fecha} | Ingreso: {entry.horaIngreso}hs</p>
                                    </div>
                                    <button
                                        onClick={() => handleClockOut(entry.id)}
                                        className="w-full bg-rose-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Square className="w-4 h-4 fill-current" />
                                        Finalizar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Past Entries / Reports Content */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm relative">
                <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-slate-800 text-lg">Historial y Reportes</h3>

                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value as any)}
                            className="bg-slate-50 border border-slate-200 rounded-2xl h-[50px] px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700 text-sm appearance-none cursor-pointer"
                        >
                            <option value="tarjetas">Vista Detallada (Tarjetas)</option>
                            <option value="planilla">Formato Planilla</option>
                            <option value="resumen">Resumen Rápido</option>
                        </select>
                    </div>
                </div>

                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desde:</label>
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={e => setFilterDateFrom(e.target.value)}
                            className="h-[50px] bg-white border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hasta:</label>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={e => setFilterDateTo(e.target.value)}
                            className="h-[50px] bg-white border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                        />
                    </div>
                    {currentUser?.role !== 'operador' && (
                        <div className="flex items-center gap-2 min-w-[200px]">
                            <SearchableSelect
                                label="Filtrar Operador"
                                options={activeOperators.map(op => ({ id: op.id, label: op.nombreCompleto }))}
                                value={filterOperator}
                                onChange={setFilterOperator}
                                placeholder="Todos"
                                className="!space-y-1 w-full"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2 min-w-[200px]">
                        <SearchableSelect
                            label="Filtrar Proyecto"
                            options={activeProjects.map(p => ({ id: p.nombre, label: p.nombre }))}
                            value={filterProject}
                            onChange={setFilterProject}
                            placeholder="Todos"
                            className="!space-y-1 w-full"
                        />
                    </div>

                    {currentUser?.role !== 'operador' && (
                        <button
                            onClick={exportToExcel}
                            className="ml-auto bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold py-2 px-4 rounded-xl shadow-sm transition-colors flex items-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Exportar a Excel
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    {viewMode === 'tarjetas' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Horario</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Horas</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCompleted.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">No hay registros completados</td>
                                    </tr>
                                ) : (
                                    filteredCompleted.map(entry => (
                                        <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors [&>td]:align-middle">
                                            <td className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight whitespace-nowrap">{formatEntryDate(entry.fecha)}</td>
                                            <td className="p-4 text-sm font-black text-primary">{entry.operator.nombreCompleto}</td>
                                            <td className="p-4">
                                                <div className="text-xs font-bold text-slate-600 truncate max-w-[200px]" title={entry.project.nombre}>
                                                    {entry.project.nombre}
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-500 text-center">
                                                {entry.horaIngreso} - {entry.horaEgreso}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 font-black rounded-xl text-sm border border-indigo-100">{entry.horasTrabajadas}h</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                {entry.isExtra ? (
                                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md">EXTRA</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md">NORMAL</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {entry.estadoConfirmado ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">
                                                        <CheckCircle2 className="w-3 h-3" /> Confirmado
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleConfirmDay(entry.id)}
                                                        className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-500 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                                                    >
                                                        <ShieldAlert className="w-3 h-3" /> Pendiente
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-4 flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(entry)}
                                                    className={`p-2 rounded-xl transition-all ${entry.estadoConfirmado ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'}`}
                                                    title={entry.estadoConfirmado ? "Requiere Clave Supervisor" : "Editar"}
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(entry)}
                                                    className={`p-2 rounded-xl transition-all ${entry.estadoConfirmado ? 'text-amber-500 hover:bg-amber-50' : 'text-rose-400 hover:bg-rose-50 hover:text-rose-600'}`}
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
                    )}

                    {viewMode === 'planilla' && (
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Obra</th>
                                    <th className="p-4 border-l border-slate-200 text-center bg-indigo-50/30 text-[10px] font-black text-indigo-400 uppercase tracking-widest" colSpan={3}>Normales</th>
                                    <th className="p-4 border-l border-slate-200 text-center bg-amber-50/30 text-[10px] font-black text-amber-400 uppercase tracking-widest" colSpan={3}>Extras</th>
                                </tr>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th colSpan={3}></th>
                                    <th className="p-2 border-l border-slate-200 text-center text-xs font-bold text-slate-500">Inicio</th>
                                    <th className="p-2 text-center text-xs font-bold text-slate-500">Fin</th>
                                    <th className="p-2 text-center text-xs font-black text-slate-800">Subtotal</th>
                                    <th className="p-2 border-l border-slate-200 text-center text-xs font-bold text-slate-500">Inicio</th>
                                    <th className="p-2 text-center text-xs font-bold text-slate-500">Fin</th>
                                    <th className="p-2 text-center text-xs font-black text-slate-800">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedPlanilla.length === 0 ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-slate-400 font-bold text-sm uppercase">Sin resultados</td></tr>
                                ) : (
                                    groupedPlanilla.map((row: any) => (
                                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 [&>td]:align-middle">
                                            <td className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight whitespace-nowrap">{formatEntryDate(row.fecha)}</td>
                                            <td className="p-4 text-sm font-black text-primary">{row.operatorName}</td>
                                            <td className="p-4 text-xs font-bold text-slate-600 truncate max-w-[200px]" title={row.projectName}>{row.projectName}</td>
                                            <td className="p-4 border-l border-slate-100 text-center text-xs text-slate-500">{row.normalStart}</td>
                                            <td className="p-4 text-center text-xs text-slate-500">{row.normalEnd}</td>
                                            <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/30">{row.normalTotal > 0 ? `${row.normalTotal}h` : '-'}</td>
                                            <td className="p-4 border-l border-slate-100 text-center text-xs text-slate-500">{row.extraStart}</td>
                                            <td className="p-4 text-center text-xs text-slate-500">{row.extraEnd}</td>
                                            <td className="p-4 text-center font-black text-amber-600 bg-amber-50/30">{row.extraTotal > 0 ? `${row.extraTotal}h` : '-'}</td>
                                        </tr>
                                    ))
                                )}
                                {groupedPlanilla.length > 0 && (
                                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                                        <td colSpan={5} className="p-4 text-right text-xs font-black text-slate-700 uppercase tracking-widest">Total Global Filtrado:</td>
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
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Operador</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Normales</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Extras</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Día</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedResumen.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold text-sm uppercase">Sin resultados</td></tr>
                                ) : (
                                    groupedResumen.map((row: any) => (
                                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 [&>td]:align-middle">
                                            <td className="p-4 text-xs font-bold text-slate-700 uppercase tracking-tight">{formatEntryDate(row.fecha)}</td>
                                            <td className="p-4 text-sm font-black text-primary">{row.operatorName}</td>
                                            <td className="p-4 text-right font-black text-indigo-600">{row.normalTotal > 0 ? `${row.normalTotal}h` : '-'}</td>
                                            <td className="p-4 text-right font-black text-amber-600">{row.extraTotal > 0 ? `${row.extraTotal}h` : '-'}</td>
                                            <td className="p-4 text-right font-black text-slate-800 bg-slate-50/50">{row.normalTotal + row.extraTotal}h</td>
                                        </tr>
                                    ))
                                )}
                                {groupedResumen.length > 0 && (
                                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                                        <td colSpan={2} className="p-4 text-right text-xs font-black text-slate-700 uppercase tracking-widest">Total Global Filtrado:</td>
                                        <td className="p-4 text-right font-black text-indigo-700">{totalFilteredNormales > 0 ? `${totalFilteredNormales}h` : '-'}</td>
                                        <td className="p-4 text-right font-black text-amber-700">{totalFilteredExtras > 0 ? `${totalFilteredExtras}h` : '-'}</td>
                                        <td className="p-4 text-right font-black text-slate-800">{totalFilteredNormales + totalFilteredExtras}h</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal de Carga Manual / Edición */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300 max-h-[95vh] flex flex-col overflow-hidden">
                        {/* Header - Fixed */}
                        <div className="p-7 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingEntry ? 'Editar Registro de Tiempo' : 'Nuevo Registro de Tiempo'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitForm} className="flex-1 flex flex-col min-h-0">
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-7 space-y-6 custom-scrollbar">
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
                                            options={operators.map(op => ({ id: op.id, label: op.nombreCompleto }))}
                                            value={formData.operatorId}
                                            onChange={(val) => setFormData({ ...formData, operatorId: val })}
                                            placeholder="Seleccionar operador..."
                                            disabled={!!editingEntry || currentUser?.role === 'operador'}
                                        />
                                    </div>

                                    {/* Proyecto */}
                                    <div className="space-y-2 md:col-span-2">
                                        <SearchableSelect
                                            label="Proyecto"
                                            options={activeProjects.map(p => ({ id: p.id, label: p.nombre }))}
                                            value={formData.projectId}
                                            onChange={(val) => setFormData({ ...formData, projectId: val })}
                                            placeholder="Seleccionar proyecto..."
                                        />
                                    </div>

                                    {/* Fecha */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Fecha</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                                            required
                                            value={formData.fecha}
                                            onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                                        />
                                    </div>

                                    {/* Hora Ingreso */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Hora Inicio</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                                            required
                                            value={formData.horaIngreso}
                                            onChange={e => setFormData({ ...formData, horaIngreso: e.target.value })}
                                        />
                                    </div>

                                    {/* Hora Egreso */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Hora Fin</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                                            required
                                            value={formData.horaEgreso}
                                            onChange={e => setFormData({ ...formData, horaEgreso: e.target.value })}
                                        />
                                    </div>

                                    {/* Horas Extras */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">¿Son Horas Extras?</label>
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, isExtra: false })}
                                                className={`flex-1 py-3 px-4 rounded-2xl font-bold transition-colors ${!formData.isExtra ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-slate-50 text-slate-500 border-2 border-slate-200'}`}
                                            >
                                                No, Normales
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, isExtra: true })}
                                                className={`flex-1 py-3 px-4 rounded-2xl font-bold transition-colors ${formData.isExtra ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-slate-50 text-slate-500 border-2 border-slate-200'}`}
                                            >
                                                Sí, Extras
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer - Fixed */}
                            <div className="p-7 border-t border-slate-100 flex gap-3 flex-shrink-0">
                                <button type="button" onClick={() => { setIsModalOpen(false); }} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-indigo-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">Guardar Registro</button>
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
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-500">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <button onClick={() => { setIsRequestModalOpen(false); setPendingAction(null); setRequestMessage(''); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-2">Solicitar {pendingAction?.type === 'request_deletion' ? 'Eliminación' : 'Modificación'}</h3>
                        <p className="text-slate-500 text-sm font-medium mb-6">Este registro ya fue confirmado. Por favor, indica el motivo para solicitar la modificación a tus supervisores.</p>
                        <form onSubmit={submitModificationRequest} className="space-y-6">
                            {pendingAction?.type === 'request_modification' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Hora Inicio Sugerida</label>
                                            <input
                                                type="time"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                                                required
                                                value={formData.horaIngreso}
                                                onChange={e => setFormData({ ...formData, horaIngreso: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Hora Fin Sugerida</label>
                                            <input
                                                type="time"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                                                required
                                                value={formData.horaEgreso}
                                                onChange={e => setFormData({ ...formData, horaEgreso: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">¿Son Horas Extras?</label>
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, isExtra: false })}
                                                className={`flex-1 py-3 px-4 rounded-2xl font-bold transition-colors ${!formData.isExtra ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-slate-50 text-slate-500 border-2 border-slate-200'}`}
                                            >
                                                No
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, isExtra: true })}
                                                className={`flex-1 py-3 px-4 rounded-2xl font-bold transition-colors ${formData.isExtra ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-slate-50 text-slate-500 border-2 border-slate-200'}`}
                                            >
                                                Sí
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Motivo / Detalles</label>
                                <textarea
                                    required
                                    autoFocus
                                    placeholder="Explica qué necesitas cambiar y por qué..."
                                    value={requestMessage}
                                    onChange={e => setRequestMessage(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 resize-none h-24 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-700 transition-all text-sm"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setIsRequestModalOpen(false); setPendingAction(null); setRequestMessage(''); }} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95">Cancelar</button>
                                <button type="submit" className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95 bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20">Enviar Solicitud</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
