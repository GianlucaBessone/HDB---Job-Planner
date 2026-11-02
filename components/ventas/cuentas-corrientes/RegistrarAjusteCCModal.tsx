'use client';

import React, { useState } from 'react';
import { FilePlus2, AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownLeft, Scale } from 'lucide-react';
import { Button, Dialog, Field } from '@/components/ui';
import { cn } from '@/lib/cn';

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

type TipoAjuste = 'SALDO_INICIAL' | 'CARGO_MANUAL' | 'NOTA_CREDITO';

const TIPOS: Array<{
    id: TipoAjuste;
    label: string;
    hint: string;
    icon: React.ElementType;
    selected: string;
    iconColor: string;
}> = [
    {
        id: 'CARGO_MANUAL',
        label: 'Nota de débito',
        hint: 'Aumenta la deuda (+)',
        icon: ArrowUpRight,
        selected: 'border-warning-500 bg-warning-50 ring-2 ring-warning-500/20 dark:bg-warning-950',
        iconColor: 'text-warning-600 dark:text-warning-300',
    },
    {
        id: 'NOTA_CREDITO',
        label: 'Nota de crédito',
        hint: 'Disminuye la deuda (−)',
        icon: ArrowDownLeft,
        selected: 'border-success-500 bg-success-50 ring-2 ring-success-500/20 dark:bg-success-950',
        iconColor: 'text-success-600 dark:text-success-300',
    },
    {
        id: 'SALDO_INICIAL',
        label: 'Saldo inicial',
        hint: 'Migración de sistema previo',
        icon: Scale,
        selected: 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-950',
        iconColor: 'text-brand-600 dark:text-brand-300',
    },
];

const FORM_ID = 'registrar-ajuste-cc';

export default function RegistrarAjusteCCModal({
    cliente,
    operadorNombre,
    onClose,
    onSuccess,
}: Props) {
    const [tipo, setTipo] = useState<TipoAjuste>('CARGO_MANUAL');
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
        <Dialog
            open
            onClose={onClose}
            dismissible={!submitting}
            size="md"
            icon={
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200 flex items-center justify-center">
                    <FilePlus2 className="w-[18px] h-[18px]" />
                </div>
            }
            title="Nota de débito, crédito o saldo inicial"
            description={cliente.name}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} isLoading={submitting} icon={<CheckCircle2 />}>
                        {submitting ? 'Guardando...' : 'Registrar movimiento'}
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div role="alert" className="p-3 rounded-lg border border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950 dark:text-danger-200 flex items-start gap-2 text-[13px]">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Selector de tipo */}
                <div>
                    <span className="field-label">Tipo de comprobante</span>
                    <div role="radiogroup" aria-label="Tipo de comprobante" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {TIPOS.map((t) => {
                            const active = tipo === t.id;
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => setTipo(t.id)}
                                    className={cn(
                                        'p-3 rounded-xl border text-left transition-colors',
                                        active
                                            ? t.selected
                                            : 'border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    )}
                                >
                                    <Icon className={cn('w-4 h-4 mb-1', t.iconColor)} />
                                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">{t.label}</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-300">{t.hint}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {tipo === 'SALDO_INICIAL' && (
                    <div>
                        <span className="field-label">Sentido del saldo inicial</span>
                        <div role="radiogroup" aria-label="Sentido del saldo inicial" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {([
                                { id: 'DEBE', label: 'Saldo deudor (el cliente debe)', selected: 'border-warning-500 bg-warning-50 dark:bg-warning-950' },
                                { id: 'HABER', label: 'Saldo a favor (anticipo del cliente)', selected: 'border-success-500 bg-success-50 dark:bg-success-950' },
                            ] as const).map((s) => {
                                const active = sentidoSaldoInicial === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setSentidoSaldoInicial(s.id)}
                                        className={cn(
                                            'py-2 px-3 rounded-lg text-[13px] font-medium border text-left transition-colors text-slate-900 dark:text-slate-50',
                                            active ? s.selected : 'border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <Field label="Importe ($ ARS)" required htmlFor="ajuste-monto">
                    <input
                        id="ajuste-monto"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0,00"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        className="input h-11 text-base font-mono font-semibold tabular-nums"
                        data-autofocus
                    />
                </Field>

                <Field label="Concepto o motivo" required htmlFor="ajuste-concepto">
                    <input
                        id="ajuste-concepto"
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
                        className="input"
                    />
                </Field>

                {tipo === 'NOTA_CREDITO' && (
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-success-200 bg-success-50 dark:border-success-900 dark:bg-success-950 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={imputarFifo}
                            onChange={(e) => setImputarFifo(e.target.checked)}
                            className="mt-0.5 rounded border-input text-success-600 focus:ring-success-500"
                        />
                        <span className="text-[13px] text-success-900 dark:text-success-100">
                            Descontar automáticamente de los comprobantes pendientes más antiguos (FIFO)
                        </span>
                    </label>
                )}

                <Field label="Observaciones internas" hint="Opcional" htmlFor="ajuste-obs">
                    <textarea
                        id="ajuste-obs"
                        rows={2}
                        placeholder="Detalle interno de respaldo..."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className="input resize-none"
                    />
                </Field>
            </form>
        </Dialog>
    );
}
