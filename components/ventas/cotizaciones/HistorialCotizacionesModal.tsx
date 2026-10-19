'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Search, FileText, Printer, Edit3, Copy, ShoppingCart,
    CheckCircle2, Ban, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Download, Loader2
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImprimir: (cotizacion: any) => void;
    onEditar: (cotizacion: any) => void;
    onDuplicar: (cotizacion: any) => void;
    onEnviarAPdv: (cotizacion: any) => void;
}

export default function HistorialCotizacionesModal({
    isOpen,
    onClose,
    onImprimir,
    onEditar,
    onDuplicar,
    onEnviarAPdv,
}: Props) {
    const [cotizaciones, setCotizaciones] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState('TODOS');
    const [sortBy, setSortBy] = useState<'numero' | 'fecha' | 'clienteNombre' | 'obra' | 'items' | 'total' | 'estado'>('fecha');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const fmt = (n: number) =>
        (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const fmtDate = (iso: string | Date | null) => {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return String(iso);
        }
    };

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (estadoFiltro !== 'TODOS') params.set('estado', estadoFiltro);
            if (busqueda.trim()) params.set('q', busqueda.trim());
            params.set('limit', '50');
            const res = await fetch(`/api/ventas/cotizaciones?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setCotizaciones(data.cotizaciones || []);
                setTotalCount(data.total || (data.cotizaciones || []).length);
            }
        } catch (err) {
            console.error('Error cargando historial de cotizaciones:', err);
        } finally {
            setLoading(false);
        }
    }, [estadoFiltro, busqueda]);

    useEffect(() => {
        if (isOpen) {
            cargar();
        }
    }, [isOpen, cargar]);

    const cotizacionesOrdenadas = useMemo(() => {
        const dir = sortOrder === 'desc' ? -1 : 1;
        return [...cotizaciones].sort((a, b) => {
            switch (sortBy) {
                case 'numero':
                    return (a.numero || '').localeCompare(b.numero || '') * dir;
                case 'clienteNombre':
                    return (a.clienteNombre || '').localeCompare(b.clienteNombre || '') * dir;
                case 'obra':
                    return (a.referenciaObra || a.condicionPago || '').localeCompare(b.referenciaObra || b.condicionPago || '') * dir;
                case 'items':
                    return (((a.items || []).length) - ((b.items || []).length)) * dir;
                case 'total':
                    return ((a.total || 0) - (b.total || 0)) * dir;
                case 'estado':
                    return (a.estado || '').localeCompare(b.estado || '') * dir;
                case 'fecha':
                default:
                    return (new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) * dir;
            }
        });
    }, [cotizaciones, sortBy, sortOrder]);

    const [cotizacionADesestimar, setCotizacionADesestimar] = useState<any | null>(null);
    const [motivoDesestimacion, setMotivoDesestimacion] = useState('Desestimada por el cliente');
    const [desestimando, setDesestimando] = useState(false);

    const handleCambiarEstado = async (cotId: string, nuevoEstado: string, motivo?: string) => {
        try {
            const res = await fetch(`/api/ventas/cotizaciones/${cotId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado, motivo }),
            });
            if (res.ok) {
                showToast(`Cotización marcada como ${nuevoEstado}`, 'success');
                await cargar();
            } else {
                const d = await res.json();
                showToast(d.error || 'No se pudo cambiar el estado', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error al actualizar estado de la cotización', 'error');
        }
    };

    const handleConfirmarDesestimacion = async () => {
        if (!cotizacionADesestimar) return;
        const motivoLimpio = motivoDesestimacion.trim();
        if (motivoLimpio.length < 3) {
            showToast('Debe ingresar un motivo de al menos 3 caracteres', 'error');
            return;
        }
        setDesestimando(true);
        try {
            const res = await fetch(`/api/ventas/cotizaciones/${cotizacionADesestimar.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: 'ANULADA',
                    motivo: motivoLimpio,
                }),
            });
            if (res.ok) {
                showToast(`Cotización ${cotizacionADesestimar.numero} desestimada correctamente`, 'success');
                setCotizacionADesestimar(null);
                await cargar();
            } else {
                const d = await res.json();
                showToast(d.error || 'No se pudo desestimar la cotización', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error al desestimar la cotización', 'error');
        } finally {
            setDesestimando(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <div>
                            <h3 className="font-black text-base">Historial y Seguimiento de Cotizaciones</h3>
                            <p className="text-xs text-slate-400">
                                {totalCount} cotizaciones registradas • Reimprima, edite, duplique o convierta en venta de PDV
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filtros */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar por N° COT, cliente, CUIT, código de artículo u obra..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape' && busqueda) setBusqueda('');
                            }}
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {busqueda && (
                            <button
                                type="button"
                                onClick={() => setBusqueda('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {['TODOS', 'VIGENTE', 'APROBADA', 'CONVERTIDA', 'RECHAZADA', 'ANULADA'].map((est) => (
                            <button
                                key={est}
                                onClick={() => setEstadoFiltro(est)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                                    estadoFiltro === est
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-background border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                {est === 'TODOS' ? 'Todas' : est}
                            </button>
                        ))}
                        <button
                            onClick={cargar}
                            className="p-2 rounded-xl bg-background border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Actualizar"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Tabla */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading && cotizaciones.length === 0 ? (
                        <div className="py-16 text-center text-xs text-slate-400">Cargando cotizaciones...</div>
                    ) : cotizacionesOrdenadas.length === 0 ? (
                        <div className="py-16 text-center text-xs text-slate-400">
                            No se encontraron cotizaciones con los filtros aplicados.
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none whitespace-nowrap">
                                    {[
                                        { key: 'numero', label: 'N° Cotización', align: 'left' },
                                        { key: 'fecha', label: 'Emisión / Vto.', align: 'left' },
                                        { key: 'clienteNombre', label: 'Cliente / Destinatario', align: 'left' },
                                        { key: 'obra', label: 'Obra / Condición', align: 'left' },
                                        { key: 'items', label: 'Ítems', align: 'center' },
                                        { key: 'total', label: 'Total (ARS)', align: 'right' },
                                        { key: 'estado', label: 'Estado', align: 'center' },
                                    ].map((col) => {
                                        const isSorted = sortBy === col.key;
                                        return (
                                            <th
                                                key={col.key}
                                                onClick={() => {
                                                    if (sortBy === col.key) {
                                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                                    } else {
                                                        setSortBy(col.key as any);
                                                        setSortOrder(col.key === 'fecha' || col.key === 'total' ? 'desc' : 'asc');
                                                    }
                                                }}
                                                className={`py-2.5 px-3 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${
                                                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                                } ${isSorted ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                                            >
                                                <div
                                                    className={`inline-flex items-center gap-1 ${
                                                        col.align === 'right' ? 'justify-end w-full' : col.align === 'center' ? 'justify-center w-full' : ''
                                                    }`}
                                                >
                                                    <span>{col.label}</span>
                                                    {isSorted ? (
                                                        sortOrder === 'asc' ? (
                                                            <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                        ) : (
                                                            <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                        )
                                                    ) : (
                                                        <ArrowUpDown className="w-3 h-3 opacity-35 shrink-0" />
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                    <th className="py-2.5 px-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {cotizacionesOrdenadas.map((cot) => {
                                    const est = cot.estaVencida && cot.estado === 'VIGENTE' ? 'VENCIDA' : cot.estado;
                                    return (
                                        <tr key={cot.id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40">
                                            <td className="py-3 px-3 font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                {cot.numero}
                                                {cot.ventaNumero && (
                                                    <div className="text-[10px] font-sans font-bold text-emerald-700 dark:text-emerald-400">
                                                        → {cot.ventaNumero}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <div className="text-slate-800 dark:text-slate-200 font-medium">{fmtDate(cot.fecha)}</div>
                                                <div className="text-[10px] text-slate-400">
                                                    Vence: {fmtDate(cot.fechaVencimiento)}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-slate-900 dark:text-slate-100">{cot.clienteNombre}</div>
                                                {cot.clienteIdentificacion && (
                                                    <div className="text-[10px] font-mono text-slate-400">
                                                        {cot.clienteIdentificacion}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                                                    {cot.referenciaObra || cot.condicionPago || '—'}
                                                </div>
                                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                                    Lista: {cot.listaPrecioNombre || 'General'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                                                {(cot.items || []).length}
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
                                                $ {fmt(cot.total)}{' '}
                                                <span className="text-[10px] text-slate-400 font-sans font-bold">ARS</span>
                                            </td>
                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                <span
                                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                        est === 'CONVERTIDA'
                                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                                            : est === 'APROBADA'
                                                            ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                                                            : est === 'VENCIDA'
                                                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                                            : est === 'RECHAZADA' || est === 'ANULADA'
                                                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                                            : 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300'
                                                    }`}
                                                >
                                                    {est}
                                                </span>
                                                {cot.motivoAnulacion && (est === 'ANULADA' || est === 'RECHAZADA') && (
                                                    <div
                                                        className="text-[9.5px] text-red-600 dark:text-red-400 font-medium truncate max-w-[130px] mx-auto mt-0.5"
                                                        title={`Motivo: ${cot.motivoAnulacion}`}
                                                    >
                                                        {cot.motivoAnulacion}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    <a
                                                        href={`/api/ventas/cotizaciones/${cot.id}/pdf?download=true`}
                                                        className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                        title="Descargar PDF Corporativo Oficial"
                                                        download={`Cotizacion_${cot.numero}.pdf`}
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>

                                                    <button
                                                        onClick={() => onImprimir(cot)}
                                                        className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                                                        title="Ver e Imprimir Cotización"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>

                                                    {cot.estado !== 'CONVERTIDA' && cot.estado !== 'ANULADA' && (
                                                        <>
                                                            <button
                                                                onClick={() => onEditar(cot)}
                                                                className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                                                                title="Cargar en el cotizador para editar"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>

                                                            {cot.estado !== 'APROBADA' && (
                                                                <button
                                                                    onClick={() => handleCambiarEstado(cot.id, 'APROBADA')}
                                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                                                    title="Marcar como Aprobada por el cliente"
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => onEnviarAPdv(cot)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px]"
                                                                title="Enviar al PDV para confirmar venta"
                                                            >
                                                                <ShoppingCart className="w-3.5 h-3.5" />
                                                                A PDV
                                                            </button>
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={() => onDuplicar(cot)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                                        title="Duplicar como nueva cotización"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>

                                                    {cot.estado !== 'CONVERTIDA' && cot.estado !== 'ANULADA' && (
                                                        <button
                                                            onClick={() => {
                                                                setCotizacionADesestimar(cot);
                                                                setMotivoDesestimacion('Desestimada por el cliente');
                                                            }}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                                            title="Desestimar / Anular cotización"
                                                        >
                                                            <Ban className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal Nativo de la App: Desestimar / Anular Cotización */}
            {cotizacionADesestimar && (
                <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-card text-card-foreground rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="p-4 bg-red-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-red-700/80">
                                    <Ban className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm">Desestimar Cotización</h4>
                                    <p className="text-[11px] text-red-100 font-mono">
                                        {cotizacionADesestimar.numero} • {cotizacionADesestimar.clienteNombre}
                                    </p>
                                </div>
                            </div>
                            <button
                                disabled={desestimando}
                                onClick={() => setCotizacionADesestimar(null)}
                                className="p-1 rounded-lg text-red-200 hover:text-white hover:bg-red-700/80 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                Al desestimar esta cotización quedará archivada con estado{' '}
                                <strong className="text-red-600 dark:text-red-400">ANULADA</strong>.
                                Por favor seleccione o detalle el motivo:
                            </p>

                            {/* Chips de motivos frecuentes */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Motivos rápidos:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        'Desestimada por el cliente',
                                        'Presupuesto vencido',
                                        'Precios desactualizados',
                                        'No aceptó condiciones de pago',
                                        'Proyecto cancelado / postergado',
                                        'Optó por otra propuesta',
                                    ].map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setMotivoDesestimacion(m)}
                                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                                                motivoDesestimacion === m
                                                    ? 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-bold'
                                                    : 'bg-muted/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-muted'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Textarea */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Motivo registrado en auditoría *
                                </label>
                                <textarea
                                    rows={3}
                                    value={motivoDesestimacion}
                                    onChange={(e) => setMotivoDesestimacion(e.target.value)}
                                    placeholder="Ingrese el motivo de desestimación..."
                                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
                                    autoFocus
                                />
                                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                                    <span>Mínimo 3 caracteres requeridos</span>
                                    <span>{motivoDesestimacion.trim().length} chars</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    disabled={desestimando}
                                    onClick={() => setCotizacionADesestimar(null)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={desestimando || motivoDesestimacion.trim().length < 3}
                                    onClick={handleConfirmarDesestimacion}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {desestimando ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Desestimando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Ban className="w-3.5 h-3.5" />
                                            <span>Desestimar Cotización</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
