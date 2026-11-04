'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, FilterX, Loader2, MapPin, PenLine, Printer, RefreshCw, ShieldAlert, ClipboardList } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, LoadingState, Pagination, SegmentedControl, Stat, Textarea } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatDate } from '@/lib/formatDate';
import { useViewState } from '@/lib/hooks/useViewState';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { cn } from '@/lib/cn';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import InformeControlHorario from '@/components/control-horario/InformeControlHorario';
import {
    calcularTotales,
    canUseControlHorario,
    ESTADO_LABEL,
    evaluarFila,
    formatDiferencia,
    formatHoras,
    formatRango,
    horasEntre,
    type AjusteDia,
    type ControlHorarioRow,
    type EstadoControl,
} from '@/lib/controlHorario';

const PAGE_SIZE = 50;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const ESTADO_TONE: Record<EstadoControl, 'neutral' | 'warning' | 'danger' | 'info'> = {
    ok: 'neutral',
    diferencia: 'warning',
    sin_gps: 'danger',
    sin_registro: 'warning',
    gps_abierta: 'info',
};

function hoyAR() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function inicioDeMes() {
    return `${hoyAR().slice(0, 8)}01`;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function diaSemana(fecha: string) {
    const d = new Date(`${fecha}T12:00:00`);
    return isNaN(d.getTime()) ? '' : DIAS[d.getDay()];
}

export default function ControlHorarioPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userLoaded, setUserLoaded] = useState(false);
    const [filters, setFilters] = useViewState('control-horario-filters', {
        from: inicioDeMes(),
        to: hoyAR(),
        operatorId: '',
        projectId: '',
        vista: 'todas' as 'todas' | 'diferencias',
    });
    const [rows, setRows] = useState<ControlHorarioRow[]>([]);
    const [ajustesDisponibles, setAjustesDisponibles] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [operators, setOperators] = useState<{ id: string; nombre: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string; nombre: string; extra?: string | null }[]>([]);
    const [page, setPage] = useState(1);
    const [informeOpen, setInformeOpen] = useState(false);
    const [editing, setEditing] = useState<ControlHorarioRow | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) setCurrentUser(JSON.parse(stored));
        } catch { /* sin sesión local */ }
        setUserLoaded(true);
    }, []);

    const allowed = canUseControlHorario(currentUser?.role);

    // Título de las migas de pan (el historial guarda el último segmento de la URL)
    const setTitle = useHistoryStore(s => s.setTitle);
    useEffect(() => {
        const t = setTimeout(() => setTitle('/timesheets/control-horario', 'Control horario'), 0);
        return () => clearTimeout(t);
    }, [setTitle]);

    useEffect(() => {
        if (!allowed) return;
        Promise.all([
            safeApiRequest('/api/operators').then(r => r.json()).catch(() => []),
            safeApiRequest('/api/projects').then(r => r.json()).catch(() => []),
        ]).then(([ops, projs]) => {
            setOperators(
                (Array.isArray(ops) ? ops : [])
                    .filter((o: any) => o?.id && o?.nombreCompleto && o.activo !== false)
                    .map((o: any) => ({ id: o.id, nombre: o.nombreCompleto }))
                    .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, 'es'))
            );
            setProjects(
                (Array.isArray(projs) ? projs : [])
                    .filter((p: any) => p?.id && p?.nombre)
                    .map((p: any) => ({ id: p.id, nombre: p.nombre, extra: p.codigoProyecto || p.cliente || null }))
            );
        });
    }, [allowed]);

    const load = useCallback(async () => {
        if (!filters.from || !filters.to) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ from: filters.from, to: filters.to });
            if (filters.operatorId) params.set('operatorId', filters.operatorId);
            if (filters.projectId) params.set('projectId', filters.projectId);
            const res = await safeApiRequest(`/api/control-horario?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'No se pudo cargar el control horario');
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setAjustesDisponibles(data?.ajustesDisponibles !== false);
            setPage(1);
        } catch (err: any) {
            setError(err?.message || 'No se pudo cargar el control horario');
        } finally {
            setLoading(false);
        }
    }, [filters.from, filters.to, filters.operatorId, filters.projectId]);

    useEffect(() => {
        if (allowed) load();
    }, [allowed, load]);

    const visibles = useMemo(
        () => (filters.vista === 'diferencias' ? rows.filter(r => evaluarFila(r).conDiferencia) : rows),
        [rows, filters.vista]
    );
    const totales = useMemo(() => calcularTotales(rows), [rows]);
    const pageRows = visibles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hayFiltros = !!(filters.operatorId || filters.projectId || filters.vista !== 'todas');

    const limpiarFiltros = () => {
        setFilters({ operatorId: '', projectId: '', vista: 'todas' });
        setPage(1);
    };

    const actualizarAjuste = (key: string, ajuste: AjusteDia | null) => {
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ajuste } : r)));
    };

    const registerCommand = useCommandStore(s => s.registerCommand);
    const unregisterCommand = useCommandStore(s => s.unregisterCommand);
    const latest = useRef({ abrirInforme: () => setInformeOpen(true) });
    useEffect(() => {
        if (!allowed) return;
        registerCommand({
            id: 'control-horario-informe',
            label: 'Imprimir informe de control horario',
            category: 'Contextual',
            action: () => latest.current.abrirInforme(),
        });
        return () => unregisterCommand('control-horario-informe');
    }, [allowed, registerCommand, unregisterCommand]);

    if (!userLoaded) return <LoadingState label="Cargando…" />;

    if (!allowed) {
        return (
            <div className="w-full">
                <ModuleHeader title="Control horario" icon={<ClipboardCheck />} />
                <div className="surface">
                    <EmptyState
                        icon={<ShieldAlert />}
                        title="No tenés permisos para ver el control horario"
                        description="Esta vista es solo para supervisores y administradores."
                    />
                </div>
            </div>
        );
    }

    const operadorNombre = operators.find(o => o.id === filters.operatorId)?.nombre || null;
    const proyectoNombre = projects.find(p => p.id === filters.projectId)?.nombre || null;

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Control horario"
                description="Cruce del registro de tiempos con la fichada GPS y ajuste manual por jornada"
                icon={<ClipboardCheck />}
                actions={[
                    { id: 'actualizar', label: 'Actualizar', icon: <RefreshCw />, onClick: load, variant: 'outline', hideLabelOnMobile: true },
                    { id: 'informe', label: 'Imprimir informe', icon: <Printer />, onClick: () => setInformeOpen(true), variant: 'primary', disabled: loading || rows.length === 0 },
                ]}
            />

            {/* Filtros */}
            <div className="surface p-4">
                <div className="grid grid-cols-2 lg:grid-cols-[160px_160px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
                    <Field label="Desde" htmlFor="ch-desde">
                        <input
                            id="ch-desde"
                            type="date"
                            className="input"
                            value={filters.from}
                            max={filters.to || undefined}
                            onChange={e => setFilters({ from: e.target.value })}
                        />
                    </Field>
                    <Field label="Hasta" htmlFor="ch-hasta">
                        <input
                            id="ch-hasta"
                            type="date"
                            className="input"
                            value={filters.to}
                            min={filters.from || undefined}
                            onChange={e => setFilters({ to: e.target.value })}
                        />
                    </Field>
                    <Field label="Operador" className="col-span-2 lg:col-span-1">
                        <SearchableSelect
                            options={operators}
                            value={filters.operatorId}
                            onChange={v => setFilters({ operatorId: v })}
                            placeholder="Todos los operadores"
                            searchPlaceholder="Buscar operador…"
                            allowClear
                        />
                    </Field>
                    <Field label="Proyecto" className="col-span-2 lg:col-span-1">
                        <SearchableSelect
                            options={projects}
                            value={filters.projectId}
                            onChange={v => setFilters({ projectId: v })}
                            placeholder="Todos los proyectos"
                            searchPlaceholder="Buscar proyecto…"
                            allowClear
                        />
                    </Field>
                    <div className="col-span-2 lg:col-span-1 flex items-center gap-2">
                        <SegmentedControl
                            label="Jornadas a mostrar"
                            value={filters.vista}
                            onChange={v => { setFilters({ vista: v }); setPage(1); }}
                            options={[
                                { value: 'todas', label: 'Todas' },
                                { value: 'diferencias', label: `Con diferencias (${totales.filasConDiferencia})` },
                            ]}
                        />
                        {hayFiltros && (
                            <Button variant="ghost" size="sm" icon={<FilterX />} onClick={limpiarFiltros}>
                                Limpiar
                            </Button>
                        )}
                    </div>
                </div>
                {filters.projectId && (
                    <p className="text-caption text-slate-500 dark:text-slate-400 mt-3">
                        Se muestran las jornadas completas de quienes trabajaron en el proyecto: el control horario es por operador y día.
                    </p>
                )}
            </div>

            {!ajustesDisponibles && (
                <div className="surface p-4 flex items-start gap-3 border-warning-300 dark:border-warning-800 bg-warning-50 dark:bg-warning-950/40" role="status">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-warning-700 dark:text-warning-300 shrink-0" />
                    <p className="text-[13px] text-warning-800 dark:text-warning-200">
                        Los ajustes manuales todavía no están habilitados: falta crear la tabla de ajustes en la base de datos. El cruce se puede consultar e imprimir igual.
                    </p>
                </div>
            )}

            {/* Indicadores */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Stat label="Horas registro" value={formatHoras(totales.horasRegistro)} hint={`${formatHoras(totales.horasExtra)} extra · ${totales.dias} jornadas`} />
                <Stat label="Horas fichada GPS" value={formatHoras(totales.horasGps)} hint={totales.gpsAbiertas ? `${totales.gpsAbiertas} sin cierre` : 'Fichadas cerradas'} />
                <Stat
                    label="Diferencia neta"
                    value={formatDiferencia(totales.diferenciaNeta)}
                    hint="GPS − registro"
                    tone={Math.abs(totales.diferenciaNeta) > 0.25 ? 'warning' : 'neutral'}
                />
                <Stat
                    label="Jornadas con diferencia"
                    value={totales.filasConDiferencia}
                    hint={`${totales.sinGps} sin fichada · ${totales.sinRegistro} sin registro`}
                    tone={totales.filasConDiferencia > 0 ? 'warning' : 'success'}
                />
                <Stat label="Horas finales" value={formatHoras(totales.horasFinales)} hint={`${totales.ajustes} ${totales.ajustes === 1 ? 'ajuste' : 'ajustes'} cargados`} className="col-span-2 lg:col-span-1" />
            </div>

            {/* Tabla */}
            <div className="surface overflow-hidden">
                {loading ? (
                    <LoadingState label="Cargando control horario…" />
                ) : error ? (
                    <ErrorState description={error} onRetry={load} />
                ) : visibles.length === 0 ? (
                    <EmptyState
                        icon={<ClipboardCheck />}
                        title={rows.length === 0 ? 'No hay jornadas en el período' : 'No hay jornadas con diferencias'}
                        description={rows.length === 0 ? 'No hay registros de tiempo ni fichadas GPS con estos filtros.' : 'Todas las jornadas del período coinciden dentro de la tolerancia de 15 minutos.'}
                        action={hayFiltros ? <Button variant="secondary" icon={<FilterX />} onClick={limpiarFiltros}>Limpiar filtros</Button> : undefined}
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="px-4 py-2">Operador</th>
                                        <th className="px-3 py-2">Fecha</th>
                                        <th className="px-3 py-2">Horario (registro)</th>
                                        <th className="px-3 py-2 text-right">Horas (registro)</th>
                                        <th className="px-3 py-2">Fichada GPS</th>
                                        <th className="px-3 py-2 text-right">Horas GPS</th>
                                        <th className="px-3 py-2 text-right">Dif.</th>
                                        <th className="px-3 pr-4 py-2">Ingreso / egreso (ajuste)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {pageRows.map(row => (
                                        <FilaControl
                                            key={row.key}
                                            row={row}
                                            ajustesDisponibles={ajustesDisponibles}
                                            onSaved={a => actualizarAjuste(row.key, a)}
                                            onEdit={() => setEditing(row)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={page} pageSize={PAGE_SIZE} total={visibles.length} onPageChange={setPage} />
                    </>
                )}
            </div>

            <p className="text-caption text-slate-500 dark:text-slate-400">
                Se marcan las jornadas cuyas horas GPS y de registro difieren en más de 15 minutos, o cuyo ingreso o egreso difiere en más de 15 minutos.
                El ajuste se guarda al salir del campo; las horas finales son las del ajuste o, si no hay, las del registro.
            </p>

            <AjusteDialog
                row={editing}
                onClose={() => setEditing(null)}
                onSaved={(key, a) => { actualizarAjuste(key, a); setEditing(null); }}
            />

            <InformeControlHorario
                open={informeOpen}
                onClose={() => setInformeOpen(false)}
                rows={rows}
                filtros={{ from: filters.from, to: filters.to, operador: operadorNombre, proyecto: proyectoNombre }}
                emitidoPor={currentUser?.nombreCompleto}
            />
        </div>
    );
}

// ── Persistencia del ajuste ──────────────────────────────────────────

async function guardarAjuste(row: ControlHorarioRow, horaIngreso: string, horaEgreso: string, observacion: string | null): Promise<AjusteDia> {
    const res = await safeApiRequest('/api/control-horario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: row.operatorId, fecha: row.fecha, horaIngreso, horaEgreso, observacion }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el ajuste');
    if (res.headers.get('X-Offline-Response')) throw new Error('Sin conexión: el ajuste no se guardó.');
    return data;
}

async function quitarAjuste(row: ControlHorarioRow): Promise<void> {
    const params = new URLSearchParams({ operatorId: row.operatorId, fecha: row.fecha });
    const res = await safeApiRequest(`/api/control-horario?${params.toString()}`, { method: 'DELETE' });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo quitar el ajuste');
    }
}

// ── Fila ─────────────────────────────────────────────────────────────

function FilaControl({
    row,
    ajustesDisponibles,
    onSaved,
    onEdit,
}: {
    row: ControlHorarioRow;
    ajustesDisponibles: boolean;
    onSaved: (a: AjusteDia | null) => void;
    onEdit: () => void;
}) {
    const ev = evaluarFila(row);
    const { registro, gps, ajuste } = row;
    const [ingreso, setIngreso] = useState(ajuste?.horaIngreso || '');
    const [egreso, setEgreso] = useState(ajuste?.horaEgreso || '');
    const [estado, setEstado] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        setIngreso(ajuste?.horaIngreso || '');
        setEgreso(ajuste?.horaEgreso || '');
    }, [ajuste?.horaIngreso, ajuste?.horaEgreso]);

    const persistir = async () => {
        const cambio = ingreso !== (ajuste?.horaIngreso || '') || egreso !== (ajuste?.horaEgreso || '');
        if (!cambio || estado === 'saving') return;
        try {
            if (!ingreso && !egreso) {
                if (!ajuste) return;
                setEstado('saving');
                await quitarAjuste(row);
                onSaved(null);
                showToast('Ajuste quitado', 'success');
            } else {
                if (!HORA.test(ingreso) || !HORA.test(egreso)) return; // espera a que estén los dos
                if (ingreso === egreso) {
                    showToast('El ingreso y el egreso no pueden ser iguales', 'error');
                    return;
                }
                setEstado('saving');
                const nuevo = await guardarAjuste(row, ingreso, egreso, ajuste?.observacion ?? null);
                onSaved(nuevo);
            }
            setEstado('saved');
            setTimeout(() => setEstado(s => (s === 'saved' ? 'idle' : s)), 2000);
        } catch (err: any) {
            setEstado('idle');
            showToast(err?.message || 'No se pudo guardar el ajuste', 'error');
        }
    };

    // Guardar cuando el foco sale de la celda (no al pasar de ingreso a egreso)
    const onBlurCelda = (e: React.FocusEvent<HTMLDivElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        persistir();
    };

    const marca = ev.conDiferencia && ev.estado !== 'gps_abierta';
    const horasAjusteBorrador = HORA.test(ingreso) && HORA.test(egreso) && ingreso !== egreso ? horasEntre(ingreso, egreso) : null;
    const ajusteDifiere = horasAjusteBorrador !== null && registro && Math.abs(horasAjusteBorrador - registro.horas) > 0.25;

    return (
        <tr className={cn(marca && 'bg-warning-50/70 dark:bg-warning-950/20')}>
            <td className="px-4 py-2 align-top">
                <div className="flex items-start gap-2">
                    <span
                        className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', marca ? 'bg-warning-500' : 'bg-transparent')}
                        aria-hidden="true"
                    />
                    <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.operatorName}</p>
                        {row.proyectos.length > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]" title={row.proyectos.join(', ')}>
                                {row.proyectos.join(', ')}
                            </p>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-3 py-2 align-top whitespace-nowrap tabular-nums">
                {formatDate(row.fecha)}
                <span className="block text-xs text-slate-500 dark:text-slate-400">{diaSemana(row.fecha)}</span>
            </td>
            <td className="px-3 py-2 align-top whitespace-nowrap tabular-nums">
                {registro ? (
                    <>
                        <span>{formatRango(registro.ingreso, registro.egreso)}</span>
                        {registro.causas.length > 0 && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{registro.causas.join(', ')}</span>
                        )}
                        {registro.registros > 1 && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{registro.registros} registros</span>
                        )}
                    </>
                ) : (
                    <span className="text-slate-400">—</span>
                )}
            </td>
            <td className="px-3 py-2 align-top text-right tabular-nums">
                {registro ? (
                    <>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatHoras(registro.horas)}</span>
                        {registro.horasExtra > 0 && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{formatHoras(registro.horasExtra)} extra</span>
                        )}
                    </>
                ) : (
                    <span className="text-slate-400">—</span>
                )}
            </td>
            <td className="px-3 py-2 align-top whitespace-nowrap tabular-nums">
                {gps ? (
                    <>
                        <span className={cn(ev.ingresoDifiere && 'font-semibold text-warning-800 dark:text-warning-200')}>{gps.ingreso || '—'}</span>
                        {' – '}
                        <span className={cn(ev.egresoDifiere && 'font-semibold text-warning-800 dark:text-warning-200', gps.abierta && !gps.egreso && 'text-info-700 dark:text-info-300')}>
                            {gps.abierta && !gps.egreso ? 'sin cierre' : gps.egreso || '—'}
                        </span>
                        {gps.fichadas > 1 && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                                {gps.fichadas} fichadas{gps.abierta ? ' · una sin cierre' : ''}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-slate-400">—</span>
                )}
            </td>
            <td className="px-3 py-2 align-top text-right tabular-nums">
                {gps ? <span className="font-semibold text-slate-900 dark:text-slate-100">{formatHoras(gps.horas)}</span> : <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                {ev.diferencia !== null && (
                    <span className={cn('tabular-nums font-semibold', ev.estado === 'diferencia' ? 'text-warning-800 dark:text-warning-200' : 'text-slate-500 dark:text-slate-400')}>
                        {formatDiferencia(ev.diferencia)}
                    </span>
                )}
                {ev.estado !== 'ok' && ev.estado !== 'diferencia' && (
                    <Badge tone={ESTADO_TONE[ev.estado]} className={ev.diferencia !== null ? 'mt-1' : undefined}>{ESTADO_LABEL[ev.estado]}</Badge>
                )}
            </td>
            <td className="px-3 pr-4 py-1.5 align-top">
                <div className="flex items-center gap-1.5" onBlur={onBlurCelda}>
                    <input
                        type="time"
                        aria-label={`Ingreso ajustado de ${row.operatorName} el ${formatDate(row.fecha)}`}
                        className="input h-8 w-[104px] px-2 tabular-nums"
                        value={ingreso}
                        disabled={!ajustesDisponibles || estado === 'saving'}
                        onChange={e => setIngreso(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') persistir(); }}
                    />
                    <input
                        type="time"
                        aria-label={`Egreso ajustado de ${row.operatorName} el ${formatDate(row.fecha)}`}
                        className="input h-8 w-[104px] px-2 tabular-nums"
                        value={egreso}
                        disabled={!ajustesDisponibles || estado === 'saving'}
                        onChange={e => setEgreso(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') persistir(); }}
                    />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Más opciones del ajuste"
                        title={ajuste?.observacion ? `Observación: ${ajuste.observacion}` : 'Copiar horario, observación o quitar'}
                        disabled={!ajustesDisponibles || estado === 'saving'}
                        onClick={onEdit}
                    >
                        <PenLine className={cn(ajuste?.observacion && 'text-brand-600 dark:text-brand-300')} />
                    </Button>
                    <span className="w-4 h-4 shrink-0 text-slate-400" aria-live="polite">
                        {estado === 'saving' && <Loader2 className="w-4 h-4 animate-spin" aria-label="Guardando" />}
                        {estado === 'saved' && <Check className="w-4 h-4 text-success-600 dark:text-success-400" aria-label="Guardado" />}
                    </span>
                </div>
                {(horasAjusteBorrador !== null || ajuste?.ajustadoPorNombre) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">
                        {horasAjusteBorrador !== null && (
                            <>
                                <span className={cn('font-semibold tabular-nums', ajusteDifiere ? 'text-warning-800 dark:text-warning-200' : 'text-slate-700 dark:text-slate-200')}>
                                    {formatHoras(horasAjusteBorrador)} h
                                </span>
                                {registro && <span className="tabular-nums"> · {formatDiferencia(horasAjusteBorrador - registro.horas)} vs. registro</span>}
                            </>
                        )}
                        {ajuste?.ajustadoPorNombre && <span> · {ajuste.ajustadoPorNombre}</span>}
                    </p>
                )}
            </td>
        </tr>
    );
}

// ── Diálogo de ajuste ────────────────────────────────────────────────

function AjusteDialog({
    row,
    onClose,
    onSaved,
}: {
    row: ControlHorarioRow | null;
    onClose: () => void;
    onSaved: (key: string, a: AjusteDia | null) => void;
}) {
    const [ingreso, setIngreso] = useState('');
    const [egreso, setEgreso] = useState('');
    const [observacion, setObservacion] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!row) return;
        setIngreso(row.ajuste?.horaIngreso || row.registro?.ingreso || row.gps?.ingreso || '');
        setEgreso(row.ajuste?.horaEgreso || row.registro?.egreso || row.gps?.egreso || '');
        setObservacion(row.ajuste?.observacion || '');
    }, [row]);

    if (!row) return null;

    const valido = HORA.test(ingreso) && HORA.test(egreso) && ingreso !== egreso;
    const horas = valido ? horasEntre(ingreso, egreso) : null;

    const guardar = async () => {
        if (!valido) return;
        setSaving(true);
        try {
            const a = await guardarAjuste(row, ingreso, egreso, observacion.trim() || null);
            onSaved(row.key, a);
            showToast('Ajuste guardado', 'success');
        } catch (err: any) {
            showToast(err?.message || 'No se pudo guardar el ajuste', 'error');
        } finally {
            setSaving(false);
        }
    };

    const quitar = async () => {
        setSaving(true);
        try {
            await quitarAjuste(row);
            onSaved(row.key, null);
            showToast('Ajuste quitado', 'success');
        } catch (err: any) {
            showToast(err?.message || 'No se pudo quitar el ajuste', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={!!row}
            onClose={onClose}
            dismissible={!saving}
            size="md"
            title="Ajuste de jornada"
            description={`${row.operatorName} · ${formatDate(row.fecha)}`}
            footer={
                <>
                    {row.ajuste && (
                        <Button variant="danger-ghost" onClick={quitar} disabled={saving} className="sm:mr-auto">
                            Quitar ajuste
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button onClick={guardar} isLoading={saving} disabled={!valido}>Guardar ajuste</Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div className="rounded-xl border border-border p-3">
                        <p className="text-caption text-slate-500 dark:text-slate-400">Registro</p>
                        <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {row.registro ? `${formatRango(row.registro.ingreso, row.registro.egreso)} · ${formatHoras(row.registro.horas)} h` : 'Sin registro'}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<ClipboardList />}
                            className="mt-1 -ml-2"
                            disabled={!row.registro?.ingreso || !row.registro?.egreso}
                            onClick={() => { setIngreso(row.registro?.ingreso || ''); setEgreso(row.registro?.egreso || ''); }}
                        >
                            Usar este horario
                        </Button>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                        <p className="text-caption text-slate-500 dark:text-slate-400">Fichada GPS</p>
                        <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {row.gps ? `${formatRango(row.gps.ingreso, row.gps.egreso, row.gps.abierta)} · ${formatHoras(row.gps.horas)} h` : 'Sin fichada'}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<MapPin />}
                            className="mt-1 -ml-2"
                            disabled={!row.gps?.ingreso || !row.gps?.egreso}
                            onClick={() => { setIngreso(row.gps?.ingreso || ''); setEgreso(row.gps?.egreso || ''); }}
                        >
                            Usar este horario
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Ingreso" htmlFor="ajuste-ingreso" required>
                        <input id="ajuste-ingreso" type="time" className="input tabular-nums" value={ingreso} onChange={e => setIngreso(e.target.value)} data-autofocus />
                    </Field>
                    <Field label="Egreso" htmlFor="ajuste-egreso" required hint={horas !== null ? `${formatHoras(horas)} h` : undefined}>
                        <input id="ajuste-egreso" type="time" className="input tabular-nums" value={egreso} onChange={e => setEgreso(e.target.value)} />
                    </Field>
                </div>

                <Textarea
                    label="Observación"
                    hint="Opcional. Sale en el informe impreso."
                    value={observacion}
                    maxLength={500}
                    onChange={e => setObservacion(e.target.value)}
                    placeholder="Ej.: olvidó fichar la salida; confirmado con el supervisor de obra"
                />
            </div>
        </Dialog>
    );
}
