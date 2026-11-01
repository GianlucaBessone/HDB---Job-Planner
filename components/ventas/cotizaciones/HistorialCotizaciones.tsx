'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Search, X, RefreshCw, FileText, Pencil, MoreHorizontal, Download, Copy,
    CheckCircle2, ShoppingCart, Ban,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { Badge, Button, Dialog, EmptyState, ErrorState, LoadingState, Pagination, Select, Textarea } from '@/components/ui';
import { MOTIVOS_ANULACION } from '@/lib/ventas/cotizacionOpciones';
import { estadoCotizacion } from './estadoCotizacion';

const PAGE_SIZE = 25;

const FILTROS_ESTADO = [
    { value: '', label: 'Todos los estados' },
    { value: 'VIGENTE', label: 'Vigentes' },
    { value: 'APROBADA', label: 'Aprobadas' },
    { value: 'CONVERTIDA', label: 'Convertidas en venta' },
    { value: 'RECHAZADA', label: 'Rechazadas' },
    { value: 'ANULADA', label: 'Anuladas' },
];

const OTRO_MOTIVO = '__otro__';

interface Props {
    /** Se incrementa desde la página para forzar una recarga (p. ej. tras guardar). */
    recargarToken?: number;
    onVer: (cotizacion: any) => void;
    onEditar: (cotizacion: any) => void;
    onDuplicar: (cotizacion: any) => void;
    onEnviarAPdv: (cotizacion: any) => void;
}

const fmtMoneda = (n: number) =>
    '$ ' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (iso: string | Date | null) =>
    iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const esEditable = (cot: any) => cot.estado !== 'CONVERTIDA' && cot.estado !== 'ANULADA';

