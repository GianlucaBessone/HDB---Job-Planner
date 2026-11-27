'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Briefcase, Check, ChevronRight, Columns3, LayoutDashboard, List, ListTodo, Plus,
    Bell, Timer, Trash2, Users as UsersIcon,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import ModuleHeader from '@/components/ModuleHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Badge, BarraSeleccion, EmptyState, LoadingState, useSeleccion } from '@/components/ui';
import { avisarLote, enLote } from '@/lib/lote';
import { cn } from '@/lib/cn';
import { useViewState } from '@/lib/hooks/useViewState';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { useAcceso } from '@/lib/store/useAccessStore';
import { estaAbierta } from '@/lib/tareas/vencimiento';
import QuickAddTarea, { type BorradorTarea } from '@/components/tareas/QuickAddTarea';
import TareaFormDialog from '@/components/tareas/TareaFormDialog';
import TareasDashboard from '@/components/tareas/TareasDashboard';
import {
    ESTADOS, PRIORIDADES, columnaDeEstado, compararAbiertas, compararCerradas,
    getEstadoConfig, getPrioridadConfig, getVencimientoInfo, iniciales,
    type OperadorOpcion, type ProyectoOpcion, type Tarea,
} from '@/components/tareas/tipos';

type Vista = 'dashboard' | 'kanban' | 'lista';

/** Tarjetas visibles en las columnas de cerradas antes de "Ver más". */
const LIMITE_CERRADAS = 8;

