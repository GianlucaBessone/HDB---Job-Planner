'use client';

import { useState, useEffect, useRef } from "react";
import { AsistenciaNav } from '@/components/asistencia/AsistenciaNav';
import { format } from "date-fns";
import { useCommandStore } from "@/lib/store/useCommandStore";
import { 
    ShieldCheck, 
    Clock, 
    MapPin, 
    Smartphone, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle, 
    MapIcon,
    Filter,
    Search,
    User
} from "lucide-react";
import { safeApiRequest } from "@/lib/offline";
import { formatDate } from "@/lib/formatDate";
import { showToast } from "@/components/Toast";
import TimeEntryMapView from "@/components/TimeEntryMapView";

const parseFlags = (flags: any): string[] => {
    if (!flags) return [];
    if (Array.isArray(flags)) return flags;
    try {
        if (typeof flags === 'string') {
            const parsed = JSON.parse(flags);
            if (Array.isArray(parsed)) return parsed;
            return [];
        }
    } catch (e) {}
    return [];
};

const getRiskStyle = (risk: string) => {
    switch (risk) {
        case 'HIGH_RISK': return 'bg-rose-500 text-white';
        case 'SOSPECHOSO': return 'bg-amber-500 text-white';
        case 'REVISAR': return 'bg-indigo-500 text-white';
        default: return 'bg-emerald-500 text-white';
    }
};

const getRiskLabel = (risk: string) => {
    const labels: Record<string, string> = {
        'HIGH_RISK': 'Alto Riesgo',
        'SOSPECHOSO': 'Sospechoso',
        'REVISAR': 'A Revisar',
        'OK': 'Sin Alertas',
    };
    return labels[risk] || risk;
};

