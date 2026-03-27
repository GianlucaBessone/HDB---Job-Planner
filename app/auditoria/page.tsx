'use client';

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
    History, 
    Search, 
    Filter, 
    User, 
    ArrowRight,
    Activity,
    Database,
    Clock,
    Eye,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { safeApiRequest } from "@/lib/offline";
import { showToast } from "@/components/Toast";

export default function AuditPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEntity, setFilterEntity] = useState("");
    const [filterAction, setFilterAction] = useState("");
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    const loadLogs = async () => {
        setLoading(true);
        try {
            let url = '/api/audit?limit=100';
            if (filterEntity) url += `&entity=${filterEntity}`;
            if (filterAction) url += `&action=${filterAction}`;
            
            const res = await safeApiRequest(url);
            const data = await res.json();
            setLogs(data);
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
            case 'CREATE': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'UPDATE': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'DELETE': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'APPROVE': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'REJECT': return 'bg-amber-50 text-amber-600 border-amber-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <History className="w-8 h-8 text-primary" />
                        Registro de Auditoría
                    </h1>
                    <p className="text-slate-500 font-medium italic">Trazabilidad completa de acciones y cambios en el sistema.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <select 
                        value={filterEntity}
                        onChange={e => setFilterEntity(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">Todas las Entidades</option>
                        <option value="TIME_ENTRY">Fichadas</option>
                        <option value="PROJECT">Proyectos</option>
                        <option value="USER">Usuarios</option>
                        <option value="SETTING">Configuraciones</option>
                    </select>

                    <select 
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">Todas las Acciones</option>
                        <option value="CREATE">Vínculo / Creación</option>
                        <option value="UPDATE">Modificación</option>
                        <option value="DELETE">Eliminación</option>
                        <option value="APPROVE">Aprobación</option>
                        <option value="REJECT">Rechazo</option>
                    </select>
                </div>
            </div>

            {/* Stats Summary (Mini) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<Activity className="w-4 h-4" />} label="Acciones hoy" value="124" />
                <StatCard icon={<Database className="w-4 h-4" />} label="Registros" value={logs.length.toString()} />
                <StatCard icon={<User className="w-4 h-4" />} label="Usuarios activos" value="12" />
                <StatCard icon={<Clock className="w-4 h-4" />} label="Uptime" value="99.9%" />
            </div>

            {/* Audit Table (Mobile Cards) */}
            <div className="space-y-4">
                {loading ? (
                    <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
                        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="font-bold text-slate-400">Escaneando transacciones...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-20 text-center bg-white rounded-3xl border border-slate-100">
                        <History className="w-16 h-16 text-slate-200 mx-auto mb-4 opacity-30" />
                        <p className="font-bold text-slate-400">Sin registros para los filtros aplicados</p>
                    </div>
                ) : (
                    logs.map((log: any) => (
                        <LogEntry 
                            key={log.id} 
                            log={log} 
                            isExpanded={expandedLog === log.id}
                            onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            styleGetter={getActionStyle}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function LogEntry({ log, isExpanded, onToggle, styleGetter }: any) {
    return (
        <div className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-primary shadow-xl shadow-primary/10' : 'border-slate-100 shadow-sm hover:border-slate-200'}`}>
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer" onClick={onToggle}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none">{format(new Date(log.timestamp), 'MMM')}</p>
                        <p className="text-lg font-black text-slate-700 leading-tight">{format(new Date(log.timestamp), 'dd')}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${styleGetter(log.action)}`}>
                                {log.action}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.entity}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 underline underline-offset-4 decoration-primary/20">
                            {log.userName || log.userEmail || 'Sistema (Automático)'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">ID Entidad</p>
                        <p className="text-xs font-bold text-slate-500 font-mono">{log.entityId?.slice(0, 12)}...</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Hora</p>
                        <p className="text-sm font-bold text-slate-700">{format(new Date(log.timestamp), 'HH:mm:ss')}</p>
                    </div>
                    <div className="p-2 rounded-full hover:bg-slate-50 transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="p-8 bg-slate-50 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-300">
                    <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Estado Anterior</h5>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 overflow-x-auto">
                            <pre className="text-[10px] font-medium text-slate-500 whitespace-pre-wrap">
                                {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : '// No hay valor previo'}
                            </pre>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2 px-1">Nuevo Estado / Cambio</h5>
                        <div className="bg-white p-5 rounded-2xl border border-primary/20 shadow-sm overflow-x-auto relative">
                             <div className="absolute top-2 right-2 bg-primary/10 text-primary p-1.5 rounded-lg">
                                <ArrowRight className="w-3 h-3" />
                             </div>
                            <pre className="text-[10px] font-bold text-slate-800 whitespace-pre-wrap">
                                {log.newValue ? JSON.stringify(log.newValue, null, 2) : '// No hay nuevo valor'}
                            </pre>
                        </div>
                    </div>

                    {log.metadata && (
                        <div className="lg:col-span-2 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
                             <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Metadatos Contextuales</h5>
                             <pre className="text-[10px] font-bold text-indigo-700">
                                {JSON.stringify(log.metadata, null, 2)}
                             </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value }: any) {
    return (
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:scale-[1.03]">
            <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-xl font-black text-slate-800 tracking-tight leading-none">{value}</p>
            </div>
        </div>
    );
}