export default function TareasPage() {
    const acceso = useAcceso();
    const verTodas = acceso.puede('tareas.ver_todas');

    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [operators, setOperators] = useState<OperadorOpcion[]>([]);
    const [projects, setProjects] = useState<ProyectoOpcion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useViewState('tareas-filters', {
        view: 'kanban' as Vista,
        search: '',
        filterPrioridad: '',
        soloMias: false,
    });
    const { view, search, filterPrioridad, soloMias } = filters;

    const [dialog, setDialog] = useState<{ open: boolean; tarea: Tarea | null; borrador?: BorradorTarea | null; edit?: boolean }>({ open: false, tarea: null });
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
    const seleccion = useSeleccion();
    const [aplicandoLote, setAplicandoLote] = useState(false);

    // Drag & drop
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);

    const currentUser = useMemo(() => {
        if (typeof window === 'undefined') return null;
        try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; }
    }, []);

    /** Mismo criterio que el servidor (lib/tareas/acceso.ts). */
    const getPermissions = useCallback((tarea: Tarea | null) => {
        if (!tarea || !currentUser) return { canEditFull: true, canChangeStatus: true };
        const inv = tarea.involucrados.find(i => i.operatorId === currentUser.id);
        const canEditFull = verTodas || currentUser.id === tarea.creadorId || inv?.rol === 'responsable';
        return { canEditFull, canChangeStatus: canEditFull || inv?.rol === 'colaborador' };
    }, [currentUser, verTodas]);

    // ── Datos ──────────────────────────────────────────────────────
    const loadTareas = useCallback(async () => {
        if (!currentUser?.id) return;
        try {
            const data = await safeApiRequest('/api/tareas').then(r => r.json());
            setTareas(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('[LOAD_TAREAS]', e);
        }
    }, [currentUser]);

    const loadSupport = useCallback(async () => {
        try {
            const [ops, projs] = await Promise.all([
                safeApiRequest('/api/operators').then(r => r.json()),
                safeApiRequest('/api/projects').then(r => r.json()),
            ]);
            if (Array.isArray(ops)) {
                setOperators(ops.filter((o: any) => o.activo)
                    .map((o: any) => ({ id: o.id, nombreCompleto: o.nombreCompleto }))
                    .sort((a: OperadorOpcion, b: OperadorOpcion) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es')));
            }
            if (Array.isArray(projs)) {
                setProjects(projs.filter((p: any) => p.activo && p.estado !== 'finalizado')
                    .map((p: any) => ({ id: p.id, nombre: p.nombre, codigoProyecto: p.codigoProyecto })));
            }
        } catch (e) {
            console.error('[LOAD_SUPPORT]', e);
        }
    }, []);

    useEffect(() => {
        Promise.all([loadTareas(), loadSupport()]).finally(() => setIsLoading(false));
    }, [loadTareas, loadSupport]);

    // Enlace directo desde una notificación: /tareas?id=...
    const deepLinkHecho = useRef(false);
    useEffect(() => {
        if (deepLinkHecho.current || isLoading || typeof window === 'undefined') return;
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id) return;
        const t = tareas.find(x => x.id === id);
        if (t) {
            deepLinkHecho.current = true;
            setDialog({ open: true, tarea: t });
        }
    }, [isLoading, tareas]);

    // ── Filtros ────────────────────────────────────────────────────
    const filteredTareas = useMemo(() => {
        const normalize = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const q = normalize(search);
        return tareas.filter(t => {
            if (q) {
                const match = normalize(t.titulo).includes(q)
                    || normalize(t.descripcion || '').includes(q)
                    || normalize(t.creadorNombre).includes(q)
                    || normalize(t.categoria || '').includes(q)
                    || normalize(t.project?.nombre || '').includes(q)
                    || normalize(t.project?.codigoProyecto || '').includes(q)
                    || t.involucrados.some(inv => normalize(inv.operator.nombreCompleto).includes(q));
                if (!match) return false;
            }
            if (filterPrioridad && t.prioridad !== filterPrioridad) return false;
            if (soloMias && currentUser && t.creadorId !== currentUser.id && !t.involucrados.some(i => i.operatorId === currentUser.id)) return false;
            return true;
        });
    }, [tareas, search, filterPrioridad, soloMias, currentUser]);

    const kanbanColumns = useMemo(() => {
        const cols: Record<string, Tarea[]> = { pendiente: [], en_progreso: [], completada: [], cancelada: [] };
        filteredTareas.forEach(t => { cols[columnaDeEstado(t.estado)]?.push(t); });
        cols.pendiente.sort(compararAbiertas);
        cols.en_progreso.sort(compararAbiertas);
        cols.completada.sort(compararCerradas);
        cols.cancelada.sort(compararCerradas);
        return cols;
    }, [filteredTareas]);

    const listaOrdenada = useMemo(() => [
        ...filteredTareas.filter(t => estaAbierta(t.estado)).sort(compararAbiertas),
        ...filteredTareas.filter(t => !estaAbierta(t.estado)).sort(compararCerradas),
    ], [filteredTareas]);

    const categorias = useMemo(
        () => Array.from(new Set(tareas.map(t => t.categoria?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'es')),
        [tareas]
    );

    // ── Acciones ───────────────────────────────────────────────────
    const openNew = (borrador?: BorradorTarea) => setDialog({ open: true, tarea: null, borrador: borrador || null });
    const openTarea = (t: Tarea, edit = false) => setDialog({ open: true, tarea: t, edit });

    const registerCommand = useCommandStore(s => s.registerCommand);
    const unregisterCommand = useCommandStore(s => s.unregisterCommand);
    const openNewRef = useRef(openNew);
    openNewRef.current = openNew;
    useEffect(() => {
        registerCommand({
            id: 'tareas-new',
            label: 'Nueva Tarea',
            category: 'Contextual',
            keys: ['ctrl', 'n'],
            action: () => openNewRef.current(),
        });
        return () => unregisterCommand('tareas-new');
    }, [registerCommand, unregisterCommand]);

    const handleDelete = async (id: string) => {
        try {
            const res = await safeApiRequest(`/api/tareas?${new URLSearchParams({ id })}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al eliminar');
            }
            showToast('Tarea eliminada', 'success');
            setDialog({ open: false, tarea: null });
            await loadTareas();
        } catch (e: any) {
            showToast(e?.message || 'Error al eliminar', 'error');
        }
        setConfirmDelete(null);
    };

    const handleQuickStatusChange = async (tarea: Tarea, nuevo: string) => {
        if (tarea.estado === nuevo) return;
        const anterior = tarea;
        const completada = nuevo === 'completada' ? new Date().toISOString() : undefined;
        setTareas(prev => prev.map(t => t.id === tarea.id ? { ...t, estado: nuevo, fechaCompletada: completada } : t));
        try {
            const res = await safeApiRequest('/api/tareas', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tarea.id, estado: nuevo }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al actualizar estado');
            }
            const actualizada = await res.json().catch(() => null);
            if (actualizada?.id) setTareas(prev => prev.map(t => t.id === tarea.id ? { ...t, ...actualizada } : t));
            showToast(`Tarea movida a "${getEstadoConfig(nuevo).label}"`, 'success');
        } catch (e: any) {
            setTareas(prev => prev.map(t => t.id === tarea.id ? anterior : t));
            showToast(e?.message || 'Error al actualizar estado', 'error');
        }
    };

    // ── Acciones masivas (P33, vista Lista) ───────────────────────
    const seleccionables = useMemo(
        () => (view === 'lista' ? listaOrdenada.filter(t => getPermissions(t).canChangeStatus).map(t => t.id) : []),
        [view, listaOrdenada, getPermissions]
    );
    const { recortar } = seleccion;
    useEffect(() => { recortar(seleccionables); }, [seleccionables]); // eslint-disable-line react-hooks/exhaustive-deps

    const aplicarLote = async (cambios: Record<string, unknown>, hecho: string | [string, string]) => {
        const ids = Array.from(seleccion.ids);
        if (ids.length === 0) return;
        setAplicandoLote(true);
        const r = await enLote(ids, id => safeApiRequest('/api/tareas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...cambios }),
        }));
        setAplicandoLote(false);
        avisarLote(r, ['tarea', 'tareas'], hecho);
        seleccion.limpiar();
        await loadTareas();
    };

    const puedeSoltar = (t: Tarea, destino: string) => {
        const { canEditFull, canChangeStatus } = getPermissions(t);
        return canEditFull || (canChangeStatus && destino !== 'cancelada');
    };

    const handleDrop = async (e: React.DragEvent, destino: string) => {
        e.preventDefault();
        setDragOver(null);
        const t = tareas.find(x => x.id === draggedId);
        setDraggedId(null);
        if (!t || columnaDeEstado(t.estado) === destino) return;
        if (!puedeSoltar(t, destino)) {
            showToast('No tenés permiso para mover la tarea a ese estado', 'error');
            return;
        }
        await handleQuickStatusChange(t, destino);
    };

    // ── Render ─────────────────────────────────────────────────────
    if (isLoading) return <LoadingState label="Cargando tareas…" />;

    const abiertas = tareas.filter(t => estaAbierta(t.estado)).length;

    return (
        <div className="w-full space-y-4 md:space-y-5 animate-in fade-in duration-200 pb-20">
            <ModuleHeader
                title="Tareas"
                description="Planificación, involucrados y recordatorios"
                icon={<ListTodo />}
                searchValue={search}
                onSearchChange={v => setFilters({ search: v })}
                searchPlaceholder="Buscar tareas…"
                actions={[
                    { id: 'new-tarea', label: 'Nueva tarea', icon: <Plus />, onClick: () => openNew(), variant: 'primary', hideLabelOnMobile: true },
                ]}
                tabs={[
                    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
                    { id: 'kanban', label: 'Kanban', icon: <Columns3 />, count: abiertas },
                    { id: 'lista', label: 'Lista', icon: <List /> },
                ]}
                activeTabId={view}
                onTabChange={id => setFilters({ view: id as Vista })}
                toolbar={view !== 'dashboard' ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={filterPrioridad}
                            onChange={e => setFilters({ filterPrioridad: e.target.value })}
                            aria-label="Filtrar por prioridad"
                            className="input h-9 w-auto"
                        >
                            <option value="">Todas las prioridades</option>
                            {PRIORIDADES.slice().reverse().map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-[13px] cursor-pointer select-none">
                            <input type="checkbox" checked={soloMias} onChange={e => setFilters({ soloMias: e.target.checked })} className="accent-primary" />
                            Solo mías
                        </label>
                    </div>
                ) : undefined}
            />

            <QuickAddTarea
                operators={operators}
                onCreated={t => setTareas(prev => [t, ...prev])}
                onMasDetalles={b => openNew(b)}
            />

            {view === 'dashboard' && (
                <TareasDashboard
                    tareas={tareas}
                    onOpen={t => openTarea(t)}
                    onFiltrarPrioridad={p => setFilters({ view: 'kanban', filterPrioridad: p })}
                />
            )}

            {view === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                    {ESTADOS.map(col => {
                        const todas = kanbanColumns[col.value] || [];
                        const cerrada = col.value === 'completada' || col.value === 'cancelada';
                        const visibles = cerrada && !expandidas[col.value] ? todas.slice(0, LIMITE_CERRADAS) : todas;
                        const arrastrada = draggedId ? tareas.find(t => t.id === draggedId) : null;
                        const destinoValido = !!arrastrada && columnaDeEstado(arrastrada.estado) !== col.value && puedeSoltar(arrastrada, col.value);
                        return (
                            <section
                                key={col.value}
                                aria-label={col.label}
                                className={cn(
                                    'rounded-2xl bg-surface-sunken p-2.5 space-y-2.5 transition-colors min-h-[160px]',
                                    dragOver === col.value && destinoValido && 'ring-2 ring-brand-400 bg-brand-50/60 dark:bg-brand-900/20'
                                )}
                                onDragOver={e => {
                                    if (!arrastrada) return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = destinoValido ? 'move' : 'none';
                                    if (dragOver !== col.value) setDragOver(col.value);
                                }}
                                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                                onDrop={e => handleDrop(e, col.value)}
                            >
                                <header className="flex items-center justify-between px-1.5 pt-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('w-2.5 h-2.5 rounded-full', col.dot)} aria-hidden="true" />
                                        <h2 className="eyebrow">{col.label}</h2>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums bg-card border border-border text-muted-foreground px-2 py-0.5 rounded-full">{todas.length}</span>
                                </header>

                                {visibles.map(t => {
                                    const { canEditFull, canChangeStatus } = getPermissions(t);
                                    return (
                                        <TareaCard
                                            key={t.id}
                                            tarea={t}
                                            draggable={canChangeStatus}
                                            arrastrando={draggedId === t.id}
                                            onDragStart={e => { setDraggedId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                                            onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
                                            onOpen={() => openTarea(t)}
                                            onDelete={() => setConfirmDelete(t.id)}
                                            onStatusChange={s => handleQuickStatusChange(t, s)}
                                            canEditFull={canEditFull}
                                            canChangeStatus={canChangeStatus}
                                        />
                                    );
                                })}

                                {todas.length > LIMITE_CERRADAS && cerrada && (
                                    <button
                                        type="button"
                                        onClick={() => setExpandidas(p => ({ ...p, [col.value]: !p[col.value] }))}
                                        className="w-full h-8 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                                    >
                                        {expandidas[col.value] ? 'Ver menos' : `Ver ${todas.length - LIMITE_CERRADAS} más`}
                                    </button>
                                )}

                                {todas.length === 0 && (
                                    <div className="border border-dashed border-border rounded-xl p-6 text-center">
                                        <p className="text-xs text-muted-foreground">
                                            {col.value === 'pendiente' ? 'Sin pendientes. Cargá una arriba.' : 'Arrastrá tareas acá'}
                                        </p>
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            {view === 'lista' && (
                listaOrdenada.length === 0 ? (
                    <EmptyState icon={<ListTodo />} title="No hay tareas" description={search || filterPrioridad || soloMias ? 'Probá con otros filtros.' : 'Cargá la primera desde la barra de alta rápida.'} />
                ) : (
                    <div className="space-y-2">
                    <BarraSeleccion
                        total={seleccionables.length}
                        seleccionadas={seleccion.cantidad}
                        onTodas={() => seleccion.poner(seleccionables)}
                        onNinguna={seleccion.limpiar}
                        unidad={['tarea', 'tareas']}
                    >
                        <button type="button" className="btn btn-primary btn-sm" disabled={aplicandoLote} onClick={() => aplicarLote({ estado: 'completada' }, ['completada', 'completadas'])}>
                            <Check aria-hidden="true" /> {aplicandoLote ? 'Aplicando…' : 'Completar'}
                        </button>
                        <select
                            aria-label="Cambiar el estado de las seleccionadas"
                            className="input h-8 w-auto text-[13px]"
                            value=""
                            disabled={aplicandoLote}
                            onChange={e => e.target.value && aplicarLote({ estado: e.target.value }, [`movida a "${getEstadoConfig(e.target.value).label}"`, `movidas a "${getEstadoConfig(e.target.value).label}"`])}
                        >
                            <option value="">Estado…</option>
                            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                        <select
                            aria-label="Cambiar la prioridad de las seleccionadas"
                            className="input h-8 w-auto text-[13px]"
                            value=""
                            disabled={aplicandoLote}
                            onChange={e => e.target.value && aplicarLote({ prioridad: e.target.value }, `con prioridad ${getPrioridadConfig(e.target.value).label.toLowerCase()}`)}
                        >
                            <option value="">Prioridad…</option>
                            {PRIORIDADES.slice().reverse().map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            Vence
                            <input
                                type="date"
                                aria-label="Cambiar el vencimiento de las seleccionadas"
                                className="input h-8 w-auto text-[13px]"
                                value=""
                                disabled={aplicandoLote}
                                onChange={e => e.target.value && aplicarLote({ fechaVencimiento: new Date(`${e.target.value}T23:59`).toISOString() }, `con vencimiento ${e.target.value.split('-').reverse().join('/')}`)}
                            />
                        </label>
                    </BarraSeleccion>
                    <div className="surface divide-y divide-border overflow-hidden">
                        {listaOrdenada.map(t => {
                            const { canEditFull, canChangeStatus } = getPermissions(t);
                            return (
                                <TareaListRow
                                    key={t.id}
                                    seleccionada={seleccion.tiene(t.id)}
                                    onSeleccionar={canChangeStatus ? () => seleccion.alternar(t.id) : undefined}
                                    tarea={t}
                                    onOpen={() => openTarea(t)}
                                    onDelete={() => setConfirmDelete(t.id)}
                                    onStatusChange={s => handleQuickStatusChange(t, s)}
                                    canEditFull={canEditFull}
                                    canChangeStatus={canChangeStatus}
                                />
                            );
                        })}
                    </div>
                    </div>
                )
            )}

            <TareaFormDialog
                open={dialog.open}
                onClose={() => setDialog(d => ({ ...d, open: false }))}
                tarea={dialog.tarea}
                borrador={dialog.borrador}
                startInEdit={dialog.edit}
                canEditFull={getPermissions(dialog.tarea).canEditFull}
                operators={operators}
                projects={projects}
                categorias={categorias}
                currentUserId={currentUser?.id}
                onSaved={loadTareas}
                onDelete={dialog.tarea ? () => setConfirmDelete(dialog.tarea!.id) : undefined}
            />

            <ConfirmDialog
                isOpen={!!confirmDelete}
                onCancel={() => setConfirmDelete(null)}
                onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
                title="¿Eliminar la tarea?"
                message="Se eliminan la tarea, sus comentarios y sus recordatorios programados."
                confirmLabel="Eliminar"
                variant="danger"
            />
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════
// Tarjeta del tablero
// ═════════════════════════════════════════════════════════════════════

function Avatares({ tarea, max, size = 'sm' }: { tarea: Tarea; max: number; size?: 'sm' | 'md' }) {
    const dim = size === 'sm' ? 'w-6 h-6 text-[11px]' : 'w-7 h-7 text-[11px]';
    return (
        <div className="flex -space-x-1.5">
            {tarea.involucrados.slice(0, max).map(inv => (
                <span
                    key={inv.id}
                    className={cn(dim, 'rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center border-2 border-card')}
                    title={`${inv.operator.nombreCompleto} (${inv.rol})`}
                >
                    {iniciales(inv.operator.nombreCompleto)}
                </span>
            ))}
            {tarea.involucrados.length > max && (
                <span className={cn(dim, 'rounded-full bg-muted text-muted-foreground font-semibold flex items-center justify-center border-2 border-card')}>
                    +{tarea.involucrados.length - max}
                </span>
            )}
        </div>
    );
}

function TareaCard({
    tarea, canEditFull, canChangeStatus, draggable, arrastrando,
    onDragStart, onDragEnd, onOpen, onDelete, onStatusChange,
}: {
    tarea: Tarea;
    canEditFull: boolean;
    canChangeStatus: boolean;
    draggable: boolean;
    arrastrando: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onOpen: () => void;
    onDelete: () => void;
    onStatusChange: (s: string) => void;
}) {
    const prioridad = getPrioridadConfig(tarea.prioridad);
    const venc = getVencimientoInfo(tarea);
    const activos = tarea.recordatorios.filter(r => !r.disparado && r.cronJobActivo).length;
    const cerrada = !estaAbierta(tarea.estado);

    return (
        <article
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onOpen}
            onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
            tabIndex={0}
            aria-label={tarea.titulo}
            className={cn(
                'relative bg-card text-card-foreground rounded-xl border border-border p-3 pl-4 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all group overflow-hidden focus-visible:outline-2 focus-visible:outline-ring',
                draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                arrastrando && 'opacity-50',
                venc?.vencida && 'border-danger-200 dark:border-danger-900'
            )}
        >
            <span className={cn('absolute left-0 top-0 bottom-0 w-1', prioridad.bar, cerrada && 'opacity-40')} aria-hidden="true" />

            <div className="flex items-start justify-between gap-2 mb-1.5">
                <Badge tone={cerrada ? 'neutral' : prioridad.tone}>{prioridad.label}</Badge>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {canChangeStatus && tarea.estado === 'pendiente' && (
                        <button type="button" onClick={() => onStatusChange('en_progreso')} className="p-1 rounded-md text-info-600 hover:bg-info-50 dark:hover:bg-info-900/20" title="Iniciar" aria-label="Iniciar">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                    {canChangeStatus && estaAbierta(tarea.estado) && (
                        <button type="button" onClick={() => onStatusChange('completada')} className="p-1 rounded-md text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20" title="Completar" aria-label="Completar">
                            <Check className="w-4 h-4" />
                        </button>
                    )}
                    {canEditFull && (
                        <button type="button" onClick={onDelete} className="p-1 rounded-md text-muted-foreground hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20" title="Eliminar" aria-label="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <h3 className={cn('text-sm font-semibold leading-snug line-clamp-2', cerrada && 'text-muted-foreground')}>{tarea.titulo}</h3>
            {tarea.descripcion && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{tarea.descripcion}</p>}

            {(tarea.project || venc) && (
                <div className="flex flex-col gap-1 mt-2">
                    {tarea.project && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                            <Briefcase className="w-3 h-3 shrink-0" /> {tarea.project.codigoProyecto || tarea.project.nombre}
                        </span>
                    )}
                    {venc && (
                        <span className={cn('flex items-center gap-1.5 text-xs', venc.className)}>
                            <Timer className="w-3 h-3 shrink-0" /> {venc.text}
                        </span>
                    )}
                </div>
            )}

            {(tarea.involucrados.length > 0 || activos > 0) && (
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border">
                    <Avatares tarea={tarea} max={4} />
                    {activos > 0 && (
                        <span className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400" title={`${activos} recordatorio(s) activo(s)`}>
                            <Bell className="w-3.5 h-3.5" /> {activos}
                        </span>
                    )}
                </div>
            )}
        </article>
    );
}

// ═════════════════════════════════════════════════════════════════════
// Fila de la lista
// ═════════════════════════════════════════════════════════════════════

function TareaListRow({
    tarea, canEditFull, canChangeStatus, onOpen, onDelete, onStatusChange, seleccionada, onSeleccionar,
}: {
    tarea: Tarea;
    seleccionada: boolean;
    /** Sin función, la tarea no se puede elegir (no podés cambiarle el estado). */
    onSeleccionar?: () => void;
    canEditFull: boolean;
    canChangeStatus: boolean;
    onOpen: () => void;
    onDelete: () => void;
    onStatusChange: (s: string) => void;
}) {
    const estado = getEstadoConfig(tarea.estado);
    const prioridad = getPrioridadConfig(tarea.prioridad);
    const venc = getVencimientoInfo(tarea);
    const activos = tarea.recordatorios.filter(r => !r.disparado && r.cronJobActivo).length;
    const completada = columnaDeEstado(tarea.estado) === 'completada';
    const cerrada = !estaAbierta(tarea.estado);

    return (
        <div className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group', seleccionada && 'bg-brand-50/60 dark:bg-brand-950/30')}>
            <input
                type="checkbox"
                className="w-4 h-4 accent-primary shrink-0 disabled:opacity-30"
                aria-label={`Seleccionar "${tarea.titulo}"`}
                checked={seleccionada}
                disabled={!onSeleccionar}
                onChange={() => onSeleccionar?.()}
            />
            <button
                type="button"
                disabled={!canChangeStatus}
                onClick={() => onStatusChange(completada ? 'pendiente' : 'completada')}
                aria-label={completada ? 'Volver a pendiente' : 'Marcar como completada'}
                title={completada ? 'Volver a pendiente' : 'Completar'}
                className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    completada ? 'bg-success-500 border-success-500 text-white' : tarea.estado === 'en_progreso' ? 'border-info-500 hover:bg-info-50 dark:hover:bg-info-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-success-500'
                )}
            >
                {completada && <Check className="w-3 h-3" />}
            </button>

            <span className={cn('w-1 h-8 rounded-full shrink-0', prioridad.bar, cerrada && 'opacity-40')} aria-hidden="true" />

            <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
                <span className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-medium truncate', completada && 'line-through text-muted-foreground')}>{tarea.titulo}</span>
                    <Badge tone={cerrada ? 'neutral' : prioridad.tone}>{prioridad.label}</Badge>
                    {tarea.estado !== 'pendiente' && <Badge tone={estado.tone} dot>{estado.label}</Badge>}
                </span>
                <span className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                    {tarea.project && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {tarea.project.codigoProyecto || tarea.project.nombre}</span>}
                    {venc && <span className={cn('flex items-center gap-1', venc.className)}><Timer className="w-3 h-3" /> {venc.text}</span>}
                    {tarea.involucrados.length > 0 && <span className="flex items-center gap-1 md:hidden"><UsersIcon className="w-3 h-3" /> {tarea.involucrados.length}</span>}
                    {activos > 0 && <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400"><Bell className="w-3 h-3" /> {activos}</span>}
                </span>
            </button>

            <div className="hidden md:block shrink-0"><Avatares tarea={tarea} max={3} size="md" /></div>

            {canEditFull && (
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label="Eliminar"
                    title="Eliminar"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
