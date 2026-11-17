'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Briefcase, ChevronRight, Plus, RefreshCw, UserPlus } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Button, EmptyState, ErrorState, LoadingState, Panel, Stat } from '@/components/ui';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { ETAPAS, etapaInfo, nombreCompleto } from '@/lib/rrhh/reclutamiento';
import NuevoPostulanteDialog from '@/components/rrhh/reclutamiento/NuevoPostulanteDialog';
import VacanteDialog from '@/components/rrhh/reclutamiento/VacanteDialog';
import {
    API, apiJson, Avatar, EtapaBadge, haceCuanto, MatchBadge, PrioridadBadge, useNavReclutamiento, VeracidadBadge, type Permisos,
} from '@/components/rrhh/reclutamiento/shared';
import type { PostulanteFila } from '@/lib/rrhh/reclutamientoServer';

interface Resumen {
    indicadores: {
        vacantesAbiertas: number;
        vacantesUrgentes: number;
        puestosAbiertos: number;
        vacantesPausadas: number;
        totalPostulantes: number;
        nuevos30: number;
        enProceso: number;
        contratados90: number;
        diasPromedioContratacion: number | null;
    };
    embudo: Record<string, number>;
    busquedas: { id: string; title: string; branch: string | null; status: string; priority: string; positionsCount: number; activos: number; finalistas: number; diasAbierta: number }[];
    actividad: { id: string; etapa: string; notas: string | null; fecha: string; por: string | null; candidato: { id: string; firstName: string; lastName: string }; vacante: { id: string; title: string } }[];
    recientes: PostulanteFila[];
    permisos: Permisos;
}

