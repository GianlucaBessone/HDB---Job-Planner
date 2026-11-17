'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, Building2, CalendarDays, ChevronRight, Pause, Pencil, Play, Plus, RefreshCw, Trash2, UserPlus, Users, XCircle } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { showToast } from '@/components/Toast';
import { Button, ConfirmDialogBase, EmptyState, ErrorState, LoadingState, SegmentedControl } from '@/components/ui';
import { diasDesde, ETAPAS } from '@/lib/rrhh/reclutamiento';
import NuevoPostulanteDialog from '@/components/rrhh/reclutamiento/NuevoPostulanteDialog';
import VacanteDialog, { type VacanteEditable } from '@/components/rrhh/reclutamiento/VacanteDialog';
import { API, apiJson, EstadoVacanteBadge, formatFecha, PrioridadBadge, useNavReclutamiento, type Permisos } from '@/components/rrhh/reclutamiento/shared';

interface Vacante extends VacanteEditable {
    startDate: string;
    endDate: string | null;
    embudo: Record<string, number>;
    total: number;
    activos: number;
    finalistas: number;
    contratados: number;
}

type Filtro = 'ABIERTA' | 'PAUSADA' | 'CERRADA' | 'TODAS';
const PESO_PRIORIDAD: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

function VacantesView() {
    const router = useRouter();
    const params = useSearchParams();
    const [vacantes, setVacantes] = useState<Vacante[] | null>(null);
    const [permisos, setPermisos] = useState<Permisos>({ gestionar: false, eliminar: false });
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [filtro, setFiltro] = useState<Filtro>('ABIERTA');
    const [editar, setEditar] = useState<Vacante | null | 'nueva'>(params.get('nueva') ? 'nueva' : null);
    const [cargarEn, setCargarEn] = useState<Vacante | null>(null);
    const [eliminar, setEliminar] = useState<Vacante | null>(null);
    const [eliminando, setEliminando] = useState(false);


    // Abierto desde un enlace (?nueva=1): se limpia la URL para que cerrar o navegar no la reabra.
    useEffect(() => {
        if (params.get('nueva')) router.replace('/rrhh/reclutamiento/vacantes');
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const r = await apiJson<{ vacantes: Vacante[]; permisos: Permisos }>(`${API}/vacantes`);
            setVacantes(r.vacantes);
            setPermisos(r.permisos);
        } catch (e: any) {
            setError(e.message);
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const conteo = useMemo(() => {
        const c: Record<Filtro, number> = { ABIERTA: 0, PAUSADA: 0, CERRADA: 0, TODAS: 0 };
        (vacantes || []).forEach(v => { c[v.status as Filtro] = (c[v.status as Filtro] || 0) + 1; c.TODAS++; });
        return c;
    }, [vacantes]);

    const visibles = useMemo(() => {
        const t = q.trim().toLowerCase();
        return (vacantes || [])
            .filter(v => filtro === 'TODAS' || v.status === filtro)
            .filter(v => !t || [v.title, v.branch, v.requirements].some(x => x?.toLowerCase().includes(t)))
            .sort((a, b) => (PESO_PRIORIDAD[a.priority] ?? 9) - (PESO_PRIORIDAD[b.priority] ?? 9) || +new Date(b.startDate) - +new Date(a.startDate));
    }, [vacantes, filtro, q]);

    const cambiarEstado = async (v: Vacante, status: string) => {
        try {
            await apiJson(`${API}/vacantes/${v.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            showToast(status === 'ABIERTA' ? 'Vacante reabierta' : status === 'PAUSADA' ? 'Vacante pausada' : 'Vacante cerrada');
            cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const confirmarEliminar = async () => {
        if (!eliminar) return;
        setEliminando(true);
        try {
            await apiJson(`${API}/vacantes/${eliminar.id}`, { method: 'DELETE' });
            showToast('Vacante eliminada');
            setEliminar(null);
            cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setEliminando(false);
        }
    };

    const nav = useNavReclutamiento('vacantes', { vacantes: conteo.ABIERTA || undefined });

    return (
        <div className="w-full space-y-4">
            <ModuleHeader
                title="Vacantes"
                description="Búsquedas laborales y su avance"
                icon={<Briefcase />}
                {...nav}
                searchValue={q}
                onSearchChange={setQ}
                searchPlaceholder="Buscar por puesto, ubicación o requisito…"
                actions={[
                    { id: 'refresh', label: 'Actualizar', icon: <RefreshCw />, onClick: cargar, variant: 'ghost', hideLabelOnMobile: true },
                    ...(permisos.gestionar ? [{ id: 'nueva', label: 'Nueva vacante', icon: <Plus />, onClick: () => setEditar('nueva'), variant: 'primary' as const }] : []),
                ]}
            />

            <div className="max-w-full overflow-x-auto">
                <SegmentedControl<Filtro>
                    label="Estado de la vacante"
                    value={filtro}
                    onChange={setFiltro}
                    options={[
                        { value: 'ABIERTA', label: `Abiertas (${conteo.ABIERTA})` },
                        { value: 'PAUSADA', label: `Pausadas (${conteo.PAUSADA})` },
                        { value: 'CERRADA', label: `Cerradas (${conteo.CERRADA})` },
                        { value: 'TODAS', label: 'Todas' },
                    ]}
                />
            </div>

            {error ? (
                <ErrorState description={error} onRetry={cargar} />
            ) : !vacantes ? (
                <LoadingState label="Cargando vacantes…" />
            ) : visibles.length === 0 ? (
                <EmptyState
                    icon={<Briefcase />}
                    title={vacantes.length === 0 ? 'Todavía no hay vacantes' : 'No hay vacantes con estos filtros'}
                    description={vacantes.length === 0 ? 'Creá una búsqueda para empezar a cargar postulantes.' : 'Cambiá el estado o la búsqueda.'}
                    action={vacantes.length === 0 && permisos.gestionar
                        ? <Button icon={<Plus />} onClick={() => setEditar('nueva')}>Crear la primera</Button>
                        : (q || filtro !== 'TODAS') ? <Button variant="secondary" onClick={() => { setQ(''); setFiltro('TODAS'); }}>Limpiar filtros</Button> : undefined}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visibles.map(v => {
                        const dias = diasDesde(v.startDate);
                        const cubiertos = v.contratados;
                        return (
                            <article key={v.id} className="surface flex flex-col">
                                <Link href={`/rrhh/reclutamiento/vacantes/${v.id}/pipeline`} className="block p-4 flex-1 rounded-t-2xl hover:bg-surface-sunken/60 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="text-heading text-foreground truncate">{v.title}</h2>
                                            <p className="text-caption text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                <span className="truncate">{v.branch || 'Sin ubicación'}</span>
                                            </p>
                                        </div>
                                        <EstadoVacanteBadge estado={v.status} />
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        <PrioridadBadge prioridad={v.priority} />
                                        <span className="badge badge-neutral tabular-nums">{cubiertos}/{v.positionsCount} cubiertos</span>
                                    </div>

                                    {/* Mini embudo: etapas abiertas */}
                                    <div className="mt-4">
                                        <div className="flex h-1.5 rounded-full overflow-hidden bg-muted" aria-hidden="true">
                                            {v.total > 0 && ETAPAS.filter(e => v.embudo[e.id]).map(e => (
                                                <div
                                                    key={e.id}
                                                    className={e.id === 'CONTRATADO' ? 'bg-success-500' : e.id === 'RECHAZADO' ? 'bg-slate-300 dark:bg-slate-600' : e.id === 'FINALISTAS' ? 'bg-brand-700' : 'bg-primary'}
                                                    style={{ width: `${(v.embudo[e.id] / v.total) * 100}%` }}
                                                />
                                            ))}
                                        </div>
                                        <dl className="grid grid-cols-3 gap-2 mt-3 text-center">
                                            <div><dt className="text-xs text-muted-foreground">En proceso</dt><dd className="text-heading tabular-nums text-foreground">{v.activos}</dd></div>
                                            <div><dt className="text-xs text-muted-foreground">Finalistas</dt><dd className="text-heading tabular-nums text-foreground">{v.finalistas}</dd></div>
                                            <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="text-heading tabular-nums text-foreground">{v.total}</dd></div>
                                        </dl>
                                    </div>

                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-3">
                                        <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                                        Desde {formatFecha(v.startDate)}{v.status !== 'CERRADA' ? ` · ${dias} ${dias === 1 ? 'día' : 'días'}` : v.endDate ? ` · cerrada el ${formatFecha(v.endDate)}` : ''}
                                    </p>
                                </Link>

                                <footer className="flex items-center gap-1 px-2 py-2 border-t border-border">
                                    {permisos.gestionar && v.status !== 'CERRADA' && (
                                        <Button size="sm" variant="tonal" icon={<UserPlus />} onClick={() => setCargarEn(v)}>Cargar postulante</Button>
                                    )}
                                    <div className="ml-auto flex items-center gap-0.5">
                                        {permisos.gestionar && (
                                            <>
                                                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${v.title}`} title="Editar" onClick={() => setEditar(v)}><Pencil /></Button>
                                                {v.status === 'ABIERTA' && <Button size="icon-sm" variant="ghost" aria-label={`Pausar ${v.title}`} title="Pausar" onClick={() => cambiarEstado(v, 'PAUSADA')}><Pause /></Button>}
                                                {v.status !== 'ABIERTA' && <Button size="icon-sm" variant="ghost" aria-label={`Reabrir ${v.title}`} title="Reabrir" onClick={() => cambiarEstado(v, 'ABIERTA')}><Play /></Button>}
                                                {v.status !== 'CERRADA' && <Button size="icon-sm" variant="ghost" aria-label={`Cerrar ${v.title}`} title="Cerrar búsqueda" onClick={() => cambiarEstado(v, 'CERRADA')}><XCircle /></Button>}
                                            </>
                                        )}
                                        {permisos.eliminar && (
                                            <Button size="icon-sm" variant="danger-ghost" aria-label={`Eliminar ${v.title}`} title="Eliminar" onClick={() => setEliminar(v)}><Trash2 /></Button>
                                        )}
                                        <Link href={`/rrhh/reclutamiento/vacantes/${v.id}/pipeline`} className="btn btn-ghost btn-sm" aria-label={`Ver pipeline de ${v.title}`}>
                                            <Users className="w-4 h-4" aria-hidden="true" /> Pipeline <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                        </Link>
                                    </div>
                                </footer>
                            </article>
                        );
                    })}
                </div>
            )}

            <VacanteDialog
                open={editar !== null}
                vacante={editar === 'nueva' ? null : editar}
                onClose={() => { setEditar(null); }}
                onGuardada={() => cargar()}
            />
            <NuevoPostulanteDialog
                open={!!cargarEn}
                vacante={cargarEn ? { id: cargarEn.id, title: cargarEn.title } : null}
                onClose={() => setCargarEn(null)}
                onGuardado={() => cargar()}
            />
            <ConfirmDialogBase
                open={!!eliminar}
                onCancel={() => setEliminar(null)}
                onConfirm={confirmarEliminar}
                tone="danger"
                loading={eliminando}
                title={`¿Eliminar la vacante "${eliminar?.title ?? ''}"?`}
                message="Se borra su pipeline con el historial de etapas, entrevistas y evaluaciones. Los postulantes siguen en la base de talentos."
                detail={eliminar && eliminar.total > 0 ? `${eliminar.total} ${eliminar.total === 1 ? 'postulante pierde' : 'postulantes pierden'} este proceso. Si la búsqueda terminó, conviene cerrarla en lugar de eliminarla.` : undefined}
                confirmLabel="Eliminar vacante"
            />
        </div>
    );
}

export default function VacantesPage() {
    return (
        <Suspense fallback={<LoadingState label="Cargando vacantes…" />}>
            <VacantesView />
        </Suspense>
    );
}
