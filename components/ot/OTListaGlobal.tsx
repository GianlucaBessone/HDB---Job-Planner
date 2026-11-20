'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Badge, EmptyState, ErrorState, LoadingState, Pagination, Select } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { safeApiRequest } from '@/lib/offline';
import { formatARS } from '@/lib/formatCurrency';
import { formatDate } from '@/lib/formatDate';

const POR_PAGINA = 30;

const ESTADOS: { value: string; label: string; tone: BadgeTone }[] = [
    { value: 'ABIERTA', label: 'Abierta', tone: 'info' },
    { value: 'PAUSADA', label: 'Pausada', tone: 'warning' },
    { value: 'PENDIENTE_FIRMA', label: 'Pendiente de firma', tone: 'brand' },
    { value: 'CERRADA', label: 'Cerrada', tone: 'success' },
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
    ciclos: { numeroCiclo: number; periodo: string; estado: string; totalGeneral: number }[];
}

/**
 * Todas las órdenes de trabajo en una lista, sin tener que entrar por cliente y
 * proyecto. La búsqueda encuentra por número, referencia del cliente, cliente,
 * proyecto, sector o texto del reporte.
 */
export default function OTListaGlobal({ busqueda }: { busqueda: string }) {
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
                <div className="rounded-xl border border-border bg-card overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr>
                                <th scope="col">Número</th>
                                <th scope="col">Cliente</th>
                                <th scope="col">Proyecto</th>
                                <th scope="col">Estado</th>
                                <th scope="col">Responsable</th>
                                <th scope="col">Último ciclo</th>
                                <th scope="col" className="text-right">Total del ciclo</th>
                                <th scope="col">Creada</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map(ot => {
                                const est = ESTADOS.find(e => e.value === ot.estado);
                                const ciclo = ot.ciclos?.[0];
                                return (
                                    <tr key={ot.id}>
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
                                        <td className="text-right tabular-nums whitespace-nowrap">{ciclo ? formatARS(ciclo.totalGeneral) : '—'}</td>
                                        <td className="whitespace-nowrap">{formatDate(ot.createdAt)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <Pagination page={pagina} pageSize={POR_PAGINA} total={total} onPageChange={setPagina} />
                </div>
            )}
        </div>
    );
}
