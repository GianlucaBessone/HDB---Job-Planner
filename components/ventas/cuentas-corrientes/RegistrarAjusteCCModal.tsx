'use client';

import React, { useState } from 'react';
import { X, FilePlus2, AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownLeft, Scale } from 'lucide-react';

interface Props {
    cliente: {
        id: string;
        name: string;
        saldoDeudor: number;
    };
    operadorNombre?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RegistrarAjusteCCModal({
    cliente,
    operadorNombre,
    onClose,
    onSuccess,
}: Props) {
    const [tipo, setTipo] = useState<'SALDO_INICIAL' | 'CARGO_MANUAL' | 'NOTA_CREDITO'>('CARGO_MANUAL');
    const [sentidoSaldoInicial, setSentidoSaldoInicial] = useState<'DEBE' | 'HABER'>('DEBE');
    const [monto, setMonto] = useState('');
    const [concepto, setConcepto] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [imputarFifo, setImputarFifo] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const montoNum = Math.round((parseFloat(monto) || 0) * 100) / 100;
        if (montoNum <= 0) {
            setError('Ingrese un monto válido mayor a $0,00.');
            return;
        }
        if (!concepto.trim()) {
            setError('El concepto o motivo del movimiento es obligatorio.');
            return;
        }

        setSubmitting(true);
        try {
            const idempotencyKey = `mov-${cliente.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const res = await fetch('/api/ventas/cuentas-corrientes/movimientos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': idempotencyKey,
                },
                body: JSON.stringify({
                    clienteId: cliente.id,
                    tipo,
                    sentidoSaldoInicial: tipo === 'SALDO_INICIAL' ? sentidoSaldoInicial : undefined,
                    monto: montoNum,
                    concepto: concepto.trim(),
                    observaciones: observaciones.trim() || undefined,
                    imputarFifo: tipo === 'NOTA_CREDITO' ? imputarFifo : false,
                    operadorNombre,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Error al registrar movimiento');
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al registrar el movimiento');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                            <FilePlus2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Registrar Nota Débito / Crédito / Saldo Inicial</h3>
                            <p className="text-xs text-slate-400">{cliente.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Selector de Tipo */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Tipo de Ajuste / Comprobante</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setTipo('CARGO_MANUAL')}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    tipo === 'CARGO_MANUAL'
                                        ? 'border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <ArrowUpRight className="w-4 h-4 text-amber-600 mb-1" />
                                <div className="text-xs font-bold">Nota de Débito</div>
                                <div className="text-[11px] opacity-75">Aumenta deuda (+)</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setTipo('NOTA_CREDITO')}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    tipo === 'NOTA_CREDITO'
                                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <ArrowDownLeft className="w-4 h-4 text-emerald-600 mb-1" />
                                <div className="text-xs font-bold">Nota de Crédito</div>
                                <div className="text-[11px] opacity-75">Disminuye deuda (-)</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setTipo('SALDO_INICIAL')}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    tipo === 'SALDO_INICIAL'
                                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <Scale className="w-4 h-4 text-indigo-600 mb-1" />
                                <div className="text-xs font-bold">Saldo Inicial</div>
                                <div className="text-[11px] opacity-75">Migración previa</div>
                            </button>
                        </div>
                    </div>

                    {tipo === 'SALDO_INICIAL' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Sentido del Saldo Inicial</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSentidoSaldoInicial('DEBE')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                                        sentidoSaldoInicial === 'DEBE'
                                            ? 'bg-amber-50 border-amber-400 text-amber-800'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    Saldo Deudor (El cliente debe)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSentidoSaldoInicial('HABER')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                                        sentidoSaldoInicial === 'HABER'
                                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    Saldo a Favor (Anticipo del cliente)
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Importe ($ ARS)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            placeholder="0.00"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-base font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Concepto / Motivo *</label>
                        <input
                            type="text"
                            required
                            placeholder={
                                tipo === 'CARGO_MANUAL'
                                    ? 'Ej: Recargo por flete / Diferencia de cotización'
                                    : tipo === 'NOTA_CREDITO'
                                    ? 'Ej: Bonificación comercial / Devolución de mercadería'
                                    : 'Ej: Saldo arrastrado de sistema anterior al 01/10'
                            }
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {tipo === 'NOTA_CREDITO' && (
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={imputarFifo}
                                onChange={(e) => setImputarFifo(e.target.checked)}
                                className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-medium text-emerald-900">
                                Descontar automáticamente de los comprobantes pendientes más antiguos (FIFO)
                            </span>
                        </label>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones adicionales (Opcional)</label>
                        <textarea
                            rows={2}
                            placeholder="Detalle interno de respaldo..."
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {submitting ? 'Guardando...' : 'Registrar Movimiento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
