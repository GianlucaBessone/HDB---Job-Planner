'use client';

import React, { useState } from 'react';
import { CheckCircle2, Settings2, AlertCircle } from 'lucide-react';
import { Button, Dialog, Field } from '@/components/ui';
import { cn } from '@/lib/cn';

interface Props {
    cliente: {
        id: string;
        name: string;
    };
    configActual: {
        limiteCredito: number;
        plazoDias: number;
        estadoCredito: string;
        observaciones: string | null;
    };
    operadorNombre?: string;
    onClose: () => void;
    onSuccess: () => void;
}

type EstadoCredito = 'ACTIVO' | 'OBSERVADO' | 'SUSPENDIDO';

const ESTADOS: Array<{ id: EstadoCredito; label: string; selected: string; hint: string }> = [
    {
        id: 'ACTIVO',
        label: 'Activo',
        selected: 'border-success-500 bg-success-50 text-success-800 ring-2 ring-success-500/20 dark:bg-success-950 dark:text-success-200',
        hint: 'Habilitado para operar normalmente en cuenta corriente.',
    },
    {
        id: 'OBSERVADO',
        label: 'Observado',
        selected: 'border-warning-500 bg-warning-50 text-warning-800 ring-2 ring-warning-500/20 dark:bg-warning-950 dark:text-warning-200',
        hint: 'Muestra una alerta preventiva pero permite operar dentro del límite.',
    },
    {
        id: 'SUSPENDIDO',
        label: 'Suspendido',
        selected: 'border-danger-500 bg-danger-50 text-danger-800 ring-2 ring-danger-500/20 dark:bg-danger-950 dark:text-danger-200',
        hint: 'Bloquea nuevas ventas en cuenta corriente desde el PDV.',
    },
];

const FORM_ID = 'config-credito-cc';

export default function ConfigCreditoModal({
    cliente,
    configActual,
    operadorNombre,
    onClose,
    onSuccess,
}: Props) {
    const [limiteCredito, setLimiteCredito] = useState(String(configActual.limiteCredito || 0));
    const [plazoDias, setPlazoDias] = useState(String(configActual.plazoDias || 30));
    const [estadoCredito, setEstadoCredito] = useState<EstadoCredito>(
        (configActual.estadoCredito as EstadoCredito) || 'ACTIVO'
    );
    const [observaciones, setObservaciones] = useState(configActual.observaciones || '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch(`/api/ventas/cuentas-corrientes/${cliente.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    limiteCredito: Math.max(0, parseFloat(limiteCredito) || 0),
                    plazoDias: Math.max(0, parseInt(plazoDias, 10) || 0),
                    estadoCredito,
                    observaciones: observaciones.trim() || null,
                    operadorNombre,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Error al actualizar política crediticia');
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al guardar configuración');
        } finally {
            setSubmitting(false);
        }
    };

    const estadoActual = ESTADOS.find((e) => e.id === estadoCredito);

    return (
        <Dialog
            open
            onClose={onClose}
            dismissible={!submitting}
            size="md"
            icon={
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200 flex items-center justify-center">
                    <Settings2 className="w-[18px] h-[18px]" />
                </div>
            }
            title="Política crediticia"
            description={cliente.name}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} isLoading={submitting} icon={<CheckCircle2 />}>
                        {submitting ? 'Guardando...' : 'Guardar configuración'}
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

                <div>
                    <span className="field-label">Estado crediticio en PDV</span>
                    <div role="radiogroup" aria-label="Estado crediticio" className="grid grid-cols-3 gap-2">
                        {ESTADOS.map((est) => (
                            <button
                                key={est.id}
                                type="button"
                                role="radio"
                                aria-checked={estadoCredito === est.id}
                                onClick={() => setEstadoCredito(est.id)}
                                className={cn(
                                    'h-9 px-3 rounded-lg text-[13px] font-medium border transition-colors',
                                    estadoCredito === est.id
                                        ? est.selected
                                        : 'border-border bg-card text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50'
                                )}
                            >
                                {est.label}
                            </button>
                        ))}
                    </div>
                    <p className="field-hint">{estadoActual?.hint}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Límite de crédito ($ ARS)" hint="0 = sin tope" htmlFor="cc-limite">
                        <input
                            id="cc-limite"
                            type="number"
                            step="100"
                            min="0"
                            value={limiteCredito}
                            onChange={(e) => setLimiteCredito(e.target.value)}
                            className="input font-mono tabular-nums"
                        />
                    </Field>
                    <Field label="Plazo de vencimiento (días)" hint="Ej: 15, 30, 60" htmlFor="cc-plazo">
                        <input
                            id="cc-plazo"
                            type="number"
                            min="0"
                            max="365"
                            value={plazoDias}
                            onChange={(e) => setPlazoDias(e.target.value)}
                            className="input font-mono tabular-nums"
                        />
                    </Field>
                </div>

                <Field label="Acuerdos y condiciones comerciales" htmlFor="cc-obs">
                    <textarea
                        id="cc-obs"
                        rows={3}
                        placeholder="Ej: Autorizado a retirar por obra Ing. Gómez. Facturación quincenal."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className="input resize-none"
                    />
                </Field>
            </form>
        </Dialog>
    );
}
