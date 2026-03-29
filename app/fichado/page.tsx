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
import SearchableSelect from '@/components/SearchableSelect';
import { filterOperatorProjects } from '@/lib/projectSelectHelper';
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
    const [validationMode, setValidationMode] = useState<'gps' | 'qr'>('gps');

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
            
            setProjects(filterOperatorProjects(projectsRes));
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
        // Enforce validations based on mode (Only for Clock IN)
        if (action === 'IN') {
            if (validationMode === 'gps' && !location) {
                showToast("Ubicación necesaria para fichar por GPS. Por favor refresca el GPS.", "info");
                refreshLocation();
                return;
            }

            if (validationMode === 'qr' && !scannedToken) {
                showToast("Debes escanear el código QR para validar tu ingreso.", "info");
                setIsScanning(true);
                return;
            }
        }

        setIsLoading(true);
        try {
            const targetProjId = projId || selectedProjectId;
            const body = {
                operatorId: currentUser.id,
                action,
                projectId: targetProjId || null,
                deviceId,
                latitude: location?.lat || null,
                longitude: location?.lng || null,
                qrToken: (validationMode === 'qr' ? scannedToken : null) || null,
                timestamp: new Date().toISOString(),
                validationMethod: validationMode // Added to metadata or handle in backend
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

    const handleOnScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        setIsLoading(true);

        try {
            const res = await safeApiRequest(`/api/config/qr-lookup?token=${encodeURIComponent(decodedText)}`).then(r => r.json());
            
            if (res.type === 'UNKNOWN') {
                showToast("Mensaje: Código QR desconocido o no asignado a ningún proyecto.", "error");
                setScannedToken('');
                return;
            }

            if (res.status === 'EXPIRED') {
                showToast(`Este Código QR ha caducado (reemplazado). Por favor usa el nuevo para ${res.name}.`, "error");
                setScannedToken('');
                return;
            }

            // SUCCESSFUL ACTIVE TOKEN
            setScannedToken(decodedText);
            setValidationMode('qr');
            
            if (res.type === 'BASE') {
                setSelectedProjectId('');
                showToast("Base Central Detectada: Validación por QR Activada", "success");
            } else if (res.type === 'PROJECT') {
                setSelectedProjectId(res.projectId);
                showToast(`Proyecto Detectado: ${res.name} (Validación QR)`, "success");
            }

        } catch (error) {
            console.error(error);
            showToast("Error al validar el código QR. Inténtalo de nuevo.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const needsQR = selectedProjectId ? selectedProject?.qrToken : systemSetting?.companyQrToken;

    return (
        <div className="max-w-md mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Status */}
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 dark:text-slate-100">{currentUser?.nombreCompleto || 'Cargando...'}</h2>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
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
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : locationError || 'Obteniendo coordenadas...'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={refreshLocation} 
                    disabled={isRefreshingLocation}
                    className="p-2 hover:bg-white/50 rounded-xl transition-all active:scale-95"
                >
                    <RefreshCcw className={`w-5 h-5 text-slate-400 dark:text-slate-500 ${isRefreshingLocation ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Device Info */}
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">ID de Dispositivo:</span>
                </div>
                <code className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{deviceId.slice(0, 8)}...</code>
            </div>

            {/* Active Entries (Clock OUT) */}
            {activeEntries.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">Jornadas Activas</h3>
                    {activeEntries.map(entry => (
                        <div key={entry.id} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-lg border-2 border-primary ring-4 ring-primary/5">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg leading-tight">{entry.project?.nombre || 'Base / Empresa'}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-black rounded-md uppercase tracking-wider">Activa</span>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Desde: {entry.horaIngreso}hs</p>
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
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Iniciar Nueva Jornada</h3>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Selecciona el destino y método de validación.</p>
                </div>

                {/* Validation Mode Toggle */}
                <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-[1.5rem] gap-1">
                    <button 
                        onClick={() => setValidationMode('gps')}
                        className={`py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${validationMode === 'gps' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                        <MapPin className="w-3.5 h-3.5" /> GPS
                    </button>
                    <button 
                        onClick={() => setValidationMode('qr')}
                        className={`py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${validationMode === 'qr' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                        <QrCode className="w-3.5 h-3.5" /> Código QR
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Searchable Project Selector */}
                    <SearchableSelect 
                        label="Lugar de Destino"
                        options={[
                            { id: '', label: '— BASE / EMPRESA —' },
                            ...projects.map(p => ({ id: p.id, label: p.nombre }))
                        ]}
                        value={selectedProjectId}
                        onChange={(val) => {
                            setSelectedProjectId(val);
                            // If they manualy change project, we clear the scanned token to avoid confusing validation modes
                            if (scannedToken) setScannedToken('');
                        }}
                        placeholder="Buscar obra..."
                        icon={<MapPin className="w-5 h-5" />}
                        className="w-full"
                    />

                    {/* Validation UI based on mode */}
                    {validationMode === 'qr' ? (
                        <div className="bg-indigo-50 border-2 border-indigo-200 border-dashed rounded-3xl p-6 text-center space-y-3">
                            <div className="mx-auto w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-900 text-sm">Escanea el Código QR</h4>
                                <p className="text-[10px] font-medium text-indigo-700/70">Apunta al código impreso en el sitio {selectedProjectId ? 'de la obra' : 'de la base'}.</p>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-white dark:bg-slate-800 border border-indigo-200 rounded-xl py-2 px-4 text-center font-mono text-xs text-slate-500 dark:text-slate-400 overflow-hidden truncate">
                                    {scannedToken || 'Esperando escaneo...'}
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setIsScanning(true)}
                                    className="px-4 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    <Camera className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 text-center space-y-2">
                            <div className={`mx-auto w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${location ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{location ? 'Ubicación Lista' : 'Esperando GPS'}</h4>
                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Requerido para validar zona de trabajo.</p>
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
                    
                    {!location && validationMode === 'gps' && (
                        <p className="text-[10px] text-center font-bold text-amber-600 animate-pulse">
                            Espera a obtener ubicación para fichar con precisión.
                        </p>
                    )}
                </div>
            </div>

            {/* Validation Tips */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-700">
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Tips de Validación
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <MapPin className="w-4 h-4 text-primary mb-1" />
                        <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 leading-tight">Asegúrate de estar dentro del radio permitido.</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <Smartphone className="w-4 h-4 text-primary mb-1" />
                        <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 leading-tight">Usa siempre tu dispositivo principal.</p>
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
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl space-y-4">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary" /> Escaneando QR
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500">
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
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Apunta la cámara al código QR impreso</p>
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
