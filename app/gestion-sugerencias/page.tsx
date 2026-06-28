'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Filter, ShieldCheck, UserCheck, CalendarDays, NotebookTabs, ArrowRightCircle, Users, Lightbulb, BadgeCheck, FileClock, X, Check, Save, Brain, BarChart3, MessageSquare, History, ListTodo, Copy } from "lucide-react";
import { showToast } from '@/components/Toast';

// Module-level cache to persist data across component remounts
// (caused by parent layout re-renders / React StrictMode double-mount)
let _cachedSugerencias: any[] | null = null;
let _cachedOperadores: any[] | null = null;
let _lastFetchTime = 0;
const STALE_THRESHOLD_MS = 30_000; // Consider data stale after 30 seconds

export default function GestionSugerenciasPage() {
    const router = useRouter();
    const [sugerencias, setSugerencias] = useState<any[]>(_cachedSugerencias || []);
    const [operadores, setOperadores] = useState<any[]>(_cachedOperadores || []);
    const [loading, setLoading] = useState(_cachedSugerencias === null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [activeTab, setActiveTab] = useState<'lista' | 'dashboard'>('lista');
    
    // Modal states
    const [selectedSug, setSelectedSug] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [modalTab, setModalTab] = useState<'detalle' | 'comentarios' | 'historial'>('detalle');
    
    // AI states
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Edit form states
    const [editForm, setEditForm] = useState({
        estado: '',
        responsable_id: '',
        fecha_cierre: '',
        reunion_programada: '',
        notas_resolucion: '',
        comentarioInterno: ''
    });
    const [nuevaAccion, setNuevaAccion] = useState({
        descripcion: '',
        responsableId: '',
        fechaLimite: ''
    });

    // Guard against duplicate fetches on remount
    const fetchGuardRef = useRef(false);

    const fetchData = useCallback(async (force = false) => {
        // Skip if already fetching, or if data is fresh and not forced
        if (fetchGuardRef.current) return;
        if (!force && _cachedSugerencias !== null && (Date.now() - _lastFetchTime) < STALE_THRESHOLD_MS) return;

        fetchGuardRef.current = true;
        // Only show full loading spinner if there's no cached data at all
        if (_cachedSugerencias === null) setLoading(true);
        try {
            const [sugRes, opRes] = await Promise.all([
                fetch('/api/sugerencias'),
                fetch('/api/operators')
            ]);
            
            if (sugRes.ok) {
                const data = await sugRes.json();
                _cachedSugerencias = data;
                setSugerencias(data);
            }
            if (opRes.ok) {
                const data = await opRes.json();
                _cachedOperadores = data;
                setOperadores(data);
            }
            _lastFetchTime = Date.now();
        } catch (error) {
            showToast("Error al cargar datos", 'error');
        } finally {
            setLoading(false);
            fetchGuardRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenModal = (sug: any) => {
        setSelectedSug(sug);
        setModalTab('detalle');
        // Load persisted AI analysis from the suggestion record, if available
        setAiAnalysis(sug.analisis_ia || null);
        setIsAnalyzing(false);
        setEditForm({
            estado: sug.estado || 'Pendiente',
            responsable_id: sug.responsable_id || '',
            fecha_cierre: sug.fecha_cierre ? new Date(sug.fecha_cierre).toISOString().slice(0, 16) : '',
            reunion_programada: sug.reunion_programada ? new Date(sug.reunion_programada).toISOString().slice(0, 16) : '',
            notas_resolucion: sug.notas_resolucion || '',
            comentarioInterno: ''
        });
        setNuevaAccion({
            descripcion: '',
            responsableId: '',
            fechaLimite: ''
        });
    };

    const analyzeWithAI = async () => {
        if (!selectedSug) return;
        setIsAnalyzing(true);
        try {
            const res = await fetch('/api/sugerencias/analizar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sugerenciaId: selectedSug.id,
                    titulo: selectedSug.titulo,
                    descripcion: selectedSug.descripcion,
                    area: selectedSug.area_involucrada,
                    propuestaAutor: selectedSug.propuesta_solucion
                })
            });
            if (res.ok) {
                const data = await res.json();
                setAiAnalysis(data);
                // Update the local suggestion cache so re-opening the modal doesn't lose the analysis
                setSugerencias(prev => prev.map(s => s.id === selectedSug.id ? { ...s, analisis_ia: data } : s));
                if (_cachedSugerencias) {
                    _cachedSugerencias = _cachedSugerencias.map(s => s.id === selectedSug.id ? { ...s, analisis_ia: data } : s);
                }
            } else {
                showToast("Error al analizar con IA", 'error');
            }
        } catch (err) {
            showToast("Error de red al invocar IA", 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!selectedSug) return;
        setIsSaving(true);
        try {
            // Assuming current user is fetched from session, but using a generic QA placeholder for now
            const payload: any = {
                estado: editForm.estado,
                actorNombre: 'QA Manager', // En producción se obtiene del usuario autenticado
                responsable_id: editForm.responsable_id === '' ? null : editForm.responsable_id,
                fecha_cierre: editForm.fecha_cierre === '' ? null : editForm.fecha_cierre,
                reunion_programada: editForm.reunion_programada === '' ? null : editForm.reunion_programada,
                notas_resolucion: editForm.notas_resolucion,
            };

            if (editForm.comentarioInterno.trim()) {
                payload.comentario = editForm.comentarioInterno;
            }
            if (nuevaAccion.descripcion.trim()) {
                payload.nuevaAccion = nuevaAccion;
            }

            const res = await fetch(`/api/sugerencias/${selectedSug.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast("Ticket actualizado correctamente", 'success');
                setSelectedSug(null);
                fetchData(true);
            } else {
                showToast("Error al actualizar", 'error');
            }
        } catch (error) {
            showToast("Error de conexión", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const filtered = useMemo(() => {
        return sugerencias.filter(sug => {
            const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const term = normalize(searchTerm);
            const matchesSearch = normalize(sug.titulo).includes(term) || 
                                  normalize(sug.id).includes(term);
            const matchesStatus = statusFilter === 'Todos' || sug.estado === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [sugerencias, searchTerm, statusFilter]);

    const stats = useMemo(() => {
        const total = sugerencias.length;
        const implementadas = sugerencias.filter(s => ['Implementada', 'Verificada', 'Cerrada'].includes(s.estado)).length;
        const tasaImplementacion = total > 0 ? (implementadas / total) * 100 : 0;
        
        const areas = sugerencias.reduce((acc, sug) => {
            if (sug.area_involucrada) {
                acc[sug.area_involucrada] = (acc[sug.area_involucrada] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        
        const topAreaEntry = Object.entries(areas).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
        const topArea = topAreaEntry ? [topAreaEntry[0], topAreaEntry[1]] : ['Ninguna', 0];

        return { total, implementadas, tasaImplementacion, topArea: { nombre: topArea[0] as string, cantidad: topArea[1] as number } };
    }, [sugerencias]);

    const getStatusColor = (estado: string) => {
        switch (estado) {
            case 'Pendiente': return 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
            case 'En evaluación': return 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
            case 'Aprobada': return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
            case 'Implementada': return 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20';
            case 'Rechazada': return 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border-rose-200 dark:border-rose-500/20';
            case 'Cerrada': return 'bg-slate-100 dark:bg-slate-500/10 text-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';
            default: return 'bg-gray-100 dark:bg-gray-500/10 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-500/20';
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-2xl text-white shadow-xl">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-blue-400" />
                        Gestión de Sugerencias y Reclamos
                    </h1>
                    <p className="text-blue-200 mt-2 font-medium max-w-2xl">
                        Tablero central para la evaluación, seguimiento y resolución de las ideas, sugerencias y reclamos presentados en la plataforma.
                    </p>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-stretch bg-primary hover:bg-blue-500 rounded-lg shadow-sm border border-blue-500 transition-colors">
                        <button
                            onClick={() => router.push('/ideas-sugerencias-reclamos')}
                            className="flex items-center gap-2 text-white px-4 py-2.5 font-bold text-sm border-r border-blue-500/50"
                        >
                            <Lightbulb className="w-4 h-4" />
                            Nuevo Registro
                        </button>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.origin + '/ideas-sugerencias-reclamos');
                                showToast("Enlace copiado", "success");
                            }}
                            className="flex items-center justify-center text-white px-3.5 transition-colors hover:bg-white/10 rounded-r-lg"
                            title="Copiar enlace al formulario"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-6 bg-white/10 px-6 py-2.5 rounded-lg backdrop-blur-sm border border-white/20 shadow-sm">
                        <div className="flex flex-col items-center justify-center">
                            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider mb-0.5">Total Abiertos</p>
                            <p className="text-xl font-black leading-none">{sugerencias.filter(s => !['Cerrada', 'Implementada', 'Rechazada'].includes(s.estado)).length}</p>
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div className="flex flex-col items-center justify-center">
                            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider mb-0.5">Sin Asignar</p>
                            <p className="text-xl font-black leading-none">{sugerencias.filter(s => !s.responsable_id).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('lista')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'lista' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <ListTodo className="w-4 h-4" /> Gestión Principal
                </button>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <BarChart3 className="w-4 h-4" /> Mejora Continua (Dashboard)
                </button>
            </div>

            {activeTab === 'lista' ? (
                <>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por código, título o área..."
                        className="w-full pl-10 pr-4 h-[46px] bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-shadow dark:text-slate-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 h-[46px]">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select 
                        className="h-full bg-card text-card-foreground border border-slate-200 dark:border-slate-700 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="Todos">Todos los Estados</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En evaluación">En evaluación</option>
                        <option value="Solicita información adicional">Solicita información adicional</option>
                        <option value="Aprobada">Aprobada</option>
                        <option value="En implementación">En implementación</option>
                        <option value="Implementada">Implementada</option>
                        <option value="Verificada">Verificada</option>
                        <option value="Rechazada">Rechazada</option>
                        <option value="Cerrada">Cerrada</option>
                    </select>
                </div>
            </div>

            {/* Table / List */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background text-foreground border-b border-slate-200 dark:border-slate-700 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    <th className="p-4">Ticket</th>
                                    <th className="p-4">Propuesta / Reclamo</th>
                                    <th className="p-4">Origen</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4">Responsable (Acción)</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-slate-500 font-medium">
                                            No se encontraron tickets.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(sug => (
                                        <tr key={sug.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                            <td className="p-4">
                                                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-secondary text-secondary-foreground px-2 py-1 rounded">#{sug.id}</span>
                                                <p className="text-[11px] text-slate-400 font-medium mt-1">
                                                    {new Date(sug.fecha_creacion).toLocaleDateString()}
                                                </p>
                                            </td>
                                            <td className="p-4">
                                                <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{sug.titulo}</p>
                                                <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-1">{sug.tipo_registro} • {sug.area_involucrada}</p>
                                            </td>
                                            <td className="p-4">
                                                {sug.presentacion === 'anonima' ? (
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-secondary text-secondary-foreground px-2 py-1 rounded-full">Anónima</span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                                                            {sug.usuario?.nombreCompleto?.charAt(0) || '?'}
                                                        </div>
                                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{sug.usuario?.nombreCompleto || 'Desconocido'}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${getStatusColor(sug.estado)}`}>
                                                    {sug.estado}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {sug.responsable ? (
                                                    <div className="flex items-center gap-2">
                                                        <UserCheck className="w-4 h-4 text-emerald-500" />
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{sug.responsable.nombreCompleto}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded border border-amber-200 dark:border-amber-500/20">Sin asignar</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => handleOpenModal(sug)}
                                                    className="inline-flex items-center gap-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 font-bold text-xs px-3 py-2 rounded-lg transition-all shadow-sm"
                                                >
                                                    Gestionar <ArrowRightCircle className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-card text-card-foreground p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Registros</p>
                            <p className="text-4xl font-black text-slate-800 dark:text-slate-100">{stats.total}</p>
                        </div>
                        <div className="bg-card text-card-foreground p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Implementadas</p>
                            <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{stats.implementadas}</p>
                        </div>
                        <div className="bg-card text-card-foreground p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tasa Implementación</p>
                            <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{stats.tasaImplementacion.toFixed(1)}%</p>
                        </div>
                        <div className="bg-card text-card-foreground p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Área más Activa</p>
                            <p className="text-xl font-black text-slate-800 dark:text-slate-100">{stats.topArea.nombre}</p>
                            <p className="text-sm text-slate-500 font-medium">{stats.topArea.cantidad} registros</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-card text-card-foreground rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-wider">Estado de Registros</h3>
                            <div className="space-y-4">
                                {Object.entries(
                                    sugerencias.reduce((acc, sug) => {
                                        acc[sug.estado] = (acc[sug.estado] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>)
                                ).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([estado, count]) => (
                                    <div key={estado}>
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className="text-slate-600 dark:text-slate-300">{estado}</span>
                                            <span className="text-slate-800 dark:text-slate-100">{count as number}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-blue-500 h-full rounded-full" 
                                                style={{ width: `${((count as number) / stats.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-card text-card-foreground rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-wider">Últimas Acciones Registradas</h3>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                {sugerencias
                                    .flatMap(sug => sug.acciones?.map((a: any) => ({ ...a, sugerencia: sug.titulo, sugId: sug.id })) || [])
                                    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .slice(0, 10)
                                    .map((accion: any, idx: number) => (
                                        <div key={idx} className="p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-muted/50 text-muted-foreground">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">#{accion.sugId} • {accion.estado}</span>
                                                <span className="text-[10px] font-medium text-slate-400">{new Date(accion.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">{accion.descripcion}</p>
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="w-3 h-3 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-500">{accion.responsable?.nombreCompleto || 'Sin responsable'}</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Gestión de Ticket */}
            {selectedSug && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border dark:border-slate-700">
                        
                        {/* Modal Header */}
                        <div className="flex flex-col border-b border-slate-100 dark:border-slate-700 bg-background text-foreground/50">
                            <div className="flex items-center justify-between p-6 pb-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <Lightbulb className="w-6 h-6 text-blue-500" />
                                        Gestionar Ticket #{selectedSug.id}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Gestión y seguimiento de resolución</p>
                                </div>
                                <button onClick={() => setSelectedSug(null)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex px-6 gap-6">
                                <button 
                                    onClick={() => setModalTab('detalle')}
                                    className={`pb-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'detalle' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <ShieldCheck className="w-4 h-4" /> Detalles y Gestión
                                </button>
                                <button 
                                    onClick={() => setModalTab('comentarios')}
                                    className={`pb-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'comentarios' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <MessageSquare className="w-4 h-4" /> Comentarios
                                    {selectedSug.comentarios?.length > 0 && (
                                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full text-[10px]">{selectedSug.comentarios.length}</span>
                                    )}
                                </button>
                                <button 
                                    onClick={() => setModalTab('historial')}
                                    className={`pb-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'historial' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <History className="w-4 h-4" /> Historial
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {modalTab === 'detalle' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    
                                    {/* Columna Izquierda: Info de la Propuesta */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Detalle del Registro</h3>
                                    <div className="bg-background text-foreground/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700 space-y-4">
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold mb-1">TÍTULO</p>
                                            <p className="text-slate-800 dark:text-slate-200 font-bold">{selectedSug.titulo}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold mb-1">DESCRIPCIÓN DEL PROBLEMA</p>
                                            <p className="text-slate-700 dark:text-slate-300 text-sm">{selectedSug.descripcion}</p>
                                        </div>
                                        {selectedSug.propuesta_solucion && (
                                            <div>
                                                <p className="text-xs text-blue-500 dark:text-blue-400 font-bold mb-1">SOLUCIÓN PROPUESTA POR AUTOR</p>
                                                <p className="text-slate-700 dark:text-slate-300 text-sm italic">{selectedSug.propuesta_solucion}</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold mb-1">ÁREA INVOLUCRADA</p>
                                                <p className="text-slate-800 dark:text-slate-200 text-sm font-medium">{selectedSug.area_involucrada}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold mb-1">IMPACTO ESTIMADO</p>
                                                <p className="text-slate-800 dark:text-slate-200 text-sm font-medium">{selectedSug.impacto_estimado}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* NUEVO PANEL IA */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-purple-500" />
                                            Asistente de Análisis
                                        </h3>
                                        {!aiAnalysis && !isAnalyzing && (
                                            <button 
                                                onClick={analyzeWithAI}
                                                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                                            >
                                                Generar Análisis
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-5 border border-purple-100 dark:border-purple-900/30">
                                        {isAnalyzing ? (
                                            <div className="flex flex-col items-center justify-center py-6">
                                                <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
                                                <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Analizando contexto y normativas...</p>
                                            </div>
                                        ) : aiAnalysis ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">ANÁLISIS DE CAUSA</p>
                                                    <p className="text-slate-700 dark:text-slate-300 text-sm">{aiAnalysis.analisisCausa}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">RECOMENDACIONES ({aiAnalysis.recomendaciones?.length || 0})</p>
                                                    <ul className="space-y-2 mt-2">
                                                        {aiAnalysis.recomendaciones?.map((r: any, idx: number) => (
                                                            <li key={idx} className="bg-card text-card-foreground rounded p-3 text-sm border border-purple-100 dark:border-purple-900/30">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{r.accion}</span>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{r.impacto}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">{r.justificacion}</p>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                {aiAnalysis.referenciasNormativas && aiAnalysis.referenciasNormativas.length > 0 && (
                                                    <div>
                                                        <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">REFERENCIAS NORMATIVAS</p>
                                                        <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                                            {aiAnalysis.referenciasNormativas.map((ref: string, idx: number) => (
                                                                <li key={idx}>{ref}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                                El asistente puede analizar este caso para proponer soluciones basadas en buenas prácticas.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha: Formulario de Gestión */}
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    Acciones de Calidad
                                </h3>

                                <div className="space-y-4">
                                    {/* Estado */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Estado de la Acción</label>
                                        <select 
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800 dark:text-slate-200"
                                            value={editForm.estado}
                                            onChange={(e) => setEditForm({...editForm, estado: e.target.value})}
                                        >
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="En evaluación">En evaluación (Análisis de Causa)</option>
                                            <option value="Aprobada">Aprobada (Plan de Acción)</option>
                                            <option value="Implementada">Implementada (Verificación)</option>
                                            <option value="Rechazada">Rechazada / Desestimada</option>
                                            <option value="Cerrada">Cerrada / Estandarizada</option>
                                        </select>
                                    </div>

                                    {/* Responsable */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Responsable de Implementación</label>
                                        <div className="relative">
                                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <select 
                                                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800 dark:text-slate-200"
                                                value={editForm.responsable_id}
                                                onChange={(e) => setEditForm({...editForm, responsable_id: e.target.value})}
                                            >
                                                <option value="">-- Sin asignar --</option>
                                                {operadores.map(op => (
                                                    <option key={op.id} value={op.id}>{op.nombreCompleto} ({op.role})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Fechas */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Reunión / Comité</label>
                                            <div className="relative">
                                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="datetime-local"
                                                    className="w-full pl-9 pr-2 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-200"
                                                    value={editForm.reunion_programada}
                                                    onChange={(e) => setEditForm({...editForm, reunion_programada: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Fecha de Cierre (Target)</label>
                                            <div className="relative">
                                                <FileClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="datetime-local"
                                                    className="w-full pl-9 pr-2 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-200"
                                                    value={editForm.fecha_cierre}
                                                    onChange={(e) => setEditForm({...editForm, fecha_cierre: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resolución */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Notas de Resolución / Causa Raíz</label>
                                        <div className="relative">
                                            <NotebookTabs className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <textarea 
                                                placeholder="Documentar análisis de causa, plan de acción o motivo de rechazo..."
                                                className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 dark:text-slate-200 min-h-[100px] resize-y"
                                                value={editForm.notas_resolucion}
                                                onChange={(e) => setEditForm({...editForm, notas_resolucion: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    {/* Comentario Rápido */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Agregar Comentario Interno</label>
                                        <input 
                                            type="text"
                                            placeholder="Comentario para el historial..."
                                            className="w-full px-4 py-2.5 bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-slate-200"
                                            value={editForm.comentarioInterno}
                                            onChange={(e) => setEditForm({...editForm, comentarioInterno: e.target.value})}
                                        />
                                    </div>
                                    {/* Nueva Acción de Mejora */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <BadgeCheck className="w-4 h-4 text-emerald-500" />
                                            Asignar Nueva Acción de Mejora
                                        </h4>
                                        <div className="space-y-3 bg-background text-foreground/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                            <input 
                                                type="text"
                                                placeholder="Descripción de la acción..."
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-slate-200"
                                                value={nuevaAccion.descripcion}
                                                onChange={(e) => setNuevaAccion({...nuevaAccion, descripcion: e.target.value})}
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <select 
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-slate-200"
                                                    value={nuevaAccion.responsableId}
                                                    onChange={(e) => setNuevaAccion({...nuevaAccion, responsableId: e.target.value})}
                                                >
                                                    <option value="">-- Responsable --</option>
                                                    {operadores.map(op => (
                                                        <option key={op.id} value={op.id}>{op.nombreCompleto}</option>
                                                    ))}
                                                </select>
                                                <input 
                                                    type="date"
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-slate-200"
                                                    value={nuevaAccion.fechaLimite}
                                                    onChange={(e) => setNuevaAccion({...nuevaAccion, fechaLimite: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Lista de Acciones Actuales */}
                                    {selectedSug.acciones && selectedSug.acciones.length > 0 && (
                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">Acciones Registradas ({selectedSug.acciones.length})</h4>
                                            <div className="space-y-2">
                                                {selectedSug.acciones.map((a: any, idx: number) => (
                                                    <div key={idx} className="bg-muted/50 text-muted-foreground p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{a.descripcion}</p>
                                                        <div className="flex items-center gap-4 mt-2">
                                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                                                {a.estado}
                                                            </span>
                                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                                Resp: {a.responsable?.nombreCompleto || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                        )}

                            {modalTab === 'comentarios' && (
                                <div className="space-y-6">
                                    <div className="bg-background text-foreground/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 max-h-[400px] overflow-y-auto space-y-4">
                                        {(!selectedSug.comentarios || selectedSug.comentarios.length === 0) ? (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10 font-medium">No hay comentarios internos en este registro.</p>
                                        ) : (
                                            selectedSug.comentarios.map((c: any, idx: number) => (
                                                <div key={idx} className="bg-card text-card-foreground p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                                                                {c.autor.charAt(0)}
                                                            </div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{c.autor}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-400 font-medium">{new Date(c.fecha).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 ml-8">{c.texto}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="flex items-end gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Agregar Comentario Interno</label>
                                            <input 
                                                type="text"
                                                placeholder="Escribe un comentario..."
                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-slate-200"
                                                value={editForm.comentarioInterno}
                                                onChange={(e) => setEditForm({...editForm, comentarioInterno: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalTab === 'historial' && (
                                <div className="space-y-6">
                                    <div className="bg-background text-foreground/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 max-h-[500px] overflow-y-auto">
                                        {(!selectedSug.historial || selectedSug.historial.length === 0) ? (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10 font-medium">No hay historial disponible.</p>
                                        ) : (
                                            <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-6">
                                                {selectedSug.historial.map((h: any, idx: number) => (
                                                    <div key={idx} className="relative pl-6">
                                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800" />
                                                        <div className="mb-1">
                                                            <span className="text-xs font-bold text-slate-400">{new Date(h.fecha).toLocaleString()}</span>
                                                            <span className="mx-2 text-slate-300">•</span>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{h.usuario}</span>
                                                        </div>
                                                        <div className="bg-card text-card-foreground p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm inline-block">
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                Cambió estado de <span className="font-bold text-slate-700 dark:text-slate-300">{h.estadoAnterior}</span> a <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border ${getStatusColor(h.estadoNuevo)}`}>{h.estadoNuevo}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-background text-foreground/50 flex justify-end gap-3">
                            <button 
                                onClick={() => setSelectedSug(null)}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-card text-card-foreground border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
