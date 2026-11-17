'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ExternalLink, ListChecks, Search, Sparkles, UserPlus, Users } from 'lucide-react';
import { Button, Dialog, EmptyState, ErrorState, LoadingState, SegmentedControl } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { ETAPAS, nombreCompleto, type EtapaId } from '@/lib/rrhh/reclutamiento';
import { MatchBloque } from './AnalisisIA';
import { API, apiJson, Avatar, EstadoCandidatoBadge, MatchBadge, RecomendacionBadge, VeracidadBadge } from './shared';

interface Sugerido {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    city: string | null;
    status: string;
    titular: string | null;
    veracidad: number | null;
    habilidades: string[];
    procesosActivos: number;
    evaluable: boolean;
    afinidad: number;
    coincidencias: string[];
    match: {
        puntaje: number;
        explicacion: string;
        cumple: string[];
        noCumple: string[];
        recomendacion: string | null;
        fecha: string;
    } | null;
}

type Alcance = 'disponibles' | 'todos';
type Orden = 'match' | 'afinidad' | 'veracidad' | 'nombre';

const POR_PEDIDO = 5;
const MAX_EVALUAR = 30;
const ETAPAS_ALTA = ETAPAS.filter(e => e.id !== 'CONTRATADO' && e.id !== 'RECHAZADO');

/**
 * Busca en la base de talentos a los mejores candidatos para una vacante sin
 * sumarlos: primero ordena por afinidad de palabras clave (sin costo) y evalúa
 * con IA solo a los que se elijan. Después se suman los que convengan.
 */
