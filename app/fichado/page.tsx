'use client';

import { useState, useEffect } from 'react';
import { 
    Play, 
    Square, 
    MapPin, 
    QrCode, 
    Smartphone, 
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    User,
    ChevronRight,
    Search
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { formatTime, formatDate } from '@/lib/formatDate';
import { showToast } from '@/components/Toast';
import { v4 as uuidv4 } from 'uuid';

interface Project {
    id: string;
    nombre: string;
    geofenceLat: number | null;
    geofenceLng: number | null;
    geofenceRadius: number | null;
    qrToken: string | null;
}

export default function PunchInPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeEntries, setActiveEntries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
    const [deviceId, setDeviceId] = useState<string>('');

    // QR State
    const [isScanning, setIsScanning] = useState(false);
    const [scannedToken, setScannedToken] = useState<string>('');

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (user) {
            const parsed = JSON.parse(user);
            setCurrentUser(parsed);
            loadData(parsed.id);
        }

        // Initialize Device ID
        let dId = localStorage.getItem('hdb_device_id');
        if (!dId) {
            dId = uuidv4();
            localStorage.setItem('hdb_device_id', dId);
        }
        setDeviceId(dId);

        // Get initial location
        refreshLocation();
    }, []);

    const loadData = async (userId: string) => {
        setIsLoading(true);
        try {
            const [projectsRes, entriesRes] = await Promise.all([
                safeApiRequest('/api/projects').then(res => res.json()),
                safeApiRequest(`/api/time-entries?operatorId=${userId}`).then(res => res.json())
            ]);
            
            setProjects(projectsRes.filter((p: any) => p.estado !== 'finalizado'));
            // Filter entries that don't have horaEgreso
            setActiveEntries(entriesRes.filter((e: any) => !e.horaEgreso));
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshLocation = () => {
        if (!navigator.geolocation) {
            setLocationError("Geolocalización no soportada por este navegador");
            return;
        }

        setIsRefreshingLocation(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setIsRefreshingLocation(false);
            },
            (err) => {
                console.error(err);
                setLocationError("Error al obtener ubicación. Asegúrate de dar permisos de GPS.");
                setIsRefreshingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handlePunch = async (action: 'IN' | 'OUT', entryId?: string, projId?: string) => {
        if (action === 'IN' && !selectedProjectId && !projId) {
            showToast("Selecciona un proyecto", "error");
            return;
        }

        setIsLoading(true);
        try {
            const body = {
                operatorId: currentUser.id,
                action,
                projectId: projId || selectedProjectId || null,
                deviceId,
                latitude: location?.lat,
                longitude: location?.lng,
                qrToken: scannedToken || null
            };

            const res = await safeApiRequest('/api/time-entries/punch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al registrar");
            }

            showToast(action === 'IN' ? "Entrada registrada" : "Salida registrada", "success");
            setScannedToken('');
            setSelectedProjectId('');
            await loadData(currentUser.id);
        } catch (err: any) {
            showToast(err.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const needsQR = selectedProject?.qrToken;

    return (
        <div className="max-w-md mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Status */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800">{currentUser?.nombreCompleto || 'Cargando...'}</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatTime(new Date())} — {formatDate(new Date())}
                        </p>
                    </div>
                </div>
            </div>

            {/* Location Status */}
            <div className={`rounded-3xl p-4 border flex items-center justify-between transition-colors ${location ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${location ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                        <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${location ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {location ? 'Ubicación Obtenida' : 'Buscando GPS...'}
                        </p>
                        <p className="text-xs font-bold text-slate-600">
                            {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : locationError || 'Obteniendo coordenadas...'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={refreshLocation} 
                    disabled={isRefreshingLocation}
                    className="p-2 hover:bg-white/50 rounded-xl transition-all active:scale-95"
                >
                    <RefreshCcw className={`w-5 h-5 text-slate-400 ${isRefreshingLocation ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Device Info */}
            <div className="px-4 py-2 bg-slate-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID de Dispositivo:</span>
                </div>
                <code className="text-[9px] font-bold text-slate-500">{deviceId.slice(0, 8)}...</code>
            </div>

            {/* Active Entries (Clock OUT) */}
            {activeEntries.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Jornadas Activas</h3>
                    {activeEntries.map(entry => (
                        <div key={entry.id} className="bg-white rounded-[2rem] p-6 shadow-lg border-2 border-primary ring-4 ring-primary/5">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h4 className="font-extrabold text-slate-800 text-lg leading-tight">{entry.project?.nombre || 'Base / Empresa'}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-black rounded-md uppercase tracking-wider">Activa</span>
                                        <p className="text-xs font-bold text-slate-400">Desde: {entry.horaIngreso}hs</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                    <Clock className="w-6 h-6 animate-pulse" />
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => handlePunch('OUT', entry.id, entry.projectId)}
                                disabled={isLoading}
                                className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-600 shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Square className="w-4 h-4 fill-current" />
                                Finalizar Jornada
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Clock IN Form */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Iniciar Nueva Jornada</h3>
                    <p className="text-xs font-medium text-slate-400">Selecciona el destino y valida tu ingreso.</p>
                </div>

                <div className="space-y-4">
                    {/* Project Selector */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Destino de Trabajo</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                <Search className="w-5 h-5" />
                            </div>
                            <select 
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer"
                            >
                                <option value="">— BASE / EMPRESA —</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* QR Placeholder (Real scanner would use a library like html5-qrcode) */}
                    {needsQR && (
                        <div className="bg-indigo-50 border-2 border-indigo-200 border-dashed rounded-3xl p-6 text-center space-y-3">
                            <div className="mx-auto w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-900 text-sm">Este proyecto requiere QR</h4>
                                <p className="text-[10px] font-medium text-indigo-700/70">Escanea el código disponible en obra.</p>
                            </div>
                            <input 
                                type="text"
                                placeholder="Ingresa token o escanea..."
                                value={scannedToken}
                                onChange={e => setScannedToken(e.target.value)}
                                className="w-full bg-white border border-indigo-200 rounded-xl py-2 px-4 text-center font-mono text-xs outline-none focus:border-indigo-500"
                            />
                        </div>
                    )}

                    {/* Submit IN */}
                    <button 
                        onClick={() => handlePunch('IN')}
                        disabled={isLoading || (needsQR && !scannedToken)}
                        className="w-full bg-emerald-500 disabled:opacity-50 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-4"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Ingresar a {selectedProject ? 'Obra' : 'Base'}
                    </button>
                    
                    {!location && (
                        <p className="text-[10px] text-center font-bold text-amber-600 animate-pulse">
                            Espera a obtener ubicación para fichar con precisión.
                        </p>
                    )}
                </div>
            </div>

            {/* Validation Tips */}
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Tips de Validación
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100">
                        <MapPin className="w-4 h-4 text-primary mb-1" />
                        <p className="text-[9px] font-bold text-slate-600 leading-tight">Asegúrate de estar dentro del radio permitido.</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-100">
                        <Smartphone className="w-4 h-4 text-primary mb-1" />
                        <p className="text-[9px] font-bold text-slate-600 leading-tight">Usa siempre tu dispositivo principal.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
