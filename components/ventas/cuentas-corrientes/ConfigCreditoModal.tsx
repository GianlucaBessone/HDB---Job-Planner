'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, Settings2, AlertCircle } from 'lucide-react';

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

export default function ConfigCreditoModal({
    cliente,
    configActual,
    operadorNombre,
    onClose,
    onSuccess,
}: Props) {
    const [limiteCredito, setLimiteCredito] = useState(String(configActual.limiteCredito || 0));
    const [plazoDias, setPlazoDias] = useState(String(configActual.plazoDias || 30));
    const [estadoCredito, setEstadoCredito] = useState<'ACTIVO' | 'OBSERVADO' | 'SUSPENDIDO'>(
        (configActual.estadoCredito as any) || 'ACTIVO'
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

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                            <Settings2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm">Política Crediticia del Cliente</h3>
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

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Estado Crediticio en PDV
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['ACTIVO', 'OBSERVADO', 'SUSPENDIDO'] as const).map((est) => (
                                <button
                                    key={est}
                                    type="button"
                                    onClick={() => setEstadoCredito(est)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                        estadoCredito === est
                                            ? est === 'ACTIVO'
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                                                : est === 'OBSERVADO'
                                                ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                                                : 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/20'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {est}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {estadoCredito === 'SUSPENDIDO'
                                ? '⚠️ Bloquea nuevas ventas fiadas en Cuenta Corriente desde el PDV.'
                                : estadoCredito === 'OBSERVADO'
                                ? 'Muestra alerta preventiva pero permite operar dentro del límite.'
                                : 'Habilitado para operar normalmente en Cuenta Corriente.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Límite de Crédito ($ ARS)
                            </label>
                            <input
                                type="number"
                                step="100"
                                min="0"
                                value={limiteCredito}
                                onChange={(e) => setLimiteCredito(e.target.value)}
                                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] text-slate-400">0 = Sin tope fijo</span>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Plazo de Vencimiento (Días)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="365"
                                value={plazoDias}
                                onChange={(e) => setPlazoDias(e.target.value)}
                                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] text-slate-400">Ej: 15, 30, 60 días</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Acuerdos / Condiciones Comerciales
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Ej: Autorizado a retirar por obra Ing. Gómez. Facturación quincenal."
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
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {submitting ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
