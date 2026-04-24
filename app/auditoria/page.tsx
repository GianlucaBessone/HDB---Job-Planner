'use client';

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
    History, 
    User, 
    ArrowRight,
    Activity,
    Database,
    Clock,
    ChevronDown,
    ChevronUp,
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
    XCircle,
    Smartphone,
    MapPin,
    Users
} from "lucide-react";
import { safeApiRequest } from "@/lib/offline";
import { showToast } from "@/components/Toast";

// ── Field label translations ──────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
    nombre: 'Nombre',
    nombreCompleto: 'Nombre Completo',
    activo: 'Activo',
    noEnMetricas: 'Excluir de Métricas',
    observaciones: 'Observaciones',
    horasEstimadas: 'Horas Estimadas',
    horasConsumidas: 'Horas Consumidas',
    horasTrabajadas: 'Horas Trabajadas',
    cliente: 'Cliente',
    clientId: 'ID Cliente',
    responsable: 'Responsable',
    responsableId: 'ID Responsable',
    tags: 'Etiquetas Técnicas',
    estado: 'Estado',
    fechaInicio: 'Fecha de Inicio',
    fechaFin: 'Fecha de Fin',
    fecha: 'Fecha',
    horaIngreso: 'Hora de Ingreso',
    horaEgreso: 'Hora de Egreso',
    estadoConfirmado: 'Confirmado',
    confirmadoPorSupervisor: 'Confirmado por Supervisor',
    isExtra: 'Horas Extra',
    causaRegistro: 'Causa de Registro',
    codigoProyecto: 'Código de Proyecto',
    categoria: 'Categoría',
    tipoActividad: 'Tipo de Actividad',
    generarOS: 'Generar OS',
    aprovisionamiento: 'Aprovisionamiento',
    geofenceLat: 'Latitud Geofence',
    geofenceLng: 'Longitud Geofence',
    geofenceRadius: 'Radio Geofence (m)',
    qrToken: 'Token QR',
    fichajeHabilitado: 'Fichaje Habilitado',
    finalizadoConPendientes: 'Finalizado con Pendientes',
    pendientesSnapshot: 'Snapshot de Pendientes',
    publicToken: 'Token Público',
    pin: 'PIN',
    role: 'Rol',
    enVacaciones: 'En Vacaciones',
    etiquetas: 'Etiquetas',
    completed: 'Completado',
    excluded: 'Excluido',
    confirmedBySupervisor: 'Confirmado por Supervisor',
    pendingChange: 'Cambio Pendiente',
    justification: 'Justificación',
    tag: 'Etiqueta',
    description: 'Descripción',
    dailyReminderEnabled: 'Recordatorio Diario',
    dailyReminderTime: 'Hora de Recordatorio',
    valorManoObra: 'Valor Mano de Obra',
    companyGeofenceLat: 'Latitud Geofence Empresa',
    companyGeofenceLng: 'Longitud Geofence Empresa',
    companyGeofenceRadius: 'Radio Geofence Empresa',
    companyQrToken: 'Token QR Empresa',
    daysWithoutHoursThreshold: 'Días sin Horas (Umbral)',
    deviceId: 'Dispositivo',
    latitude: 'Latitud',
    longitude: 'Longitud',
    qrValidated: 'QR Validado',
    validationFlags: 'Banderas de Validación',
    isSuspicious: 'Sospechoso',
    isOfflinePending: 'Pendiente Offline',
    status: 'Estado de Aprobación',
    score: 'Puntuación de Riesgo',
    riskLevel: 'Nivel de Riesgo',
    approvedById: 'Aprobado por (ID)',
    approvedAt: 'Fecha de Aprobación',
    projectId: 'Proyecto (ID)',
    operatorId: 'Operador (ID)',
    createdAt: 'Fecha de Creación',
    updatedAt: 'Última Actualización',
};

const ENTITY_LABELS: Record<string, string> = {
    PROJECT: 'Proyecto',
    OPERATOR: 'Operador',
    TIME_ENTRY: 'Registro de Horas',
    FICHADA: 'Fichada GPS/QR',
    CHECKLIST: 'Checklist',
    SETTING: 'Configuración',
    USER: 'Usuario',
};

const ACTION_LABELS: Record<string, string> = {
    CREATE: 'Creación',
    UPDATE: 'Modificación',
    DELETE: 'Eliminación',
    APPROVE: 'Aprobación',
    REJECT: 'Rechazo',
};

const ACTION_ICONS: Record<string, any> = {
    CREATE: Plus,
    UPDATE: Pencil,
    DELETE: Trash2,
    APPROVE: CheckCircle2,
    REJECT: XCircle,
};

