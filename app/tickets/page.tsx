'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import ModuleHeader from '@/components/ModuleHeader';
import ReportTicketModal from '@/components/tickets/ReportTicketModal';
import AgentePanel from '@/components/tickets/AgentePanel';
import { showToast } from '@/components/Toast';
import {
    LifeBuoy, Plus, RefreshCw, AlertTriangle, Clock, CheckCircle2,
    Bug, Sparkles, Lightbulb, HelpCircle, MessageSquare, History, Brain,
    Loader2, X, ChevronRight, User, Paperclip, Send, ShieldAlert,
    CircleDot, ArrowUpRight, Filter, Copy, FileCode2,
    ListChecks,
} from 'lucide-react';
import {
    getSlaEstado,
    getTransiciones,
    TICKET_ESTADO_LABEL,
    TICKET_ESTADO_STYLE,
    TICKET_IMPACTO_LABEL,
    TICKET_PRIORIDAD_LABEL,
    TICKET_RIESGO_LABEL,
    TICKET_TIPOS,
    TICKET_TIPO_LABEL,
    TICKET_TIPO_STYLE,
    TICKET_URGENCIAS,
    TICKET_URGENCIA_LABEL,
    TICKET_URGENCIA_STYLE,
} from '@/lib/tickets';

const TIPO_ICONS: Record<string, any> = {
    error: Bug,
    funcionalidad: Sparkles,
    sugerencia: Lightbulb,
    consulta: HelpCircle,
};

const ESTADOS_FILTRO = [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'nuevo', label: 'Nuevos' },
    { value: 'triaje', label: 'En triaje' },
    { value: 'en_analisis', label: 'En análisis' },
    { value: 'pendiente_aprobacion', label: 'Pendiente de aprobación' },
    { value: 'listo_para_fix', label: 'Listos para corregir' },
    { value: 'en_progreso', label: 'En progreso' },
    { value: 'en_revision', label: 'En revisión' },
    { value: 'resuelto', label: 'Resueltos' },
    { value: 'cerrado', label: 'Cerrados' },
    { value: 'rechazado', label: 'Rechazados' },
    { value: 'duplicado', label: 'Duplicados' },
];

function fechaRelativa(value?: string | null) {
    if (!value) return '—';
    try {
        return formatDistanceToNow(new Date(value), { addSuffix: true, locale: es });
    } catch {
        return '—';
    }
}

function prioridadLabel(value: string) {
    return (TICKET_PRIORIDAD_LABEL as any)[value] || value;
}

