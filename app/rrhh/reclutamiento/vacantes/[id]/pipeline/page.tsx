'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ArrowLeft, Briefcase, Columns3, List, Mail, MessageCircle, Pencil, Plus, Sparkles, Trash2, UserPlus, UserSearch } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { showToast } from '@/components/Toast';
import { Button, ConfirmDialogBase, EmptyState, ErrorState, LoadingState, SegmentedControl } from '@/components/ui';
import { diasDesde, ETAPAS, linkWhatsapp, nombreCompleto, type EtapaId } from '@/lib/rrhh/reclutamiento';
import NuevoPostulanteDialog from '@/components/rrhh/reclutamiento/NuevoPostulanteDialog';
import BuscarEnBaseDialog from '@/components/rrhh/reclutamiento/BuscarEnBaseDialog';
import VacanteDialog, { type VacanteEditable } from '@/components/rrhh/reclutamiento/VacanteDialog';
import { API, apiJson, Avatar, useMigasReclutamiento, useTituloRuta, EstadoVacanteBadge, MatchBadge, PrioridadBadge, RecomendacionBadge, VeracidadBadge, type Permisos } from '@/components/rrhh/reclutamiento/shared';

interface Tarjeta {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    etapa: string;
    enEtapaDesde: string | null;
    titular: string | null;
    veracidad: number | null;
    match: number | null;
    recomendacion: string | null;
    tags: string[];
}

interface Vacante extends VacanteEditable { startDate: string }

type Vista = 'tablero' | 'lista';

