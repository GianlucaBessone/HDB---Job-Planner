'use client';

import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { showToast } from "@/components/Toast";
import TimeEntryMapView from "@/components/TimeEntryMapView";

export default function ApprovalsPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedEntry, setSelectedEntry] = useState<any>(null);

    const loadEntries = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest('/api/time-entries/approve?status=PENDING_APPROVAL');
            const data = await res.json();
            setEntries(data);
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

    const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
        try {
            const res = await safeApiRequest('/api/time-entries/approve', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action, approvedById: currentUser.id })
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

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'AUTO_APPROVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'PENDING_APPROVAL': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'APPROVED': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    const getRiskStyle = (risk: string) => {
        switch (risk) {
            case 'HIGH_RISK': return 'bg-rose-500 text-white';
            case 'SOSPECHOSO': return 'bg-amber-500 text-white';
            case 'REVISAR': return 'bg-indigo-500 text-white';
            default: return 'bg-emerald-500 text-white';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                        Aprobación de Fichadas
                    </h1>
                    <p className="text-slate-500 font-medium">Revisa las entradas que requieren validación manual.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                        <span className="text-xs font-bold text-slate-600">{entries.length} Pendientes</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Entries List */}
                <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                    {loading ? (
                        <div className="p-8 text-center bg-white rounded-3xl border border-slate-100">
                            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm font-bold text-slate-400">Cargando fichadas...</p>
                        </div>
                    ) : (Array.isArray(entries) && entries.length === 0) ? (
                        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
                            <p className="text-sm font-bold text-slate-400">No hay fichadas pendientes</p>
                        </div>
                    ) : (
                        Array.isArray(entries) && entries.map(entry => (
                            <button
                                key={entry.id}
                                onClick={() => setSelectedEntry(entry)}
                                className={`w-full text-left p-5 rounded-3xl border transition-all hover:scale-[1.02] cursor-pointer ${
                                    selectedEntry?.id === entry.id 
                                    ? 'bg-white border-primary shadow-xl shadow-primary/10 ring-2 ring-primary/5' 
                                    : 'bg-white border-slate-100 shadow-sm hover:border-slate-300'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getRiskStyle(entry.riskLevel)}`}>
                                        {entry.riskLevel}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">{format(new Date(entry.createdAt || entry.fecha), 'HH:mm')}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 leading-tight mb-1">{entry.operador?.nombreCompleto || entry.operator?.nombreCompleto}</h4>
                                <p className="text-xs font-medium text-slate-500 mb-3">{entry.project?.nombre || 'Base / Empresa'}</p>
                                
                                <div className="flex flex-wrap gap-2">
                                    {JSON.parse(entry.validationFlags || '[]').map((flag: string) => (
                                        <span key={flag} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold border border-slate-200">
                                            {flag}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Selection Detail */}
                <div className="lg:col-span-2">
                    {selectedEntry ? (
                        <EntryDetail entry={selectedEntry} onAction={handleAction} />
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-4">
                                <Search className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-500 mb-2">Selecciona una fichada</h3>
                            <p className="text-sm font-medium text-slate-400 max-w-xs">Haz click en una entrada de la lista para ver los detalles y procesar la aprobación.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function EntryDetail({ entry, onAction }: { entry: any, onAction: (id: string, action: 'APPROVED' | 'REJECTED') => void }) {
    const flags = JSON.parse(entry.validationFlags || '[]');
    
    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Map Placeholder or Actual Map */}
            <div className="h-64 bg-slate-100 relative">
                {entry.latitude ? (
                    <TimeEntryMapView lat={entry.latitude} lng={entry.longitude} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <MapIcon className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-xs font-bold">Sin ubicación precisa...</p>
                    </div>
                )}
                
                <div className="absolute top-4 left-4 right-4 flex justify-between">
                    <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-white/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Coordenadas</p>
                            <p className="text-xs font-bold text-slate-700">{entry.latitude?.toFixed(5)}, {entry.longitude?.toFixed(5)}</p>
                        </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-white/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                           <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">ID Dispositivo</p>
                            <p className="text-xs font-bold text-slate-700">{entry.deviceId?.slice(0, 10)}...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                                <User className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{entry.operador?.nombreCompleto}</h2>
                                <p className="text-slate-500 font-bold">{entry.project?.nombre || 'Base / Empresa Central'}</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4">
                             <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <span className="text-sm font-bold text-slate-700">{entry.fecha} a las {entry.horaIngreso || entry.horaEgreso}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-bold text-slate-700">Riesgo: {entry.riskLevel} (Score: {entry.score})</span>
                             </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => onAction(entry.id, 'REJECTED')}
                            className="px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                        <button 
                            onClick={() => onAction(entry.id, 'APPROVED')}
                            className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Aprobar Fichada
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" /> Flags de Validación
                        </h4>
                        <div className="space-y-3">
                            {flags.length > 0 ? flags.map((flag: string) => (
                                <div key={flag} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-600">{getFlagLabel(flag)}</span>
                                    <span className="text-[9px] font-black text-slate-300 uppercase">{flag}</span>
                                </div>
                            )) : (
                                <p className="text-xs font-bold text-slate-400 italic">No se detectaron anomalías.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-50/30 rounded-[2rem] p-6 border border-indigo-100/50">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Resumen de Jornada
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ingreso</p>
                                <p className="text-lg font-black text-indigo-600">{entry.horaIngreso || '--:--'}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Egreso</p>
                                <p className="text-lg font-black text-slate-600">{entry.horaEgreso || 'Activo'}</p>
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
        'EXCESSIVE_SHIFT': 'Jornada Excesiva (>12h)',
        'QR_INVALID': 'Token QR Inválido',
        'NO_LOCATION': 'Sin Ubicación'
    };
    return labels[flag] || flag;
}
