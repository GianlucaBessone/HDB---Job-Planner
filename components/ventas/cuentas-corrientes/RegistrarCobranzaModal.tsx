'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    X, DollarSign, CheckCircle2, AlertCircle, Plus, Trash2,
    Layers, CreditCard, Banknote, Building2, FileText
} from 'lucide-react';
import { MedioPagoCobranzaInput, ImputacionManualInput } from '@/lib/ventas/cuentaCorrienteService';

export interface ComprobantePendienteItem {
    id: string;
    destinoTipo: 'VENTA' | 'CARGO';
    numero: string;
    fecha: string | Date;
    fechaVencimiento: string | Date;
    diasVencido: number;
    vencido: boolean;
    concepto: string;
    montoTotalOperacion: number;
    montoOriginalCC: number;
    montoPagadoCC: number;
    saldoPendiente: number;
}

interface Props {
    cliente: {
        id: string;
        nombre: string;
        saldoActual: number;
        deudaVencida: number;
    };
    comprobantesPendientes: ComprobantePendienteItem[];
    operadorNombre?: string;
    onClose: () => void;
    onSuccess: (reciboCreado: any) => void;
}

const MEDIOS_PAGO: Array<{
    id: MedioPagoCobranzaInput['metodo'];
    label: string;
    icon: any;
}> = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
    { id: 'TRANSFERENCIA', label: 'Transferencia Bancaria', icon: Building2 },
    { id: 'CHEQUE', label: 'Cheque / E-Cheq', icon: FileText },
    { id: 'TARJETA_DEBITO', label: 'Tarjeta Débito', icon: CreditCard },
    { id: 'TARJETA_CREDITO', label: 'Tarjeta Crédito', icon: CreditCard },
    { id: 'OTRO', label: 'Otro Medio', icon: DollarSign },
];