export default function ApprovalsPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    // Selección para aprobar varias fichadas a la vez. El rechazo sigue siendo de a una:
    // rechazar borra la fichada.
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
    const [aprobandoVarias, setAprobandoVarias] = useState(false);

    const registerCommand = useCommandStore((state) => state.registerCommand);
    const unregisterCommand = useCommandStore((state) => state.unregisterCommand);
    const latestActions = useRef({ loadEntries: () => {} });

    const loadEntries = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest('/api/time-entries/approve?status=PENDING_APPROVAL');
            const data = await res.json();
            setEntries(data);
            const ids = new Set<string>((Array.isArray(data) ? data : []).map((e: any) => e.id));
            setSeleccion(prev => new Set(Array.from(prev).filter(id => ids.has(id))));
        } catch (error) {
            console.error(error);
            showToast("Error al cargar fichadas", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        setCurrentUser(user);
        loadEntries();
    }, []);

    useEffect(() => {
        latestActions.current = { loadEntries };
    });

    useEffect(() => {
        registerCommand({
            id: 'aprobaciones-refresh',
            label: 'Actualizar Fichadas Pendientes',
            category: 'Contextual',
            keys: ['ctrl', 'r'],
            action: () => latestActions.current.loadEntries()
        });
        return () => unregisterCommand('aprobaciones-refresh');
    }, [registerCommand, unregisterCommand]);

    const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
        try {
            const res = await safeApiRequest('/api/time-entries/approve', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action })
            });
            if (res.ok) {
                showToast(action === 'APPROVED' ? "Fichada aprobada" : "Fichada rechazada", "success");
                loadEntries();
                setSelectedEntry(null);
            }
        } catch (error) {
            showToast("Error al procesar acción", "error");
        }
    };

    const toggleSeleccion = (id: string) => {
        setSeleccion(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const lista = Array.isArray(entries) ? entries : [];
    const todasSeleccionadas = lista.length > 0 && lista.every(e => seleccion.has(e.id));

    const aprobarSeleccionadas = async () => {
        const ids = Array.from(seleccion);
        if (ids.length === 0) return;
        setAprobandoVarias(true);
        let ok = 0;
        let error: string | null = null;
        for (const id of ids) {
            try {
                const res = await safeApiRequest('/api/time-entries/approve', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, action: 'APPROVED' })
                });
                if (res.ok) ok++;
                else if (!error) error = (await res.json().catch(() => null))?.error || 'No se pudo aprobar';
            } catch {
                if (!error) error = 'Error de conexión';
            }
        }
        setAprobandoVarias(false);
        if (ok > 0) showToast(ok === 1 ? '1 fichada aprobada' : `${ok} fichadas aprobadas`, 'success');
        if (ok < ids.length) showToast(`${ids.length - ok} sin aprobar: ${error}`, 'error');
        setSeleccion(new Set());
        setSelectedEntry(null);
        loadEntries();
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'AUTO_APPROVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'PENDING_APPROVAL': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'APPROVED': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-background text-foreground text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800';
        }
    };


    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            <AsistenciaNav />
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-title text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-brand-600 dark:text-brand-300" />
                        Fichadas a aprobar
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Revisa las entradas que requieren validación manual.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="bg-card text-card-foreground px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{entries.length} Pendientes</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Entries List */}
                <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                    {!loading && lista.length > 0 && (
                        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
                            <label className="flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-primary"
                                    checked={todasSeleccionadas}
                                    onChange={() => setSeleccion(todasSeleccionadas ? new Set() : new Set(lista.map(e => e.id)))}
                                />
                                {seleccion.size > 0 ? `${seleccion.size} seleccionadas` : 'Seleccionar todas'}
                            </label>
                            {seleccion.size > 0 && (
                                <button
                                    type="button"
                                    onClick={aprobarSeleccionadas}
                                    disabled={aprobandoVarias}
                                    className="btn btn-primary btn-sm"
                                >
                                    <CheckCircle2 aria-hidden="true" />
                                    {aprobandoVarias ? 'Aprobando…' : `Aprobar ${seleccion.size}`}
                                </button>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="p-8 text-center bg-card text-card-foreground rounded-3xl border border-slate-100 dark:border-slate-800">
                            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Cargando fichadas...</p>
                        </div>
                    ) : (Array.isArray(entries) && entries.length === 0) ? (
                        <div className="p-12 text-center bg-card text-card-foreground rounded-3xl border border-slate-100 dark:border-slate-800">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No hay fichadas pendientes</p>
                        </div>
                    ) : (
                        Array.isArray(entries) && entries.map(entry => (
                            <div key={entry.id} className="relative">
                            <input
                                type="checkbox"
                                aria-label={`Seleccionar la fichada de ${entry.operator?.nombreCompleto || 'operador'}`}
                                className="absolute bottom-5 right-5 z-10 w-4 h-4 accent-primary"
                                checked={seleccion.has(entry.id)}
                                onChange={() => toggleSeleccion(entry.id)}
                            />
                            <button
                                onClick={() => setSelectedEntry(entry)}
                                className={`w-full text-left p-5 pr-12 rounded-3xl border transition-all duration-200 cursor-pointer ${
                                    selectedEntry?.id === entry.id 
                                    ? 'bg-card text-card-foreground border-primary shadow-xl ring-2 ring-primary/5' 
                                    : 'bg-card text-card-foreground border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`px-2 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${getRiskStyle(entry.riskLevel)}`}>
                                        {getRiskLabel(entry.riskLevel)}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{format(new Date(entry.createdAt || entry.fecha), 'HH:mm')}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-tight mb-1">{entry.operator?.nombreCompleto}</h4>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">{entry.project?.nombre || 'Base / Empresa'}</p>
                                
                                <div className="flex flex-wrap gap-2">
                                    {parseFlags(entry.validationFlags).map((flag: string) => (
                                        <span key={flag} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-[11px] font-bold border border-amber-100">
                                            {getFlagLabel(flag)}
                                        </span>
                                    ))}
                                </div>
                            </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Selection Detail */}
                <div className="lg:col-span-2">
                    {selectedEntry ? (
                        <EntryDetail entry={selectedEntry} onAction={handleAction} />
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-background text-foreground border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center">
                            <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-4">
                                <Search className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-2">Selecciona una fichada</h3>
                            <p className="text-sm font-medium text-slate-400 dark:text-slate-500 max-w-xs">Haz click en una entrada de la lista para ver los detalles y procesar la aprobación.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function EntryDetail({ entry, onAction }: { entry: any, onAction: (id: string, action: 'APPROVED' | 'REJECTED') => void }) {
    const flags = parseFlags(entry.validationFlags);
    
    return (
        <div className="bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Map Placeholder or Actual Map */}
            <div className="h-64 bg-muted text-muted-foreground/50 relative">
                {entry.latitude ? (
                    <TimeEntryMapView lat={entry.latitude} lng={entry.longitude} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <MapIcon className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-xs font-bold">Sin ubicación precisa...</p>
                    </div>
                )}
                
                <div className="absolute top-4 left-4 right-4 flex justify-between">
                    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-white/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none mb-1">Coordenadas</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{entry.latitude?.toFixed(5)}, {entry.longitude?.toFixed(5)}</p>
                        </div>
                    </div>

                    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-white/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                           <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none mb-1">ID Dispositivo</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{entry.deviceId?.slice(0, 10)}...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-slate-500 dark:text-slate-400">
                                <User className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-title text-slate-800 dark:text-slate-100">{entry.operator?.nombreCompleto}</h2>
                                <p className="text-slate-500 dark:text-slate-400 font-bold">{entry.project?.nombre || 'Base / Empresa Central'}</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4">
                             <div className="flex items-center gap-2">
                                 <Clock className="w-4 h-4 text-primary" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(entry.fecha)} a las {entry.horaIngreso || entry.horaEgreso}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Riesgo: {getRiskLabel(entry.riskLevel)} (Score: {entry.score})</span>
                             </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => onAction(entry.id, 'REJECTED')}
                            className="px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-semibold text-xs border border-rose-100 hover:bg-rose-100 transition-all flex items-center gap-2"
                        >
                            <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                        <button 
                            onClick={() => onAction(entry.id, 'APPROVED')}
                            className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-semibold text-xs hover:bg-emerald-600 transition-all flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Aprobar Fichada
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-background text-foreground rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
                        <h4 className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" /> Flags de Validación
                        </h4>
                        <div className="space-y-3">
                            {flags.length > 0 ? flags.map((flag: string) => (
                                <div key={flag} className="bg-card text-card-foreground p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{getFlagLabel(flag)}</span>
                                    <span className="text-[11px] font-semibold text-slate-300 uppercase">{flag}</span>
                                </div>
                            )) : (
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 italic">No se detectaron anomalías.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-50/30 rounded-3xl p-6 border border-indigo-100/50">
                        <h4 className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Resumen de Jornada
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-card text-card-foreground p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Ingreso</p>
                                <p className="text-lg font-bold text-indigo-600">{entry.horaIngreso || '--:--'}</p>
                            </div>
                            <div className="bg-card text-card-foreground p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Egreso</p>
                                <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{entry.horaEgreso || 'Activo'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getFlagLabel(flag: string) {
    const labels: any = {
        'OUT_OF_GEOFENCE': 'Fuera de Geovalla',
        'DEVICE_MISMATCH': 'Dispositivo No Habitual',
        'DEVICE_SHARED': 'Dispositivo Compartido',
        'OFFLINE_PENDING': 'Fichado Fuera de Línea',
        'OVERLAP_DETECTED': 'Superposición de Horarios',
        'RETROACTIVE_CHARGE': 'Carga Retroactiva (>48h)',
        'VERY_SHORT_SHIFT': 'Jornada Demasiado Corta',
        'CIERRE_ADMINISTRATIVO': 'Cierre Administrativo (egreso del registro manual)',
        'EXCESSIVE_SHIFT': 'Jornada Excesiva (>12h)',
        'QR_INVALID': 'Token QR Inválido',
        'NO_LOCATION': 'Sin Ubicación',
        'UNASSIGNED_PROJECT': 'Proyecto no Asignado'
    };
    return labels[flag] || flag;
}
