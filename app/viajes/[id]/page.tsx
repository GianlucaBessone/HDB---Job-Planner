'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    AlertTriangle, Ban, Check, CheckCheck, ClipboardCheck, Lock, Pencil, Plane, Printer, RotateCcw, Trash2, Undo2, X,
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { showToast } from '@/components/Toast';
import {
    Badge, Button, ConfirmDialogBase, Dialog, EmptyState, ErrorState, Field, LoadingState, MoneyInput, Panel, Stat, Textarea,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import {
    baseLabel, categoriaLabel, esGestorViajes, formatFechaCorta, formatFechaHora, formatRangoFechas, MODALIDAD_LABEL, viajeConfigurable,
    type ModalidadFondos,
} from '@/lib/viajes';
import ViajeFormDialog from '@/components/viajes/ViajeFormDialog';
import { GastoInfo, GastosPorDia, HistorialViaje, type GastoVista } from '@/components/viajes/GastosLista';
import { imprimirInforme } from '@/components/viajes/informe';
import { apiJson, BarraConsumo, Dato, EstadoViajeBadge, money, Ruta, textoResultado } from '@/components/viajes/shared';

type Tab = 'resumen' | 'gastos' | 'rendicion' | 'historial';
type AccionEstado = 'cancelar' | 'devolver' | 'cerrar';

export default function ViajeAdminDetallePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [role, setRole] = useState<string | null>(null);
    const [viaje, setViaje] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('resumen');
    const [editOpen, setEditOpen] = useState(false);
    const [accion, setAccion] = useState<AccionEstado | null>(null);
    const [nota, setNota] = useState('');
    const [eliminarOpen, setEliminarOpen] = useState(false);
    const [trabajando, setTrabajando] = useState(false);
    const [verificando, setVerificando] = useState<string | null>(null);
    const [ajuste, setAjuste] = useState<{ gasto: GastoVista; estado: 'observado' | 'rechazado' } | null>(null);

    useEffect(() => {
        try { setRole((JSON.parse(localStorage.getItem('currentUser') || '{}').role || 'operador').toLowerCase()); } catch { setRole('operador'); }
    }, []);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const data = await apiJson(`/api/viajes/${id}`);
            setViaje(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    // Migas de pan con el código del viaje en lugar del id.
    const setTitle = useHistoryStore(s => s.setTitle);
    useEffect(() => {
        if (!viaje?.codigo) return;
        const t = setTimeout(() => setTitle(`/viajes/${id}`, viaje.codigo), 0);
        return () => clearTimeout(t);
    }, [setTitle, id, viaje?.codigo]);

    // Al abrir un viaje por rendir, se va directo a la rendición.
    useEffect(() => {
        if (viaje?.estado === 'finalizado') setTab(t => (t === 'resumen' ? 'rendicion' : t));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viaje?.id, viaje?.estado]);

    const nombres = useMemo<Record<string, string>>(
        () => Object.fromEntries((viaje?.participantes || []).map((p: any) => [p.id, p.nombre])),
        [viaje?.participantes]
    );

    const sinPermiso = role !== null && !esGestorViajes(role);
    useEffect(() => {
        if (sinPermiso) router.replace(`/mis-viajes/${id}`);
    }, [sinPermiso, router, id]);

    if (sinPermiso) return null;
    if (loading) return <LoadingState label="Cargando viaje…" />;
    if (error || !viaje) return <ErrorState title="No pudimos abrir el viaje" description={error || undefined} onRetry={cargar} />;

    const r = viaje.resumen;
    const cerrado = viaje.estado === 'cerrado';
    const totales = cerrado && viaje.cierre ? { ...r, ...viaje.cierre } : r;
    const res = textoResultado(totales.resultado);
    const esAnticipo = viaje.modalidadFondos === 'anticipo';

    const cambiarEstado = async () => {
        if (!accion) return;
        setTrabajando(true);
        try {
            const data = await apiJson(`/api/viajes/${id}/estado`, { method: 'POST', body: JSON.stringify({ accion, nota: nota.trim() || null }) });
            setViaje(data);
            showToast({ cancelar: 'Viaje cancelado', devolver: 'Viaje devuelto al responsable', cerrar: 'Rendición cerrada' }[accion], 'success');
            setAccion(null);
            setNota('');
            if (accion === 'cerrar') setTab('resumen');
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setTrabajando(false);
        }
    };

    const eliminar = async () => {
        setTrabajando(true);
        try {
            await apiJson(`/api/viajes/${id}`, { method: 'DELETE' });
            showToast('Viaje eliminado', 'success');
            router.push('/viajes');
        } catch (e: any) {
            showToast(e.message, 'error');
            setTrabajando(false);
        }
    };

    const verificar = async (items: { gastoId: string; estado: string; montoAprobado?: number | null; observacion?: string | null }[], clave: string) => {
        setVerificando(clave);
        try {
            const data = await apiJson(`/api/viajes/${id}/verificacion`, { method: 'POST', body: JSON.stringify({ items }) });
            setViaje(data);
            return true;
        } catch (e: any) {
            showToast(e.message, 'error');
            return false;
        } finally {
            setVerificando(null);
        }
    };

    const pendientes: GastoVista[] = viaje.gastos.filter((g: GastoVista) => g.estadoVerificacion === 'pendiente');

    const acciones = [
        { id: 'imprimir', label: 'Informe', icon: <Printer />, variant: 'outline' as const, hideLabelOnMobile: true, onClick: () => { if (!imprimirInforme(viaje)) showToast('Permití las ventanas emergentes para imprimir.', 'error'); } },
        ...(viajeConfigurable(viaje.estado) ? [{ id: 'editar', label: 'Editar', icon: <Pencil />, variant: 'outline' as const, onClick: () => setEditOpen(true) }] : []),
        ...(viaje.estado === 'planificado' && viaje.gastos.length === 0 ? [{ id: 'eliminar', label: 'Eliminar', icon: <Trash2 />, variant: 'danger' as const, hideLabelOnMobile: true, onClick: () => setEliminarOpen(true) }] : []),
        ...(['planificado', 'en_curso'].includes(viaje.estado) && !(viaje.estado === 'planificado' && viaje.gastos.length === 0) ? [{ id: 'cancelar', label: 'Cancelar viaje', icon: <Ban />, variant: 'danger' as const, onClick: () => setAccion('cancelar') }] : []),
        ...(viaje.estado === 'finalizado' ? [
            { id: 'devolver', label: 'Devolver', icon: <Undo2 />, variant: 'outline' as const, onClick: () => setAccion('devolver') },
            { id: 'cerrar', label: 'Cerrar rendición', icon: <Lock />, variant: 'primary' as const, disabled: r.pendientes > 0, onClick: () => setAccion('cerrar') },
        ] : []),
    ];

    const tabs = [
        { id: 'resumen', label: 'Resumen' },
        { id: 'gastos', label: 'Gastos', count: viaje.gastos.length },
        ...(viaje.estado === 'finalizado' || cerrado ? [{ id: 'rendicion', label: 'Rendición', count: viaje.estado === 'finalizado' ? r.pendientes : undefined }] : []),
        { id: 'historial', label: 'Historial' },
    ];

    const categorias = Array.from(new Set([...Object.keys(r.estimadoPorCategoria), ...Object.keys(r.gastadoPorCategoria)]));

    return (
        <div>
            <ModuleHeader
                title={viaje.motivo}
                description={`${viaje.codigo} · ${viaje.origen} → ${viaje.destino} · ${formatRangoFechas(viaje.fechaInicio, viaje.fechaFin)}`}
                icon={<Plane />}
                className="[&_h1>span:last-of-type]:whitespace-normal"
                actions={acciones}
                tabs={tabs}
                activeTabId={tab}
                onTabChange={t => setTab(t as Tab)}
            />

            {/* Banda de estado */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-[13px] text-slate-600 dark:text-slate-300">
                <EstadoViajeBadge estado={viaje.estado} />
                <span>Responsable: <b className="font-medium text-slate-900 dark:text-slate-100">{viaje.responsable?.nombreCompleto}</b></span>
                <span>{MODALIDAD_LABEL[viaje.modalidadFondos as ModalidadFondos]}</span>
                <span>{r.dias} días · {r.personas} persona{r.personas === 1 ? '' : 's'}</span>
                {viaje.project && <span>Proyecto: {viaje.project.codigoProyecto ? `${viaje.project.codigoProyecto} · ` : ''}{viaje.project.nombre}</span>}
                {viaje.fechaFin !== viaje.fechaFinOriginal && (
                    <Badge tone="warning">Extendido desde el {formatFechaCorta(viaje.fechaFinOriginal)}</Badge>
                )}
            </div>

            {tab === 'resumen' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Stat label="Estimado" value={money(r.estimado)} />
                        <Stat
                            label="Gastado"
                            value={money(r.gastado)}
                            tone={r.porcentajeConsumo > 100 ? 'danger' : 'neutral'}
                            hint={r.estimado > 0 ? `${r.porcentajeConsumo}% del estimado` : `${viaje.gastos.length} gastos`}
                        />
                        {esAnticipo
                            ? <Stat label="Saldo de fondos" value={money(r.saldoFondos)} tone={r.saldoFondos < 0 ? 'danger' : 'neutral'} hint={`Anticipo ${money(r.anticipo)}`} />
                            : <Stat label="A reintegrar" value={money(r.gastadoPropio)} hint="Contra rendición" />}
                        <Stat label={cerrado ? 'Resultado' : 'Disponible vs. estimado'} value={cerrado ? money(res.monto) : money(r.disponible)} tone={cerrado ? res.tone : r.disponible < 0 ? 'danger' : 'success'} hint={cerrado ? res.label : undefined} />
                    </div>
                    {r.estimado > 0 && <BarraConsumo porcentaje={r.porcentajeConsumo} grosor="h-2" />}

                    {viaje.descripcion && (
                        <p className="text-[13px] text-slate-600 dark:text-slate-300 bg-surface-sunken border border-border rounded-lg px-3 py-2.5 whitespace-pre-line">{viaje.descripcion}</p>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Panel title="Estimado vs. gastado por categoría" padded={false}>
                            {categorias.length === 0 ? (
                                <EmptyState compact title="Sin costos ni gastos" />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead><tr><th className="text-left">Categoría</th><th className="text-right">Estimado</th><th className="text-right">Gastado</th><th className="text-right">Diferencia</th></tr></thead>
                                        <tbody>
                                            {categorias.map(c => {
                                                const e = r.estimadoPorCategoria[c] || 0;
                                                const g = r.gastadoPorCategoria[c] || 0;
                                                return (
                                                    <tr key={c}>
                                                        <td>{categoriaLabel(c)}</td>
                                                        <td className="text-right tabular-nums whitespace-nowrap">{money(e)}</td>
                                                        <td className="text-right tabular-nums whitespace-nowrap">{money(g)}</td>
                                                        <td className={cn('text-right tabular-nums whitespace-nowrap', e - g < 0 && 'text-danger-700 dark:text-danger-300')}>{money(e - g)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Panel>

                        <Panel title="Presupuesto configurado" description={`${r.dias} días · ${r.noches} noches · ${r.personas} personas`} padded={false}>
                            {viaje.costos.length === 0 ? (
                                <EmptyState compact title="Sin costos estimados" description="Editá el viaje para cargar el presupuesto." />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead><tr><th className="text-left">Categoría</th><th className="text-left">Base</th><th className="text-right">Unitario</th></tr></thead>
                                        <tbody>
                                            {viaje.costos.map((c: any) => (
                                                <tr key={c.id}>
                                                    <td>{categoriaLabel(c.categoria)}</td>
                                                    <td>{baseLabel(c.base)}</td>
                                                    <td className="text-right tabular-nums whitespace-nowrap">{money(c.monto)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Panel>

                        <Panel title="Costo por persona" description="Gastos individuales + globales prorrateados" padded={false}>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead><tr><th className="text-left">Persona</th><th className="text-right">Individual</th><th className="text-right">Global</th><th className="text-right">Total</th></tr></thead>
                                    <tbody>
                                        {(totales.porPersona || []).map((p: any) => (
                                            <tr key={p.participanteId}>
                                                <td>{p.nombre}{viaje.participantes.find((x: any) => x.id === p.participanteId)?.operatorId === viaje.responsableId && <span className="text-xs text-slate-500 dark:text-slate-400"> · responsable</span>}</td>
                                                <td className="text-right tabular-nums whitespace-nowrap">{money(p.individual)}</td>
                                                <td className="text-right tabular-nums whitespace-nowrap">{money(p.global)}</td>
                                                <td className="text-right tabular-nums whitespace-nowrap font-medium">{money(p.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        <Panel title="Fondos">
                            <dl className="divide-y divide-border">
                                <Dato label="Modalidad" value={MODALIDAD_LABEL[viaje.modalidadFondos as ModalidadFondos]} />
                                {esAnticipo && <Dato label="Anticipo entregado" value={money(r.anticipo)} />}
                                <Dato label="Pagado con fondos del viaje" value={money(r.gastadoFondos)} />
                                <Dato label="Pagado con medios propios" value={money(r.gastadoPropio)} />
                                {esAnticipo && <Dato label="Saldo de fondos" value={money(r.saldoFondos)} tone={r.saldoFondos < 0 ? 'danger' : undefined} strong />}
                            </dl>
                            {viaje.extensiones.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="eyebrow mb-2">Extensiones</h3>
                                    <ul className="space-y-2">
                                        {viaje.extensiones.map((e: any) => (
                                            <li key={e.id} className="text-[13px]">
                                                <span className="font-medium text-slate-900 dark:text-slate-100">{formatFechaCorta(e.fechaFinAnterior)} → {formatFechaCorta(e.fechaFinNueva)}</span>
                                                <span className="block text-xs text-slate-500 dark:text-slate-400">{e.motivo} · {e.usuarioNombre}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Panel>
                    </div>

                    {cerrado && (
                        <Panel title="Cierre de la rendición" description={`Cerrado por ${viaje.cerradoPorNombre || '—'} el ${formatFechaHora(viaje.fechaCierre)}`}>
                            <ResultadoLiquidacion totales={totales} />
                            {viaje.observacionCierre && <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-300 whitespace-pre-line">{viaje.observacionCierre}</p>}
                        </Panel>
                    )}
                </div>
            )}

            {tab === 'gastos' && (
                viaje.gastos.length === 0
                    ? <div className="surface"><EmptyState title="Todavía no hay gastos" description="El responsable los registra desde Mis Viajes." /></div>
                    : <GastosPorDia gastos={viaje.gastos} nombres={nombres} />
            )}

            {tab === 'rendicion' && (
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
                    <Panel
                        title="Verificación de gastos"
                        description={`${r.verificados} de ${viaje.gastos.length} verificados`}
                        padded={false}
                        actions={viaje.estado === 'finalizado' && pendientes.length > 0 ? (
                            <Button
                                variant="tonal"
                                size="sm"
                                icon={<CheckCheck />}
                                isLoading={verificando === 'todos'}
                                onClick={() => verificar(pendientes.map(g => ({ gastoId: g.id, estado: 'aprobado' })), 'todos')}
                            >
                                Aprobar pendientes ({pendientes.length})
                            </Button>
                        ) : undefined}
                    >
                        {viaje.gastos.length > 0 && (
                            <div className="px-4 pt-3">
                                <BarraConsumo porcentaje={viaje.gastos.length ? Math.round((r.verificados / viaje.gastos.length) * 100) : 0} label="Avance de la verificación" />
                            </div>
                        )}
                        {viaje.gastos.length === 0 ? (
                            <EmptyState compact title="El viaje no tiene gastos" description="Podés cerrar la rendición directamente." />
                        ) : (
                            <ul className="divide-y divide-border">
                                {[...viaje.gastos].sort((a: GastoVista, b: GastoVista) => a.fecha.localeCompare(b.fecha)).map((g: GastoVista) => {
                                    const enCurso = verificando === g.id;
                                    const editable = viaje.estado === 'finalizado';
                                    return (
                                        <li key={g.id} className={cn('p-3 sm:p-4 flex flex-col sm:flex-row gap-3', g.estadoVerificacion === 'pendiente' && editable && 'bg-warning-50/40 dark:bg-warning-950/20')}>
                                            <div className="flex-1 min-w-0">
                                                <GastoInfo gasto={g} nombres={nombres} mostrarVerificacion />
                                            </div>
                                            {editable && (
                                                <div className="flex sm:flex-col sm:items-stretch sm:self-start gap-2 sm:w-[132px] shrink-0">
                                                    {g.estadoVerificacion === 'pendiente' ? (
                                                        <>
                                                            <Button size="sm" variant="tonal" icon={<Check />} isLoading={enCurso} onClick={() => verificar([{ gastoId: g.id, estado: 'aprobado' }], g.id)} className="flex-1 sm:flex-none">Aprobar</Button>
                                                            <Button size="sm" variant="secondary" icon={<AlertTriangle />} onClick={() => setAjuste({ gasto: g, estado: 'observado' })} className="flex-1 sm:flex-none">Observar</Button>
                                                            <Button size="sm" variant="danger-ghost" icon={<X />} onClick={() => setAjuste({ gasto: g, estado: 'rechazado' })} className="flex-1 sm:flex-none">Rechazar</Button>
                                                        </>
                                                    ) : (
                                                        <Button size="sm" variant="ghost" icon={<RotateCcw />} isLoading={enCurso} onClick={() => verificar([{ gastoId: g.id, estado: 'pendiente' }], g.id)}>Rehacer</Button>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>

                    <Panel title="Liquidación" className="xl:sticky xl:top-[calc(var(--topbar-h)+1rem)]">
                        <ResultadoLiquidacion totales={totales} />
                        {viaje.estado === 'finalizado' && (
                            <div className="mt-4 space-y-2">
                                <Button className="w-full" icon={<ClipboardCheck />} disabled={r.pendientes > 0} onClick={() => setAccion('cerrar')}>
                                    Cerrar rendición
                                </Button>
                                {r.pendientes > 0 && <p className="field-hint text-center">Faltan verificar {r.pendientes} gasto{r.pendientes === 1 ? '' : 's'}.</p>}
                            </div>
                        )}
                        {viaje.notaConclusion && (
                            <div className="mt-4">
                                <h3 className="eyebrow mb-1">Nota del responsable</h3>
                                <p className="text-[13px] text-slate-600 dark:text-slate-300 whitespace-pre-line">{viaje.notaConclusion}</p>
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            {tab === 'historial' && (
                <Panel>
                    <HistorialViaje historial={viaje.historial} />
                </Panel>
            )}

            <ViajeFormDialog open={editOpen} onClose={() => setEditOpen(false)} viaje={viaje} onSaved={setViaje} />

            {/* Cancelar / devolver / cerrar */}
            <Dialog
                open={!!accion}
                onClose={() => { setAccion(null); setNota(''); }}
                dismissible={!trabajando}
                size="sm"
                title={accion === 'cerrar' ? 'Cerrar la rendición' : accion === 'devolver' ? 'Devolver al responsable' : 'Cancelar el viaje'}
                description={
                    accion === 'cerrar' ? 'Se congelan los totales y el viaje queda cerrado. No se puede deshacer.'
                        : accion === 'devolver' ? 'El viaje vuelve a "En curso" para que el responsable corrija o agregue gastos.'
                            : 'El viaje queda cancelado y no admite más gastos.'
                }
                footer={
                    <>
                        <Button variant="secondary" onClick={() => { setAccion(null); setNota(''); }} disabled={trabajando}>Volver</Button>
                        <Button
                            variant={accion === 'cancelar' ? 'danger' : 'primary'}
                            isLoading={trabajando}
                            disabled={accion !== 'cerrar' && nota.trim().length < 5}
                            onClick={cambiarEstado}
                        >
                            {accion === 'cerrar' ? 'Cerrar rendición' : accion === 'devolver' ? 'Devolver' : 'Cancelar viaje'}
                        </Button>
                    </>
                }
            >
                {accion === 'cerrar' && <div className="mb-4"><ResultadoLiquidacion totales={totales} /></div>}
                <Textarea
                    label={accion === 'cerrar' ? 'Observaciones (opcional)' : accion === 'devolver' ? 'Qué tiene que corregir' : 'Motivo'}
                    required={accion !== 'cerrar'}
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    data-autofocus
                />
            </Dialog>

            <AjusteDialog
                ajuste={ajuste}
                onClose={() => setAjuste(null)}
                onConfirm={async (item) => { if (await verificar([item], item.gastoId)) setAjuste(null); }}
                loading={!!verificando}
            />

            <ConfirmDialogBase
                open={eliminarOpen}
                onCancel={() => setEliminarOpen(false)}
                onConfirm={eliminar}
                loading={trabajando}
                title={`¿Eliminar ${viaje.codigo}?`}
                message="Se borra el viaje planificado y su configuración. No se puede deshacer."
                confirmLabel="Eliminar viaje"
            />
        </div>
    );
}

function ResultadoLiquidacion({ totales }: { totales: any }) {
    const res = textoResultado(totales.resultado);
    return (
        <dl className="divide-y divide-border">
            <Dato label="Total gastado" value={money(totales.gastado)} />
            <Dato label="No reconocido" value={totales.rechazado > 0 ? `− ${money(totales.rechazado)}` : money(0)} tone={totales.rechazado > 0 ? 'danger' : undefined} />
            <Dato label="Total aprobado" value={money(totales.aprobado)} strong />
            <Dato label="Anticipo entregado" value={money(totales.anticipo)} />
            <div className={cn('flex items-baseline justify-between gap-3 pt-3 mt-1')}>
                <dt className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{res.label}</dt>
                <dd className={cn('text-heading tabular-nums', res.tone === 'warning' ? 'text-warning-700 dark:text-warning-300' : 'text-success-700 dark:text-success-300')}>{money(res.monto)}</dd>
            </div>
        </dl>
    );
}

function AjusteDialog({
    ajuste, onClose, onConfirm, loading,
}: {
    ajuste: { gasto: GastoVista; estado: 'observado' | 'rechazado' } | null;
    onClose: () => void;
    onConfirm: (item: { gastoId: string; estado: string; montoAprobado?: number | null; observacion: string }) => void;
    loading: boolean;
}) {
    const [monto, setMonto] = useState('');
    const [obs, setObs] = useState('');
    useEffect(() => {
        if (ajuste) { setMonto(String(ajuste.gasto.monto)); setObs(''); }
    }, [ajuste]);
    if (!ajuste) return null;
    const observado = ajuste.estado === 'observado';
    const montoNum = Number(monto) || 0;
    const invalido = obs.trim().length < 3 || (observado && (montoNum < 0 || montoNum > ajuste.gasto.monto));
    return (
        <Dialog
            open
            onClose={onClose}
            dismissible={!loading}
            size="sm"
            title={observado ? 'Observar gasto' : 'Rechazar gasto'}
            description={`${categoriaLabel(ajuste.gasto.categoria)} · ${money(ajuste.gasto.monto)}`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Volver</Button>
                    <Button
                        variant={observado ? 'primary' : 'danger'}
                        isLoading={loading}
                        disabled={invalido}
                        onClick={() => onConfirm({ gastoId: ajuste.gasto.id, estado: ajuste.estado, montoAprobado: observado ? montoNum : null, observacion: obs.trim() })}
                    >
                        {observado ? 'Aprobar con ajuste' : 'Rechazar'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {observado && (
                    <Field label="Monto que se aprueba" required htmlFor="ajuste-monto" hint={`Máximo ${money(ajuste.gasto.monto)}`} error={montoNum > ajuste.gasto.monto ? 'Supera el monto del gasto.' : undefined}>
                        <MoneyInput id="ajuste-monto" value={monto} onValueChange={setMonto} className="input" data-autofocus />
                    </Field>
                )}
                <Textarea
                    label="Motivo"
                    required
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder={observado ? 'Ej.: el ticket incluye consumo personal' : 'Ej.: sin comprobante válido'}
                    data-autofocus={!observado ? true : undefined}
                />
            </div>
        </Dialog>
    );
}
