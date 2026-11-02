'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    DollarSign, CheckCircle2, AlertCircle, Plus, Trash2,
    Layers, CreditCard, Banknote, Building2, FileText
} from 'lucide-react';
import { Badge, Button, Dialog, Field, SegmentedControl } from '@/components/ui';
import { cn } from '@/lib/cn';
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

const FORM_ID = 'registrar-cobranza-cc';

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
        <Dialog
            open
            onClose={onClose}
            dismissible={!submitting}
            size="xl"
            icon={
                <div className="w-9 h-9 rounded-xl bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300 flex items-center justify-center">
                    <DollarSign className="w-[18px] h-[18px]" />
                </div>
            }
            title="Registrar cobranza"
            description={
                <>
                    Recibo de cuenta corriente de{' '}
                    <strong className="font-semibold text-slate-900 dark:text-slate-50">{cliente.nombre}</strong>
                </>
            }
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form={FORM_ID}
                        isLoading={submitting}
                        disabled={totalCobranza <= 0}
                        icon={<CheckCircle2 />}
                    >
                        {submitting ? 'Emitiendo recibo...' : `Emitir recibo por $${fmt(totalCobranza)}`}
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div role="alert" className="p-3 rounded-lg border border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950 dark:text-danger-200 flex items-start gap-2 text-[13px]">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Resumen superior y montos rápidos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-border bg-surface-sunken flex items-center justify-between gap-2">
                        <div>
                            <div className="eyebrow">Deuda actual</div>
                            <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                                ${fmt(saldoDeudor)}
                            </div>
                        </div>
                        {saldoDeudor > 0 && (
                            <Button variant="tonal" size="sm" onClick={() => handleSetMontoRapido(saldoDeudor)}>
                                Saldar total
                            </Button>
                        )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-900 dark:bg-warning-950 flex items-center justify-between gap-2">
                        <div>
                            <div className="text-eyebrow uppercase text-warning-800 dark:text-warning-300">Deuda vencida</div>
                            <div className="text-lg font-semibold font-mono tabular-nums text-warning-900 dark:text-warning-100">
                                ${fmt(cliente.deudaVencida)}
                            </div>
                        </div>
                        {cliente.deudaVencida > 0 && (
                            <Button variant="secondary" size="sm" onClick={() => handleSetMontoRapido(cliente.deudaVencida)}>
                                Cobrar vencido
                            </Button>
                        )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-success-200 bg-success-50 dark:border-success-900 dark:bg-success-950 flex items-center justify-between gap-2">
                        <div>
                            <div className="text-eyebrow uppercase text-success-800 dark:text-success-300">Total del recibo</div>
                            <div className="text-lg font-semibold font-mono tabular-nums text-success-800 dark:text-success-200">
                                ${fmt(totalCobranza)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-success-800 dark:text-success-300">Saldo posterior</div>
                            <div className="text-[13px] font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                                ${fmt(Math.max(0, saldoRestanteEstimado))}
                            </div>
                            {saldoRestanteEstimado < -0.01 && (
                                <div className="text-xs font-medium text-success-800 dark:text-success-300">
                                    A favor: ${fmt(Math.abs(saldoRestanteEstimado))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Medios de pago */}
                <section className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                            1. Medios de pago recibidos
                        </h3>
                        <Button variant="secondary" size="sm" onClick={handleAddPago} icon={<Plus />}>
                            Agregar medio
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {pagos.map((pago, index) => (
                            <div
                                key={pago.id}
                                className="grid grid-cols-12 gap-2.5 items-end p-2.5 rounded-lg border border-border bg-surface-sunken"
                            >
                                <div className="col-span-12 sm:col-span-4">
                                    <label htmlFor={`pago-metodo-${pago.id}`} className="field-label">
                                        Medio #{index + 1}
                                    </label>
                                    <select
                                        id={`pago-metodo-${pago.id}`}
                                        value={pago.metodo}
                                        onChange={(e) => handleChangePago(pago.id, 'metodo', e.target.value)}
                                        className="input pr-8"
                                    >
                                        {MEDIOS_PAGO.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-span-6 sm:col-span-3">
                                    <label htmlFor={`pago-monto-${pago.id}`} className="field-label">
                                        Importe ($)
                                    </label>
                                    <input
                                        id={`pago-monto-${pago.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0,00"
                                        value={pago.monto}
                                        onChange={(e) => handleChangePago(pago.id, 'monto', e.target.value)}
                                        className="input font-mono font-semibold tabular-nums text-right"
                                    />
                                </div>

                                <div className="col-span-6 sm:col-span-4">
                                    <label htmlFor={`pago-ref-${pago.id}`} className="field-label">
                                        N° comprobante / cheque
                                    </label>
                                    <input
                                        id={`pago-ref-${pago.id}`}
                                        type="text"
                                        placeholder="Ej: Transf #84920"
                                        value={pago.referencia}
                                        onChange={(e) => handleChangePago(pago.id, 'referencia', e.target.value)}
                                        className="input"
                                    />
                                </div>

                                <div className="col-span-12 sm:col-span-1 flex justify-end">
                                    <Button
                                        variant="danger-ghost"
                                        size="icon"
                                        disabled={pagos.length <= 1}
                                        onClick={() => handleRemovePago(pago.id)}
                                        aria-label="Quitar medio de pago"
                                        title="Quitar medio de pago"
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Imputación de comprobantes */}
                <section className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                                2. Imputación a comprobantes pendientes ({comprobantesPendientes.length})
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                Cancelá automáticamente desde la deuda más antigua (FIFO) o elegí cada comprobante.
                            </p>
                        </div>

                        <SegmentedControl
                            label="Modo de imputación"
                            value={modoImputacion}
                            onChange={(v) => setModoImputacion(v as 'FIFO' | 'MANUAL')}
                            options={[
                                { value: 'FIFO', label: 'Automático (FIFO)' },
                                { value: 'MANUAL', label: 'Manual' },
                            ]}
                        />
                    </div>

                    {comprobantesPendientes.length === 0 ? (
                        <div className="p-5 text-center rounded-lg border border-dashed border-border bg-surface-sunken text-[13px] text-slate-600 dark:text-slate-300">
                            El cliente no tiene comprobantes con saldo pendiente. El pago quedará como saldo a favor en su cuenta corriente.
                        </div>
                    ) : (
                        <div className="border border-border rounded-lg overflow-hidden">
                            <div className="max-h-60 overflow-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-surface-sunken border-b border-border sticky top-0 z-10">
                                        <tr className="text-left text-slate-600 dark:text-slate-300">
                                            {modoImputacion === 'MANUAL' && (
                                                <th className="py-2 px-3 text-center w-10 font-medium">
                                                    <span className="sr-only">Seleccionar</span>
                                                </th>
                                            )}
                                            <th className="py-2 px-3 font-medium">Comprobante</th>
                                            <th className="py-2 px-3 font-medium">Emisión / Vto.</th>
                                            <th className="py-2 px-3 font-medium text-right">Total orig.</th>
                                            <th className="py-2 px-3 font-medium text-right">Saldo pend.</th>
                                            <th className="py-2 px-3 font-medium text-right w-36">A imputar</th>
                                            <th className="py-2 px-3 font-medium text-right">Restante</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
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
                                                    className={imputado > 0 ? 'bg-success-50/60 dark:bg-success-950/40' : undefined}
                                                >
                                                    {modoImputacion === 'MANUAL' && (
                                                        <td className="py-2 px-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={imputado > 0}
                                                                onChange={() => handleToggleComprobanteManual(comp)}
                                                                aria-label={`Imputar ${comp.numero}`}
                                                                className="rounded border-input text-brand-600 focus:ring-brand-500"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="py-2 px-3">
                                                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-50">
                                                            {comp.numero}
                                                        </div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                                                            {comp.concepto}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 whitespace-nowrap">
                                                        <div className="text-slate-700 dark:text-slate-200">{fmtDate(comp.fecha)}</div>
                                                        <div className="text-xs">
                                                            {comp.vencido ? (
                                                                <span className="text-danger-700 dark:text-danger-300 font-medium">
                                                                    Vencido ({comp.diasVencido}d)
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-600 dark:text-slate-400">
                                                                    Vto: {fmtDate(comp.fechaVencimiento)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                                        ${fmt(comp.montoOriginalCC)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                                                        ${fmt(comp.saldoPendiente)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right">
                                                        {modoImputacion === 'FIFO' ? (
                                                            <span
                                                                className={cn(
                                                                    'font-mono tabular-nums font-semibold',
                                                                    imputado > 0
                                                                        ? 'text-success-700 dark:text-success-300'
                                                                        : 'text-slate-500 dark:text-slate-400'
                                                                )}
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
                                                                placeholder="0,00"
                                                                aria-label={`Monto a imputar a ${comp.numero}`}
                                                                onChange={(e) =>
                                                                    setImputacionesManuales((prev) => ({
                                                                        ...prev,
                                                                        [comp.id]: e.target.value,
                                                                    }))
                                                                }
                                                                className="input h-8 w-28 ml-auto px-2 text-right text-xs font-mono font-semibold tabular-nums"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                                        {quedaSaldado ? (
                                                            <Badge tone="success">
                                                                <CheckCircle2 /> Saldado
                                                            </Badge>
                                                        ) : imputado > 0 ? (
                                                            <span className="text-warning-700 dark:text-warning-300 font-semibold">
                                                                Parcial (${fmt(restante)})
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-600 dark:text-slate-400">${fmt(restante)}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {modoImputacion === 'MANUAL' && (
                                <div className="px-4 py-2.5 bg-surface-sunken border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span>
                                            Imputado:{' '}
                                            <strong className="font-mono tabular-nums text-brand-700 dark:text-brand-300">
                                                ${fmt(totalImputadoManual)}
                                            </strong>
                                        </span>
                                        <span>
                                            Sin imputar (a cuenta):{' '}
                                            <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-50">
                                                ${fmt(Math.max(0, totalCobranza - totalImputadoManual))}
                                            </strong>
                                        </span>
                                    </div>
                                    {totalImputadoManual > 0 &&
                                        Math.abs(totalImputadoManual - totalCobranza) > 0.01 && (
                                            <Button variant="ghost" size="sm" onClick={handleSincronizarMontoDesdeManual}>
                                                Ajustar cobro a ${fmt(totalImputadoManual)}
                                            </Button>
                                        )}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* Concepto y observaciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Concepto del recibo" hint="Opcional" htmlFor="cobranza-concepto">
                        <input
                            id="cobranza-concepto"
                            type="text"
                            placeholder="Ej: Cancelación parcial facturas mes anterior"
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            className="input"
                        />
                    </Field>
                    <Field label="Observaciones internas" hint="Opcional" htmlFor="cobranza-obs">
                        <input
                            id="cobranza-obs"
                            type="text"
                            placeholder="Ej: Entregó comprobante por WhatsApp"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            className="input"
                        />
                    </Field>
                </div>
            </form>
        </Dialog>
    );
}