export default function ReclutamientoTableroPage() {
    const router = useRouter();
    const [data, setData] = useState<Resumen | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [nuevoPostulante, setNuevoPostulante] = useState(false);
    const [nuevaVacante, setNuevaVacante] = useState(false);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            setData(await apiJson<Resumen>(`${API}/resumen`));
        } catch (e: any) {
            setError(e.message);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const nav = useNavReclutamiento('tablero', data ? { postulantes: data.indicadores.totalPostulantes } : {});
    const puedeGestionar = !!data?.permisos.gestionar;

    const registerCommand = useCommandStore(s => s.registerCommand);
    const unregisterCommand = useCommandStore(s => s.unregisterCommand);
    const abrir = useRef(() => setNuevoPostulante(true));
    useEffect(() => {
        if (!puedeGestionar) return;
        registerCommand({ id: 'rrhh-nuevo-postulante', label: 'Nuevo postulante', description: 'Cargar un CV y analizarlo con IA', category: 'Contextual', action: () => abrir.current() });
        return () => unregisterCommand('rrhh-nuevo-postulante');
    }, [registerCommand, unregisterCommand, puedeGestionar]);

    const ind = data?.indicadores;
    const etapasEmbudo = ETAPAS.filter(e => e.id !== 'RECHAZADO');
    const maxEmbudo = Math.max(1, ...etapasEmbudo.map(e => data?.embudo[e.id] || 0));

    return (
        <div className="w-full space-y-6">
            <ModuleHeader
                title="Reclutamiento"
                description="Búsquedas abiertas, postulantes en proceso y contrataciones"
                icon={<Briefcase />}
                {...nav}
                actions={[
                    { id: 'refresh', label: 'Actualizar', icon: <RefreshCw />, onClick: cargar, variant: 'ghost', hideLabelOnMobile: true },
                    ...(puedeGestionar ? [
                        { id: 'vacante', label: 'Nueva vacante', icon: <Plus />, onClick: () => setNuevaVacante(true), variant: 'outline' as const, hideLabelOnMobile: true },
                        { id: 'postulante', label: 'Nuevo postulante', icon: <UserPlus />, onClick: () => setNuevoPostulante(true), variant: 'primary' as const },
                    ] : []),
                ]}
            />

            {error ? (
                <ErrorState description={error} onRetry={cargar} />
            ) : !data || !ind ? (
                <LoadingState label="Cargando el tablero…" />
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Stat
                            label="Búsquedas abiertas"
                            value={ind.vacantesAbiertas}
                            hint={`${ind.puestosAbiertos} ${ind.puestosAbiertos === 1 ? 'puesto' : 'puestos'} · ${ind.vacantesUrgentes} prioritarias`}
                            tone={ind.vacantesUrgentes > 0 ? 'warning' : 'neutral'}
                        />
                        <Stat label="En proceso" value={ind.enProceso} hint="Postulantes en etapas abiertas" />
                        <Stat label="Nuevos postulantes" value={ind.nuevos30} hint={`Últimos 30 días · ${ind.totalPostulantes} en la base`} />
                        <Stat
                            label="Contrataciones"
                            value={ind.contratados90}
                            hint={ind.diasPromedioContratacion != null ? `Últimos 90 días · ${String(ind.diasPromedioContratacion).replace('.', ',')} días promedio` : 'Últimos 90 días'}
                            tone={ind.contratados90 > 0 ? 'success' : 'neutral'}
                        />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <Panel title="Embudo de selección" description="Etapa actual de los postulantes en búsquedas abiertas o pausadas">
                            {ind.enProceso + (data.embudo.CONTRATADO || 0) === 0 ? (
                                <EmptyState compact icon={<Briefcase />} title="Sin postulantes en proceso" description="Cargá postulantes en una vacante para ver el embudo." />
                            ) : (
                                <ul className="space-y-2.5">
                                    {etapasEmbudo.map(e => {
                                        const n = data.embudo[e.id] || 0;
                                        return (
                                            <li key={e.id} className="grid grid-cols-[132px_1fr_32px] items-center gap-3">
                                                <span className="text-[13px] text-slate-700 dark:text-slate-300 truncate">{e.label}</span>
                                                <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                                                    <div className={e.id === 'CONTRATADO' ? 'h-full rounded-full bg-success-500' : 'h-full rounded-full bg-primary'} style={{ width: `${(n / maxEmbudo) * 100}%` }} />
                                                </div>
                                                <span className="text-[13px] font-semibold tabular-nums text-right text-foreground">{n}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {(data.embudo.RECHAZADO || 0) > 0 && (
                                <p className="text-xs text-muted-foreground mt-3">{data.embudo.RECHAZADO} descartados en estas búsquedas.</p>
                            )}
                        </Panel>

                        <Panel
                            title="Búsquedas en curso"
                            padded={false}
                            actions={<Link href="/rrhh/reclutamiento/vacantes" className="btn btn-ghost btn-sm">Ver todas <ArrowRight className="w-4 h-4" /></Link>}
                        >
                            {data.busquedas.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<Briefcase />}
                                    title="No hay búsquedas abiertas"
                                    action={puedeGestionar ? <Button size="sm" variant="secondary" onClick={() => setNuevaVacante(true)}>Crear vacante</Button> : undefined}
                                />
                            ) : (
                                <ul className="divide-y divide-border">
                                    {data.busquedas.map(v => (
                                        <li key={v.id}>
                                            <Link href={`/rrhh/reclutamiento/vacantes/${v.id}/pipeline`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-medium text-foreground truncate">{v.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {[v.branch, `${v.diasAbierta} ${v.diasAbierta === 1 ? 'día' : 'días'} abierta`, v.status === 'PAUSADA' ? 'Pausada' : null].filter(Boolean).join(' · ')}
                                                    </p>
                                                </div>
                                                {(v.priority === 'URGENTE' || v.priority === 'ALTA') && <PrioridadBadge prioridad={v.priority} />}
                                                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{v.activos} en proceso · {v.finalistas} finalistas</span>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        <Panel title="Actividad reciente" padded={false}>
                            {data.actividad.length === 0 ? (
                                <EmptyState compact title="Sin movimientos todavía" />
                            ) : (
                                <ul className="divide-y divide-border">
                                    {data.actividad.map(a => (
                                        <li key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                                            <Avatar persona={a.candidato} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] text-foreground">
                                                    <Link href={`/rrhh/reclutamiento/postulantes/${a.candidato.id}`} className="font-medium hover:underline">{nombreCompleto(a.candidato)}</Link>
                                                    <span className="text-muted-foreground"> → {etapaInfo(a.etapa).singular.toLowerCase()} en </span>
                                                    <Link href={`/rrhh/reclutamiento/vacantes/${a.vacante.id}/pipeline`} className="hover:underline">{a.vacante.title}</Link>
                                                </p>
                                                <p className="text-xs text-muted-foreground">{haceCuanto(a.fecha)}{a.por ? ` · ${a.por}` : ''}</p>
                                            </div>
                                            <EtapaBadge etapa={a.etapa} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        <Panel
                            title="Postulantes recientes"
                            padded={false}
                            actions={<Link href="/rrhh/reclutamiento/postulantes" className="btn btn-ghost btn-sm">Base de talentos <ArrowRight className="w-4 h-4" /></Link>}
                        >
                            {data.recientes.length === 0 ? (
                                <EmptyState
                                    compact
                                    title="Todavía no hay postulantes"
                                    description="Subí un CV en PDF y la IA completa la ficha."
                                    action={puedeGestionar ? <Button size="sm" variant="secondary" onClick={() => setNuevoPostulante(true)}>Cargar el primero</Button> : undefined}
                                />
                            ) : (
                                <ul className="divide-y divide-border">
                                    {data.recientes.map(c => (
                                        <li key={c.id}>
                                            <Link href={`/rrhh/reclutamiento/postulantes/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken transition-colors">
                                                <Avatar persona={c} size="sm" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-medium text-foreground truncate">{nombreCompleto(c)}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{c.titular || c.email || 'Sin perfil'} · {haceCuanto(c.createdAt)}</p>
                                                </div>
                                                {c.veracidad != null && <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">Veracidad <VeracidadBadge puntaje={c.veracidad} /></span>}
                                                {c.mejorMatch != null && <MatchBadge puntaje={c.mejorMatch} />}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>
                </>
            )}

            <NuevoPostulanteDialog
                open={nuevoPostulante}
                onClose={() => setNuevoPostulante(false)}
                onGuardado={id => router.push(`/rrhh/reclutamiento/postulantes/${id}`)}
            />
            <VacanteDialog
                open={nuevaVacante}
                onClose={() => setNuevaVacante(false)}
                onGuardada={id => router.push(`/rrhh/reclutamiento/vacantes/${id}/pipeline`)}
            />
        </div>
    );
}
