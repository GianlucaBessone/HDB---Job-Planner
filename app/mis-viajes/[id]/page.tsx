'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    AlertTriangle, CalendarPlus, CheckCircle2, ChevronLeft, Flag, Info, Luggage, MoreHorizontal, Pencil, Play, Plus, Receipt, Trash2, Users,
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { showToast } from '@/components/Toast';
import { Badge, Button, ConfirmDialogBase, Dialog, EmptyState, ErrorState, Input, LoadingState, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
    formatFechaCorta, formatRangoFechas, fromISODate, MODALIDAD_LABEL, toISODate, viajeEditablePorResponsable, type ModalidadFondos,
} from '@/lib/viajes';
import GastoFormDialog, { type GastoEditable } from '@/components/viajes/GastoFormDialog';
import { GastosPorDia, HistorialViaje, type GastoVista } from '@/components/viajes/GastosLista';
import { apiJson, BarraConsumo, Dato, EstadoViajeBadge, money, Ruta, textoResultado } from '@/components/viajes/shared';

const diaSiguiente = (iso: string) => toISODate(new Date(fromISODate(iso).getTime() + 86_400_000));

export default function MiViajeDetallePage() {
    const { id } = useParams<{ id: string }>();
    const [viaje, setViaje] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [gastoOpen, setGastoOpen] = useState(false);
    const [gastoEdit, setGastoEdit] = useState<GastoEditable | null>(null);
    const [borrar, setBorrar] = useState<GastoVista | null>(null);
    const [masOpen, setMasOpen] = useState(false);
    const [extenderOpen, setExtenderOpen] = useState(false);
    const [concluirOpen, setConcluirOpen] = useState(false);
    const [iniciarOpen, setIniciarOpen] = useState(false);
    const [verHistorial, setVerHistorial] = useState(false);
    const [trabajando, setTrabajando] = useState(false);

    const [ext, setExt] = useState({ fecha: '', motivo: '' });
    const [notaConclusion, setNotaConclusion] = useState('');

    const cargar = useCallback(async () => {
        setError(null);
        try {
            setViaje(await apiJson(`/api/viajes/${id}`));
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
        const t = setTimeout(() => setTitle(`/mis-viajes/${id}`, viaje.codigo), 0);
        return () => clearTimeout(t);
    }, [setTitle, id, viaje?.codigo]);

    const nombres = useMemo<Record<string, string>>(
        () => Object.fromEntries((viaje?.participantes || []).map((p: any) => [p.id, p.nombre])),
        [viaje?.participantes]
    );

    if (loading) return <LoadingState label="Cargando viaje…" />;
    if (error || !viaje) {
        return (
            <ErrorState
                title="No pudimos abrir el viaje"
                description={error || undefined}
                onRetry={cargar}
            />
        );
    }

    const r = viaje.resumen;
    const esResponsable = !!viaje.permisos?.esResponsable;
    const editable = esResponsable && viajeEditablePorResponsable(viaje.estado);
    const anticipo = viaje.modalidadFondos === 'anticipo';
    const extendido = viaje.fechaFin !== viaje.fechaFinOriginal;
    const ultimaDevolucion = viaje.estado === 'en_curso' ? viaje.historial.find((h: any) => h.accion === 'devuelto') : null;
    const devueltoVigente = ultimaDevolucion && !viaje.historial.some((h: any) => h.accion === 'concluido' && h.createdAt > ultimaDevolucion.createdAt);
    const sinComprobante = viaje.gastos.filter((g: GastoVista) => g.comprobantes.length === 0).length;
    const res = textoResultado(viaje.cierre?.resultado ?? r.resultado);

    const estado = async (accion: 'iniciar' | 'concluir', nota?: string) => {
        setTrabajando(true);
        try {
            const data = await apiJson(`/api/viajes/${id}/estado`, { method: 'POST', body: JSON.stringify({ accion, nota: nota || null }) });
            setViaje(data);
            showToast(accion === 'iniciar' ? 'Viaje iniciado' : 'Viaje concluido y enviado a rendición', 'success');
            setConcluirOpen(false);
            setIniciarOpen(false);
            setNotaConclusion('');
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setTrabajando(false);
        }
    };

    const extender = async () => {
        setTrabajando(true);
        try {
            const data = await apiJson(`/api/viajes/${id}/extensiones`, { method: 'POST', body: JSON.stringify({ fechaFinNueva: ext.fecha, motivo: ext.motivo }) });
            setViaje(data);
            showToast(`Estadía extendida hasta el ${formatFechaCorta(ext.fecha)}`, 'success');
            setExtenderOpen(false);
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setTrabajando(false);
        }
    };

    const eliminarGasto = async () => {
        if (!borrar) return;
        setTrabajando(true);
        try {
            setViaje(await apiJson(`/api/viajes/${id}/gastos/${borrar.id}`, { method: 'DELETE' }));
            showToast('Gasto eliminado', 'success');
            setBorrar(null);
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setTrabajando(false);
        }
    };

    const abrirNuevoGasto = () => { setGastoEdit(null); setGastoOpen(true); };
    const abrirExtender = () => { setExt({ fecha: diaSiguiente(viaje.fechaFin), motivo: '' }); setMasOpen(false); setExtenderOpen(true); };
    const abrirConcluir = () => { setMasOpen(false); setConcluirOpen(true); };

    const accionesHeader = editable ? [
        { id: 'extender', label: 'Extender estadía', icon: <CalendarPlus />, onClick: abrirExtender, variant: 'outline' as const },
        ...(viaje.estado === 'en_curso' ? [{ id: 'concluir', label: 'Concluir viaje', icon: <Flag />, onClick: abrirConcluir, variant: 'outline' as const }] : []),
        viaje.estado === 'planificado'
            ? { id: 'iniciar', label: 'Iniciar viaje', icon: <Play />, onClick: () => setIniciarOpen(true), variant: 'primary' as const }
            : { id: 'gasto', label: 'Registrar gasto', icon: <Plus />, onClick: abrirNuevoGasto, variant: 'primary' as const },
    ] : [];

    return (
        <div className="max-w-3xl mx-auto">
            <Link href="/mis-viajes" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mb-3 md:hidden">
                <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Mis Viajes
            </Link>

            {/* En el celular las acciones van en la barra inferior */}
            <div className="hidden md:block">
                <ModuleHeader title={viaje.motivo} description={`${viaje.codigo} · ${viaje.origen} → ${viaje.destino}`} icon={<Luggage />} actions={accionesHeader} />
            </div>
            <div className="md:hidden mb-4">
                <ModuleHeader title={viaje.motivo} description={viaje.codigo} icon={<Luggage />} className="!mb-0 [&_h1>span:last-of-type]:whitespace-normal" />
            </div>

            <div className="space-y-4">
                {/* Encabezado del viaje */}
                <section className="surface p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <EstadoViajeBadge estado={viaje.estado} />
                        {!esResponsable && <Badge tone="neutral"><Users /> Participante</Badge>}
                        {extendido && <Badge tone="warning">Extendido</Badge>}
                    </div>
                    <Ruta origen={viaje.origen} destino={viaje.destino} className="mt-3 text-heading text-slate-900 dark:text-slate-50 max-w-full" />
                    <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1">
                        {formatRangoFechas(viaje.fechaInicio, viaje.fechaFin)} · {r.dias} día{r.dias === 1 ? '' : 's'} · {r.personas} persona{r.personas === 1 ? '' : 's'}
                    </p>
                    {extendido && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Fin original: {formatFechaCorta(viaje.fechaFinOriginal)}</p>}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {MODALIDAD_LABEL[viaje.modalidadFondos as ModalidadFondos]} · Responsable: {viaje.responsable?.nombreCompleto}
                    </p>
                    {viaje.descripcion && (
                        <p className="mt-3 text-[13px] text-slate-700 dark:text-slate-200 bg-surface-sunken border border-border rounded-lg px-3 py-2 whitespace-pre-line">{viaje.descripcion}</p>
                    )}
                </section>

                {/* Avisos de estado */}
                {viaje.estado === 'planificado' && esResponsable && (
                    <Aviso tone="info" icon={<Info />} titulo="El viaje todavía no empezó">
                        Inicialo cuando salgas. Ya podés cargar gastos previos (por ejemplo, combustible).
                    </Aviso>
                )}
                {devueltoVigente && (
                    <Aviso tone="warning" icon={<AlertTriangle />} titulo="Administración te devolvió el viaje">
                        {ultimaDevolucion.detalle}
                    </Aviso>
                )}
                {viaje.estado === 'finalizado' && (
                    <Aviso tone="info" icon={<CheckCircle2 />} titulo="Enviado a rendición">
                        Administración está verificando los gastos. Te avisamos cuando cierre.
                    </Aviso>
                )}
                {viaje.estado === 'cerrado' && (
                    <Aviso tone="success" icon={<CheckCircle2 />} titulo="Rendición cerrada">
                        {res.label}{res.monto > 0 ? `: ${money(res.monto)}` : ''}.
                        {viaje.observacionCierre ? ` ${viaje.observacionCierre}` : ''}
                    </Aviso>
                )}
                {viaje.estado === 'cancelado' && (
                    <Aviso tone="danger" icon={<AlertTriangle />} titulo="Viaje cancelado">
                        {viaje.historial.find((h: any) => h.accion === 'cancelado')?.detalle}
                    </Aviso>
                )}

                {/* Saldo */}
                <section className="surface p-4" aria-label="Consumo y saldo">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="text-caption text-slate-500 dark:text-slate-400">Gastado</p>
                            <p className="text-display tabular-nums text-slate-900 dark:text-slate-50 leading-tight">{money(r.gastado)}</p>
                        </div>
                        {r.estimado > 0 && (
                            <div className="text-right">
                                <p className="text-caption text-slate-500 dark:text-slate-400">Estimado</p>
                                <p className="text-[13px] font-medium tabular-nums text-slate-700 dark:text-slate-200">{money(r.estimado)}</p>
                            </div>
                        )}
                    </div>
                    {r.estimado > 0 && (
                        <>
                            <BarraConsumo porcentaje={r.porcentajeConsumo} grosor="h-2.5" className="mt-3" />
                            <p className={cn('text-xs mt-1.5', r.disponible < 0 ? 'text-danger-700 dark:text-danger-300' : 'text-slate-500 dark:text-slate-400')}>
                                {r.disponible >= 0
                                    ? `Quedan ${money(r.disponible)} del estimado (${r.porcentajeConsumo}% usado)`
                                    : `Te pasaste ${money(-r.disponible)} del estimado`}
                            </p>
                        </>
                    )}
                    <div className={cn('grid gap-3 mt-4 pt-4 border-t border-border', anticipo ? 'grid-cols-2' : 'grid-cols-1')}>
                        {anticipo && (
                            <div>
                                <p className="text-caption text-slate-500 dark:text-slate-400">Saldo de fondos</p>
                                <p className={cn('text-heading tabular-nums', r.saldoFondos < 0 ? 'text-danger-700 dark:text-danger-300' : 'text-slate-900 dark:text-slate-50')}>{money(r.saldoFondos)}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">de {money(r.anticipo)} entregados</p>
                            </div>
                        )}
                        <div>
                            <p className="text-caption text-slate-500 dark:text-slate-400">{anticipo ? 'Medios propios' : 'A reintegrarte'}</p>
                            <p className="text-heading tabular-nums text-slate-900 dark:text-slate-50">{money(r.gastadoPropio)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{anticipo ? 'Se te reintegra al rendir' : 'Contra rendición'}</p>
                        </div>
                    </div>
                </section>

                {/* Gastos */}
                <section>
                    <div className="flex items-center justify-between px-1 mb-2">
                        <h2 className="text-heading text-slate-900 dark:text-slate-50">Gastos <span className="text-slate-400 font-normal">({viaje.gastos.length})</span></h2>
                        {sinComprobante > 0 && editable && <Badge tone="warning">{sinComprobante} sin foto</Badge>}
                    </div>
                    {viaje.gastos.length === 0 ? (
                        <div className="surface">
                            <EmptyState
                                compact
                                icon={<Receipt />}
                                title="Todavía no registraste gastos"
                                description={editable ? 'Cargá cada gasto con la foto del ticket apenas lo hagas.' : undefined}
                                action={editable ? <Button icon={<Plus />} onClick={abrirNuevoGasto}>Registrar gasto</Button> : undefined}
                            />
                        </div>
                    ) : (
                        <GastosPorDia
                            gastos={viaje.gastos}
                            nombres={nombres}
                            renderActions={editable ? (g) => (
                                <>
                                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => { setGastoEdit(g as GastoEditable); setGastoOpen(true); }}>Editar</Button>
                                    <Button size="sm" variant="danger-ghost" icon={<Trash2 />} onClick={() => setBorrar(g)}>Eliminar</Button>
                                </>
                            ) : undefined}
                        />
                    )}
                </section>

                {/* Extensiones e historial */}
                {viaje.extensiones.length > 0 && (
                    <section className="surface p-4">
                        <h2 className="eyebrow mb-2">Extensiones de estadía</h2>
                        <ul className="space-y-2">
                            {viaje.extensiones.map((e: any) => (
                                <li key={e.id} className="text-[13px]">
                                    <span className="font-medium text-slate-900 dark:text-slate-100">{formatFechaCorta(e.fechaFinAnterior)} → {formatFechaCorta(e.fechaFinNueva)}</span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">{e.motivo}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <section className="surface">
                    <button type="button" className="w-full flex items-center justify-between p-4 text-left" aria-expanded={verHistorial} onClick={() => setVerHistorial(v => !v)}>
                        <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100">Historial del viaje</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{verHistorial ? 'Ocultar' : 'Ver'}</span>
                    </button>
                    {verHistorial && <div className="px-4 pb-4"><HistorialViaje historial={viaje.historial} /></div>}
                </section>
            </div>

            {/* Barra de acción fija (celular) */}
            {editable && (
                <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-card border-t border-border px-4 pt-3 pb-3 safe-area-bottom shadow-xl">
                    <div className="flex gap-2 max-w-3xl mx-auto">
                        {viaje.estado === 'planificado' ? (
                            <Button size="lg" className="flex-1" icon={<Play />} onClick={() => setIniciarOpen(true)}>Iniciar viaje</Button>
                        ) : (
                            <Button size="lg" className="flex-1" icon={<Plus />} onClick={abrirNuevoGasto}>Registrar gasto</Button>
                        )}
                        {viaje.estado === 'planificado' && (
                            <Button size="lg" variant="secondary" icon={<Receipt />} onClick={abrirNuevoGasto} aria-label="Registrar gasto previo" />
                        )}
                        <Button size="lg" variant="secondary" icon={<MoreHorizontal />} onClick={() => setMasOpen(true)} aria-label="Más acciones" />
                    </div>
                </div>
            )}

            {/* Hoja de más acciones */}
            <Dialog open={masOpen} onClose={() => setMasOpen(false)} size="sm" title="Acciones del viaje">
                <div className="space-y-2">
                    <button type="button" className="w-full flex items-center gap-3 p-3 rounded-lg border border-border text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={abrirExtender}>
                        <CalendarPlus className="w-5 h-5 text-slate-500" aria-hidden="true" />
                        <span>
                            <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-100">Extender estadía</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">Hoy termina el {formatFechaCorta(viaje.fechaFin)}</span>
                        </span>
                    </button>
                    {viaje.estado === 'en_curso' && (
                        <button type="button" className="w-full flex items-center gap-3 p-3 rounded-lg border border-border text-left hover:bg-slate-50 dark:hover:bg-slate-800" onClick={abrirConcluir}>
                            <Flag className="w-5 h-5 text-slate-500" aria-hidden="true" />
                            <span>
                                <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-100">Concluir viaje</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">Envía los gastos a rendición</span>
                            </span>
                        </button>
                    )}
                </div>
            </Dialog>

            <GastoFormDialog
                open={gastoOpen}
                onClose={() => setGastoOpen(false)}
                viaje={viaje}
                gasto={gastoEdit}
                onSaved={setViaje}
            />

            {/* Extender */}
            <Dialog
                open={extenderOpen}
                onClose={() => setExtenderOpen(false)}
                dismissible={!trabajando}
                size="sm"
                title="Extender estadía"
                description={`El viaje termina el ${formatFechaCorta(viaje.fechaFin)}. El estimado por día y noche se recalcula solo.`}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setExtenderOpen(false)} disabled={trabajando}>Cancelar</Button>
                        <Button onClick={extender} isLoading={trabajando} disabled={!ext.fecha || ext.fecha <= viaje.fechaFin || ext.motivo.trim().length < 5}>Extender</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Nueva fecha de fin" type="date" required min={diaSiguiente(viaje.fechaFin)} value={ext.fecha} onChange={e => setExt(x => ({ ...x, fecha: e.target.value }))} className="max-md:text-[16px]" />
                    <Textarea label="Motivo" required rows={3} maxLength={1000} value={ext.motivo} onChange={e => setExt(x => ({ ...x, motivo: e.target.value }))} placeholder="Ej.: el cliente pidió un día más para la puesta en marcha" />
                    {anticipo && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Si el anticipo no alcanza, registrá los gastos extra como <b className="font-medium">medios propios</b> para que se te reintegren.
                        </p>
                    )}
                </div>
            </Dialog>

            {/* Concluir */}
            <Dialog
                open={concluirOpen}
                onClose={() => setConcluirOpen(false)}
                dismissible={!trabajando}
                size="sm"
                title="Concluir el viaje"
                description="Después ya no vas a poder cargar ni editar gastos. Administración hace la rendición."
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setConcluirOpen(false)} disabled={trabajando}>Volver</Button>
                        <Button onClick={() => estado('concluir', notaConclusion.trim())} isLoading={trabajando} icon={<Flag />}>Concluir viaje</Button>
                    </>
                }
            >
                <dl className="divide-y divide-border mb-4">
                    <Dato label="Gastos registrados" value={viaje.gastos.length} />
                    <Dato label="Total gastado" value={money(r.gastado)} strong />
                    {anticipo && <Dato label="Saldo de fondos" value={money(r.saldoFondos)} tone={r.saldoFondos < 0 ? 'danger' : undefined} />}
                    <Dato label="Pagado con medios propios" value={money(r.gastadoPropio)} />
                </dl>
                {sinComprobante > 0 && (
                    <p className="mb-4 text-[13px] text-warning-800 dark:text-warning-200 bg-warning-50 dark:bg-warning-950 rounded-lg px-3 py-2">
                        {sinComprobante} gasto{sinComprobante === 1 ? ' no tiene' : 's no tienen'} foto del ticket. Pueden ser observados en la rendición.
                    </p>
                )}
                <Textarea label="Nota para administración (opcional)" rows={2} maxLength={2000} value={notaConclusion} onChange={e => setNotaConclusion(e.target.value)} placeholder="Ej.: devuelvo el sobrante en efectivo" />
            </Dialog>

            <ConfirmDialogBase
                open={iniciarOpen}
                onCancel={() => setIniciarOpen(false)}
                onConfirm={() => estado('iniciar')}
                loading={trabajando}
                tone="primary"
                title="¿Iniciar el viaje?"
                message={`${viaje.origen} → ${viaje.destino}. Queda registrada la hora de salida.`}
                confirmLabel="Iniciar viaje"
            />

            <ConfirmDialogBase
                open={!!borrar}
                onCancel={() => setBorrar(null)}
                onConfirm={eliminarGasto}
                loading={trabajando}
                title="¿Eliminar este gasto?"
                message={borrar ? `${borrar.descripcion || 'Gasto'} · ${money(borrar.monto)}. Se borran también sus fotos.` : undefined}
                confirmLabel="Eliminar gasto"
            />
        </div>
    );
}

function Aviso({ tone, icon, titulo, children }: { tone: 'info' | 'warning' | 'success' | 'danger'; icon: React.ReactNode; titulo: string; children?: React.ReactNode }) {
    const cls = {
        info: 'bg-info-50 border-info-200 text-info-900 dark:bg-info-950 dark:border-info-900 dark:text-info-100',
        warning: 'bg-warning-50 border-warning-200 text-warning-900 dark:bg-warning-950 dark:border-warning-900 dark:text-warning-100',
        success: 'bg-success-50 border-success-200 text-success-900 dark:bg-success-950 dark:border-success-900 dark:text-success-100',
        danger: 'bg-danger-50 border-danger-200 text-danger-900 dark:bg-danger-950 dark:border-danger-900 dark:text-danger-100',
    }[tone];
    return (
        <div role="status" className={cn('flex gap-3 rounded-2xl border px-4 py-3 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:shrink-0 [&>svg]:mt-0.5', cls)}>
            {icon}
            <div className="min-w-0">
                <p className="text-[13px] font-semibold">{titulo}</p>
                {children && <p className="text-[13px] mt-0.5 opacity-90">{children}</p>}
            </div>
        </div>
    );
}
