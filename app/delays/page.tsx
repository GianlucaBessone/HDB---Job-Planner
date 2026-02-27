'use client';

import { useState, useEffect } from 'react';
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
    ChevronRight,
    ArrowLeft,
    Timer,
    Info,
    Layout
} from 'lucide-react';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Project {
    id: string;
    nombre: string;
}

interface ClientDelay {
    id: string;
    projectId: string;
    project: Project;
    fecha: string;
    hora: string;
    operador: string;
    area: string;
    motivo: string;
    duracion: number;
}

const AREAS = ['Control Documentario', 'Calidad', 'Compras', 'IT', 'Producción', 'Logística', 'Seguridad', 'Otro'];

export default function DelaysPage() {
    const [delays, setDelays] = useState<ClientDelay[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [operators, setOperators] = useState<{ nombreCompleto: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Custom Confirm Dialog State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [delayToDelete, setDelayToDelete] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        projectId: '',
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().slice(0, 5),
        operador: '',
        area: '',
        motivo: '',
        duracion: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [delaysData, projectsData, operatorsData] = await Promise.all([
                fetch('/api/delays').then(res => res.json()),
                fetch('/api/projects').then(res => res.json()),
                fetch('/api/operators').then(res => res.json())
            ]);
            setDelays(Array.isArray(delaysData) ? delaysData : []);
            setProjects(Array.isArray(projectsData) ? projectsData : []);
            setOperators(Array.isArray(operatorsData) ? operatorsData : []);
        } catch (error) {
            console.error('Error loading delays data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch('/api/delays', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            setIsModalOpen(false);
            setFormData({
                ...formData,
                motivo: '',
                duracion: 0,
                area: ''
            });
            loadData();
        } catch (error) {
            console.error('Error saving delay:', error);
        }
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

    const filteredDelays = delays.filter(d =>
        d.project.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.motivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.area.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Link href="/projects" className="hover:text-primary transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
                            <ArrowLeft className="w-3 h-3" />
                            Gestión de Proyectos
                        </Link>
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <Timer className="w-8 h-8 text-amber-500" />
                        Demoras del Cliente
                    </h2>
                    <p className="text-slate-500 font-medium italic">Registro de tiempos externos para análisis de causa raíz</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-amber-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-amber-600 shadow-xl shadow-amber-500/20 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Registrar Demora
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6 flex items-start gap-4 text-amber-800">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                    <Info className="w-5 h-5 text-amber-500" />
                </div>
                <div className="space-y-1 text-sm">
                    <p className="font-bold uppercase tracking-widest text-[10px]">Nota Conceptual</p>
                    <p className="font-medium">
                        Estos registros representan tiempos muertos atribuidos al cliente.
                        <strong> No afectan el IPT ni el ahorro de horas operativo</strong>, se analizan por separado para reportes de responsabilidad.
                    </p>
                </div>
            </div>

            {/* Content List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-slate-700">Historial de Registros</h3>
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar en historial..."
                            className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {isLoading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
                        ))
                    ) : filteredDelays.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center bg-white border border-slate-200 border-dashed rounded-[2.5rem] text-slate-400">
                            <Clock className="w-12 h-12 mb-4 opacity-10" />
                            <p className="font-bold uppercase tracking-widest text-xs">Sin registros de demora</p>
                        </div>
                    ) : (
                        filteredDelays.map(delay => (
                            <div key={delay.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-shadow group">
                                <div className="flex items-start gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                                        <Building2 className="w-6 h-6 text-amber-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-slate-800 text-lg leading-none">{delay.project.nombre}</span>
                                            <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-tight">#{delay.id.slice(-4).toUpperCase()}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-tighter">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {delay.fecha}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {delay.hora}hs</span>
                                            <span className="flex items-center gap-1 text-primary"><User className="w-3 h-3" /> {delay.operador}</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-600 line-clamp-1 italic">"{delay.motivo}"</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8 justify-between md:justify-end">
                                    <div className="text-right space-y-0.5">
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Área: {delay.area}</span>
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-3xl font-black text-amber-500 tracking-tighter">{delay.duracion}</span>
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-tighter">Horas</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteClick(delay.id)}
                                        className="p-3 bg-rose-50 text-rose-400 rounded-2xl hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto">
                        <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                                        <Timer className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Registrar Demora</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 ml-0.5">Responsabilidad del Cliente</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><Trash2 className="w-5 h-5 rotate-45" /></button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Proyecto */}
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Layout className="w-3 h-3" /> Proyecto afectado
                                    </label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700"
                                        required
                                        value={formData.projectId}
                                        onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                                    >
                                        <option value="">— Seleccionar proyecto —</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                </div>

                                {/* Fecha */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Calendar className="w-3 h-3" /> Fecha
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700"
                                        required
                                        value={formData.fecha}
                                        onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                                    />
                                </div>

                                {/* Hora */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Clock className="w-3 h-3" /> Hora
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700"
                                        required
                                        value={formData.hora}
                                        onChange={e => setFormData({ ...formData, hora: e.target.value })}
                                    />
                                </div>

                                {/* Operador */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <User className="w-3 h-3" /> Quien registra (Interno)
                                    </label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700"
                                        required
                                        value={formData.operador}
                                        onChange={e => setFormData({ ...formData, operador: e.target.value })}
                                    >
                                        <option value="">— Seleccionar operador —</option>
                                        {operators.map(op => <option key={op.nombreCompleto} value={op.nombreCompleto}>{op.nombreCompleto}</option>)}
                                    </select>
                                </div>

                                {/* Área del Cliente */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Building2 className="w-3 h-3" /> Área del Cliente
                                    </label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-slate-700"
                                        required
                                        value={formData.area}
                                        onChange={e => setFormData({ ...formData, area: e.target.value })}
                                    >
                                        <option value="">— Seleccionar área —</option>
                                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>

                                {/* Motivo */}
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <AlertCircle className="w-3 h-3" /> Motivo de la demora
                                    </label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-medium text-slate-700 resize-none h-24"
                                        required
                                        placeholder="Describa el motivo de la demora externa..."
                                        value={formData.motivo}
                                        onChange={e => setFormData({ ...formData, motivo: e.target.value })}
                                    />
                                </div>

                                {/* Duración */}
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Timer className="w-3 h-3" /> Tiempo perdido (Horas)
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="0"
                                            max="24"
                                            step="0.5"
                                            className="flex-1 accent-amber-500"
                                            value={formData.duracion}
                                            onChange={e => setFormData({ ...formData, duracion: parseFloat(e.target.value) })}
                                        />
                                        <div className="w-20 bg-amber-50 border border-amber-100 rounded-xl py-2 flex flex-col items-center">
                                            <span className="text-xl font-black text-amber-500">{formData.duracion}</span>
                                            <span className="text-[8px] font-black text-amber-600 uppercase">Hs</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] bg-amber-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-600 shadow-xl shadow-amber-500/20 shadow-xl transition-all active:scale-95"
                                >
                                    Registrar Evento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Registro de Demora"
                message="¿Estás seguro de que deseas eliminar este registro de demora? Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                onConfirm={confirmDelete}
                onCancel={() => {
                    setIsConfirmOpen(false);
                    setDelayToDelete(null);
                }}
            />
        </div>
    );
}
