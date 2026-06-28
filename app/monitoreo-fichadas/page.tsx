'use client';

import { useState, useEffect, useCallback } from 'react';
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
    RefreshCcw,
    GitCompareArrows,
    X,
    TrendingUp,
    TrendingDown,
    Minus,
    Info,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { formatDate, formatTime, formatSheetDates } from '@/lib/formatDate';
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

    // Verificar Cruce modal
    const [isCruceOpen, setIsCruceOpen] = useState(false);
    const [cruceFrom, setCruceFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [cruceTo, setCruceTo] = useState(new Date().toISOString().split('T')[0]);
    const [cruceOperator, setCruceOperator] = useState('');
    const [cruceRows, setCruceRows] = useState<any[]>([]);
    const [cruceLoading, setCruceLoading] = useState(false);
    const [cruceStatusFilter, setCruceStatusFilter] = useState<string | null>(null);

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
            let url = `/api/fichadas?from=${filterDateFrom}&to=${filterDateTo}`;
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
        formatSheetDates(ws);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Historial Fichadas');
        XLSX.writeFile(wb, `Fichadas_${filterDateFrom}_${filterDateTo}.xlsx`);
    };

    const loadCruce = async () => {
        setCruceLoading(true);
        setCruceStatusFilter(null);
        try {
            let url = `/api/verificar-cruce?from=${cruceFrom}&to=${cruceTo}`;
            if (cruceOperator) url += `&operatorId=${cruceOperator}`;
            const data = await safeApiRequest(url).then(res => res.json());
            setCruceRows(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast('Error al cargar cruce de datos', 'error');
        } finally {
            setCruceLoading(false);
        }
    };

    const exportCruceToExcel = () => {
        const checkStr = (v: boolean | null) => v === null ? 'N/A' : v ? '✓' : '✗';
        const statusLabel: Record<string, string> = {
            OK: 'CORRECTO',
            ALERTA: 'ALERTA',
            SIN_FICHADA: 'SIN FICHADA',
            SIN_MANUAL: 'SIN REGISTRO MANUAL',
        };
        const aoa: any[][] = [[
            'Estado', 'Fecha', 'Operador',
            'Manual: 1ra Entrada', 'Manual: Última Salida', 'Manual Horas', 'Manual Registros',
            'Fichada: 1ra Entrada', 'Fichada: Última Salida', 'Fichada Horas', 'Fichada Cantidad',
            'Fichada Abierta', 'Fichada AutoCerrada',
            'Entrada OK', 'Salida OK', 'Horas OK',
        ]];
        for (const r of cruceRows) {
            aoa.push([
                statusLabel[r.status] ?? r.status,
                formatDate(r.fecha),
                r.operatorName,
                r.manualPrimeraEntrada ?? '-',
                r.manualUltimaSalida ?? '-',
                r.manualHoras,
                r.manualRegistros,
                r.fichadaPrimeraEntrada ?? '-',
                r.fichadaUltimaSalida ?? '-',
                r.fichadaHoras,
                r.fichadaCantidad,
                r.fichadaTieneAbierta ? 'SI' : 'NO',
                r.fichadaAutoCerrada ? 'SI' : 'NO',
                checkStr(r.entradaOk),
                checkStr(r.salidaOk),
                checkStr(r.horasOk),
            ]);
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        formatSheetDates(ws);
        // Apply column widths
        ws['!cols'] = [14, 12, 22, 16, 16, 12, 14, 16, 16, 12, 14, 14, 16, 11, 10, 10].map(w => ({ wch: w }));

        // Color-code rows
        const statusColors: Record<string, string> = {
            'CORRECTO': 'FF00B050',
            'ALERTA': 'FFFF0000',
            'SIN FICHADA': 'FFFF9900',
            'SIN REGISTRO MANUAL': 'FF0070C0',
        };
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = 1; R <= range.e.r; R++) {
            const cellAddr = XLSX.utils.encode_cell({ r: R, c: 0 });
            const cell = ws[cellAddr];
            if (!cell) continue;
            const color = statusColors[cell.v as string];
            if (color) {
                cell.s = { fill: { patternType: 'solid', fgColor: { rgb: color } }, font: { bold: true, color: { rgb: 'FFFFFFFF' } } };
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cruce Fichadas-Registros');
        XLSX.writeFile(wb, `CruceFichadas_${cruceFrom}_${cruceTo}.xlsx`);
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
            'OFFLINE_PENDING': 'El registro se tomó sin internet y se sincronizó luego',
            'UNASSIGNED_PROJECT': 'Proyecto no asignado en la planificación del día',
            'VERY_SHORT_SHIFT': 'Jornada demasiado corta (menos de 10 minutos)',
            'EXCESSIVE_SHIFT': 'Jornada excesiva (más de 12 horas)',
            'OVERLAP_DETECTED': 'Superposición de jornadas detectada',
            'RETROACTIVE_CHARGE': 'Carga retroactiva (más de 48 horas después del evento)',
        };
        return descriptions[flag] || flag;
    };

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Clock className="w-6 h-6" />
                        </div>
                        Monitoreo de Fichadas
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Control auditado de ingresos y egresos (GPS / Dispositivo)</p>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={loadEntries}
                        className="p-3 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
                        title="Refrescar"
                    >
                        <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsCruceOpen(true)}
                        className="flex-1 md:flex-none bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm"
                    >
                        <GitCompareArrows className="w-4 h-4" />
                        Verificar Cruce
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
            <div className="bg-card text-card-foreground rounded-[2.5rem] p-6 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Desde</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input 
                            type="date"
                            value={filterDateFrom}
                            onChange={e => setFilterDateFrom(e.target.value)}
                            className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Hasta</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input 
                            type="date"
                            value={filterDateTo}
                            onChange={e => setFilterDateTo(e.target.value)}
                            className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
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
                            : 'bg-background text-foreground/50 text-slate-500 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <AlertTriangle className={`w-4 h-4 ${filterSuspicious ? 'animate-pulse' : ''}`} />
                        Sospechosos
                    </button>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-card text-card-foreground rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Información de Jornada</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operador</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Horarios</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Audit trail</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="inline-block w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse">Cargando registros auditados...</p>
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="mx-auto w-16 h-16 bg-background text-foreground/50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                                            <Search className="w-8 h-8" />
                                        </div>
                                        <p className="font-bold text-slate-400 dark:text-slate-500">No se encontraron fichadas con estos filtros</p>
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry) => (
                                    <tr key={entry.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${entry.isSuspicious ? 'bg-rose-50/30' : ''}`}>
                                        <td className="p-5">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">{formatDate(entry.fecha)}</span>
                                                    {entry.isExtra && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-widest">Extra</span>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm leading-tight">{entry.project?.nombre || 'Base / Empresa'}</h4>
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
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{entry.operator.nombreCompleto}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ingreso</span>
                                                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{entry.horaIngreso || '--:--'}</span>
                                                    </div>
                                                    <div className="text-slate-300">→</div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Egreso</span>
                                                        <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">{entry.horaEgreso || '--:--'}</span>
                                                    </div>
                                                </div>
                                                {entry.horasTrabajadas > 0 && (
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-muted text-muted-foreground/50 px-2 py-0.5 rounded-full">{entry.horasTrabajadas}h trabajadas</span>
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
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500">
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
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 hover:text-indigo-500 transition-all active:scale-95"
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
                    <div className="relative bg-card text-card-foreground w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <ShieldAlert className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Ficha Auditada</h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{formatDate(selectedEntry.fecha)} — {selectedEntry.operator.nombreCompleto}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl text-slate-400 dark:text-slate-500 transition-colors">
                                <ArrowUpRight className="w-6 h-6 rotate-180" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-background text-foreground/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Destino Declarado</p>
                                    <h4 className="font-extrabold text-slate-800 dark:text-slate-100 leading-tight">{selectedEntry.project?.nombre || 'Base / Empresa'}</h4>
                                    {selectedEntry.project?.cliente && <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{selectedEntry.project.cliente}</p>}
                                </div>
                                <div className="bg-background text-foreground/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Horario Registrado</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-black text-indigo-600">{selectedEntry.horaIngreso || '--:--'}</span>
                                        <span className="text-slate-300">→</span>
                                        <span className="text-lg font-black text-rose-500">{selectedEntry.horaEgreso || '--:--'}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{selectedEntry.horasTrabajadas} horas totales</p>
                                </div>
                            </div>

                            {/* Validation Flags Section */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Resultados de Validación Digital
                                </h4>
                                <div className="space-y-2">
                                    {selectedEntry.validationFlags ? (
                                        JSON.parse(selectedEntry.validationFlags).map((flag: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                                <div className="w-8 h-8 rounded-xl bg-card text-card-foreground flex items-center justify-center text-rose-500 shadow-sm">
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
                                            <div className="w-8 h-8 rounded-xl bg-card text-card-foreground flex items-center justify-center text-emerald-500 shadow-sm">
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
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Smartphone className="w-3.5 h-3.5" /> Identidad del Dispositivo
                                    </h4>
                                    <div className="bg-muted text-muted-foreground/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700">
                                        <code className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block break-all mb-2">ID: {selectedEntry.deviceId || 'N/A'}</code>
                                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 leading-tight">Este ID es único por instalación y se utiliza para evitar que un operario fiche desde múltiples teléfonos no autorizados.</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5" /> Posicionamiento GPS
                                    </h4>
                                    {/* Entry Location */}
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                            <ArrowUpRight className="w-3 h-3" /> Ubicación de Ingreso
                                        </p>
                                        {selectedEntry.latitude ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="px-3 py-1.5 bg-muted text-muted-foreground/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Lat: {selectedEntry.latitude.toFixed(6)}</div>
                                                    <div className="px-3 py-1.5 bg-muted text-muted-foreground/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Lng: {selectedEntry.longitude?.toFixed(6)}</div>
                                                </div>
                                                <a 
                                                    href={`https://www.google.com/maps?q=${selectedEntry.latitude},${selectedEntry.longitude}`}
                                                    target="_blank"
                                                    className="w-full bg-emerald-600 text-white py-2 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                                                >
                                                    <MapIcon className="w-3.5 h-3.5" /> Ver Ingreso en Maps
                                                </a>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic">Sin ubicación de ingreso</p>
                                        )}
                                    </div>
                                    {/* Exit Location */}
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
                                            <ArrowDownLeft className="w-3 h-3" /> Ubicación de Egreso
                                        </p>
                                        {(selectedEntry as any).latitudeEgreso ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="px-3 py-1.5 bg-muted text-muted-foreground/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Lat: {(selectedEntry as any).latitudeEgreso.toFixed(6)}</div>
                                                    <div className="px-3 py-1.5 bg-muted text-muted-foreground/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Lng: {(selectedEntry as any).longitudeEgreso?.toFixed(6)}</div>
                                                </div>
                                                <a 
                                                    href={`https://www.google.com/maps?q=${(selectedEntry as any).latitudeEgreso},${(selectedEntry as any).longitudeEgreso}`}
                                                    target="_blank"
                                                    className="w-full bg-rose-600 text-white py-2 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-rose-700 shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
                                                >
                                                    <MapIcon className="w-3.5 h-3.5" /> Ver Egreso en Maps
                                                </a>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic">{selectedEntry.horaEgreso ? 'Sin ubicación de egreso' : 'Jornada aún activa'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-xs"> Cerrar Detalle </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verificar Cruce Modal */}
            {isCruceOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsCruceOpen(false)} />
                    <div className="relative bg-white dark:bg-slate-950 w-full max-w-7xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <GitCompareArrows className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Verificación y Cruce de Horas</h3>
                                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Compara fichadas de GPS/QR con los registros manuales cargados por operarios</p>
                                </div>
                            </div>
                            <button onClick={() => setIsCruceOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl text-slate-400 dark:text-slate-500 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Search and Filters Bar */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/20 dark:bg-slate-900/10 flex flex-wrap gap-4 items-end">
                            <div className="space-y-1.5 flex-1 min-w-[150px]">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Desde</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                    <input 
                                        type="date"
                                        value={cruceFrom}
                                        onChange={e => setCruceFrom(e.target.value)}
                                        className="w-full bg-secondary text-secondary-foreground border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 flex-1 min-w-[150px]">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Hasta</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                    <input 
                                        type="date"
                                        value={cruceTo}
                                        onChange={e => setCruceTo(e.target.value)}
                                        className="w-full bg-secondary text-secondary-foreground border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex-[2] min-w-[200px]">
                                <SearchableSelect 
                                    label="Filtrar por Operador"
                                    options={operators.map(o => ({ id: o.id, label: o.nombreCompleto }))}
                                    value={cruceOperator}
                                    onChange={setCruceOperator}
                                    placeholder="Todos los operadores"
                                />
                            </div>

                            <div className="flex gap-2 w-full md:w-auto">
                                <button
                                    onClick={loadCruce}
                                    disabled={cruceLoading}
                                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-55"
                                >
                                    {cruceLoading ? (
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <Search className="w-4 h-4" />
                                    )}
                                    Buscar y Procesar
                                </button>

                                <button
                                    onClick={exportCruceToExcel}
                                    disabled={cruceRows.length === 0}
                                    className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-55 disabled:shadow-none"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Exportar Excel
                                </button>
                            </div>
                        </div>

                        {/* Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/5">
                            {/* Summary cards */}
                            {cruceRows.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div 
                                        onClick={() => setCruceStatusFilter(null)}
                                        className={`bg-white dark:bg-slate-900 p-4 rounded-3xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${cruceStatusFilter === null ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md scale-[1.02]' : 'border-slate-100 dark:border-slate-800'}`}
                                    >
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Días Evaluados</span>
                                        <span className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">{cruceRows.length}</span>
                                    </div>
                                    <div 
                                        onClick={() => setCruceStatusFilter(cruceStatusFilter === 'OK' ? null : 'OK')}
                                        className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${cruceStatusFilter === 'OK' ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md scale-[1.02]' : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40'}`}
                                    >
                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Correctos (OK)</span>
                                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                                            {cruceRows.filter(r => r.status === 'OK').length}
                                        </span>
                                    </div>
                                    <div 
                                        onClick={() => setCruceStatusFilter(cruceStatusFilter === 'ALERTA' ? null : 'ALERTA')}
                                        className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${cruceStatusFilter === 'ALERTA' ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20 shadow-md scale-[1.02]' : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40'}`}
                                    >
                                        <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Alertas / Desvíos</span>
                                        <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
                                            {cruceRows.filter(r => r.status === 'ALERTA').length}
                                        </span>
                                    </div>
                                    <div 
                                        onClick={() => setCruceStatusFilter(cruceStatusFilter === 'SIN_FICHADA' ? null : 'SIN_FICHADA')}
                                        className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${cruceStatusFilter === 'SIN_FICHADA' ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-md scale-[1.02]' : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40'}`}
                                    >
                                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Sin Fichada (Manual)</span>
                                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                                            {cruceRows.filter(r => r.status === 'SIN_FICHADA').length}
                                        </span>
                                    </div>
                                    <div 
                                        onClick={() => setCruceStatusFilter(cruceStatusFilter === 'SIN_MANUAL' ? null : 'SIN_MANUAL')}
                                        className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${cruceStatusFilter === 'SIN_MANUAL' ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20 shadow-md scale-[1.02]' : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40'}`}
                                    >
                                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Sin Registro Manual</span>
                                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
                                            {cruceRows.filter(r => r.status === 'SIN_MANUAL').length}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                                {cruceLoading ? (
                                    <div className="p-20 text-center space-y-3">
                                        <div className="inline-block w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Procesando y cruzando bases de datos relacionales...</p>
                                    </div>
                                ) : cruceRows.length === 0 ? (
                                    <div className="p-16 text-center space-y-3 text-slate-400 dark:text-slate-500">
                                        <Info className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
                                        <p className="font-bold">No hay datos procesados en este rango.</p>
                                        <p className="text-xs">Selecciona un rango de fechas y presiona "Buscar y Procesar".</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                                    <th className="p-4 font-black uppercase text-slate-400 tracking-wider">Estado</th>
                                                    <th className="p-4 font-black uppercase text-slate-400 tracking-wider">Operador</th>
                                                    <th className="p-4 font-black uppercase text-slate-400 tracking-wider text-center">Registro Manual (Declarado)</th>
                                                    <th className="p-4 font-black uppercase text-slate-400 tracking-wider text-center">Fichada Digital (Auditoría)</th>
                                                    <th className="p-4 font-black uppercase text-slate-400 tracking-wider text-center">Resultado Cruce</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {cruceRows.filter((r: any) => !cruceStatusFilter || r.status === cruceStatusFilter).map((r, i) => {
                                                    const statusThemes: Record<string, string> = {
                                                        OK: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
                                                        ALERTA: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40',
                                                        SIN_FICHADA: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40',
                                                        SIN_MANUAL: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40',
                                                    };
                                                    const statusLabel: Record<string, string> = {
                                                        OK: 'CORRECTO',
                                                        ALERTA: 'ALERTA / DESVÍO',
                                                        SIN_FICHADA: 'SIN FICHADA',
                                                        SIN_MANUAL: 'SIN MANUAL',
                                                    };

                                                    return (
                                                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                                            <td className="p-4 font-medium">
                                                                <span className={`px-2 py-1 rounded-lg border font-black text-[9px] tracking-wide ${statusThemes[r.status]}`}>
                                                                    {statusLabel[r.status]}
                                                                </span>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="font-bold text-slate-800 dark:text-slate-200">{r.operatorName}</div>
                                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{formatDate(r.fecha)}</div>
                                                            </td>
                                                            <td className="p-4 bg-slate-50/30 dark:bg-slate-900/20">
                                                                {r.manualRegistros > 0 ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <div className="flex gap-2">
                                                                            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono font-bold">{r.manualPrimeraEntrada ?? '--:--'}</span>
                                                                            <span className="text-slate-300">→</span>
                                                                            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono font-bold">{r.manualUltimaSalida ?? '--:--'}</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 font-semibold">{r.manualHoras} hs en {r.manualRegistros} registro(s)</div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center italic text-slate-400">Sin carga manual</div>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                {r.fichadaCantidad > 0 ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <div className="flex gap-2 items-center">
                                                                            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono font-bold">{r.fichadaPrimeraEntrada ?? '--:--'}</span>
                                                                            <span className="text-slate-300">→</span>
                                                                            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono font-bold">{r.fichadaUltimaSalida ?? '--:--'}</span>
                                                                            {r.fichadaTieneAbierta && (
                                                                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" title="Fichada abierta actualmente" />
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                                                                            <span>{r.fichadaHoras} hs en {r.fichadaCantidad} fichada(s)</span>
                                                                            {r.fichadaAutoCerrada && (
                                                                                <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-1 rounded text-[8px] font-black uppercase">AutoCorte 16h</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center italic text-slate-400">Sin fichadas registradas</div>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {r.status === 'SIN_FICHADA' && (
                                                                    <div className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-900/40 text-[10px] font-bold">
                                                                        <AlertTriangle className="w-3.5 h-3.5" /> No Fichó
                                                                    </div>
                                                                )}
                                                                {r.status === 'SIN_MANUAL' && (
                                                                    <div className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-900/40 text-[10px] font-bold">
                                                                        <AlertTriangle className="w-3.5 h-3.5" /> No Declaró Horas
                                                                    </div>
                                                                )}
                                                                {r.status === 'OK' && (
                                                                    <div className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-[10px] font-bold">
                                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Todo OK
                                                                    </div>
                                                                )}
                                                                {r.status === 'ALERTA' && (
                                                                    <div className="flex flex-col gap-1 items-center">
                                                                        {r.entradaOk === false && (
                                                                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                                                <TrendingDown className="w-3 h-3" /> Fichó Tarde (Ingreso Fichado: {r.fichadaPrimeraEntrada} &gt; Manual: {r.manualPrimeraEntrada})
                                                                            </span>
                                                                        )}
                                                                        {r.salidaOk === false && (
                                                                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                                                <TrendingUp className="w-3 h-3" /> Fichó Temprano (Egreso Fichado: {r.fichadaUltimaSalida} &lt; Manual: {r.manualUltimaSalida})
                                                                            </span>
                                                                        )}
                                                                        {r.horasOk === false && (
                                                                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                                                <Minus className="w-3 h-3" /> Diferencia Horas (Fichado: {r.fichadaHoras}h &lt; Manual: {r.manualHoras}h)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-background text-foreground/40 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button onClick={() => setIsCruceOpen(false)} className="px-6 py-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-xs"> Cerrar </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
