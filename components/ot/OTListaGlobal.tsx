'use client';

import { ESTADO_OT_INFO } from '@/lib/estados';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, PauseCircle, PlayCircle } from 'lucide-react';
import { Badge, BarraSeleccion, EmptyState, ErrorState, LoadingState, Pagination, Select, useSeleccion } from '@/components/ui';
import { avisarLote, enLote } from '@/lib/lote';
import type { BadgeTone } from '@/components/ui';
import { safeApiRequest } from '@/lib/offline';
import { formatARS } from '@/lib/formatCurrency';
import { formatDate } from '@/lib/formatDate';
import { useAcceso } from '@/lib/store/useAccessStore';

const POR_PAGINA = 30;

const ESTADOS: { value: string; label: string; tone: BadgeTone }[] = [
    { value: 'ABIERTA', ...ESTADO_OT_INFO.ABIERTA },
    { value: 'PAUSADA', ...ESTADO_OT_INFO.PAUSADA },
    { value: 'PENDIENTE_FIRMA', ...ESTADO_OT_INFO.PENDIENTE_FIRMA },
    { value: 'CERRADA', ...ESTADO_OT_INFO.CERRADA },
];

interface OTFila {
    id: string;
    numeroOT: string;
    refCliente: string | null;
    estado: string;
    sector: string | null;
    createdAt: string;
    cliente: { id: string; nombre: string } | null;
    proyecto: { id: string; nombre: string; codigoProyecto: string | null } | null;
    responsable: { id: string; nombreCompleto: string } | null;
    ciclos: { numeroCiclo: number; periodo: string; estado: string; totalGeneral: number | null }[];
}

/**
 * Todas las órdenes de trabajo en una lista, sin tener que entrar por cliente y
 * proyecto. La búsqueda encuentra por número, referencia del cliente, cliente,
 * proyecto, sector o texto del reporte.
 */
