'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Clock,
    Calendar,
    User,
    Building2,
    AlertCircle,
    Plus,
    Trash2,
    History,
    Search,
    ArrowLeft,
    Timer,
    Info,
    Layout,
    FileSpreadsheet,
    LayoutGrid,
    X,
    Edit2
} from 'lucide-react';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import * as XLSX from 'xlsx';
import SearchableSelect from '@/components/SearchableSelect';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Project {
    id: string;
    nombre: string;
    clientId?: string;
    client?: { id: string; nombre: string };
}

interface ClientDelay {
    id: string;
    projectId: string;
    project: Project;
    fecha: string;
    hora: string;
    operador: string;
    area: string;
    responsableArea?: string;
    motivo: string;
    duracion: number;
}

const AREAS = ['Control Documentario', 'Calidad', 'Compras', 'IT', 'Producción', 'Logística', 'Seguridad', 'MAPHI', 'Portería', 'Mantenimiento', 'Ingeniería', 'Gerencia', 'Otro'];

export default function DelaysPage() {
    const [delays, setDelays] = useState<ClientDelay[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<{ nombreCompleto: string }[]>([]);
    const [clients, setClients] = useState<{ id: string; nombre: string }[]>([]);
    const [areaOptions, setAreaOptions] = useState<string[]>([]);
    const [motivoOptions, setMotivoOptions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [viewMode, setViewMode] = useState<'tarjetas' | 'tabla'>('tabla');
    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [filterClientId, setFilterClientId] = useState('');
    const [filterProjectId, setFilterProjectId] = useState('');

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [delayToDelete, setDelayToDelete] = useState<string | null>(null);
    const [editingDelayId, setEditingDelayId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        projectId: '',
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().slice(0, 5),
        operador: '',
        area: '',
        responsableArea: '',
        motivo: '',
        duracion: 0
    });

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                setCurrentUser(user);
                setFormData(prev => ({ ...prev, operador: user.nombreCompleto }));
            } catch (e) { }
        }
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [delaysData, projectsData, operatorsData, clientsData, configOptions] = await Promise.all([
                fetch('/api/delays').then(res => res.json()),
                fetch('/api/projects').then(res => res.json()),
                fetch('/api/operators').then(res => res.json()),
                fetch('/api/clients').then(res => res.json()),
                fetch('/api/config/options').then(res => res.json())
            ]);
            setDelays(Array.isArray(delaysData) ? delaysData : []);
            setProjects(Array.isArray(projectsData) ? projectsData : []);
            setOperators(Array.isArray(operatorsData) ? operatorsData : []);
            setClients(Array.isArray(clientsData) ? clientsData : []);

            if (Array.isArray(configOptions)) {
                setAreaOptions(configOptions.filter((o: any) => o.category === 'AREA_DEMORA' && o.active).map((o: any) => o.value));
                setMotivoOptions(configOptions.filter((o: any) => o.category === 'MOTIVO_DEMORA' && o.active).map((o: any) => o.value));
            }
        } catch (error) {
            console.error('Error loading delays data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = editingDelayId ? 'PATCH' : 'POST';
            const url = editingDelayId ? `/api/delays?id=${editingDelayId}` : '/api/delays';

            await fetch(url, {
                method,
                body: JSON.stringify({
                    ...formData,
                    duracion: Number(formData.duracion) || 0
                })
            });
            setIsModalOpen(false);
            setEditingDelayId(null);
            setFormData(prev => ({ ...prev, projectId: '', motivo: '', duracion: 0, area: '', responsableArea: '' }));
            loadData();
        } catch (error) {
            console.error('Error saving delay:', error);
        }
    };

    const handleEditClick = (delay: ClientDelay) => {
        setEditingDelayId(delay.id);
        setFormData({
            projectId: delay.projectId,
            fecha: delay.fecha,
            hora: delay.hora,
            operador: delay.operador,
            area: delay.area,
            responsableArea: delay.responsableArea || '',
            motivo: delay.motivo,
            duracion: delay.duracion
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setDelayToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!delayToDelete) return;
        try {
            await fetch(`/api/delays?id=${delayToDelete}`, { method: 'DELETE' });
            loadData();
            setIsConfirmOpen(false);
            setDelayToDelete(null);
        } catch (error) {
            console.error('Error deleting delay:', error);
        }
    };

    const filteredDelays = useMemo(() => {
        return delays.filter(d => {
            const search = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                d.project.nombre.toLowerCase().includes(search) ||
                d.motivo.toLowerCase().includes(search) ||
                d.area.toLowerCase().includes(search) ||
                d.operador.toLowerCase().includes(search);
            const matchesDateFrom = !filterDateFrom || d.fecha >= filterDateFrom;
            const matchesDateTo = !filterDateTo || d.fecha <= filterDateTo;
            const matchesClient = !filterClientId || d.project.clientId === filterClientId;
            const matchesProject = !filterProjectId || d.projectId === filterProjectId;
            return matchesSearch && matchesDateFrom && matchesDateTo && matchesClient && matchesProject;
        });
    }, [delays, searchTerm, filterDateFrom, filterDateTo, filterClientId, filterProjectId]);

    const totalHours = filteredDelays.reduce((sum, d) => sum + d.duracion, 0);

    const exportToExcel = () => {
        const aoa: any[][] = [['Fecha', 'Hora', 'Proyecto', 'Operador', 'Área Cliente', 'Responsable Área', 'Motivo', 'Duración (Hs)']];
        filteredDelays.forEach(d => {
            aoa.push([d.fecha, d.hora, d.project.nombre, d.operador, d.area, d.responsableArea || '-', d.motivo, d.duracion]);
        });
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Demoras Cliente');
        XLSX.writeFile(wb, `Demoras_Cliente_${filterDateFrom}_${filterDateTo}.xlsx`);
    };

    const formatDate = (dateStr: string) => {
        try { return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: es }); }
        catch { return dateStr; }
    };

    const hasActiveFilters = !!(filterClientId || filterProjectId || searchTerm);

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Link href="/projects" className="hover:text-primary transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
                            <ArrowLeft className="w-3 h-3" /> Regresar a Proyectos
                        </Link>
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <Timer className="w-8 h-8 text-amber-500" />
                        Demoras del Cliente
                    </h2>
                    <p className="text-slate-500 font-medium italic">Registro de tiempos externos para análisis de causa raíz</p>
                </div>
                <button
                    onClick={() => {
                        setEditingDelayId(null);
                        setFormData(prev => ({ ...prev, projectId: '', motivo: '', duracion: 0, area: '', responsableArea: '' }));
                        setIsModalOpen(true);
                    }}
                    className="bg-amber-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-amber-600 shadow-xl shadow-amber-500/20 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" /> Registrar Demora
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-100 rounded-3xl p-4 md:p-5 flex items-center gap-4 text-amber-800">
                <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
                    <Info className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-sm font-medium leading-relaxed">
                    Estos registros representan tiempos muertos atribuidos al cliente.
                    <strong> No afectan el IPT ni el ahorro de horas operativo</strong>, se analizan por separado para reportes de responsabilidad.
                </p>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-slate-700">Historial de Registros</h3>
                        <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest">
                            {filteredDelays.length} registros · {totalHours.toFixed(1)}h
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* View Toggle */}
                        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                            <button
                                onClick={() => setViewMode('tabla')}
                                title="Vista Tabla"
                                className={`p-2 rounded-lg transition-all ${viewMode === 'tabla' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setViewMode('tarjetas')}
                                title="Vista Tarjetas"
                                className={`p-2 rounded-lg transition-all ${viewMode === 'tarjetas' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={exportToExcel}
                            className="bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors flex items-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                        </button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="p-4 md:p-5 bg-slate-50/60 border-b border-slate-100 flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full h-[50px] bg-white border border-slate-200 rounded-2xl pl-10 pr-4 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-700"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Desde</label>
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                            className="h-[50px] bg-white border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none" />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Hasta</label>
                        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                            className="h-[50px] bg-white border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none" />
                    </div>

                    <div className="min-w-[160px]">
                        <SearchableSelect
                            options={clients.map(c => ({ id: c.id, label: c.nombre }))}
                            value={filterClientId}
                            onChange={setFilterClientId}
                            placeholder="Todos los clientes"
                            className="!space-y-0"
                        />
                    </div>

                    <div className="min-w-[160px]">
                        <SearchableSelect
                            options={projects.map(p => ({ id: p.id, label: p.nombre }))}
                            value={filterProjectId}
                            onChange={setFilterProjectId}
                            placeholder="Todos los proyectos"
                            className="!space-y-0"
                        />
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={() => { setFilterClientId(''); setFilterProjectId(''); setSearchTerm(''); }}
                            className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline h-10 px-2"
                        >
                            <X className="w-3 h-3" /> Limpiar
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-8 space-y-3">
                            {Array(4).fill(0).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
                        </div>
                    ) : filteredDelays.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                            <Clock className="w-12 h-12 mb-4 opacity-10" />
                            <p className="font-bold uppercase tracking-widest text-xs">Sin registros que coincidan</p>
                        </div>
                    ) : viewMode === 'tabla' ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Área</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">Resp. Área</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Operador</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Duración</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDelays.map(delay => (
                                    <tr key={delay.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                                        <td className="p-4 text-xs font-bold text-slate-500 whitespace-nowrap">{formatDate(delay.fecha)}</td>
                                        <td className="p-4 text-sm font-black text-slate-800 max-w-[200px] truncate">{delay.project.nombre}</td>
                                        <td className="p-4">
                                            <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-1 rounded-lg uppercase tracking-widest whitespace-nowrap">{delay.area}</span>
                                        </td>
                                        <td className="p-4 text-xs font-medium text-slate-500 italic max-w-[250px] truncate" title={delay.motivo}>"{delay.motivo}"</td>
                                        <td className="p-4 text-xs font-bold text-slate-400 hidden lg:table-cell">{delay.responsableArea || '—'}</td>
                                        <td className="p-4 text-xs font-bold text-primary hidden md:table-cell">{delay.operador}</td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 bg-amber-50 text-amber-600 font-black rounded-xl text-sm border border-amber-100">{delay.duracion}h</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
                                                    <button onClick={() => handleEditClick(delay)} className="p-2 rounded-xl text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDeleteClick(delay.id)} className="p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                                    <td colSpan={6} className="p-4 text-right text-[10px] uppercase tracking-widest text-slate-500">Total Horas en Rango:</td>
                                    <td className="p-4 text-center text-amber-600 text-base font-black">{totalHours.toFixed(1)}h</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    ) : (
                        /* Card Grid View */
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredDelays.map(delay => (
                                <div key={delay.id} className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-all group">
                                    <div className="flex items-start gap-3 justify-between">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                                <Building2 className="w-5 h-5 text-amber-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-slate-800 text-sm leading-tight truncate">{delay.project.nombre}</h4>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-slate-400">{formatDate(delay.fecha)} · {delay.hora}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
                                                <button onClick={() => handleEditClick(delay)} className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button onClick={() => handleDeleteClick(delay.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-1 rounded-lg uppercase tracking-widest w-fit">{delay.area}</span>
                                    <div className="bg-slate-50 px-3 py-2.5 rounded-xl">
                                        <p className="text-xs font-medium text-slate-600 italic line-clamp-2">"{delay.motivo}"</p>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                {delay.operador.charAt(0)}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">{delay.operador}</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-amber-500 tracking-tighter">{delay.duracion}</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Hs</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300 max-h-[95vh] flex flex-col overflow-hidden">
                        {/* Header - Fixed */}
                        <div className="p-8 md:p-10 pb-4 flex items-center justify-between border-b border-slate-50 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                                    <Timer className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                                        {editingDelayId ? 'Editar Registro' : 'Registrar Demora'}
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Responsabilidad del Cliente</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => { setIsModalOpen(false); setEditingDelayId(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-8 md:p-10 pt-6 space-y-6 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Proyecto */}
                                    <div className="md:col-span-2">
                                        <SearchableSelect
                                            label="Proyecto afectado"
                                            icon={<Layout className="w-3 h-3" />}
                                            options={projects.map(p => ({ id: p.id, label: p.nombre }))}
                                            value={formData.projectId}
                                            onChange={(val) => setFormData({ ...formData, projectId: val })}
                                            placeholder="Buscar proyecto..."
                                            className="!space-y-0"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Calendar className="w-3 h-3" /> Fecha
                                        </label>
                                        <input type="date" required value={formData.fecha}
                                            onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700 h-[50px]"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> Hora
                                        </label>
                                        <input type="time" required value={formData.hora}
                                            onChange={e => setFormData({ ...formData, hora: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700 h-[50px]"
                                        />
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Motivo Frecuente</label>
                                            <SearchableSelect
                                                options={motivoOptions.map(m => ({ id: m, label: m }))}
                                                value={motivoOptions.includes(formData.motivo) ? formData.motivo : ''}
                                                onChange={(val) => setFormData({ ...formData, motivo: val })}
                                                placeholder="Seleccionar motivo predefinido..."
                                                className="!space-y-0"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Detalle / Motivo Específico</label>
                                            <textarea required value={formData.motivo} onChange={e => setFormData({ ...formData, motivo: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700 min-h-[50px] max-h-[150px]"
                                                placeholder="Describe o amplía el motivo de la demora..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <User className="w-3 h-3" /> Quien registra
                                        </label>
                                        {currentUser?.role === 'operador' ? (
                                            <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl py-3 px-4 font-bold text-slate-500 h-[50px] flex items-center">
                                                {formData.operador}
                                            </div>
                                        ) : (
                                            <SearchableSelect
                                                options={operators.map(op => ({ id: op.nombreCompleto, label: op.nombreCompleto }))}
                                                value={formData.operador}
                                                onChange={(val) => setFormData({ ...formData, operador: val })}
                                                placeholder="Seleccionar operador..."
                                                className="!space-y-0"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Building2 className="w-3 h-3" /> Área del Cliente
                                        </label>
                                        <SearchableSelect
                                            options={(areaOptions.length > 0 ? areaOptions : AREAS).map(a => ({ id: a, label: a }))}
                                            value={formData.area}
                                            onChange={(val) => setFormData({ ...formData, area: val })}
                                            placeholder="Seleccionar área..."
                                            className="!space-y-0"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <User className="w-3 h-3" /> Responsable del Área (Opcional)
                                        </label>
                                        <input type="text" value={formData.responsableArea}
                                            onChange={e => setFormData({ ...formData, responsableArea: e.target.value })}
                                            placeholder="Nombre del responsable si lo conoce..."
                                            className="w-full h-[50px] bg-slate-50 border border-slate-200 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700 text-sm rounded-2xl"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <AlertCircle className="w-3 h-3" /> Motivo de la demora
                                        </label>
                                        <textarea required value={formData.motivo}
                                            onChange={e => setFormData({ ...formData, motivo: e.target.value })}
                                            placeholder="Describa el motivo de la demora externa..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-medium text-slate-700 resize-none h-24"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Timer className="w-3 h-3" /> Tiempo perdido (Horas)
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input type="range" min="0" max="24" step="0.25"
                                                className="flex-1 accent-amber-500"
                                                value={formData.duracion}
                                                onChange={e => setFormData({ ...formData, duracion: parseFloat(e.target.value) })}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="24"
                                                step="0.25"
                                                value={formData.duracion}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        setFormData({ ...formData, duracion: '' as any });
                                                        return;
                                                    }
                                                    const v = parseFloat(val);
                                                    if (!isNaN(v)) {
                                                        setFormData({ ...formData, duracion: v });
                                                    }
                                                }}
                                                onBlur={() => {
                                                    const v = parseFloat(formData.duracion as any);
                                                    if (!isNaN(v)) {
                                                        const rounded = Math.round(v * 4) / 4;
                                                        setFormData({ ...formData, duracion: Math.max(0, Math.min(24, rounded)) });
                                                    } else {
                                                        setFormData({ ...formData, duracion: 0 });
                                                    }
                                                }}
                                                className="w-24 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3 text-xl font-black text-amber-500 text-center outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 shrink-0"
                                            />
                                            <span className="text-xs font-black text-amber-600 uppercase shrink-0">Hs</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium pl-1">Ajuste en tramos de 15 minutos (0.25h)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 p-8 md:p-10 border-t border-slate-50 flex-shrink-0">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95">
                                    Cancelar
                                </button>
                                <button type="submit"
                                    className="flex-[2] bg-amber-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-600 shadow-xl shadow-amber-500/20 transition-all active:scale-95">
                                    {editingDelayId ? 'Guardar Cambios' : 'Registrar Evento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Registro de Demora"
                message="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                onConfirm={confirmDelete}
                onCancel={() => { setIsConfirmOpen(false); setDelayToDelete(null); }}
            />
        </div>
    );
}
