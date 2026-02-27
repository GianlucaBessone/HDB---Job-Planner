'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Clock, Calendar, User, Layout, CheckCircle2, ShieldAlert, Plus, Trash2, Edit3, X, AlertCircle, Activity } from 'lucide-react';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';

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
}

export default function TimesheetsPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Quick Actions State
    const [selectedOperator, setSelectedOperator] = useState('');
    const [selectedProject, setSelectedProject] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
    const [formData, setFormData] = useState({
        operatorId: '',
        projectId: '',
        fecha: new Date().toISOString().split('T')[0],
        horaIngreso: '',
        horaEgreso: ''
    });

    const [adminPin, setAdminPin] = useState('');
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<any>(null);

    // Confirm dialog
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [entriesData, projectsData, operatorsData] = await Promise.all([
                fetch('/api/time-entries').then(res => res.json()),
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
            alert('Por favor selecciona operador y proyecto para iniciar jornada.');
            return;
        }

        // Check if operator already has an open entry today
        const today = new Date().toISOString().split('T')[0];
        const hasOpen = entries.find(e => e.operatorId === selectedOperator && e.fecha === today && !e.horaEgreso);
        if (hasOpen) {
            alert('El operador ya tiene una jornada iniciada sin finalizar hoy.');
            return;
        }

        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);

        try {
            await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operatorId: selectedOperator,
                    projectId: selectedProject,
                    fecha: today,
                    horaIngreso: timeString,
                    horaEgreso: null
                })
            });
            loadData();
            setSelectedOperator('');
            setSelectedProject('');
        } catch (error) {
            console.error(error);
        }
    };

    const handleClockOut = async (id: string, requiresPin = false) => {
        if (requiresPin) {
            setPendingAction({ type: 'clockOut', id });
            setIsPinModalOpen(true);
            return;
        }

        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);

        try {
            const res = await fetch('/api/time-entries', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    horaEgreso: timeString,
                    adminPin: pendingAction?.type === 'clockOut' ? adminPin : undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.error);
                return;
            }

            setIsPinModalOpen(false);
            setAdminPin('');
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
                body: JSON.stringify({ id, estadoConfirmado: true })
            });
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const openEditModal = (entry?: TimeEntry) => {
        if (entry && entry.estadoConfirmado) {
            setPendingAction({ type: 'edit', entry });
            setIsPinModalOpen(true);
            return;
        }

        if (entry) {
            setEditingEntry(entry);
            setFormData({
                operatorId: entry.operatorId,
                projectId: entry.projectId,
                fecha: entry.fecha,
                horaIngreso: entry.horaIngreso || '',
                horaEgreso: entry.horaEgreso || ''
            });
        } else {
            setEditingEntry(null);
            setFormData({
                operatorId: '',
                projectId: '',
                fecha: new Date().toISOString().split('T')[0],
                horaIngreso: '',
                horaEgreso: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.horaIngreso && formData.horaEgreso) {
            if (formData.horaEgreso < formData.horaIngreso) {
                alert('La hora de egreso no puede ser menor a la de ingreso');
                return;
            }
        }

        try {
            const payload: any = { ...formData };
            if (adminPin) payload.adminPin = adminPin;

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
                alert(errorData.error);
                return;
            }

            setIsModalOpen(false);
            setAdminPin('');
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteClick = (entry: TimeEntry) => {
        if (entry.estadoConfirmado) {
            setPendingAction({ type: 'delete', id: entry.id });
            setIsPinModalOpen(true);
            return;
        }
        setEntryToDelete(entry.id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        const id = entryToDelete || pendingAction?.id;
        if (!id) return;
        try {
            let url = `/api/time-entries?id=${id}`;
            if (adminPin) url += `&adminPin=${adminPin}`;

            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error);
                return;
            }

            loadData();
            setIsConfirmOpen(false);
            setEntryToDelete(null);
            setIsPinModalOpen(false);
            setAdminPin('');
            setPendingAction(null);
        } catch (error) {
            console.error(error);
        }
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pendingAction?.type === 'edit') {
            setIsPinModalOpen(false);
            setEditingEntry(pendingAction.entry);
            setFormData({
                operatorId: pendingAction.entry.operatorId,
                projectId: pendingAction.entry.projectId,
                fecha: pendingAction.entry.fecha,
                horaIngreso: pendingAction.entry.horaIngreso || '',
                horaEgreso: pendingAction.entry.horaEgreso || ''
            });
            setIsModalOpen(true);
        } else if (pendingAction?.type === 'delete') {
            confirmDelete();
        } else if (pendingAction?.type === 'clockOut') {
            handleClockOut(pendingAction.id);
        }
    };

    // Derived Data
    const activeProjects = projects.filter(p => !['finalizado', 'por_hacer'].includes(p.estado));
    const activeOperators = operators;

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
            <div className="bg-white border border-slate-200 shadow-sm p-6 md:p-8 rounded-[2.5rem] flex flex-col md:flex-row items-end md:items-center gap-4 md:gap-8">
                <div className="w-full md:w-1/3 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <User className="w-3 h-3" /> Operador
                    </label>
                    <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                        value={selectedOperator}
                        onChange={(e) => setSelectedOperator(e.target.value)}
                    >
                        <option value="">— Seleccionar —</option>
                        {activeOperators.map(op => <option key={op.id} value={op.id}>{op.nombreCompleto}</option>)}
                    </select>
                </div>

                <div className="w-full md:w-1/3 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Layout className="w-3 h-3" /> Proyecto Activo
                    </label>
                    <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                    >
                        <option value="">— Seleccionar —</option>
                        {activeProjects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>

                <div className="w-full md:w-auto pt-4 md:pt-0 shrink-0">
                    <button
                        onClick={handleClockIn}
                        disabled={!selectedOperator || !selectedProject}
                        className="w-full md:w-auto bg-emerald-500 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all justify-center"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Iniciar Jornada
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

            {/* Past Entries List */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-lg">Historial de Registros</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Horario</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Horas</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.filter(e => e.horaEgreso).length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">No hay registros completados</td>
                                </tr>
                            ) : (
                                entries.filter(e => e.horaEgreso).map(entry => (
                                    <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-xs font-bold text-slate-600">{entry.fecha}</td>
                                        <td className="p-4 text-sm font-bold text-primary">{entry.operator.nombreCompleto}</td>
                                        <td className="p-4 text-xs font-bold text-slate-600 line-clamp-1 truncate max-w-[200px]">{entry.project.nombre}</td>
                                        <td className="p-4 text-xs font-bold text-slate-500 text-center">
                                            {entry.horaIngreso} - {entry.horaEgreso}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 font-black rounded-xl text-sm border border-indigo-100">{entry.horasTrabajadas}h</span>
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
                </div>
            </div>

            {/* Modal de Carga Manual / Edición */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300">
                        <form onSubmit={handleSubmitForm} className="p-8 md:p-10 space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <Clock className="w-6 h-6 text-indigo-500" />
                                    {editingEntry ? 'Editar Registro' : 'Carga Manual'}
                                </h3>
                                <button type="button" onClick={() => { setIsModalOpen(false); setAdminPin(''); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X className="w-5 h-5" /></button>
                            </div>

                            {/* Alerta si está editando un registro confirmado (ya ingresó la clave) */}
                            {editingEntry?.estadoConfirmado && (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                                    <p className="text-xs font-bold text-amber-800">Modificando registro confirmado mediante override de supervisor.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Operador */}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Operador</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                                        required
                                        value={formData.operatorId}
                                        onChange={e => setFormData({ ...formData, operatorId: e.target.value })}
                                        disabled={!!editingEntry} // Usualmente no se cambia el operador de un registro, pero por si acaso.
                                    >
                                        <option value="">— Seleccionar —</option>
                                        {operators.map(op => <option key={op.id} value={op.id}>{op.nombreCompleto}</option>)}
                                    </select>
                                </div>

                                {/* Proyecto */}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Proyecto</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700"
                                        required
                                        value={formData.projectId}
                                        onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                                        disabled={!!editingEntry && editingEntry.estadoConfirmado} // Si está firmado no conviene cambiar el proyecto sin más
                                    >
                                        <option value="">— Seleccionar —</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
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
                                        disabled={!!editingEntry && editingEntry.estadoConfirmado}
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
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button type="button" onClick={() => { setIsModalOpen(false); setAdminPin(''); }} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-indigo-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">Guardar Registro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal PIN Supervisor */}
            {isPinModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 rounded-2xl bg-amber-50 text-amber-500">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <button onClick={() => { setIsPinModalOpen(false); setPendingAction(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight mb-2">Autorización Requerida</h3>
                        <p className="text-slate-500 text-sm font-medium mb-6">Esta acción afecta un registro confirmado. Ingrese el PIN de supervisor para continuar.</p>
                        <form onSubmit={handlePinSubmit} className="space-y-6">
                            <input
                                type="password"
                                placeholder="PIN"
                                autoFocus
                                required
                                value={adminPin}
                                onChange={e => setAdminPin(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-center tracking-widest text-2xl font-black outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all"
                            />
                            <button type="submit" className="w-full px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95 bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20">Autorizar</button>
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
        </div>
    );
}