export default function OTListaGlobal({ busqueda }: { busqueda: string }) {
    const verMontos = useAcceso().puede('ot.ver_montos');
    const [estado, setEstado] = useState('TODAS');
    const [pagina, setPagina] = useState(1);
    const [filas, setFilas] = useState<OTFila[]>([]);
    const [total, setTotal] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    const [reintento, setReintento] = useState(0);
    const [termino, setTermino] = useState(busqueda);

    // Espera a que se deje de escribir antes de buscar
    useEffect(() => {
        const t = setTimeout(() => setTermino(busqueda.trim()), 300);
        return () => clearTimeout(t);
    }, [busqueda]);

    useEffect(() => { setPagina(1); }, [termino, estado]);

    useEffect(() => {
        let cancelado = false;
        setCargando(true);
        setError(false);
        const params = new URLSearchParams({ page: String(pagina), limit: String(POR_PAGINA) });
        if (termino) params.set('search', termino);
        if (estado !== 'TODAS') params.set('estado', estado);
        safeApiRequest(`/api/ordenes-trabajo?${params.toString()}`)
            .then(async res => {
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (cancelado) return;
                setFilas(Array.isArray(data?.data) ? data.data : []);
                setTotal(data?.pagination?.total ?? 0);
            })
            .catch(() => { if (!cancelado) setError(true); })
            .finally(() => { if (!cancelado) setCargando(false); });
        return () => { cancelado = true; };
    }, [termino, estado, pagina, reintento]);

    const hayFiltros = !!termino || estado !== 'TODAS';

    // ── Acciones masivas (P33): pausar, reanudar y reasignar las abiertas o pausadas de la página ──
    const seleccion = useSeleccion();
    const [aplicando, setAplicando] = useState(false);
    const [responsables, setResponsables] = useState<{ id: string; nombreCompleto: string }[] | null>(null);
    const seleccionables = useMemo(() => filas.filter(o => o.estado === 'ABIERTA' || o.estado === 'PAUSADA').map(o => o.id), [filas]);
    const { recortar } = seleccion;
    useEffect(() => { recortar(seleccionables); }, [seleccionables]); // eslint-disable-line react-hooks/exhaustive-deps
    const elegidas = filas.filter(o => seleccion.tiene(o.id));

    useEffect(() => {
        if (seleccion.cantidad === 0 || responsables) return;
        safeApiRequest('/api/operators')
            .then(r => (r.ok ? r.json() : []))
            .then((ops: any[]) => setResponsables(
                (Array.isArray(ops) ? ops : []).filter(o => o.activo)
                    .map(o => ({ id: o.id, nombreCompleto: o.nombreCompleto }))
                    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'))
            ))
            .catch(() => setResponsables([]));
    }, [seleccion.cantidad, responsables]);

    const cambiarEstado = async (nuevoEstado: 'ABIERTA' | 'PAUSADA') => {
        const ids = elegidas.filter(o => o.estado !== nuevoEstado).map(o => o.id);
        if (ids.length === 0) return;
        setAplicando(true);
        const r = await enLote(ids, id => safeApiRequest(`/api/ordenes-trabajo/${id}/estado`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevoEstado, motivo: 'Cambio en lote desde la lista de órdenes' }),
        }));
        setAplicando(false);
        avisarLote(r, ['orden', 'órdenes'], nuevoEstado === 'PAUSADA' ? ['pausada', 'pausadas'] : ['reanudada', 'reanudadas']);
        seleccion.limpiar();
        setReintento(n => n + 1);
    };

    const reasignar = async (responsableId: string) => {
        const ids = elegidas.filter(o => o.responsable?.id !== responsableId).map(o => o.id);
        if (ids.length === 0) return;
        setAplicando(true);
        const r = await enLote(ids, id => safeApiRequest(`/api/ordenes-trabajo/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ responsableId }),
        }));
        setAplicando(false);
        const nombre = responsables?.find(o => o.id === responsableId)?.nombreCompleto ?? 'el responsable elegido';
        avisarLote(r, ['orden', 'órdenes'], [`reasignada a ${nombre}`, `reasignadas a ${nombre}`]);
        seleccion.limpiar();
        setReintento(n => n + 1);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-56">
                    <Select label="Estado" value={estado} onChange={e => setEstado(e.target.value)}>
                        <option value="TODAS">Todos</option>
                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </Select>
                </div>
                {hayFiltros && estado !== 'TODAS' && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEstado('TODAS')}>
                        Limpiar estado
                    </button>
                )}
            </div>

            {cargando && filas.length === 0 ? (
                <LoadingState label="Cargando órdenes de trabajo…" />
            ) : error ? (
                <ErrorState
                    description="No se pudieron cargar las órdenes de trabajo."
                    onRetry={() => setReintento(n => n + 1)}
                />
            ) : filas.length === 0 ? (
                <EmptyState
                    icon={<FileText />}
                    title={hayFiltros ? 'No hay órdenes que coincidan' : 'Todavía no hay órdenes de trabajo'}
                    description={hayFiltros ? 'Probá con otro número, cliente o estado.' : 'Creá la primera desde "Nueva OT".'}
                />
            ) : (
                <div className="space-y-2">
                <BarraSeleccion
                    total={seleccionables.length}
                    seleccionadas={seleccion.cantidad}
                    onTodas={() => seleccion.poner(seleccionables)}
                    onNinguna={seleccion.limpiar}
                    unidad={['orden', 'órdenes']}
                >
                    {elegidas.some(o => o.estado === 'ABIERTA') && (
                        <button type="button" className="btn btn-secondary btn-sm" disabled={aplicando} onClick={() => cambiarEstado('PAUSADA')}>
                            <PauseCircle aria-hidden="true" /> Pausar
                        </button>
                    )}
                    {elegidas.some(o => o.estado === 'PAUSADA') && (
                        <button type="button" className="btn btn-secondary btn-sm" disabled={aplicando} onClick={() => cambiarEstado('ABIERTA')}>
                            <PlayCircle aria-hidden="true" /> Reanudar
                        </button>
                    )}
                    <select
                        aria-label="Reasignar el responsable de las seleccionadas"
                        className="input h-8 w-auto text-[13px]"
                        value=""
                        disabled={aplicando || !responsables}
                        onChange={e => e.target.value && reasignar(e.target.value)}
                    >
                        <option value="">{responsables ? 'Reasignar a…' : 'Cargando personas…'}</option>
                        {responsables?.map(o => <option key={o.id} value={o.id}>{o.nombreCompleto}</option>)}
                    </select>
                </BarraSeleccion>
                <div className="rounded-xl border border-border bg-card overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr>
                                <th scope="col" className="w-8"><span className="sr-only">Selección</span></th>
                                <th scope="col">Número</th>
                                <th scope="col">Cliente</th>
                                <th scope="col">Proyecto</th>
                                <th scope="col">Estado</th>
                                <th scope="col">Responsable</th>
                                <th scope="col">Último ciclo</th>
                                {verMontos && <th scope="col" className="text-right">Total del ciclo</th>}
                                <th scope="col">Creada</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map(ot => {
                                const est = ESTADOS.find(e => e.value === ot.estado);
                                const ciclo = ot.ciclos?.[0];
                                return (
                                    <tr key={ot.id} className={seleccion.tiene(ot.id) ? 'bg-brand-50/60 dark:bg-brand-950/30' : undefined}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-primary disabled:opacity-30"
                                                aria-label={`Seleccionar ${ot.numeroOT}`}
                                                title={seleccionables.includes(ot.id) ? undefined : 'Solo se eligen órdenes abiertas o pausadas'}
                                                checked={seleccion.tiene(ot.id)}
                                                disabled={!seleccionables.includes(ot.id)}
                                                onChange={() => seleccion.alternar(ot.id)}
                                            />
                                        </td>
                                        <td className="font-mono whitespace-nowrap">
                                            <Link href={`/ordenes-trabajo/${ot.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
                                                {ot.numeroOT}
                                            </Link>
                                            {ot.refCliente && <span className="block text-xs text-muted-foreground">Ref. {ot.refCliente}</span>}
                                        </td>
                                        <td>{ot.cliente?.nombre ?? '—'}</td>
                                        <td>
                                            {ot.proyecto?.nombre ?? '—'}
                                            {ot.sector && <span className="block text-xs text-muted-foreground">{ot.sector}</span>}
                                        </td>
                                        <td><Badge tone={est?.tone ?? 'neutral'}>{est?.label ?? ot.estado}</Badge></td>
                                        <td>{ot.responsable?.nombreCompleto ?? '—'}</td>
                                        <td className="whitespace-nowrap">{ciclo ? `${ciclo.numeroCiclo} · ${ciclo.periodo}` : '—'}</td>
                                        {verMontos && (
                                            <td className="text-right tabular-nums whitespace-nowrap">{ciclo?.totalGeneral != null ? formatARS(ciclo.totalGeneral) : '—'}</td>
                                        )}
                                        <td className="whitespace-nowrap">{formatDate(ot.createdAt)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <Pagination page={pagina} pageSize={POR_PAGINA} total={total} onPageChange={setPagina} />
                </div>
                </div>
            )}
        </div>
    );
}