export default function HistorialCotizaciones({ recargarToken = 0, onVer, onEditar, onDuplicar, onEnviarAPdv }: Props) {
    const [cotizaciones, setCotizaciones] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    const [estado, setEstado] = useState('');
    const [menuAbierto, setMenuAbierto] = useState<{ cot: any; top: number; left: number } | null>(null);

    const [aAnular, setAAnular] = useState<any | null>(null);
    const [motivo, setMotivo] = useState<string>(MOTIVOS_ANULACION[0]);
    const [motivoOtro, setMotivoOtro] = useState('');
    const [anulando, setAnulando] = useState(false);

    const searchRef = useRef<HTMLInputElement>(null);

    // Búsqueda con espera corta para no consultar en cada tecla
    useEffect(() => {
        const t = setTimeout(() => {
            setBusquedaAplicada(busqueda.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [busqueda]);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
            if (estado) params.set('estado', estado);
            if (busquedaAplicada) params.set('q', busquedaAplicada);
            const res = await fetch(`/api/ventas/cotizaciones?${params.toString()}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setCotizaciones(data.cotizaciones || []);
            setTotal(data.total || 0);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [page, estado, busquedaAplicada]);

    useEffect(() => {
        cargar();
    }, [cargar, recargarToken]);

    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    // Cerrar el menú de fila con clic afuera, Escape o scroll
    useEffect(() => {
        if (!menuAbierto) return;
        const cerrar = () => setMenuAbierto(null);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
        window.addEventListener('mousedown', cerrar);
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', cerrar, true);
        window.addEventListener('resize', cerrar);
        return () => {
            window.removeEventListener('mousedown', cerrar);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', cerrar, true);
            window.removeEventListener('resize', cerrar);
        };
    }, [menuAbierto]);

    const cambiarEstado = async (cot: any, nuevoEstado: string, motivoTexto?: string) => {
        const res = await fetch(`/api/ventas/cotizaciones/${cot.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado, motivo: motivoTexto }),
        });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || 'No se pudo cambiar el estado');
        }
    };

    const handleAprobar = async (cot: any) => {
        try {
            await cambiarEstado(cot, 'APROBADA');
            showToast(`Cotización ${cot.numero} marcada como aprobada`, 'success');
            cargar();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const motivoFinal = motivo === OTRO_MOTIVO ? motivoOtro.trim() : motivo;

    const handleAnular = async () => {
        if (!aAnular || motivoFinal.length < 3) return;
        setAnulando(true);
        try {
            await cambiarEstado(aAnular, 'ANULADA', motivoFinal);
            showToast(`Cotización ${aAnular.numero} anulada`, 'success');
            setAAnular(null);
            cargar();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setAnulando(false);
        }
    };

    const abrirMenu = (e: React.MouseEvent<HTMLButtonElement>, cot: any) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        const alto = 200;
        // Abajo si entra; si no, arriba; si tampoco, pegado al borde inferior visible
        const top =
            r.bottom + 4 + alto <= window.innerHeight
                ? r.bottom + 4
                : r.top - 4 - alto >= 8
                ? r.top - 4 - alto
                : Math.max(8, window.innerHeight - alto - 8);
        setMenuAbierto(menuAbierto?.cot.id === cot.id ? null : { cot, top, left: r.right - 224 });
    };

    const hayFiltros = Boolean(busqueda || estado);

    return (
        <section className="flex-1 min-h-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                        ref={searchRef}
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && busqueda && setBusqueda('')}
                        placeholder="Buscar por número, cliente, CUIT, obra o artículo"
                        aria-label="Buscar cotizaciones"
                        className="input h-8 pl-9 pr-8"
                    />
                    {busqueda && (
                        <button
                            type="button"
                            onClick={() => setBusqueda('')}
                            className="btn btn-ghost btn-icon btn-sm absolute right-0.5 top-1/2 -translate-y-1/2"
                            aria-label="Limpiar búsqueda"
                        >
                            <X />
                        </button>
                    )}
                </div>
                <div className="w-48">
                    <Select
                        value={estado}
                        onChange={(e) => {
                            setEstado(e.target.value);
                            setPage(1);
                        }}
                        aria-label="Filtrar por estado"
                        className="h-8"
                    >
                        {FILTROS_ESTADO.map((f) => (
                            <option key={f.value} value={f.value}>
                                {f.label}
                            </option>
                        ))}
                    </Select>
                </div>
                {hayFiltros && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setBusqueda('');
                            setEstado('');
                            setPage(1);
                        }}
                    >
                        Limpiar filtros
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={cargar}
                    aria-label="Actualizar"
                    title="Actualizar"
                    className="ml-auto"
                >
                    <RefreshCw className={loading ? 'animate-spin' : ''} />
                </Button>
            </div>

            {/* Tabla */}
            <div className="flex-1 min-h-0 overflow-auto">
                {error ? (
                    <ErrorState onRetry={cargar} />
                ) : loading && cotizaciones.length === 0 ? (
                    <LoadingState label="Cargando cotizaciones…" />
                ) : cotizaciones.length === 0 ? (
                    <EmptyState
                        icon={<FileText />}
                        title={hayFiltros ? 'Sin resultados' : 'Todavía no hay cotizaciones'}
                        description={
                            hayFiltros
                                ? 'Ninguna cotización coincide con la búsqueda o el estado elegido.'
                                : 'Las cotizaciones que guardes van a aparecer acá.'
                        }
                        action={
                            hayFiltros ? (
                                <Button variant="secondary" size="sm" onClick={() => { setBusqueda(''); setEstado(''); }}>
                                    Limpiar filtros
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-card">
                            <tr className="border-b border-border text-left">
                                <th className="eyebrow py-2 px-3 font-semibold">Número</th>
                                <th className="eyebrow py-2 px-3 font-semibold">Fecha</th>
                                <th className="eyebrow py-2 px-3 font-semibold">Vence</th>
                                <th className="eyebrow py-2 px-3 font-semibold">Cliente</th>
                                <th className="eyebrow py-2 px-3 font-semibold hidden xl:table-cell">Referencia</th>
                                <th className="eyebrow py-2 px-3 font-semibold text-right">Total</th>
                                <th className="eyebrow py-2 px-3 font-semibold">Estado</th>
                                <th className="py-2 px-3 w-[1%]"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {cotizaciones.map((cot) => {
                                const est = estadoCotizacion(cot);
                                return (
                                    <tr
                                        key={cot.id}
                                        onClick={() => onVer(cot)}
                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                    >
                                        <td className="py-2 px-3 font-mono text-[13px] font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                            {cot.numero}
                                            {cot.ventaNumero && (
                                                <div className="font-sans text-xs font-normal text-slate-500">
                                                    Venta {cot.ventaNumero}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                                            {fmtFecha(cot.fecha)}
                                        </td>
                                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                                            {fmtFecha(cot.fechaVencimiento)}
                                        </td>
                                        <td className="py-2 px-3 max-w-[280px]">
                                            <div className="truncate font-medium text-slate-900 dark:text-slate-100" title={cot.clienteNombre}>
                                                {cot.clienteNombre}
                                            </div>
                                            {cot.clienteIdentificacion && (
                                                <div className="text-xs text-slate-500 font-mono">{cot.clienteIdentificacion}</div>
                                            )}
                                        </td>
                                        <td className="py-2 px-3 max-w-[220px] hidden xl:table-cell">
                                            <div className="truncate text-slate-600 dark:text-slate-300" title={cot.referenciaObra || ''}>
                                                {cot.referenciaObra || '—'}
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                            {fmtMoneda(cot.total)}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                            <Badge tone={est.tone}>{est.label}</Badge>
                                            {cot.motivoAnulacion && (cot.estado === 'ANULADA' || cot.estado === 'RECHAZADA') && (
                                                <div className="text-xs text-slate-500 truncate max-w-[160px] mt-0.5" title={cot.motivoAnulacion}>
                                                    {cot.motivoAnulacion}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-1.5 px-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-0.5">
                                                <Button variant="ghost" size="icon-sm" onClick={() => onVer(cot)} aria-label="Ver documento" title="Ver documento">
                                                    <FileText />
                                                </Button>
                                                {esEditable(cot) && (
                                                    <Button variant="ghost" size="icon-sm" onClick={() => onEditar(cot)} aria-label="Editar" title="Editar">
                                                        <Pencil />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => abrirMenu(e, cot)}
                                                    aria-label="Más acciones"
                                                    aria-haspopup="menu"
                                                    aria-expanded={menuAbierto?.cot.id === cot.id}
                                                    title="Más acciones"
                                                >
                                                    <MoreHorizontal />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {total > PAGE_SIZE && (
                <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="shrink-0" />
            )}

            {/* Menú de acciones de fila */}
            {menuAbierto && (
                <div
                    role="menu"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ top: menuAbierto.top, left: Math.max(8, menuAbierto.left) }}
                    className="fixed z-50 w-56 py-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl animate-in fade-in duration-100"
                >
                    {(() => {
                        const cot = menuAbierto.cot;
                        const item = (label: string, icon: React.ReactNode, onClick: () => void, danger = false) => (
                            <button
                                key={label}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuAbierto(null);
                                    onClick();
                                }}
                                className={`w-full flex items-center gap-2.5 px-3 h-9 text-[13px] text-left [&>svg]:w-4 [&>svg]:h-4 ${
                                    danger
                                        ? 'text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/40'
                                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                {icon}
                                {label}
                            </button>
                        );
                        return (
                            <>
                                {item('Descargar PDF', <Download />, () => {
                                    window.location.href = `/api/ventas/cotizaciones/${cot.id}/pdf?download=true`;
                                })}
                                {item('Duplicar como nueva', <Copy />, () => onDuplicar(cot))}
                                {esEditable(cot) && item('Facturar en PDV', <ShoppingCart />, () => onEnviarAPdv(cot))}
                                {cot.estado === 'VIGENTE' && item('Marcar como aprobada', <CheckCircle2 />, () => handleAprobar(cot))}
                                {esEditable(cot) && (
                                    <>
                                        <div className="my-1 border-t border-border" />
                                        {item('Anular…', <Ban />, () => {
                                            setMotivo(MOTIVOS_ANULACION[0]);
                                            setMotivoOtro('');
                                            setAAnular(cot);
                                        }, true)}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Anulación */}
            <Dialog
                open={!!aAnular}
                onClose={() => setAAnular(null)}
                dismissible={!anulando}
                size="sm"
                title={`Anular ${aAnular?.numero || ''}`}
                description="La cotización queda archivada como anulada y ya no se puede editar ni facturar."
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setAAnular(null)} disabled={anulando}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleAnular} isLoading={anulando} disabled={motivoFinal.length < 3}>
                            Anular cotización
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <Select label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} data-autofocus>
                        {MOTIVOS_ANULACION.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                        <option value={OTRO_MOTIVO}>Otro motivo…</option>
                    </Select>
                    {motivo === OTRO_MOTIVO && (
                        <Textarea
                            label="Detalle del motivo"
                            value={motivoOtro}
                            onChange={(e) => setMotivoOtro(e.target.value)}
                            placeholder="Mínimo 3 caracteres"
                            rows={3}
                        />
                    )}
                </div>
            </Dialog>
        </section>
    );
}