function PipelineView({ id }: { id: string }) {
    const router = useRouter();
    const params = useSearchParams();
    const [vacante, setVacante] = useState<Vacante | null>(null);
    const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);
    const [permisos, setPermisos] = useState<Permisos>({ gestionar: false, eliminar: false });
    const [error, setError] = useState<string | null>(null);
    const [vista, setVista] = useState<Vista>('tablero');
    const [cargar, setCargar] = useState<{ etapa: EtapaId } | null>(params.get('cargar') ? { etapa: 'POSTULADO' } : null);
    const [editar, setEditar] = useState(false);
    const [eliminar, setEliminar] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [evaluando, setEvaluando] = useState<string | null>(null);
    const [buscarEnBase, setBuscarEnBase] = useState(false);

    useMigasReclutamiento();
    useTituloRuta(`/rrhh/reclutamiento/vacantes/${id}`, vacante?.title);
    useTituloRuta(`/rrhh/reclutamiento/vacantes/${id}/pipeline`, 'Pipeline');


    // Abierto desde un enlace (?cargar=1): se limpia la URL para que cerrar o navegar no la reabra.
    useEffect(() => {
        if (params.get('cargar')) router.replace(`/rrhh/reclutamiento/vacantes/${id}/pipeline`);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const recargar = useCallback(async () => {
        setError(null);
        try {
            const r = await apiJson<{ vacante: Vacante; postulantes: Tarjeta[]; permisos: Permisos }>(`${API}/vacantes/${id}/pipeline`);
            setVacante(r.vacante);
            setTarjetas(r.postulantes);
            setPermisos(r.permisos);
        } catch (e: any) {
            setError(e.message);
        }
    }, [id]);
    useEffect(() => { recargar(); }, [recargar]);

    useEffect(() => {
        try { const v = localStorage.getItem('sgi:rrhh-pipeline-vista'); if (v === 'lista' || v === 'tablero') setVista(v); } catch { /* sin almacenamiento */ }
    }, []);
    const cambiarVista = (v: Vista) => {
        setVista(v);
        try { localStorage.setItem('sgi:rrhh-pipeline-vista', v); } catch { /* sin almacenamiento */ }
    };

    const columnas = useMemo(() => {
        const c: Record<string, Tarjeta[]> = Object.fromEntries(ETAPAS.map(e => [e.id, []]));
        (tarjetas || []).forEach(t => { (c[t.etapa] ||= []).push(t); });
        return c;
    }, [tarjetas]);

    const mover = async (t: Tarjeta, etapa: string) => {
        if (t.etapa === etapa) return;
        const anterior = tarjetas;
        setTarjetas(ts => (ts || []).map(x => (x.id === t.id ? { ...x, etapa, enEtapaDesde: new Date().toISOString() } : x)));
        try {
            await apiJson(`${API}/vacantes/${id}/postulantes/${t.id}`, { method: 'PATCH', body: JSON.stringify({ stage: etapa }) });
            const e = ETAPAS.find(x => x.id === etapa);
            showToast(`${nombreCompleto(t)} pasó a ${e?.singular.toLowerCase() ?? etapa}`);
        } catch (err: any) {
            setTarjetas(anterior);
            showToast(err.message, 'error');
        }
    };

    const onDragEnd = (r: DropResult) => {
        if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
        const t = tarjetas?.find(x => x.id === r.draggableId);
        if (t) mover(t, r.destination.droppableId);
    };

    const evaluar = async (t: Tarjeta) => {
        setEvaluando(t.id);
        try {
            const r = await apiJson<{ match: { puntaje: number } }>(`${API}/postulantes/${t.id}/compatibilidad`, { method: 'POST', body: JSON.stringify({ vacancyId: id }) });
            showToast(`Compatibilidad de ${nombreCompleto(t)}: ${r.match.puntaje}%`);
            recargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setEvaluando(null);
        }
    };

    const confirmarEliminar = async () => {
        setEliminando(true);
        try {
            await apiJson(`${API}/vacantes/${id}`, { method: 'DELETE' });
            showToast('Vacante eliminada');
            router.push('/rrhh/reclutamiento/vacantes');
        } catch (e: any) {
            showToast(e.message, 'error');
            setEliminando(false);
        }
    };

    const total = tarjetas?.length ?? 0;
    const activos = (tarjetas || []).filter(t => t.etapa !== 'CONTRATADO' && t.etapa !== 'RECHAZADO').length;

    const contacto = (t: Tarjeta) => {
        const wa = linkWhatsapp(t.phone, `Hola ${t.firstName}, te contactamos de HDB por la búsqueda de ${vacante?.title ?? 'personal'}.`);
        return (
            <div className="flex items-center gap-0.5">
                {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon btn-sm" aria-label={`WhatsApp a ${nombreCompleto(t)}`} title="WhatsApp" onClick={e => e.stopPropagation()}>
                        <MessageCircle className="w-4 h-4" />
                    </a>
                )}
                {t.email && (
                    <a href={`mailto:${t.email}?subject=${encodeURIComponent(`Búsqueda laboral HDB · ${vacante?.title ?? ''}`)}`} className="btn btn-ghost btn-icon btn-sm" aria-label={`Email a ${nombreCompleto(t)}`} title="Email" onClick={e => e.stopPropagation()}>
                        <Mail className="w-4 h-4" />
                    </a>
                )}
            </div>
        );
    };

    const puntajes = (t: Tarjeta) => (
        <div className="flex flex-wrap items-center gap-1">
            {t.match != null ? (
                <MatchBadge puntaje={t.match} />
            ) : permisos.gestionar ? (
                <Button size="sm" variant="ghost" className="!h-6 !px-1.5 text-xs" icon={<Sparkles />} isLoading={evaluando === t.id} onClick={() => evaluar(t)}>
                    Evaluar match
                </Button>
            ) : null}
            {t.veracidad != null && <span title="Índice de veracidad del CV"><VeracidadBadge puntaje={t.veracidad} /></span>}
        </div>
    );

    if (error) return <ErrorState description={error} onRetry={recargar} />;

    return (
        <div className="w-full flex flex-col gap-4 lg:h-[calc(100dvh-var(--topbar-h)-4rem)]">
            <ModuleHeader
                title={vacante ? vacante.title : 'Pipeline'}
                description={vacante ? [vacante.branch, `${activos} en proceso`, `${total} en total`, `${vacante.positionsCount} ${vacante.positionsCount === 1 ? 'puesto' : 'puestos'}`].filter(Boolean).join(' · ') : 'Cargando…'}
                icon={<Briefcase />}
                actions={[
                    { id: 'volver', label: 'Vacantes', icon: <ArrowLeft />, onClick: () => router.push('/rrhh/reclutamiento/vacantes'), variant: 'ghost', hideLabelOnMobile: true },
                    ...(permisos.eliminar ? [{ id: 'eliminar', label: 'Eliminar', icon: <Trash2 />, onClick: () => setEliminar(true), variant: 'danger' as const, hideLabelOnMobile: true }] : []),
                    { id: 'buscar-base', label: 'Buscar en la base', icon: <UserSearch />, onClick: () => setBuscarEnBase(true), variant: 'outline' as const, hideLabelOnMobile: true },
                    ...(permisos.gestionar ? [
                        { id: 'editar', label: 'Editar', icon: <Pencil />, onClick: () => setEditar(true), variant: 'outline' as const, hideLabelOnMobile: true },
                        { id: 'cargar', label: 'Cargar postulante', icon: <UserPlus />, onClick: () => setCargar({ etapa: 'POSTULADO' }), variant: 'primary' as const },
                    ] : []),
                ]}
            />

            <div className="flex flex-wrap items-center gap-2">
                {vacante && <EstadoVacanteBadge estado={vacante.status} />}
                {vacante && <PrioridadBadge prioridad={vacante.priority} />}
                <SegmentedControl<Vista>
                    label="Vista"
                    value={vista}
                    onChange={cambiarVista}
                    className="ml-auto"
                    options={[{ value: 'tablero', label: 'Tablero', icon: <Columns3 /> }, { value: 'lista', label: 'Lista', icon: <List /> }]}
                />
            </div>

            {!tarjetas || !vacante ? (
                <LoadingState label="Cargando pipeline…" />
            ) : total === 0 ? (
                <EmptyState
                    icon={<UserPlus />}
                    title="Esta vacante todavía no tiene postulantes"
                    description="Subí CVs en PDF y la IA calcula la compatibilidad con los requisitos, o sumá postulantes de la base de talentos."
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button variant="secondary" icon={<UserSearch />} onClick={() => setBuscarEnBase(true)}>Buscar en la base</Button>
                            {permisos.gestionar && <Button icon={<UserPlus />} onClick={() => setCargar({ etapa: 'POSTULADO' })}>Cargar postulante</Button>}
                        </div>
                    }
                />
            ) : vista === 'lista' ? (
                <div className="surface overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="px-4 py-2">Postulante</th>
                                    <th className="px-4 py-2">Puntajes</th>
                                    <th className="px-4 py-2">Etapa</th>
                                    <th className="px-4 py-2 hidden md:table-cell">En la etapa</th>
                                    <th className="px-4 py-2 text-right">Contacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {tarjetas.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2.5 min-w-[200px]">
                                                <Avatar persona={t} size="sm" />
                                                <div className="min-w-0">
                                                    <Link href={`/rrhh/reclutamiento/postulantes/${t.id}`} className="text-[13px] font-medium text-foreground hover:underline">{nombreCompleto(t)}</Link>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[240px]">{t.titular || t.city || '—'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">{puntajes(t)}</td>
                                        <td className="px-4 py-2">
                                            <select
                                                className="input w-auto !h-8"
                                                aria-label={`Etapa de ${nombreCompleto(t)}`}
                                                value={t.etapa}
                                                disabled={!permisos.gestionar}
                                                onChange={e => mover(t, e.target.value)}
                                            >
                                                {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.singular}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 hidden md:table-cell text-xs text-muted-foreground tabular-nums">
                                            {t.enEtapaDesde ? `${diasDesde(t.enEtapaDesde)} d` : '—'}
                                        </td>
                                        <td className="px-4 py-2"><div className="flex justify-end">{contacto(t)}</div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-x-auto pb-2 -mx-1 px-1">
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="flex gap-3 h-full items-stretch">
                            {ETAPAS.map(etapa => {
                                const items = columnas[etapa.id] || [];
                                return (
                                    <section key={etapa.id} aria-label={etapa.label} className="w-[272px] shrink-0 flex flex-col rounded-2xl border border-border bg-surface-sunken">
                                        <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                                            <h2 className="eyebrow flex items-center gap-2">
                                                {etapa.label}
                                                <span className="badge badge-neutral tabular-nums">{items.length}</span>
                                            </h2>
                                            {permisos.gestionar && etapa.id !== 'RECHAZADO' && etapa.id !== 'CONTRATADO' && (
                                                <Button size="icon-sm" variant="ghost" aria-label={`Cargar postulante en ${etapa.label}`} title="Cargar postulante en esta etapa" onClick={() => setCargar({ etapa: etapa.id })}>
                                                    <Plus />
                                                </Button>
                                            )}
                                        </header>
                                        <Droppable droppableId={etapa.id} isDropDisabled={!permisos.gestionar}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={`flex-1 min-h-[120px] overflow-y-auto px-2 pb-2 space-y-2 rounded-b-2xl transition-colors ${snapshot.isDraggingOver ? 'bg-brand-50 dark:bg-brand-950/60' : ''}`}
                                                >
                                                    {items.map((t, index) => (
                                                        <Draggable key={t.id} draggableId={t.id} index={index} isDragDisabled={!permisos.gestionar}>
                                                            {(p, s) => (
                                                                <article
                                                                    ref={p.innerRef}
                                                                    {...p.draggableProps}
                                                                    {...p.dragHandleProps}
                                                                    aria-label={`${nombreCompleto(t)}, ${etapa.singular}`}
                                                                    className={`surface p-3 ${s.isDragging ? 'shadow-xl border-primary' : ''}`}
                                                                >
                                                                    <div className="flex items-start gap-2">
                                                                        <Avatar persona={t} size="sm" />
                                                                        <div className="min-w-0 flex-1">
                                                                            <Link href={`/rrhh/reclutamiento/postulantes/${t.id}`} className="text-[13px] font-medium text-foreground hover:underline line-clamp-1">
                                                                                {nombreCompleto(t)}
                                                                            </Link>
                                                                            <p className="text-xs text-muted-foreground line-clamp-1">{t.titular || t.city || 'Sin perfil cargado'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-2">{puntajes(t)}</div>
                                                                    {t.recomendacion && t.recomendacion !== 'evaluar' && <div className="mt-1.5"><RecomendacionBadge valor={t.recomendacion} /></div>}
                                                                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
                                                                        <span className="text-xs text-muted-foreground tabular-nums" title="Días en esta etapa">
                                                                            {t.enEtapaDesde ? `${diasDesde(t.enEtapaDesde)} d en la etapa` : ''}
                                                                        </span>
                                                                        {contacto(t)}
                                                                    </div>
                                                                </article>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </section>
                                );
                            })}
                        </div>
                    </DragDropContext>
                </div>
            )}

            <NuevoPostulanteDialog
                open={!!cargar}
                vacante={vacante ? { id: vacante.id, title: vacante.title } : null}
                etapaInicial={cargar?.etapa}
                onClose={() => { setCargar(null); }}
                onGuardado={() => recargar()}
            />
            {vacante && (
                <BuscarEnBaseDialog
                    open={buscarEnBase}
                    onClose={() => setBuscarEnBase(false)}
                    vacante={{ id: vacante.id, title: vacante.title }}
                    puedeGestionar={permisos.gestionar}
                    onSumados={() => recargar()}
                />
            )}
            <VacanteDialog open={editar} vacante={vacante} onClose={() => setEditar(false)} onGuardada={() => recargar()} />
            <ConfirmDialogBase
                open={eliminar}
                onCancel={() => setEliminar(false)}
                onConfirm={confirmarEliminar}
                tone="danger"
                loading={eliminando}
                title={`¿Eliminar la vacante "${vacante?.title ?? ''}"?`}
                message="Se borra su pipeline con el historial de etapas. Los postulantes siguen en la base de talentos."
                detail={total > 0 ? 'Si la búsqueda terminó, conviene cerrarla en lugar de eliminarla: así se conserva el historial.' : undefined}
                confirmLabel="Eliminar vacante"
            />
        </div>
    );
}

export default function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    return (
        <Suspense fallback={<LoadingState label="Cargando pipeline…" />}>
            <PipelineView id={id} />
        </Suspense>
    );
}