export default function TicketsPage() {
    const [user, setUser] = useState<any>(null);
    const [tickets, setTickets] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [operadores, setOperadores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openReport, setOpenReport] = useState(false);

    const [filters, setFilters] = useState({
        q: '',
        estado: 'todos',
        tipo: 'todos',
        urgencia: 'todos',
    });

    const [selected, setSelected] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [tab, setTab] = useState<'detalle' | 'analisis' | 'historial' | 'comentarios'>('detalle');
    const [nuevoEstado, setNuevoEstado] = useState('');
    const [comentario, setComentario] = useState('');
    const [comentarioInterno, setComentarioInterno] = useState(false);
    const [asignado, setAsignado] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [analizando, setAnalizando] = useState(false);

    useEffect(() => {
        try {
            setUser(JSON.parse(localStorage.getItem('currentUser') || '{}'));
        } catch {
            setUser({});
        }
    }, []);

    const role = (user?.role || 'operador').toLowerCase();
    const canManage = ['admin', 'qa', 'supervisor'].includes(role);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            if (filters.q.trim()) qs.set('q', filters.q.trim());
            if (filters.estado !== 'todos') qs.set('estado', filters.estado);
            if (filters.tipo !== 'todos') qs.set('tipo', filters.tipo);
            if (filters.urgencia !== 'todos') qs.set('urgencia', filters.urgencia);

            const [ticketsRes, metricsRes] = await Promise.all([
                fetch(`/api/tickets?${qs.toString()}`),
                fetch('/api/tickets/metrics'),
            ]);

            if (ticketsRes.ok) setTickets(await ticketsRes.json());
            if (metricsRes.ok) setMetrics(await metricsRes.json());
        } catch {
            showToast('Error al cargar los tickets', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchData]);

    useEffect(() => {
        if (!canManage) return;
        fetch('/api/operators')
            .then(r => (r.ok ? r.json() : []))
            .then(data => setOperadores(Array.isArray(data) ? data.filter((o: any) => o.activo) : []))
            .catch(() => {});
    }, [canManage]);

    const abrirDetalle = async (ticket: any) => {
        setSelected(ticket);
        setDetail(null);
        setDetailLoading(true);
        setTab('detalle');
        setNuevoEstado('');
        setComentario('');
        setComentarioInterno(false);
        setAsignado(ticket.asignadoAId || '');

        try {
            const res = await fetch(`/api/tickets/${ticket.id}`);
            if (res.ok) {
                const data = await res.json();
                setDetail(data);
                setAsignado(data.asignadoAId || '');
            } else {
                showToast('No se pudo abrir el ticket', 'error');
                setSelected(null);
            }
        } catch {
            showToast('Error de red al abrir el ticket', 'error');
            setSelected(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const aplicarCambios = async (extra?: Record<string, any>) => {
        if (!detail) return;
        setGuardando(true);
        try {
            const payload: any = {
                autorNombre: user?.nombreCompleto || 'Equipo de soporte',
                ...(extra || {}),
            };

            if (!extra) {
                if (asignado !== (detail.asignadoAId || '')) payload.asignadoAId = asignado || null;
                if (nuevoEstado && nuevoEstado !== detail.estado) payload.estado = nuevoEstado;
                if (comentario.trim()) {
                    payload.comentario = comentario.trim();
                    payload.comentarioInterno = comentarioInterno;
                }
            }

            const res = await fetch(`/api/tickets/${detail.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo actualizar');

            showToast('Ticket actualizado', 'success');
            setComentario('');
            await abrirDetalle(data);
            fetchData();
        } catch (err: any) {
            showToast(err.message || 'Error al actualizar el ticket', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const enviarComentario = async () => {
        if (!comentario.trim()) return;
        await aplicarCambios({ comentario: comentario.trim(), comentarioInterno });
    };

    const analizarConIA = async () => {
        if (!detail) return;
        setAnalizando(true);
        try {
            const res = await fetch(`/api/tickets/${detail.id}/analizar`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo analizar el ticket.');

            // Recargamos el detalle completo para conservar historial y comentarios.
            const refreshed = await fetch(`/api/tickets/${detail.id}`);
            if (refreshed.ok) {
                const completo = await refreshed.json();
                setDetail(completo);
                setSelected(completo);
            } else {
                setDetail(data);
                setSelected(data);
            }

            showToast('Análisis de IA listo', 'success');
            fetchData();
        } catch (err: any) {
            showToast(err.message || 'Error al analizar el ticket', 'error');
        } finally {
            setAnalizando(false);
        }
    };

    const stats = useMemo(() => ([
        {
            label: 'Abiertos',
            value: metrics?.abiertos ?? '—',
            icon: CircleDot,
            className: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400',
        },
        {
            label: 'Críticos',
            value: metrics?.criticos ?? '—',
            icon: AlertTriangle,
            className: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400',
        },
        {
            label: 'Fuera de SLA',
            value: metrics?.vencidos ?? '—',
            icon: Clock,
            className: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400',
        },
        {
            label: 'Resueltos (7d)',
            value: metrics?.resueltosSemana ?? '—',
            icon: CheckCircle2,
            className: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
        },
    ]), [metrics]);

    const transiciones = detail ? getTransiciones(detail.estado) : [];
    const analisisEsGemini = detail?.analisisAgente?.origen === 'gemini';
    const puedeAnalizar = !!detail && (canManage || detail.reportadoPorId === user?.id);

    return (
        <div className="w-full">
            <ModuleHeader
                title="Tickets de Soporte"
                description="Fallas, pedidos y sugerencias del sistema"
                icon={<LifeBuoy />}
                actions={[
                    {
                        id: 'nuevo-ticket',
                        label: 'Nuevo ticket',
                        icon: <Plus />,
                        variant: 'primary',
                        onClick: () => setOpenReport(true),
                    },
                    {
                        id: 'actualizar',
                        label: 'Actualizar',
                        icon: <RefreshCw />,
                        variant: 'outline',
                        hideLabelOnMobile: true,
                        onClick: fetchData,
                    },
                ]}
                searchValue={filters.q}
                onSearchChange={v => setFilters(f => ({ ...f, q: v }))}
                searchPlaceholder="Buscar por código, título o persona…"
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {stats.map(s => (
                    <div key={s.label} className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${s.className}`}>
                            <s.icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">{s.value}</p>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 truncate">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
                <div className="flex items-center gap-2 text-slate-400">
                    <Filter className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filtros</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                    <select
                        value={filters.estado}
                        onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}
                        className="h-9 px-3 rounded-lg bg-card text-card-foreground border border-slate-200 dark:border-slate-700 text-[12px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-rose-500"
                    >
                        {ESTADOS_FILTRO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                    <select
                        value={filters.tipo}
                        onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}
                        className="h-9 px-3 rounded-lg bg-card text-card-foreground border border-slate-200 dark:border-slate-700 text-[12px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-rose-500"
                    >
                        <option value="todos">Todos los tipos</option>
                        {TICKET_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select
                        value={filters.urgencia}
                        onChange={e => setFilters(f => ({ ...f, urgencia: e.target.value }))}
                        className="h-9 px-3 rounded-lg bg-card text-card-foreground border border-slate-200 dark:border-slate-700 text-[12px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-rose-500"
                    >
                        <option value="todos">Todas las urgencias</option>
                        {TICKET_URGENCIAS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Lista */}
            <div className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="w-7 h-7 animate-spin" />
                        <p className="text-xs font-bold uppercase tracking-widest">Cargando tickets…</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="py-20 px-6 text-center">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-4">
                            <LifeBuoy className="w-7 h-7" />
                        </div>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">No hay tickets con estos filtros</p>
                        <p className="text-xs text-slate-400 font-medium mt-1 mb-4">
                            Si algo no funciona, reportalo y el equipo lo revisa.
                        </p>
                        <button
                            onClick={() => setOpenReport(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-[13px] font-bold hover:bg-rose-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Reportar una falla
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tickets.map(t => {
                            const TipoIcon = TIPO_ICONS[t.tipo] || Bug;
                            const sla = getSlaEstado(t.urgencia, t.createdAt, t.fechaResolucion);
                            const abierto = !['cerrado', 'resuelto', 'rechazado', 'duplicado'].includes(t.estado);

                            return (
                                <button
                                    key={t.id}
                                    onClick={() => abrirDetalle(t)}
                                    className="w-full text-left px-4 sm:px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                            t.tipo === 'error' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' :
                                            t.tipo === 'funcionalidad' ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400' :
                                            t.tipo === 'sugerencia' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                                            'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400'
                                        }`}>
                                            <TipoIcon className="w-4 h-4" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider">{t.codigo}</span>
                                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${TICKET_TIPO_STYLE[t.tipo as keyof typeof TICKET_TIPO_STYLE] || ''}`}>
                                                    {TICKET_TIPO_LABEL[t.tipo as keyof typeof TICKET_TIPO_LABEL] || t.tipo}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${TICKET_URGENCIA_STYLE[t.urgencia as keyof typeof TICKET_URGENCIA_STYLE] || ''}`}>
                                                    {TICKET_URGENCIA_LABEL[t.urgencia as keyof typeof TICKET_URGENCIA_LABEL] || t.urgencia}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${TICKET_ESTADO_STYLE[t.estado as keyof typeof TICKET_ESTADO_STYLE] || ''}`}>
                                                    {TICKET_ESTADO_LABEL[t.estado as keyof typeof TICKET_ESTADO_LABEL] || t.estado}
                                                </span>
                                                {abierto && sla.estado === 'vencido' && (
                                                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider">
                                                        SLA vencido
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                                {t.titulo}
                                            </p>

                                            <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {t.reportadoPorNombre || t.reportadoPor?.nombreCompleto || 'Anónimo'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {fechaRelativa(t.createdAt)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MessageSquare className="w-3 h-3" />
                                                    {t._count?.comentarios || 0}
                                                </span>
                                                <span className="hidden sm:inline-flex items-center gap-1">
                                                    <ArrowUpRight className="w-3 h-3" />
                                                    {prioridadLabel(t.prioridad)}
                                                </span>
                                                {t.asignadoANombre && (
                                                    <span className="hidden md:inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                                        <ShieldAlert className="w-3 h-3" />
                                                        {t.asignadoANombre}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-2 group-hover:text-rose-500 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <ReportTicketModal
                open={openReport}
                onClose={() => setOpenReport(false)}
                onCreated={() => fetchData()}
            />

            {/* Detalle */}
            {selected && (
                <div className="fixed inset-0 z-[205] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelected(null)} />

                    <div className="relative w-full max-w-3xl bg-card text-card-foreground rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-300 my-auto">
                        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-[10px] font-black text-slate-400 tracking-wider">{selected.codigo}</span>
                                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${TICKET_ESTADO_STYLE[(detail?.estado || selected.estado) as keyof typeof TICKET_ESTADO_STYLE] || ''}`}>
                                        {TICKET_ESTADO_LABEL[(detail?.estado || selected.estado) as keyof typeof TICKET_ESTADO_LABEL] || selected.estado}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${TICKET_URGENCIA_STYLE[(detail?.urgencia || selected.urgencia) as keyof typeof TICKET_URGENCIA_STYLE] || ''}`}>
                                        {TICKET_URGENCIA_LABEL[(detail?.urgencia || selected.urgencia) as keyof typeof TICKET_URGENCIA_LABEL]}
                                    </span>
                                </div>
                                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">
                                    {detail?.titulo || selected.titulo}
                                </h2>
                            </div>
                            <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg shrink-0">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-1 px-3 border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
                            {[
                                { id: 'detalle', label: 'Detalle', icon: FileCode2 },
                                { id: 'analisis', label: 'Análisis del agente', icon: Brain },
                                { id: 'historial', label: 'Historial', icon: History },
                                { id: 'comentarios', label: 'Comentarios', icon: MessageSquare },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id as any)}
                                    className={`flex items-center gap-1.5 h-11 px-3 text-[12px] font-bold border-b-2 transition-colors whitespace-nowrap ${
                                        tab === t.id
                                            ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <t.icon className="w-3.5 h-3.5" />
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 max-h-[62vh] overflow-y-auto">
                            {detailLoading || !detail ? (
                                <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Cargando…</p>
                                </div>
                            ) : tab === 'detalle' ? (
                                <div className="space-y-5">
                                    <section>
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descripción</h3>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{detail.descripcion}</p>
                                    </section>

                                    {detail.pasosReproducir && (
                                        <section>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cómo reproducirlo</h3>
                                            <pre className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 whitespace-pre-wrap font-sans">{detail.pasosReproducir}</pre>
                                        </section>
                                    )}

                                    {detail.comportamientoEsperado && (
                                        <section>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Comportamiento esperado</h3>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{detail.comportamientoEsperado}</p>
                                        </section>
                                    )}

                                    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Prioridad', value: prioridadLabel(detail.prioridad) },
                                            { label: 'Impacto', value: (TICKET_IMPACTO_LABEL as any)[detail.impacto] || detail.impacto },
                                            { label: 'Riesgo', value: (TICKET_RIESGO_LABEL as any)[detail.riesgo] || detail.riesgo },
                                            {
                                                label: 'Auto-fix',
                                                value: detail.autoFixPermitido
                                                    ? 'Habilitado'
                                                    : detail.autoFixAutorizadoPorUsuario ? 'Autorizado, no habilitado' : 'No',
                                            },
                                        ].map(item => (
                                            <div key={item.label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                                                <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 mt-0.5">{item.value}</p>
                                            </div>
                                        ))}
                                    </section>

                                    {detail.clasificacionDeclarada && (
                                        ['tipo', 'urgencia', 'impacto', 'prioridad'].some(k => detail.clasificacionDeclarada[k] && detail.clasificacionDeclarada[k] !== detail[k])
                                    ) && (
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            Declarado por quien reportó:{' '}
                                            {[
                                                (TICKET_TIPO_LABEL as any)[detail.clasificacionDeclarada.tipo] || detail.clasificacionDeclarada.tipo,
                                                `urgencia ${(TICKET_URGENCIA_LABEL as any)[detail.clasificacionDeclarada.urgencia] || detail.clasificacionDeclarada.urgencia}`,
                                                `impacto ${(TICKET_IMPACTO_LABEL as any)[detail.clasificacionDeclarada.impacto] || detail.clasificacionDeclarada.impacto}`,
                                                detail.clasificacionDeclarada.prioridad,
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                    )}

                                    <section>
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contexto técnico</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                                            {Object.entries(detail.contexto || {}).map(([k, v]) => (
                                                <p key={k} className="truncate"><span className="text-slate-400">{k}:</span> {String(v)}</p>
                                            ))}
                                            {Object.keys(detail.contexto || {}).length === 0 && <p>Sin contexto registrado.</p>}
                                        </div>
                                    </section>

                                    {Array.isArray(detail.adjuntos) && detail.adjuntos.length > 0 && (
                                        <section>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Adjuntos</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {detail.adjuntos.map((a: any) => (
                                                    <a
                                                        key={a.url}
                                                        href={a.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        <Paperclip className="w-3 h-3" />
                                                        {a.nombre}
                                                    </a>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {detail.resolucion && (
                                        <section>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Resolución</h3>
                                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap">{detail.resolucion}</p>
                                        </section>
                                    )}
                                </div>
                            ) : tab === 'analisis' ? (
                                <div className="space-y-4">
                                    {detail.analisisAgente ? (
                                        <>
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                                                    <p className="text-[11px] font-bold text-violet-700 dark:text-violet-300">
                                                        {analisisEsGemini ? 'Triaje automático con Gemini' : 'Evaluación registrada por el agente'}.
                                                        {' '}Riesgo: {(TICKET_RIESGO_LABEL as any)[detail.riesgo] || detail.riesgo}
                                                    </p>
                                                </div>
                                                {puedeAnalizar && (
                                                    <button
                                                        onClick={analizarConIA}
                                                        disabled={analizando}
                                                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 disabled:opacity-60 transition-colors shrink-0"
                                                    >
                                                        {analizando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                                        {analizando ? 'Analizando…' : 'Re-analizar'}
                                                    </button>
                                                )}
                                            </div>

                                            {[
                                                ['Resumen', detail.analisisAgente.resumen],
                                                ['Causa raíz', detail.analisisAgente.causaRaiz],
                                                ['Alcance', detail.analisisAgente.alcance],
                                                ['Plan', detail.analisisAgente.plan],
                                            ].map(([label, value]) => value ? (
                                                <section key={label as string}>
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label as string}</h3>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{String(value)}</p>
                                                </section>
                                            ) : null)}

                                            {detail.estimacion && (
                                                <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Esfuerzo</p>
                                                        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{detail.estimacion.esfuerzo || '—'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Horas</p>
                                                        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{detail.estimacion.horas ?? '—'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Confianza</p>
                                                        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{detail.estimacion.confianza || '—'}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Riesgo</p>
                                                        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{(TICKET_RIESGO_LABEL as any)[detail.estimacion.riesgo] || detail.estimacion.riesgo || '—'}</p>
                                                    </div>
                                                </section>
                                            )}

                                            {Array.isArray(detail.analisisAgente.archivosProbables) && detail.analisisAgente.archivosProbables.length > 0 && (
                                                <section>
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Archivos probables</h3>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {detail.analisisAgente.archivosProbables.map((f: string) => (
                                                            <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                                                                <FileCode2 className="w-3 h-3" />
                                                                {f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}

                                            {Array.isArray(detail.analisisAgente.preguntasAlUsuario) && detail.analisisAgente.preguntasAlUsuario.length > 0 && (
                                                <section>
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Datos que faltan</h3>
                                                    <ul className="space-y-1.5">
                                                        {detail.analisisAgente.preguntasAlUsuario.map((p: string) => (
                                                            <li key={p} className="flex gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                <span className="text-violet-500 font-black">?</span>
                                                                <span>{p}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </section>
                                            )}

                                            {Array.isArray(detail.analisisAgente.duplicadosProbables) && detail.analisisAgente.duplicadosProbables.length > 0 && (
                                                <section>
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Posibles duplicados</h3>
                                                    <div className="space-y-1.5">
                                                        {detail.analisisAgente.duplicadosProbables.map((d: any) => (
                                                            <div key={d.codigo} className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 p-2.5">
                                                                <p className="text-[11px] font-black text-amber-700 dark:text-amber-300">{d.codigo}</p>
                                                                {d.motivo && <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80 mt-0.5">{d.motivo}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}

                                            {detail.analisisAgente.respuestaSugerida && (
                                                <section>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Respuesta sugerida</h3>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard?.writeText(detail.analisisAgente.respuestaSugerida);
                                                                showToast('Respuesta copiada', 'success');
                                                            }}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                        >
                                                            <Copy className="w-3 h-3" /> Copiar
                                                        </button>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                                                        {detail.analisisAgente.respuestaSugerida}
                                                    </p>
                                                </section>
                                            )}

                                        </>
                                    ) : (
                                        <div className="py-10 text-center">
                                            <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-50 dark:bg-violet-900/20 text-violet-500 flex items-center justify-center mb-4">
                                                <Brain className="w-7 h-7" />
                                            </div>
                                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">Todavía no hay evaluación</p>
                                            <p className="text-xs text-slate-400 font-medium mt-1 max-w-md mx-auto">
                                                Gemini puede clasificar el ticket, estimar el riesgo y proponer un plan ahora mismo.
                                                La corrección del código, si hace falta, la hace un agente con acceso al repositorio.
                                            </p>

                                            {puedeAnalizar && (
                                                <button
                                                    onClick={analizarConIA}
                                                    disabled={analizando}
                                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-black uppercase tracking-widest hover:bg-violet-700 disabled:opacity-60 transition-colors"
                                                >
                                                    {analizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                    {analizando ? 'Analizando…' : 'Analizar con IA'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <AgentePanel ticket={detail} canManage={canManage} />
                                </div>
                            ) : tab === 'historial' ? (
                                <div className="space-y-3">
                                    {(detail.historial || []).length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-8">Sin movimientos registrados.</p>
                                    ) : (
                                        detail.historial.map((h: any, i: number) => (
                                            <div key={h.id} className="flex gap-3">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5" />
                                                    {i < detail.historial.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />}
                                                </div>
                                                <div className="pb-2">
                                                    <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                                        {h.estadoAnterior === '-' ? 'Ticket creado' : `${(TICKET_ESTADO_LABEL as any)[h.estadoAnterior] || h.estadoAnterior} → ${(TICKET_ESTADO_LABEL as any)[h.estadoNuevo] || h.estadoNuevo}`}
                                                    </p>
                                                    <p className="text-[10px] font-semibold text-slate-400">
                                                        {h.usuario} · {fechaRelativa(h.createdAt)}
                                                    </p>
                                                    {h.comentario && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{h.comentario}</p>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2.5">
                                        {(detail.comentarios || []).length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-6">Todavía no hay comentarios.</p>
                                        ) : (
                                            detail.comentarios.map((c: any) => (
                                                <div key={c.id} className={`rounded-xl border p-3 ${c.interno ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{c.autor}</p>
                                                        <p className="text-[10px] font-semibold text-slate-400">{fechaRelativa(c.createdAt)}</p>
                                                    </div>
                                                    <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{c.texto}</p>
                                                    {c.interno && <span className="inline-block mt-1 text-[9px] font-black text-amber-600 uppercase tracking-widest">Nota interna</span>}
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                                        <textarea
                                            value={comentario}
                                            onChange={e => setComentario(e.target.value)}
                                            rows={3}
                                            placeholder="Escribí un comentario…"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                                        />
                                        <div className="flex items-center justify-between mt-2">
                                            {canManage ? (
                                                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                    <input
                                                        type="checkbox"
                                                        checked={comentarioInterno}
                                                        onChange={e => setComentarioInterno(e.target.checked)}
                                                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                                    />
                                                    Nota interna
                                                </label>
                                            ) : <span />}
                                            <button
                                                onClick={enviarComentario}
                                                disabled={!comentario.trim() || guardando}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white text-[12px] font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                                            >
                                                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                Comentar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer de gestión */}
                        {detail && canManage && (
                            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cambiar estado</label>
                                        <select
                                            value={nuevoEstado || detail.estado}
                                            onChange={e => setNuevoEstado(e.target.value)}
                                            className="w-full h-9 px-3 rounded-lg bg-card text-card-foreground border border-slate-200 dark:border-slate-700 text-[12px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-rose-500"
                                        >
                                            <option value={detail.estado}>{(TICKET_ESTADO_LABEL as any)[detail.estado] || detail.estado} (actual)</option>
                                            {transiciones.map(e => (
                                                <option key={e} value={e}>{(TICKET_ESTADO_LABEL as any)[e] || e}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Asignar a</label>
                                        <select
                                            value={asignado}
                                            onChange={e => setAsignado(e.target.value)}
                                            className="w-full h-9 px-3 rounded-lg bg-card text-card-foreground border border-slate-200 dark:border-slate-700 text-[12px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-rose-500"
                                        >
                                            <option value="">Sin asignar</option>
                                            {operadores.map(o => (
                                                <option key={o.id} value={o.id}>{o.nombreCompleto}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => aplicarCambios()}
                                        disabled={guardando}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-[12px] font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                                    >
                                        {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
                                        Guardar cambios
                                    </button>

                                    {detail.estado === 'pendiente_aprobacion' && (
                                        <button
                                            onClick={() => aplicarCambios({ estado: 'listo_para_fix', comentario: 'Aprobado para implementación.' })}
                                            disabled={guardando}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Aprobar corrección
                                        </button>
                                    )}

                                    {detail.estado === 'resuelto' && (
                                        <button
                                            onClick={() => aplicarCambios({ estado: 'cerrado', comentario: 'Ticket cerrado.' })}
                                            disabled={guardando}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 text-white text-[12px] font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Cerrar ticket
                                        </button>
                                    )}

                                    {transiciones.includes('pendiente_aprobacion') && (
                                        <button
                                            onClick={() => aplicarCambios({ estado: 'pendiente_aprobacion', comentario: 'Escalado para revisión humana.' })}
                                            disabled={guardando}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[12px] font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
                                        >
                                            <ShieldAlert className="w-3.5 h-3.5" />
                                            Escalar
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {detail && !canManage && detail.estado === 'resuelto' && (
                            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 flex flex-wrap gap-2">
                                <button
                                    onClick={() => aplicarCambios({ estado: 'cerrado', comentario: 'Cierre confirmado por el autor.' })}
                                    disabled={guardando}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Confirmar cierre
                                </button>
                                <button
                                    onClick={() => aplicarCambios({ estado: 'en_revision', comentario: 'El autor reabrió el ticket.' })}
                                    disabled={guardando}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[12px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Reabrir
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