export default function RegistrarCobranzaModal({
    cliente,
    comprobantesPendientes,
    operadorNombre,
    onClose,
    onSuccess,
}: Props) {
    const saldoDeudor = Math.max(0, cliente.saldoActual || 0);
    const [modoImputacion, setModoImputacion] = useState<'FIFO' | 'MANUAL'>('FIFO');
    const [pagos, setPagos] = useState<
        Array<{ id: string; metodo: MedioPagoCobranzaInput['metodo']; monto: string; referencia: string }>
    >([
        {
            id: '1',
            metodo: 'TRANSFERENCIA',
            monto: saldoDeudor > 0 ? String(Math.round(saldoDeudor * 100) / 100) : '',
            referencia: '',
        },
    ]);
    const [imputacionesManuales, setImputacionesManuales] = useState<Record<string, string>>({});
    const [concepto, setConcepto] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fmt = (n: number) =>
        (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const fmtDate = (iso: string | Date) => {
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

    const totalCobranza = useMemo(() => {
        return Math.round(
            pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0) * 100
        ) / 100;
    }, [pagos]);

    // Previsualización de cómo se imputará en modo FIFO
    const previewFifo = useMemo(() => {
        let disponible = totalCobranza;
        const map: Record<string, number> = {};
        for (const comp of comprobantesPendientes) {
            if (disponible <= 0.009) {
                map[comp.id] = 0;
                continue;
            }
            const aplicar = Math.round(Math.min(disponible, comp.saldoPendiente) * 100) / 100;
            map[comp.id] = aplicar;
            disponible = Math.round((disponible - aplicar) * 100) / 100;
        }
        return {
            porComprobante: map,
            excedenteSinImputar: Math.max(0, disponible),
        };
    }, [totalCobranza, comprobantesPendientes]);

    const totalImputadoManual = useMemo(() => {
        return Math.round(
            Object.values(imputacionesManuales).reduce((acc, val) => acc + (parseFloat(val) || 0), 0) * 100
        ) / 100;
    }, [imputacionesManuales]);

    useEffect(() => {
        if (modoImputacion === 'MANUAL' && Object.keys(imputacionesManuales).length === 0) {
            const init: Record<string, string> = {};
            for (const comp of comprobantesPendientes) {
                const montoFifo = previewFifo.porComprobante[comp.id] || 0;
                if (montoFifo > 0) {
                    init[comp.id] = String(montoFifo);
                }
            }
            setImputacionesManuales(init);
        }
    }, [modoImputacion, comprobantesPendientes, previewFifo, imputacionesManuales]);

    const handleSetMontoRapido = (monto: number) => {
        const redondeado = Math.round(monto * 100) / 100;
        if (pagos.length === 1) {
            setPagos([{ ...pagos[0], monto: String(redondeado) }]);
        } else {
            setPagos([
                {
                    id: Date.now().toString(),
                    metodo: 'TRANSFERENCIA',
                    monto: String(redondeado),
                    referencia: '',
                },
            ]);
        }
    };

    const handleAddPago = () => {
        setPagos((prev) => [
            ...prev,
            { id: Date.now().toString(), metodo: 'EFECTIVO', monto: '', referencia: '' },
        ]);
    };

    const handleRemovePago = (id: string) => {
        if (pagos.length <= 1) return;
        setPagos((prev) => prev.filter((p) => p.id !== id));
    };

    const handleChangePago = (
        id: string,
        field: 'metodo' | 'monto' | 'referencia',
        value: string
    ) => {
        setPagos((prev) =>
            prev.map((p) => (p.id === id ? ({ ...p, [field]: value } as any) : p))
        );
    };

    const handleToggleComprobanteManual = (comp: ComprobantePendienteItem) => {
        setImputacionesManuales((prev) => {
            const actual = parseFloat(prev[comp.id] || '0');
            if (actual > 0) {
                const copy = { ...prev };
                delete copy[comp.id];
                return copy;
            } else {
                return {
                    ...prev,
                    [comp.id]: String(comp.saldoPendiente),
                };
            }
        });
    };

    const handleSincronizarMontoDesdeManual = () => {
        if (totalImputadoManual > 0) {
            handleSetMontoRapido(totalImputadoManual);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (totalCobranza <= 0) {
            setError('Debe ingresar un monto de cobranza mayor a $0,00.');
            return;
        }

        const mediosPagoValidos: MedioPagoCobranzaInput[] = pagos
            .map((p) => ({
                metodo: p.metodo,
                monto: Math.round((parseFloat(p.monto) || 0) * 100) / 100,
                referencia: p.referencia.trim() || null,
            }))
            .filter((p) => p.monto > 0);

        if (mediosPagoValidos.length === 0) {
            setError('Debe especificar al menos un medio de pago con monto válido.');
            return;
        }

        const imputacionesList: ImputacionManualInput[] = [];
        if (modoImputacion === 'MANUAL') {
            for (const comp of comprobantesPendientes) {
                const m = Math.round((parseFloat(imputacionesManuales[comp.id] || '0') || 0) * 100) / 100;
                if (m > 0) {
                    if (m > comp.saldoPendiente + 0.01) {
                        setError(
                            `El monto imputado a ${comp.numero} ($${fmt(m)}) supera su saldo pendiente ($${fmt(comp.saldoPendiente)}).`
                        );
                        return;
                    }
                    imputacionesList.push({
                        destinoTipo: comp.destinoTipo,
                        destinoId: comp.id,
                        monto: m,
                    });
                }
            }
            if (totalImputadoManual > totalCobranza + 0.01) {
                setError(
                    `La suma imputada manualmente ($${fmt(totalImputadoManual)}) supera el total cobrado ($${fmt(totalCobranza)}).`
                );
                return;
            }
        }

        setSubmitting(true);
        try {
            const idempotencyKey = `cob-${cliente.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const res = await fetch('/api/ventas/cuentas-corrientes/cobranzas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': idempotencyKey,
                },
                body: JSON.stringify({
                    clienteId: cliente.id,
                    mediosPago: mediosPagoValidos,
                    modoImputacion,
                    imputacionesManuales: modoImputacion === 'MANUAL' ? imputacionesList : undefined,
                    concepto: concepto.trim() || undefined,
                    observaciones: observaciones.trim() || undefined,
                    operadorNombre,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Error al registrar la cobranza');
            }
            onSuccess(data.recibo || data);
        } catch (err: any) {
            setError(err.message || 'Error inesperado al registrar cobranza');
        } finally {
            setSubmitting(false);
        }
    };

    const saldoRestanteEstimado = Math.round((saldoDeudor - totalCobranza) * 100) / 100;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base tracking-tight">
                                Registrar Cobranza / Recibo de Cuenta Corriente
                            </h3>
                            <p className="text-xs text-slate-400">
                                Cliente: <span className="text-white font-semibold">{cliente.nombre}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && (
                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs font-medium">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Resumen superior y botones rápidos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Deuda Actual
                                </div>
                                <div className="text-lg font-bold font-mono text-slate-900">
                                    ${fmt(saldoDeudor)}
                                </div>
                            </div>
                            {saldoDeudor > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSetMontoRapido(saldoDeudor)}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors"
                                >
                                    Saldar Total
                                </button>
                            )}
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                                    Deuda Vencida
                                </div>
                                <div className="text-lg font-bold font-mono text-amber-800">
                                    ${fmt(cliente.deudaVencida)}
                                </div>
                            </div>
                            {cliente.deudaVencida > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSetMontoRapido(cliente.deudaVencida)}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs transition-colors"
                                >
                                    Cobrar Vencido
                                </button>
                            )}
                        </div>

                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                                    Total Recibo a Emitir
                                </div>
                                <div className="text-xl font-bold font-mono text-emerald-700">
                                    ${fmt(totalCobranza)}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] text-emerald-600 font-semibold">Saldo Posterior</div>
                                <div
                                    className={`text-xs font-bold font-mono ${
                                        saldoRestanteEstimado > 0 ? 'text-slate-700' : 'text-emerald-700'
                                    }`}
                                >
                                    ${fmt(Math.max(0, saldoRestanteEstimado))}
                                    {saldoRestanteEstimado < -0.01 &&
                                        ` (A favor: $${fmt(Math.abs(saldoRestanteEstimado))})`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Medios de pago */}
                    <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-indigo-600" />
                                1. Medios de Pago Recibidos
                            </h4>
                            <button
                                type="button"
                                onClick={handleAddPago}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                            >
                                <Plus className="w-3.5 h-3.5" /> Agregar Medio
                            </button>
                        </div>

                        <div className="space-y-2">
                            {pagos.map((pago, index) => (
                                <div
                                    key={pago.id}
                                    className="grid grid-cols-12 gap-2.5 items-center bg-white p-2.5 rounded-xl border border-slate-200"
                                >
                                    <div className="col-span-12 sm:col-span-4">
                                        <label className="block mb-0.5 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                            Medio #{index + 1}
                                        </label>
                                        <select
                                            value={pago.metodo}
                                            onChange={(e) =>
                                                handleChangePago(pago.id, 'metodo', e.target.value)
                                            }
                                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {MEDIOS_PAGO.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-6 sm:col-span-3">
                                        <label className="block mb-0.5 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                            Importe ($)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={pago.monto}
                                            onChange={(e) =>
                                                handleChangePago(pago.id, 'monto', e.target.value)
                                            }
                                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                                        />
                                    </div>

                                    <div className="col-span-5 sm:col-span-4">
                                        <label className="block mb-0.5 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                            N° Comprobante / Cheque / Ref.
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Transf #84920 / Cheque Bco Nación"
                                            value={pago.referencia}
                                            onChange={(e) =>
                                                handleChangePago(pago.id, 'referencia', e.target.value)
                                            }
                                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="col-span-1 flex justify-end pt-4">
                                        <button
                                            type="button"
                                            disabled={pagos.length <= 1}
                                            onClick={() => handleRemovePago(pago.id)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                                            title="Quitar medio de pago"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Imputación de Comprobantes */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-indigo-600" />
                                    2. Imputación a Comprobantes Pendientes ({comprobantesPendientes.length})
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                    Elija si desea cancelar automáticamente desde la deuda más antigua (FIFO) o seleccionar manualmente cada factura.
                                </p>
                            </div>

                            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setModoImputacion('FIFO')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        modoImputacion === 'FIFO'
                                            ? 'bg-white text-indigo-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Automático (FIFO Antiguo → Nuevo)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModoImputacion('MANUAL')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        modoImputacion === 'MANUAL'
                                            ? 'bg-white text-indigo-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Selección Manual
                                </button>
                            </div>
                        </div>

                        {comprobantesPendientes.length === 0 ? (
                            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                                El cliente no registra comprobantes con saldo pendiente de cancelación. El pago quedará registrado como saldo a favor / anticipo en su cuenta corriente.
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                            <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                {modoImputacion === 'MANUAL' && (
                                                    <th className="py-2 px-3 text-center w-10">Sel.</th>
                                                )}
                                                <th className="py-2 px-3 text-left">Comprobante</th>
                                                <th className="py-2 px-3 text-left">Emisión / Vto.</th>
                                                <th className="py-2 px-3 text-right">Total Orig.</th>
                                                <th className="py-2 px-3 text-right">Saldo Pend.</th>
                                                <th className="py-2 px-3 text-right w-36">Monto a Imputar</th>
                                                <th className="py-2 px-3 text-right">Saldo Restante</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {comprobantesPendientes.map((comp) => {
                                                const imputado =
                                                    modoImputacion === 'FIFO'
                                                        ? previewFifo.porComprobante[comp.id] || 0
                                                        : parseFloat(imputacionesManuales[comp.id] || '0') || 0;
                                                const restante = Math.max(
                                                    0,
                                                    Math.round((comp.saldoPendiente - imputado) * 100) / 100
                                                );
                                                const quedaSaldado = restante <= 0.009 && imputado > 0;

                                                return (
                                                    <tr
                                                        key={comp.id}
                                                        className={`transition-colors ${
                                                            imputado > 0
                                                                ? 'bg-emerald-50/40'
                                                                : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {modoImputacion === 'MANUAL' && (
                                                            <td className="py-2 px-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={imputado > 0}
                                                                    onChange={() =>
                                                                        handleToggleComprobanteManual(comp)
                                                                    }
                                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="py-2 px-3">
                                                            <div className="font-mono font-bold text-slate-800">
                                                                {comp.numero}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                                                {comp.concepto}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="text-slate-700">
                                                                {fmtDate(comp.fecha)}
                                                            </div>
                                                            <div className="text-[11px]">
                                                                {comp.vencido ? (
                                                                    <span className="text-red-600 font-bold">
                                                                        Vencido ({comp.diasVencido}d)
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400">
                                                                        Vto: {fmtDate(comp.fechaVencimiento)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                                                            ${fmt(comp.montoOriginalCC)}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                                            ${fmt(comp.saldoPendiente)}
                                                        </td>
                                                        <td className="py-2 px-3 text-right">
                                                            {modoImputacion === 'FIFO' ? (
                                                                <span
                                                                    className={`font-mono font-bold ${
                                                                        imputado > 0
                                                                            ? 'text-emerald-700'
                                                                            : 'text-slate-300'
                                                                    }`}
                                                                >
                                                                    ${fmt(imputado)}
                                                                </span>
                                                            ) : (
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max={comp.saldoPendiente}
                                                                    value={imputacionesManuales[comp.id] ?? ''}
                                                                    placeholder="0.00"
                                                                    onChange={(e) =>
                                                                        setImputacionesManuales((prev) => ({
                                                                            ...prev,
                                                                            [comp.id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    className="w-28 px-2 py-1 text-right font-mono font-bold text-xs rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono">
                                                            {quedaSaldado ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                                                    <CheckCircle2 className="w-3 h-3" /> Saldado
                                                                </span>
                                                            ) : imputado > 0 ? (
                                                                <span className="text-amber-700 font-bold">
                                                                    Parcial (${fmt(restante)})
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">
                                                                    ${fmt(restante)}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {modoImputacion === 'MANUAL' && (
                                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-4">
                                            <span>
                                                Suma Imputada:{' '}
                                                <strong className="font-mono text-indigo-700">
                                                    ${fmt(totalImputadoManual)}
                                                </strong>
                                            </span>
                                            <span>
                                                Sin Imputar (A cuenta):{' '}
                                                <strong className="font-mono text-slate-700">
                                                    ${fmt(Math.max(0, totalCobranza - totalImputadoManual))}
                                                </strong>
                                            </span>
                                        </div>
                                        {totalImputadoManual > 0 &&
                                            Math.abs(totalImputadoManual - totalCobranza) > 0.01 && (
                                                <button
                                                    type="button"
                                                    onClick={handleSincronizarMontoDesdeManual}
                                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                                                >
                                                    Ajustar cobro a ${fmt(totalImputadoManual)}
                                                </button>
                                            )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Concepto y Observaciones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Concepto del Recibo (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Cancelación parcial facturas mes anterior"
                                value={concepto}
                                onChange={(e) => setConcepto(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Observaciones / Notas Internas
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Entregó comprobante por WhatsApp"
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || totalCobranza <= 0}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-all"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {submitting
                                ? 'Emitiendo Recibo...'
                                : `Confirmar y Emitir Recibo ($${fmt(totalCobranza)})`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