// Fields to skip in human-readable display (internal/noise)
const SKIP_FIELDS = new Set([
    'id', 'updatedAt', 'createdAt', 'publicToken', 'pendientesSnapshot', 
    'validationFlags', 'score', 'riskLevel', 'isOfflinePending',
    'approvedAt', 'approvedById',
]);

// ── Helpers ──────────────────────────────────────────────────────
function formatFieldValue(key: string, value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (Array.isArray(value)) return value.length === 0 ? '(vacío)' : value.join(', ');
    if (typeof value === 'object') {
        // Try to display something useful for nested objects
        if (value.nombre) return value.nombre;
        if (value.nombreCompleto) return value.nombreCompleto;
        return JSON.stringify(value);
    }
    // Format dates
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        try { return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: es }); } catch { return value; }
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value.split('-').reverse().join('/');
    }
    return String(value);
}

function getFieldLabel(key: string): string {
    return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

// ── Main Page ──────────────────────────────────────────────────
export default function AuditPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [stats, setStats] = useState<{ todayCount: number; totalCount: number; uniqueUsersToday: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterEntity, setFilterEntity] = useState("");
    const [filterAction, setFilterAction] = useState("");
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    const loadLogs = async () => {
        setLoading(true);
        try {
            let url = '/api/audit?limit=200&stats=true';
            if (filterEntity) url += `&entity=${filterEntity}`;
            if (filterAction) url += `&action=${filterAction}`;
            
            const res = await safeApiRequest(url);
            const data = await res.json();
            
            if (data.logs) {
                setLogs(data.logs);
                setStats(data.stats);
            } else {
                // Fallback if stats param not supported
                setLogs(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            showToast("Error al cargar registros", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [filterEntity, filterAction]);

    const getActionStyle = (action: string) => {
        switch (action) {
            case 'CREATE': return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            case 'UPDATE': return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            case 'DELETE': return 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800';
            case 'APPROVE': return 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
            case 'REJECT': return 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            default: return 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <History className="w-8 h-8 text-primary" />
                        Registro de Auditoría
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium italic">Trazabilidad completa de acciones y cambios en el sistema.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <select 
                        value={filterEntity}
                        onChange={e => setFilterEntity(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">Todas las Entidades</option>
                        <option value="TIME_ENTRY">Registro de Horas</option>
                        <option value="FICHADA">Fichadas GPS/QR</option>
                        <option value="PROJECT">Proyectos</option>
                        <option value="OPERATOR">Operadores</option>
                        <option value="CHECKLIST">Checklist</option>
                        <option value="SETTING">Configuraciones</option>
                    </select>

                    <select 
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">Todas las Acciones</option>
                        <option value="CREATE">Creación</option>
                        <option value="UPDATE">Modificación</option>
                        <option value="DELETE">Eliminación</option>
                        <option value="APPROVE">Aprobación</option>
                        <option value="REJECT">Rechazo</option>
                    </select>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard icon={<Activity className="w-4 h-4" />} label="Acciones hoy" value={stats?.todayCount?.toString() || '—'} />
                <StatCard icon={<Database className="w-4 h-4" />} label="Registros cargados" value={stats?.totalCount?.toString() || logs.length.toString()} />
                <StatCard icon={<Users className="w-4 h-4" />} label="Usuarios hoy" value={stats?.uniqueUsersToday?.toString() || '—'} />
            </div>

            {/* Audit Entries */}
            <div className="space-y-3">
                {loading ? (
                    <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="font-bold text-slate-400 dark:text-slate-500">Escaneando transacciones...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <History className="w-16 h-16 text-slate-200 mx-auto mb-4 opacity-30" />
                        <p className="font-bold text-slate-400 dark:text-slate-500">Sin registros para los filtros aplicados</p>
                    </div>
                ) : (
                    logs.map((log: any) => (
                        <LogEntry 
                            key={log.id} 
                            log={log} 
                            isExpanded={expandedLog === log.id}
                            onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            actionStyle={getActionStyle(log.action)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Log Entry Card ──────────────────────────────────────────────
function LogEntry({ log, isExpanded, onToggle, actionStyle }: any) {
    const ActionIcon = ACTION_ICONS[log.action] || Activity;
    const entityLabel = ENTITY_LABELS[log.entity] || log.entity;
    const actionLabel = ACTION_LABELS[log.action] || log.action;
    
    // Derive a readable summary line
    const summary = buildSummary(log);

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-primary/40 shadow-lg shadow-primary/5' : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-slate-200 dark:hover:border-slate-700'}`}>
            <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer" onClick={onToggle}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Action Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${actionStyle}`}>
                        <ActionIcon className="w-4 h-4" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                        {/* Tags row */}
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${actionStyle}`}>
                                {actionLabel}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{entityLabel}</span>
                        </div>
                        {/* Summary */}
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {summary}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    {/* User */}
                    <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
                            {log.userName || log.userEmail || 'Sin info de usuario'}
                        </span>
                    </div>
                    {/* Timestamp */}
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-none">
                            {format(new Date(log.timestamp), "dd MMM yyyy", { locale: es })}
                        </p>
                        <p className="text-xs font-black text-slate-600 dark:text-slate-300 leading-tight">
                            {format(new Date(log.timestamp), 'HH:mm:ss')}
                        </p>
                    </div>
                    {/* Expand */}
                    <div className="p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 md:px-5 pb-5 pt-1 border-t border-slate-50 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                    <ExpandedDetails log={log} />
                </div>
            )}
        </div>
    );
}

// ── Build a human-readable summary line ─────────────────────────
function buildSummary(log: any): string {
    const entity = ENTITY_LABELS[log.entity] || log.entity;
    const val = log.newValue || log.oldValue;
    
    // Try to find a human name for the entity
    let entityName = '';
    if (val) {
        if (val.nombre) entityName = val.nombre;
        else if (val.nombreCompleto) entityName = val.nombreCompleto;
        else if (val.codigoProyecto) entityName = val.codigoProyecto;
        else if (val.description) entityName = val.description;
    }

    switch (log.action) {
        case 'CREATE':
            return entityName ? `Se creó ${entity.toLowerCase()}: ${entityName}` : `Se creó un nuevo ${entity.toLowerCase()}`;
        case 'UPDATE':
            return entityName ? `Se modificó ${entity.toLowerCase()}: ${entityName}` : `Se modificó un ${entity.toLowerCase()}`;
        case 'DELETE':
            return entityName ? `Se eliminó ${entity.toLowerCase()}: ${entityName}` : `Se eliminó un ${entity.toLowerCase()}`;
        case 'APPROVE':
            return entityName ? `Se aprobó ${entity.toLowerCase()}: ${entityName}` : `Se aprobó un ${entity.toLowerCase()}`;
        case 'REJECT':
            return entityName ? `Se rechazó ${entity.toLowerCase()}: ${entityName}` : `Se rechazó un ${entity.toLowerCase()}`;
        default:
            return `Acción sobre ${entity.toLowerCase()}`;
    }
}

// ── Expanded Details Component ──────────────────────────────────
function ExpandedDetails({ log }: { log: any }) {
    const isUpdate = log.action === 'UPDATE';
    const isCreate = log.action === 'CREATE';
    const isDelete = log.action === 'DELETE';

    return (
        <div className="space-y-4 mt-2">
            {/* ID mini badge */}
            {log.entityId && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="font-bold uppercase tracking-widest">ID:</span>
                    <code className="bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded font-mono">{log.entityId}</code>
                </div>
            )}

            {/* UPDATE: Show field-by-field diff */}
            {isUpdate && log.oldValue && log.newValue && (
                <DiffTable oldValue={log.oldValue} newValue={log.newValue} />
            )}

            {/* CREATE: Show new record fields */}
            {isCreate && log.newValue && (
                <FieldsTable title="Datos del nuevo registro" data={log.newValue} variant="create" />
            )}

            {/* DELETE: Show deleted record fields */}
            {isDelete && log.oldValue && (
                <FieldsTable title="Datos eliminados" data={log.oldValue} variant="delete" />
            )}

            {/* APPROVE / REJECT */}
            {(log.action === 'APPROVE' || log.action === 'REJECT') && log.newValue && (
                <FieldsTable 
                    title={log.action === 'APPROVE' ? 'Registro aprobado' : 'Registro rechazado'} 
                    data={log.newValue} 
                    variant={log.action === 'APPROVE' ? 'create' : 'delete'} 
                />
            )}

            {/* Fallback: if no old/new value at all */}
            {!log.oldValue && !log.newValue && (
                <p className="text-xs text-slate-400 italic">No hay datos de cambio registrados para esta acción.</p>
            )}

            {/* Metadata section */}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
                <MetadataSection metadata={log.metadata} />
            )}
        </div>
    );
}

// ── Diff Table (UPDATE) ─────────────────────────────────────────
function DiffTable({ oldValue, newValue }: { oldValue: any; newValue: any }) {
    const allKeys = new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})]);
    const changedFields: { key: string; old: any; new_: any }[] = [];

    allKeys.forEach(key => {
        if (SKIP_FIELDS.has(key)) return;
        const oldV = oldValue?.[key];
        const newV = newValue?.[key];
        // Compare stringified to handle objects/arrays
        if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
            changedFields.push({ key, old: oldV, new_: newV });
        }
    });

    if (changedFields.length === 0) {
        return <p className="text-xs text-slate-400 italic">No se detectaron cambios en los campos visibles.</p>;
    }

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {changedFields.length} campo{changedFields.length > 1 ? 's' : ''} modificado{changedFields.length > 1 ? 's' : ''}
                </h5>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {changedFields.map(({ key, old, new_ }) => (
                    <div key={key} className="px-4 py-2.5 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-40 shrink-0">{getFieldLabel(key)}</span>
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                            <span className="text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-lg font-medium line-through max-w-[200px] truncate" title={formatFieldValue(key, old)}>
                                {formatFieldValue(key, old)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                            <span className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg font-bold max-w-[200px] truncate" title={formatFieldValue(key, new_)}>
                                {formatFieldValue(key, new_)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Fields Table (CREATE / DELETE) ───────────────────────────────
function FieldsTable({ title, data, variant }: { title: string; data: any; variant: 'create' | 'delete' }) {
    const borderColor = variant === 'create' 
        ? 'border-emerald-200 dark:border-emerald-800' 
        : 'border-rose-200 dark:border-rose-800';
    const headerBg = variant === 'create'
        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800';
    const headerText = variant === 'create'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

    const fields = Object.entries(data).filter(([key]) => !SKIP_FIELDS.has(key) && data[key] !== null && data[key] !== undefined);

    if (fields.length === 0) return null;

    // Show key fields first (nombre, fecha, etc.)
    const priorityKeys = ['nombre', 'nombreCompleto', 'codigoProyecto', 'fecha', 'horaIngreso', 'horaEgreso', 'horasTrabajadas', 'estado', 'causaRegistro'];
    const sorted = fields.sort(([a], [b]) => {
        const aIdx = priorityKeys.indexOf(a);
        const bIdx = priorityKeys.indexOf(b);
        if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
        if (aIdx >= 0) return -1;
        if (bIdx >= 0) return 1;
        return 0;
    });

    return (
        <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
            <div className={`px-4 py-2 border-b ${headerBg}`}>
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${headerText}`}>{title}</h5>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {sorted.map(([key, value]) => (
                    <div key={key} className="px-4 py-2 flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-40 shrink-0">{getFieldLabel(key)}</span>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate" title={formatFieldValue(key, value)}>
                            {formatFieldValue(key, value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Metadata Section ────────────────────────────────────────────
function MetadataSection({ metadata }: { metadata: any }) {
    return (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30">
                <h5 className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Contexto de la Acción</h5>
            </div>
            <div className="p-3 flex flex-wrap gap-3">
                {metadata.deviceId && (
                    <MetaBadge icon={<Smartphone className="w-3 h-3" />} label="Dispositivo" value={metadata.deviceId.slice(0, 16) + '...'} />
                )}
                {metadata.action && (
                    <MetaBadge icon={<Activity className="w-3 h-3" />} label="Tipo" value={metadata.action === 'IN' ? 'Ingreso' : metadata.action === 'OUT' ? 'Egreso' : metadata.action} />
                )}
                {(metadata.latitude !== undefined && metadata.longitude !== undefined) && (
                    <MetaBadge icon={<MapPin className="w-3 h-3" />} label="Ubicación" value={`${metadata.latitude?.toFixed(4)}, ${metadata.longitude?.toFixed(4)}`} />
                )}
                {metadata.projectId && (
                    <MetaBadge icon={<Database className="w-3 h-3" />} label="Proyecto ID" value={metadata.projectId.slice(0, 12) + '...'} />
                )}
                {metadata.fecha && (
                    <MetaBadge icon={<Clock className="w-3 h-3" />} label="Fecha Registro" value={metadata.fecha} />
                )}
                {metadata.horaIngreso && (
                    <MetaBadge icon={<Clock className="w-3 h-3" />} label="Ingreso" value={metadata.horaIngreso} />
                )}
                {metadata.horaEgreso && (
                    <MetaBadge icon={<Clock className="w-3 h-3" />} label="Egreso" value={metadata.horaEgreso} />
                )}
                {metadata.isExtra !== undefined && (
                    <MetaBadge icon={<Activity className="w-3 h-3" />} label="Extra" value={metadata.isExtra ? 'Sí' : 'No'} />
                )}
                {metadata.causaRegistro && (
                    <MetaBadge icon={<Activity className="w-3 h-3" />} label="Causa" value={metadata.causaRegistro} />
                )}
            </div>
        </div>
    );
}

function MetaBadge({ icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/50 rounded-lg px-2.5 py-1.5">
            <span className="text-indigo-400">{icon}</span>
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{label}:</span>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{value}</span>
        </div>
    );
}

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ icon, label, value }: any) {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:scale-[1.03]">
            <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">{value}</p>
            </div>
        </div>
    );
}
