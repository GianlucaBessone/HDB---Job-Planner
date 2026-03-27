'use client';

import { useState, useEffect } from 'react';
import { 
    Clock, 
    Calendar, 
    User, 
    Layout, 
    MapPin, 
    Smartphone, 
    AlertTriangle, 
    CheckCircle2, 
    Search, 
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    FileSpreadsheet,
    Map as MapIcon,
    ShieldAlert,
    ExternalLink,
    RefreshCcw
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { formatDate, formatTime } from '@/lib/formatDate';
import { showToast } from '@/components/Toast';
import SearchableSelect from '@/components/SearchableSelect';
import CodeBadge from '@/components/CodeBadge';
import * as XLSX from 'xlsx';

interface TimeEntry {
    id: string;
    operatorId: string;
    operator: { nombreCompleto: string };
    projectId: string | null;
    project: { nombre: string; cliente: string; codigoProyecto?: string } | null;
    fecha: string;
    horaIngreso: string | null;
    horaEgreso: string | null;
    horasTrabajadas: number;
    deviceId: string | null;
    latitude: number | null;
    longitude: number | null;
    qrValidated: boolean;
    validationFlags: string | null;
    isSuspicious: boolean;
    isExtra: boolean;
}

export default function FichadasAdminPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Filters
    const [filterDateFrom, setFilterDateFrom] = useState(() => {
        const d = new Date();
        d.setHours(0,0,0,0);
        return d.toISOString().split('T')[0];
    });
    const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [filterOperator, setFilterOperator] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterSuspicious, setFilterSuspicious] = useState(false);

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (user) {
            setCurrentUser(JSON.parse(user));
        }
        loadInitialData();
    }, []);

    useEffect(() => {
        loadEntries();
    }, [filterDateFrom, filterDateTo, filterOperator, filterProject, filterSuspicious]);

    const loadInitialData = async () => {
        try {
            const [opsRes, projsRes] = await Promise.all([
                safeApiRequest('/api/operators').then(res => res.json()),
                safeApiRequest('/api/projects').then(res => res.json())
            ]);
            setOperators(opsRes);
            setProjects(projsRes);
        } catch (err) {
            console.error("Error loading filters", err);
        }
    };

    const loadEntries = async () => {
        setIsLoading(true);
        try {
            let url = `/api/time-entries?from=${filterDateFrom}&to=${filterDateTo}`;
            if (filterOperator) url += `&operatorId=${filterOperator}`;
            if (filterProject) url += `&projectId=${filterProject}`;

            const data = await safeApiRequest(url).then(res => res.json());
            let filtered = Array.isArray(data) ? data : [];
            
            if (filterSuspicious) {
                filtered = filtered.filter((e: any) => e.isSuspicious);
            }

            setEntries(filtered);
        } catch (err) {
            console.error("Error loading entries", err);
            showToast("Error al cargar registros", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const exportToExcel = () => {
        const aoa = [
            ['Fecha', 'Operador', 'Proyecto', 'Ingreso', 'Egreso', 'Horas', 'Extra', 'Dispositivo', 'Latitud', 'Longitud', 'Validaciones', 'Sospechoso']
        ];

        entries.forEach(e => {
            const flags = e.validationFlags ? JSON.parse(e.validationFlags).join(', ') : '';
            aoa.push([
                formatDate(e.fecha),
                e.operator.nombreCompleto,
                e.project?.nombre || 'Base / Empresa',
                e.horaIngreso || '-',
                e.horaEgreso || '-',
                e.horasTrabajadas,
                e.isExtra ? 'SI' : 'NO',
                e.deviceId || '-',
                e.latitude?.toString() || '-',
                e.longitude?.toString() || '-',
                flags,
                e.isSuspicious ? 'SI' : 'NO'
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Historial Fichadas');
        XLSX.writeFile(wb, `Fichadas_${filterDateFrom}_${filterDateTo}.xlsx`);
    };

    const getFlagIcon = (flagsJson: string | null) => {
        if (!flagsJson) return null;
        try {
            const flags = JSON.parse(flagsJson);
            if (flags.includes('OUT_OF_GEOFENCE')) return <MapPin className="w-3.5 h-3.5 text-rose-500" />;
            if (flags.includes('DEVICE_MISMATCH')) return <Smartphone className="w-3.5 h-3.5 text-amber-500" />;
            if (flags.includes('QR_INVALID')) return <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />;
        } catch (e) {}
        return null;
    };

    const getFlagDescription = (flag: string) => {
        const descriptions: Record<string, string> = {
            'OUT_OF_GEOFENCE': 'Fuera de rango GPS (Geocerca)',
            'DEVICE_MISMATCH': 'Dispositivo no reconocido (No es su teléfono principal)',
            'QR_INVALID': 'Token de código QR inválido o expirado',
            'NO_LOCATION': 'No se capturó ubicación GPS',
            'DEVICE_SHARED': 'Este dispositivo fue usado por otro operario recientemente',
            'OFFLINE_PENDING': 'El registro se tomó sin internet y se sincronizó luego'
        };
        return descriptions[flag] || flag;
    };

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Clock className="w-6 h-6" />
                        </div>
                        Monitoreo de Fichadas
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Control auditado de ingresos y egresos (GPS / Dispositivo)</p>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={loadEntries}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all active:scale-95 shadow-sm"
                        title="Refrescar"
                    >
                        <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="flex-1 md:flex-none bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-sm"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportar Excel
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Desde</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="date"
                            value={filterDateFrom}
                            onChange={e => setFilterDateFrom(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Hasta</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="date"
                            value={filterDateTo}
                            onChange={e => setFilterDateTo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                        />
                    </div>
                </div>

                <div className="flex-[2] min-w-[200px]">
                    <SearchableSelect 
                        label="Operador"
                        options={operators.map(o => ({ id: o.id, label: o.nombreCompleto }))}
                        value={filterOperator}
                        onChange={setFilterOperator}
                        placeholder="Todos los operadores"
                    />
                </div>

                <div className="flex-[2] min-w-[200px]">
                    <SearchableSelect 
                        label="Proyecto / Destino"
                        options={[
                            { id: 'BASE', label: '— BASE / EMPRESA —' },
                            ...projects.map(p => ({ id: p.id, label: p.nombre }))
                        ]}
                        value={filterProject === 'null' ? 'BASE' : filterProject}
                        onChange={(val) => setFilterProject(val === 'BASE' ? 'null' : val)}
                        placeholder="Todos los proyectos"
                    />
                </div>

                <div className="flex-none">
                    <button
                        onClick={() => setFilterSuspicious(!filterSuspicious)}
                        className={`h-[42px] px-5 rounded-xl font-bold transition-all active:scale-95 text-xs flex items-center gap-2 ${
                            filterSuspicious 
                            ? 'bg-rose-100 text-rose-700 border-2 border-rose-500' 
                            : 'bg-slate-50 text-slate-500 border-2 border-slate-200'
                        }`}
                    >
                        <AlertTriangle className={`w-4 h-4 ${filterSuspicious ? 'animate-pulse' : ''}`} />
                        Sospechosos
                    </button>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Información de Jornada</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Horarios</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit trail</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="inline-block w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                                        <p className="text-sm font-bold text-slate-400 animate-pulse">Cargando registros auditados...</p>
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                                            <Search className="w-8 h-8" />
                                        </div>
                                        <p className="font-bold text-slate-400">No se encontraron fichadas con estos filtros</p>
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry) => (
                                    <tr key={entry.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${entry.isSuspicious ? 'bg-rose-50/30' : ''}`}>
                                        <td className="p-5">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{formatDate(entry.fecha)}</span>
                                                    {entry.isExtra && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-widest">Extra</span>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <h4 className="font-black text-slate-800 text-sm leading-tight">{entry.project?.nombre || 'Base / Empresa'}</h4>
                                                    {entry.project?.codigoProyecto && (
                                                        <div className="mt-1">
                                                            <CodeBadge code={entry.project.codigoProyecto} variant="project" size="sm" showCopy={false} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold text-xs">
                                                    {entry.operator.nombreCompleto.charAt(0)}
                                                </div>
                                                <span className="text-sm font-black text-slate-700">{entry.operator.nombreCompleto}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ingreso</span>
                                                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{entry.horaIngreso || '--:--'}</span>
                                                    </div>
                                                    <div className="text-slate-300">→</div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Egreso</span>
                                                        <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">{entry.horaEgreso || '--:--'}</span>
                                                    </div>
                                                </div>
                                                {entry.horasTrabajadas > 0 && (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{entry.horasTrabajadas}h trabajadas</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex items-center gap-2">
                                                    {entry.isSuspicious ? (
                                                        <div className="flex items-center gap-1 bg-rose-100 text-rose-600 px-2 py-1 rounded-lg text-xs font-black animate-pulse" title={entry.validationFlags || ''}>
                                                            <AlertTriangle className="w-4 h-4" /> Validaciones con alerta
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-black">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
                                                        </div>
                                                    )}
                                                    {getFlagIcon(entry.validationFlags)}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {entry.deviceId && (
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                                                            <Smartphone className="w-3 h-3" /> {entry.deviceId.slice(0, 8)}...
                                                        </div>
                                                    )}
                                                    {entry.latitude && (
                                                        <a 
                                                            href={`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`}
                                                            target="_blank"
                                                            className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 hover:underline"
                                                        >
                                                            <MapIcon className="w-3 h-3" /> Ver mapa
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => { setSelectedEntry(entry); setIsModalOpen(true); }}
                                                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-500 transition-all active:scale-95"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audit Detail Modal */}
            {isModalOpen && selectedEntry && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <ShieldAlert className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Ficha Auditada</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{formatDate(selectedEntry.fecha)} — {selectedEntry.operator.nombreCompleto}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors">
                                <ArrowUpRight className="w-6 h-6 rotate-180" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Destino Declarado</p>
                                    <h4 className="font-extrabold text-slate-800 leading-tight">{selectedEntry.project?.nombre || 'Base / Empresa'}</h4>
                                    {selectedEntry.project?.cliente && <p className="text-xs font-bold text-slate-500 mt-1">{selectedEntry.project.cliente}</p>}
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Horario Registrado</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-black text-indigo-600">{selectedEntry.horaIngreso || '--:--'}</span>
                                        <span className="text-slate-300">→</span>
                                        <span className="text-lg font-black text-rose-500">{selectedEntry.horaEgreso || '--:--'}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 mt-1">{selectedEntry.horasTrabajadas} horas totales</p>
                                </div>
                            </div>

                            {/* Validation Flags Section */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Resultados de Validación Digital
                                </h4>
                                <div className="space-y-2">
                                    {selectedEntry.validationFlags ? (
                                        JSON.parse(selectedEntry.validationFlags).map((flag: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm">
                                                    <AlertTriangle className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-black text-rose-900 leading-none mb-1">{flag}</p>
                                                    <p className="text-[11px] font-bold text-rose-700/70">{getFlagDescription(flag)}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-emerald-500 shadow-sm">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-emerald-900 leading-none mb-1">Cero Alertas</p>
                                                <p className="text-[11px] font-bold text-emerald-700/70">Todas las validaciones digitales de GPS, dispositivo y QR pasaron correctamente.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Technical Rastro */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Smartphone className="w-3.5 h-3.5" /> Identidad del Dispositivo
                                    </h4>
                                    <div className="bg-slate-100 p-5 rounded-3xl border border-slate-200">
                                        <code className="text-[10px] font-bold text-slate-600 block break-all mb-2">ID: {selectedEntry.deviceId || 'N/A'}</code>
                                        <p className="text-[9px] font-bold text-slate-400 leading-tight">Este ID es único por instalación y se utiliza para evitar que un operario fiche desde múltiples teléfonos no autorizados.</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5" /> Posicionamiento Global
                                    </h4>
                                    {selectedEntry.latitude ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 border border-slate-200">Lat: {selectedEntry.latitude.toFixed(6)}</div>
                                                <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 border border-slate-200">Lng: {selectedEntry.longitude?.toFixed(6)}</div>
                                            </div>
                                            <a 
                                                href={`https://www.google.com/maps?q=${selectedEntry.latitude},${selectedEntry.longitude}`}
                                                target="_blank"
                                                className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                            >
                                                <MapIcon className="w-4 h-4" /> Abrir en Google Maps
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="p-5 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                                            <p className="text-xs font-bold text-slate-400 italic">Ubicación no disponible para este registro.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs"> Cerrar Detalle </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
