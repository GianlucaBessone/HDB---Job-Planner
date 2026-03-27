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
    Search,
    X,
    Camera
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
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
    const [systemSetting, setSystemSetting] = useState<any>(null);

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
            const [projectsRes, entriesRes, systemRes] = await Promise.all([
                safeApiRequest('/api/projects').then(res => res.json()),
                safeApiRequest(`/api/time-entries?operatorId=${userId}`).then(res => res.json()),
                safeApiRequest('/api/config/system').then(res => res.json())
            ]);
            
            setProjects(projectsRes.filter((p: any) => p.estado !== 'finalizado'));
            setActiveEntries(entriesRes.filter((e: any) => !e.horaEgreso));
            setSystemSetting(systemRes);
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
        // Enforce location
        if (!location) {
            showToast("Ubicación necesaria. Por favor refresca el GPS.", "info");
            refreshLocation();
            return;
        }

        // Enforce QR if required
        const targetProjId = projId || selectedProjectId;
        const targetProj = projects.find(p => p.id === targetProjId);
        const requiredQRToken = targetProjId ? targetProj?.qrToken : systemSetting?.companyQrToken;
        
        if (requiredQRToken && !scannedToken) {
            showToast("Debes escanear el código QR para validar tu posición.", "info");
            setIsScanning(true);
            return;
        }

        setIsLoading(true);
        try {
            const body = {
                operatorId: currentUser.id,
                action,
                projectId: targetProjId || null,
                deviceId,
                latitude: location.lat,
                longitude: location.lng,
                qrToken: scannedToken || null,
                timestamp: new Date().toISOString()
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

    const handleOnScanSuccess = (decodedText: string) => {
        setIsScanning(false);
        setScannedToken(decodedText);
        
        // Auto-select based on token
        if (systemSetting?.companyQrToken === decodedText) {
            setSelectedProjectId('');
            showToast("Base Central Detectada", "success");
        } else {
            const foundProj = projects.find(p => p.qrToken === decodedText);
            if (foundProj) {
                setSelectedProjectId(foundProj.id);
                showToast(`Proyecto Detectado: ${foundProj.nombre}`, "success");
            }
        }
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const needsQR = selectedProjectId ? selectedProject?.qrToken : systemSetting?.companyQrToken;

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
                        <div className="flex gap-2">
                            <div className="relative group flex-1">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <select 
                                    value={selectedProjectId}
                                    onChange={e => setSelectedProjectId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-10 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer text-sm leading-tight min-h-[60px]"
                                >
                                    <option value="">— BASE / EMPRESA —</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronRight className="w-5 h-5 rotate-90" />
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsScanning(true)}
                                className="w-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center active:scale-90 transition-all shadow-sm"
                                title="Escanear QR para auto-detectar lugar"
                            >
                                <QrCode className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* QR Validation Section */}
                    {needsQR && (
                        <div className="bg-indigo-50 border-2 border-indigo-200 border-dashed rounded-3xl p-6 text-center space-y-3">
                            <div className="mx-auto w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-900 text-sm">Validación por QR (Opcional)</h4>
                                <p className="text-[10px] font-medium text-indigo-700/70">Escanea si estás en el lugar para mayor precisión.</p>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    placeholder="Ingresa token..."
                                    value={scannedToken}
                                    onChange={e => setScannedToken(e.target.value)}
                                    className="flex-1 bg-white border border-indigo-200 rounded-xl py-2 px-4 text-center font-mono text-xs outline-none focus:border-indigo-500"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setIsScanning(true)}
                                    className="px-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-90 transition-all flex items-center justify-center"
                                >
                                    <Camera className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Submit IN */}
                    <button 
                        onClick={() => handlePunch('IN')}
                        disabled={isLoading}
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

            {isScanning && (
                <QRScannerModal 
                    onScan={handleOnScanSuccess} 
                    onClose={() => setIsScanning(false)} 
                />
            )}
        </div>
    );
}

function QRScannerModal({ onScan, onClose }: { onScan: (token: string) => void, onClose: () => void }) {
    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                onScan(decodedText);
                html5QrCode.stop();
            },
            () => {}
        ).catch(err => {
            console.error(err);
            showToast("Error al iniciar cámara. Verifica los permisos.", "error");
            onClose();
        });

        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(console.error);
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl space-y-4">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary" /> Escaneando QR
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="relative aspect-square bg-slate-900">
                    <div id="reader" className="w-full h-full"></div>
                    {/* Floating guide */}
                    <div className="absolute inset-0 border-[40px] border-slate-900/40 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-full border-2 border-primary/50 rounded-2xl shadow-[0_0_0_999px_rgba(15,23,42,0.6)]"></div>
                    </div>
                </div>

                <div className="p-6 text-center">
                    <p className="text-xs font-bold text-slate-500">Apunta la cámara al código QR impreso</p>
                </div>
            </div>
            
            <button 
                onClick={onClose}
                className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-black uppercase tracking-widest text-[10px] transition-all"
            >
                Cancelar Escaneo
            </button>
        </div>
    );
}
