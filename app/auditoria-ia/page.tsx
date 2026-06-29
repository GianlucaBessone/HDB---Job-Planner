'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useViewState } from '@/lib/hooks/useViewState';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Sparkles,
    Coins,
    Users,
    Clock,
    DollarSign,
    Search,
    RefreshCw,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Database,
    ShieldAlert,
    User,
    TrendingUp,
    HelpCircle,
    FileText
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';

const AI_ACTION_LABELS: Record<string, string> = {
    'GEN_ISO_DOC': 'Generación Procedimiento ISO',
    'TECH_CHAT': 'Asistente de Campo (Chat)',
    'TECHNICAL_ASSISTANT': 'Asistente Técnico IA',
    'GEN_CHECKLIST': 'Generador de Checklist',
    'GEN_OBS': 'Análisis Observaciones OS',
    'IMAGE_ANOMALY': 'Análisis Multimodal de Imagen',
    'OCR': 'Extracción de Texto OCR',
    'TRAINING_GEN': 'Generador Capacitación LMS',
    'SEMANTIC_SEARCH': 'Búsqueda Semántica QMS',
};

const ACTION_COLORS: Record<string, string> = {
    'GEN_ISO_DOC': 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800',
    'TECH_CHAT': 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800',
    'TECHNICAL_ASSISTANT': 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800',
    'GEN_CHECKLIST': 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
    'GEN_OBS': 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    'IMAGE_ANOMALY': 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800',
    'OCR': 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800',
    'TRAINING_GEN': 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-800',
    'SEMANTIC_SEARCH': 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-800',
};

type ViewMode = 'consumption' | 'audit' | 'chats';