export default function BuscarEnBaseDialog({
    open,
    onClose,
    vacante,
    puedeGestionar,
    onSumados,
}: {
    open: boolean;
    onClose: () => void;
    vacante: { id: string; title: string };
    puedeGestionar: boolean;
    onSumados: () => void;
}) {
    const [lista, setLista] = useState<Sugerido[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [alcance, setAlcance] = useState<Alcance>('disponibles');
    const [orden, setOrden] = useState<Orden>('match');
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
    const [abierto, setAbierto] = useState<string | null>(null);
    const [avance, setAvance] = useState<{ hecho: number; total: number } | null>(null);
    const [etapa, setEtapa] = useState<EtapaId>('PRESELECCION');
    const [sumando, setSumando] = useState<string | 'lote' | null>(null);
    const cancelar = useRef(false);
    const huboSumados = useRef(false);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const r = await apiJson<{ postulantes: Sugerido[] }>(`${API}/vacantes/${vacante.id}/sugerencias`);
            setLista(r.postulantes);
        } catch (e: any) {
            setError(e.message);
        }
    }, [vacante.id]);

    useEffect(() => {
        if (!open) return;
        setLista(null); setQ(''); setSeleccion(new Set()); setAbierto(null); setAvance(null); setSumando(null);
        huboSumados.current = false;
        cargar();
    }, [open, cargar]);

    const visibles = useMemo(() => {
        const t = q.trim().toLowerCase();
        const l = (lista || [])
            .filter(c => alcance === 'todos' || (c.status !== 'CONTRATADO' && c.status !== 'RECHAZADO'))
            .filter(c => !t || [nombreCompleto(c), c.email, c.city, c.titular, ...c.habilidades].some(x => x?.toLowerCase().includes(t)));
        const num = (v: number | null | undefined) => v ?? -1;
        l.sort((a, b) => {
            if (orden === 'nombre') return nombreCompleto(a).localeCompare(nombreCompleto(b), 'es');
            if (orden === 'veracidad') return num(b.veracidad) - num(a.veracidad) || b.afinidad - a.afinidad;
            if (orden === 'afinidad') return b.afinidad - a.afinidad || num(b.match?.puntaje) - num(a.match?.puntaje);
            return num(b.match?.puntaje) - num(a.match?.puntaje) || b.afinidad - a.afinidad;
        });
        return l;
    }, [lista, q, alcance, orden]);

    const evaluados = (lista || []).filter(c => c.match).length;
    const seleccionados = (lista || []).filter(c => seleccion.has(c.id));
    const aEvaluar = seleccionados.filter(c => c.evaluable);
    const ocupado = !!avance || !!sumando;

    const alternar = (id: string) => setSeleccion(s => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });

    /** Atajo: los 10 de mayor afinidad que todavía no tienen match. */
    const elegirSugeridos = () => {
        const ids = visibles.filter(c => !c.match && c.evaluable).slice(0, 10).map(c => c.id);
        setSeleccion(new Set(ids));
        if (!ids.length) showToast('No quedan postulantes sin evaluar en esta lista.', 'info');
    };

    const evaluar = async () => {
        const ids = aEvaluar.map(c => c.id).slice(0, MAX_EVALUAR);
        if (!ids.length) return;
        cancelar.current = false;
        setAvance({ hecho: 0, total: ids.length });
        let ok = 0;
        const fallidos: string[] = [];
        for (let i = 0; i < ids.length && !cancelar.current; i += POR_PEDIDO) {
            const lote = ids.slice(i, i + POR_PEDIDO);
            try {
                const r = await apiJson<{ resultados: { candidateId: string; ok: boolean; puntaje?: number; error?: string }[] }>(
                    `${API}/vacantes/${vacante.id}/sugerencias`,
                    { method: 'POST', body: JSON.stringify({ candidateIds: lote }) },
                );
                r.resultados.forEach(x => (x.ok ? ok++ : fallidos.push(x.error || 'Error')));
                // Puntaje provisorio hasta recargar con el detalle completo.
                setLista(l => (l || []).map(c => {
                    const res = r.resultados.find(x => x.candidateId === c.id && x.ok);
                    return res ? { ...c, match: { puntaje: res.puntaje!, explicacion: '', cumple: [], noCumple: [], recomendacion: null, fecha: new Date().toISOString() } } : c;
                }));
            } catch (e: any) {
                fallidos.push(e.message);
                if (/configurada|permiso/i.test(e.message)) break; // no tiene sentido seguir
            }
            setAvance({ hecho: Math.min(i + POR_PEDIDO, ids.length), total: ids.length });
        }
        setAvance(null);
        setSeleccion(new Set());
        setOrden('match');
        await cargar();
        if (ok) showToast(`${ok} ${ok === 1 ? 'postulante evaluado' : 'postulantes evaluados'}${fallidos.length ? ` · ${fallidos.length} sin evaluar` : ''}`);
        if (fallidos.length) showToast(fallidos[0], 'error');
    };

    const sumar = async (ids: string[]) => {
        if (!ids.length) return;
        setSumando(ids.length === 1 ? ids[0] : 'lote');
        let ok = 0;
        for (const candidateId of ids) {
            try {
                await apiJson(`${API}/vacantes/${vacante.id}/postulantes`, { method: 'POST', body: JSON.stringify({ candidateId, stage: etapa }) });
                ok++;
            } catch (e: any) {
                showToast(e.message, 'error');
            }
        }
        if (ok) {
            huboSumados.current = true;
            setLista(l => (l || []).filter(c => !ids.includes(c.id)));
            setSeleccion(s => new Set(Array.from(s).filter(id => !ids.includes(id))));
            showToast(ok === 1 ? 'Sumado a la vacante' : `${ok} postulantes sumados a la vacante`);
            onSumados();
        }
        setSumando(null);
    };

    const cerrar = () => {
        cancelar.current = true;
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={cerrar}
            dismissible={!ocupado}
            size="full"
            icon={<Users className="w-[18px] h-[18px]" />}
            title="Buscar en la base de talentos"
            description={`Ordená la base para "${vacante.title}", evaluá con IA a los que más prometen y sumá solo los que convengan.`}
            footer={
                avance ? (
                    <>
                        <div className="flex-1 min-w-0 mr-auto" aria-live="polite">
                            <p className="text-[13px] text-foreground">Evaluando con IA… {avance.hecho} de {avance.total}</p>
                            <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden max-w-xs">
                                <div className="h-full bg-primary rounded-full transition-[width] duration-200" style={{ width: `${(avance.hecho / avance.total) * 100}%` }} />
                            </div>
                        </div>
                        <Button variant="secondary" onClick={() => { cancelar.current = true; }}>Detener</Button>
                    </>
                ) : (
                    <>
                        <span className="text-[13px] text-muted-foreground mr-auto">
                            {seleccion.size ? `${seleccion.size} ${seleccion.size === 1 ? 'seleccionado' : 'seleccionados'}` : `${evaluados} evaluados con IA para esta vacante`}
                        </span>
                        <Button variant="secondary" onClick={cerrar}>{huboSumados.current ? 'Listo' : 'Cerrar'}</Button>
                        {puedeGestionar && (
                            <>
                                <Button variant="tonal" icon={<UserPlus />} disabled={!seleccion.size} isLoading={sumando === 'lote'} onClick={() => sumar(Array.from(seleccion))}>
                                    Sumar seleccionados
                                </Button>
                                <Button icon={<Sparkles />} disabled={!aEvaluar.length} onClick={evaluar}>
                                    Evaluar con IA{aEvaluar.length ? ` (${Math.min(aEvaluar.length, MAX_EVALUAR)})` : ''}
                                </Button>
                            </>
                        )}
                    </>
                )
            }
        >
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        <input className="input !pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, perfil, habilidad, ciudad…" aria-label="Buscar en la base de talentos" />
                    </div>
                    <SegmentedControl<Alcance>
                        label="Postulantes a incluir"
                        value={alcance}
                        onChange={setAlcance}
                        options={[{ value: 'disponibles', label: 'Disponibles' }, { value: 'todos', label: 'Todos' }]}
                    />
                    <select className="input w-auto" aria-label="Ordenar por" value={orden} onChange={e => setOrden(e.target.value as Orden)}>
                        <option value="match">Mejor match IA</option>
                        <option value="afinidad">Mayor afinidad</option>
                        <option value="veracidad">Mayor veracidad</option>
                        <option value="nombre">Nombre</option>
                    </select>
                    {puedeGestionar && (
                        <>
                            <Button variant="ghost" icon={<ListChecks />} onClick={elegirSugeridos} disabled={ocupado}>Elegir 10 más afines</Button>
                            <select className="input w-auto" aria-label="Etapa al sumar" value={etapa} onChange={e => setEtapa(e.target.value as EtapaId)}>
                                {ETAPAS_ALTA.map(s => <option key={s.id} value={s.id}>Sumar como: {s.singular}</option>)}
                            </select>
                        </>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    <b className="font-medium">Afinidad</b>: coincidencia de palabras de la vacante (puesto, requisitos y palabras clave) con el perfil; se calcula al instante y sin IA.
                    {' '}<b className="font-medium">Match IA</b>: evaluación completa contra los requisitos; cada postulante es una consulta a la IA (máximo {MAX_EVALUAR} por vez). Evaluar no los suma a la vacante.
                </p>

                {error ? (
                    <ErrorState description={error} onRetry={cargar} />
                ) : !lista ? (
                    <LoadingState label="Analizando la base de talentos…" />
                ) : visibles.length === 0 ? (
                    <EmptyState
                        compact
                        icon={<Users />}
                        title={lista.length === 0 ? 'No hay postulantes fuera de esta vacante' : 'Sin resultados'}
                        description={lista.length === 0 ? 'Todos los postulantes de la base ya están en el pipeline.' : alcance === 'disponibles' ? 'Probá incluir a todos o cambiar la búsqueda.' : 'Probá con otra búsqueda.'}
                    />
                ) : (
                    <ul className="divide-y divide-border border border-border rounded-xl">
                        {visibles.map(c => {
                            const sel = seleccion.has(c.id);
                            const exp = abierto === c.id && c.match && c.match.explicacion;
                            return (
                                <li key={c.id} className={cn(sel && 'bg-brand-50/60 dark:bg-brand-950/40')}>
                                    <div className="flex items-start sm:items-center gap-3 px-3 py-2.5">
                                        {puedeGestionar && (
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 mt-2.5 sm:mt-0 accent-primary shrink-0"
                                                checked={sel}
                                                disabled={ocupado}
                                                onChange={() => alternar(c.id)}
                                                aria-label={`Seleccionar a ${nombreCompleto(c)}`}
                                            />
                                        )}
                                        <Avatar persona={c} size="sm" />
                                        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                    <span className="text-[13px] font-medium text-foreground">{nombreCompleto(c)}</span>
                                                    {c.status !== 'BASE_TALENTOS' && <EstadoCandidatoBadge estado={c.status} />}
                                                    {c.procesosActivos > 0 && <span className="text-xs text-muted-foreground">{c.procesosActivos} {c.procesosActivos === 1 ? 'proceso abierto' : 'procesos abiertos'}</span>}
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
                                                    {[c.titular, c.city].filter(Boolean).join(' · ') || 'Sin perfil cargado'}
                                                    {c.habilidades.length > 0 && ` · ${c.habilidades.slice(0, 4).join(', ')}`}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 shrink-0">
                                                <div className="w-24 sm:w-28" title={c.coincidencias.length ? `Coincide en: ${c.coincidencias.join(', ')}` : 'Sin coincidencias destacadas'}>
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                                        <span>Afinidad</span>
                                                        <span className="tabular-nums text-foreground">{c.afinidad}%</span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                                                        <div className="h-full rounded-full bg-slate-400 dark:bg-slate-500" style={{ width: `${Math.max(2, c.afinidad)}%` }} />
                                                    </div>
                                                </div>

                                                <div className="sm:w-32 flex flex-wrap sm:flex-col items-center sm:items-start gap-1">
                                                    {c.match ? (
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                            onClick={() => setAbierto(abierto === c.id ? null : c.id)}
                                                            aria-expanded={!!exp}
                                                            aria-label={`Ver detalle del match de ${nombreCompleto(c)}`}
                                                            disabled={!c.match.explicacion}
                                                        >
                                                            <MatchBadge puntaje={c.match.puntaje} />
                                                            {c.match.explicacion && (exp ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />)}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">{c.evaluable ? 'Sin evaluar' : 'Perfil sin datos'}</span>
                                                    )}
                                                    {c.match?.recomendacion && c.match.recomendacion !== 'evaluar' && <RecomendacionBadge valor={c.match.recomendacion} />}
                                                </div>

                                                <div className="hidden lg:block w-16" title="Índice de veracidad del CV">
                                                    <VeracidadBadge puntaje={c.veracidad} />
                                                </div>

                                                <div className="flex items-center gap-1 ml-auto sm:ml-0">
                                                    <Link href={`/rrhh/reclutamiento/postulantes/${c.id}`} target="_blank" className="btn btn-ghost btn-icon btn-sm" aria-label={`Abrir la ficha de ${nombreCompleto(c)} en otra pestaña`} title="Ver ficha">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Link>
                                                    {puedeGestionar && (
                                                        <Button size="sm" variant="tonal" icon={<UserPlus />} isLoading={sumando === c.id} disabled={ocupado && sumando !== c.id} onClick={() => sumar([c.id])}>
                                                            Sumar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {exp && c.match && (
                                        <div className="px-4 pb-4 pt-1 sm:pl-[76px]">
                                            <MatchBloque match={c.match} />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Dialog>
    );
}