export default function AiAuditPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [filters, setFilters] = useViewState('auditoria-ia-filters', {
        viewMode: 'consumption' as ViewMode,
        filterAction: '',
        filterSuccess: '',
        searchTerm: ''
    });
    const { viewMode, filterAction, filterSuccess, searchTerm } = filters;
    const setViewMode = (val: ViewMode) => setFilters({ viewMode: val });
    const setFilterAction = (val: string) => setFilters({ filterAction: val });
    const setFilterSuccess = (val: string) => setFilters({ filterSuccess: val });
    const setSearchTerm = (val: string) => setFilters({ searchTerm: val });
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [userConsumption, setUserConsumption] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [expandedChatId, setExpandedChatId] = useState<string | null>(null);

    const registerCommand = useCommandStore((state) => state.registerCommand);
    const unregisterCommand = useCommandStore((state) => state.unregisterCommand);
    const latestActions = useRef({ fetchData: () => {} });

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const parsed = JSON.parse(stored);
            const role = parsed.role?.toLowerCase() || '';
            if (role !== 'admin' && role !== 'qa' && role !== 'supervisor') {
                showToast("Acceso denegado. Se requieren permisos de supervisor, administrador o QA.", "error");
                router.replace('/');
            } else {
                setCurrentUser(parsed);
            }
        } else {
            router.replace('/');
        }
    }, [router]);

    const fetchData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            let url = '/api/ai/audit?limit=150';
            if (filterAction) url += `&action=${filterAction}`;
            if (filterSuccess) url += `&success=${filterSuccess}`;

            const res = await safeApiRequest(url);
            const result = await res.json();
            if (result.success) {
                setStats(result.stats);
                setLogs(result.logs || []);
                setUserConsumption(result.userConsumption || []);
                setConversations(result.conversations || []);
            } else {
                showToast(result.error || "Error al obtener auditoría", "error");
            }
        } catch (error: any) {
            showToast("Error de red al consultar auditoría de IA", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        latestActions.current = { fetchData };
    });

    useEffect(() => {
        fetchData();
    }, [currentUser, filterAction, filterSuccess]);

    useEffect(() => {
        registerCommand({
            id: 'auditoria-ia-refresh',
            label: 'Actualizar Auditoría IA',
            category: 'Contextual',
            keys: ['ctrl', 'r'],
            action: () => latestActions.current.fetchData()
        });
        return () => unregisterCommand('auditoria-ia-refresh');
    }, [registerCommand, unregisterCommand]);

    if (!currentUser) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    // Filtered logs based on search term (name, role, or error message)
    const filteredLogs = logs.filter(log => {
        const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const term = normalize(searchTerm);
        if (!term) return true;
        return (
            normalize(log.userName || '').includes(term) ||
            normalize(log.userRole || '').includes(term) ||
            normalize(log.action || '').includes(term) ||
            normalize(log.errorMessage || '').includes(term)
        );
    });

    const getActionLabel = (action: string) => {
        return AI_ACTION_LABELS[action] || action;
    };

    const getActionBadgeColor = (action: string) => {
        return ACTION_COLORS[action] || 'bg-background text-foreground text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800';
    };

    const formatCost = (cost: number) => {
        if (cost === 0) return '$0.00';
        if (cost < 0.01) return `$${cost.toFixed(4)}`;
        return `$${cost.toFixed(2)}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                        Monitoreo e Auditoría de IA
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium italic">
                        Control de consumo de tokens, costos estimados de Gemini y registro histórico de consultas.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 transition-all text-slate-700 dark:text-slate-200"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card text-card-foreground p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:scale-[1.02]">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Peticiones Totales</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                                {stats.totalCount}
                            </p>
                            <span className="text-[9px] font-bold text-emerald-500 mt-1 block">
                                {stats.totalCount > 0 ? ((stats.successCount / stats.totalCount) * 100).toFixed(1) : 100}% éxito
                            </span>
                        </div>
                    </div>

                    <div className="bg-card text-card-foreground p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:scale-[1.02]">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Coins className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Tokens Consumidos</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                                {stats.totalTokens.toLocaleString()}
                            </p>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 block">
                                In: {stats.totalInputTokens.toLocaleString()} | Out: {stats.totalOutputTokens.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="bg-card text-card-foreground p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:scale-[1.02]">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Costo Estimado</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none text-amber-600 dark:text-amber-400">
                                {formatCost(stats.totalCost)}
                            </p>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 block">
                                USD (gemini-2.5-flash)
                            </span>
                        </div>
                    </div>

                    <div className="bg-card text-card-foreground p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:scale-[1.02]">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Latencia Promedio</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                                {(stats.avgLatency / 1000).toFixed(2)}s
                            </p>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 block">
                                Tiempo de respuesta
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-sm overflow-x-auto w-full max-w-2xl">
                <button
                    onClick={() => setViewMode('consumption')}
                    className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                        viewMode === 'consumption'
                            ? 'bg-primary text-white shadow-md'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Consumo por Usuario
                </button>
                <button
                    onClick={() => setViewMode('audit')}
                    className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                        viewMode === 'audit'
                            ? 'bg-primary text-white shadow-md'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Database className="w-4 h-4" />
                    Registro de Consultas
                </button>
                <button
                    onClick={() => setViewMode('chats')}
                    className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                        viewMode === 'chats'
                            ? 'bg-primary text-white shadow-md'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Historial de Chats
                </button>
            </div>

            {/* View container */}
            <div className="space-y-6">
                {/* 1. CONSUMPTION VIEW */}
                {viewMode === 'consumption' && (
                    <div className="bg-card text-card-foreground rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                Consumos de IA por Usuario
                            </h3>
                            <p className="text-xs text-slate-450 dark:text-slate-400 font-medium mt-1">
                                Concentración de uso, volumen de tokens e impacto económico estimado por cada miembro.
                            </p>
                        </div>

                        {loading ? (
                            <div className="p-16 text-center">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                                <p className="font-bold text-slate-450">Calculando cuotas y consumos...</p>
                            </div>
                        ) : userConsumption.length === 0 ? (
                            <div className="p-20 text-center text-slate-400 italic">
                                <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                No hay registros de consumo disponibles en el sistema.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                            <th className="px-6 py-4">Usuario</th>
                                            <th className="px-6 py-4">Rol</th>
                                            <th className="px-6 py-4 text-center">Llamadas Realizadas</th>
                                            <th className="px-6 py-4 text-right">Tokens Consumidos</th>
                                            <th className="px-6 py-4 text-right">Costo Estimado (USD)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {userConsumption.map((userStats, idx) => (
                                            <tr key={userStats.userId + idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                                                <td className="px-6 py-4.5 flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-200 uppercase">
                                                        {userStats.userName.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{userStats.userName}</p>
                                                        <span className="text-[10px] font-mono text-slate-400">{userStats.userId}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4.5">
                                                    <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350">
                                                        {userStats.userRole}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4.5 text-center font-bold text-slate-700 dark:text-slate-200">
                                                    {userStats.requestCount}
                                                </td>
                                                <td className="px-6 py-4.5 text-right font-mono font-bold text-slate-700 dark:text-slate-200">
                                                    {userStats.totalTokens.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                                    {formatCost(userStats.estimatedCost)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. REQUEST AUDIT LOGS */}
                {viewMode === 'audit' && (
                    <div className="space-y-4">
                        {/* Filters Panel */}
                        <div className="bg-card text-card-foreground p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar por usuario, rol o error..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-background text-foreground border-none rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div className="flex gap-2">
                                <select
                                    value={filterAction}
                                    onChange={e => setFilterAction(e.target.value)}
                                    className="bg-background text-foreground border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 text-slate-600 dark:text-slate-200"
                                >
                                    <option value="">Todas las Actividades</option>
                                    {Object.entries(AI_ACTION_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>

                                <select
                                    value={filterSuccess}
                                    onChange={e => setFilterSuccess(e.target.value)}
                                    className="bg-background text-foreground border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 text-slate-600 dark:text-slate-200"
                                >
                                    <option value="">Todos los Estados</option>
                                    <option value="true">Éxito</option>
                                    <option value="false">Falla</option>
                                </select>
                            </div>
                        </div>

                        {/* Audit Log list */}
                        <div className="space-y-3">
                            {loading ? (
                                <div className="p-16 text-center bg-card text-card-foreground rounded-3xl border border-slate-100">
                                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                                    <p className="font-bold text-slate-450">Leyendo logs de auditoría de IA...</p>
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="p-20 text-center bg-card text-card-foreground rounded-3xl border border-slate-100 dark:border-slate-800">
                                    <ShieldAlert className="w-14 h-14 text-slate-250 mx-auto mb-3 opacity-40" />
                                    <p className="font-bold text-slate-400 dark:text-slate-500">Ningún registro coincide con los filtros aplicados</p>
                                </div>
                            ) : (
                                filteredLogs.map((log) => {
                                    const isExpanded = expandedLogId === log.id;
                                    return (
                                        <div
                                            key={log.id}
                                            className={`bg-card text-card-foreground rounded-2xl border transition-all overflow-hidden ${
                                                isExpanded
                                                    ? 'border-primary/40 shadow-lg shadow-primary/5'
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div
                                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                                        log.success 
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-100 dark:border-emerald-900/50' 
                                                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-100 dark:border-rose-900/50'
                                                    }`}>
                                                        {log.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getActionBadgeColor(log.action)}`}>
                                                                {getActionLabel(log.action)}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-slate-500 border border-slate-200 dark:border-slate-600">
                                                                {log.provider || 'gemini'}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                                {log.model}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                            {log.success 
                                                                ? `Operación de IA exitosa` 
                                                                : `Error: ${log.errorMessage || 'Acceso fallido'}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-5 shrink-0 justify-between md:justify-end">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="max-w-[130px] truncate">{log.userName || 'Usuario Anónimo'}</span>
                                                    </div>

                                                    <div className="text-right hidden md:block">
                                                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                            {format(new Date(log.createdAt), "dd MMM yyyy", { locale: es })}
                                                        </p>
                                                        <p className="text-xs font-black text-slate-600 dark:text-slate-350">
                                                            {format(new Date(log.createdAt), 'HH:mm:ss')}
                                                        </p>
                                                    </div>

                                                    <div className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-5 pb-5 pt-1.5 border-t border-slate-50 dark:border-slate-800/60 bg-slate-50/20 dark:bg-slate-900/10 space-y-4 animate-in slide-in-from-top-2">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                        <div className="bg-card text-card-foreground p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Registro</p>
                                                            <p className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{log.id}</p>
                                                        </div>
                                                        <div className="bg-card text-card-foreground p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tokens Usados</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                                                                {log.totalTokens.toLocaleString()}
                                                                <span className="text-[10px] text-slate-400 font-normal ml-1">
                                                                    (In: {log.inputTokens} | Out: {log.outputTokens})
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div className="bg-card text-card-foreground p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Costo Generado</p>
                                                            <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">{formatCost(log.estimatedCost)} USD</p>
                                                        </div>
                                                        <div className="bg-card text-card-foreground p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Latencia / Tiempo</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{(log.latencyMs / 1000).toFixed(2)} segundos</p>
                                                        </div>
                                                    </div>

                                                    {log.entity && (
                                                        <div className="bg-card text-card-foreground p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs">
                                                            <h5 className="font-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest mb-1.5">Entidad Vinculada</h5>
                                                            <div className="flex gap-4">
                                                                <div>
                                                                    <span className="text-slate-400 font-bold">Tipo:</span>{' '}
                                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{log.entity}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400 font-bold">ID:</span>{' '}
                                                                    <code className="bg-background text-foreground px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-300">{log.entityId}</code>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!log.success && log.errorMessage && (
                                                        <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 p-4 rounded-xl text-xs">
                                                            <h5 className="font-black text-rose-500 uppercase tracking-widest text-[9px] mb-1.5 flex items-center gap-1.5">
                                                                <ShieldAlert className="w-3.5 h-3.5" />
                                                                Detalle del Error de Ejecución
                                                            </h5>
                                                            <p className="font-semibold text-rose-600 dark:text-rose-450 leading-relaxed font-mono whitespace-pre-wrap">
                                                                {log.errorMessage}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* 3. TECHNICAL CHATS AUDITING */}
                {viewMode === 'chats' && (
                    <div className="space-y-4">
                        <div className="bg-card text-card-foreground p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                Auditoría de Transcripción de Chats
                            </h3>
                            <p className="text-xs text-slate-450 dark:text-slate-400 font-medium mt-1">
                                Permite revisar las conversaciones mantenidas por el personal operativo con el asistente inteligente de Gemini.
                            </p>
                        </div>

                        {loading ? (
                            <div className="p-16 text-center bg-card text-card-foreground rounded-3xl border border-slate-100">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                                <p className="font-bold text-slate-450">Descargando hilos de conversación...</p>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="p-20 text-center bg-card text-card-foreground rounded-3xl border border-slate-100 dark:border-slate-800">
                                <MessageSquare className="w-14 h-14 text-slate-200 mx-auto mb-3 opacity-30" />
                                <p className="font-bold text-slate-400 dark:text-slate-500">No se han registrado chats de soporte técnico con IA.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {conversations.map((chat) => {
                                    const isExpanded = expandedChatId === chat.id;
                                    const msgCount = chat.messages?.length || 0;
                                    return (
                                        <div
                                            key={chat.id}
                                            className={`bg-card text-card-foreground rounded-2xl border transition-all overflow-hidden ${
                                                isExpanded
                                                    ? 'border-primary/45 shadow-lg'
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div
                                                onClick={() => setExpandedChatId(isExpanded ? null : chat.id)}
                                                className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center text-purple-600">
                                                        <MessageSquare className="w-4 h-4" />
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                                                {chat.title || 'Conversación técnica'}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">
                                                                {msgCount} mensaje{msgCount !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-450 dark:text-slate-500 font-medium flex flex-wrap gap-x-3 gap-y-0.5">
                                                            <span>Usuario: <strong className="text-slate-750 dark:text-slate-250 font-bold">{chat.userName || 'Usuario Anónimo'}</strong> ({chat.userRole || 'Desconocido'})</span>
                                                            {chat.entity && (
                                                                <span>
                                                                    • {chat.entity === 'Project' ? 'Proyecto' : chat.entity === 'OrdenServicio' ? 'Orden de Servicio' : chat.entity}:{' '}
                                                                    <strong className="text-slate-755 dark:text-slate-255 font-bold">{chat.entityName || chat.entityId}</strong>
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-5 shrink-0 justify-between md:justify-end">
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                            Último Cambio
                                                        </p>
                                                        <p className="text-xs font-black text-slate-600 dark:text-slate-350">
                                                            {format(new Date(chat.updatedAt), "dd/MM/yyyy HH:mm")}
                                                        </p>
                                                    </div>

                                                    <div className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-5 pb-5 pt-3 border-t border-slate-50 dark:border-slate-800/60 bg-slate-50/20 dark:bg-slate-900/10 space-y-4 animate-in slide-in-from-top-2">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-2 border-slate-100 dark:border-slate-800">
                                                        Detalle de la Conversación
                                                    </h4>
                                                    
                                                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                                                        {chat.messages && chat.messages.length > 0 ? (
                                                            chat.messages.map((msg: any) => {
                                                                const isUser = msg.role === 'user';
                                                                return (
                                                                    <div
                                                                        key={msg.id}
                                                                        className={`flex gap-3 max-w-[85%] ${
                                                                            isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                                                                        }`}
                                                                    >
                                                                        {/* Message avatar */}
                                                                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-sm uppercase ${
                                                                            isUser
                                                                                ? 'bg-primary text-white'
                                                                                : 'bg-indigo-600 text-white'
                                                                        }`}>
                                                                            {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                                                                        </div>

                                                                        {/* Bubble wrapper */}
                                                                        <div className="space-y-1">
                                                                            <div className={`p-3.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                                                                                isUser
                                                                                    ? 'bg-primary text-white rounded-tr-none'
                                                                                    : 'bg-card text-card-foreground border border-slate-100 dark:border-slate-700/80 text-slate-700 dark:text-slate-100 rounded-tl-none'
                                                                            }`}>
                                                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                                            </div>
                                                                            <p className={`text-[9px] text-slate-400 font-bold ${isUser ? 'text-right' : 'text-left'}`}>
                                                                                {format(new Date(msg.createdAt), 'HH:mm')}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic text-center py-4">
                                                                Sin mensajes registrados en esta sesión.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
