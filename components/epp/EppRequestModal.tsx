'use client';

import React, { useState } from 'react';
import { X, Package, Send, Loader2 } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { createOperatorEppRequest } from '@/app/mis-epp/actions';

interface EppRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    operatorId: string;
    catalog: any[];
    preselectedEppId?: string;
    onRequestCreated: () => void;
}

export default function EppRequestModal({
    isOpen,
    onClose,
    operatorId,
    catalog,
    preselectedEppId,
    onRequestCreated
}: EppRequestModalProps) {
    const [eppItemId, setEppItemId] = useState(preselectedEppId || '');
    const [talle, setTalle] = useState('');
    const [motivo, setMotivo] = useState('DETERIORO');
    const [comentario, setComentario] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eppItemId) {
            showToast('Seleccione el elemento de EPP que necesita', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await createOperatorEppRequest({
                operatorId,
                eppItemId,
                talle,
                motivo,
                comentario
            });

            if (res.success) {
                showToast('Solicitud enviada a Recursos Humanos / Pañol', 'success');
                onRequestCreated();
                onClose();
            } else {
                showToast(res.error || 'Error al enviar solicitud', 'error');
            }
        } catch (err: any) {
            showToast('Error de red', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                Solicitar Elemento de EPP
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Pedido de reposición o nuevo elemento
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                            Elemento Solicitado *
                        </label>
                        <select
                            required
                            value={eppItemId}
                            onChange={(e) => setEppItemId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                        >
                            <option value="">-- Seleccione elemento --</option>
                            {catalog.map(it => (
                                <option key={it.id} value={it.id}>
                                    {it.nombre} ({it.categoria})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                Motivo del Pedido *
                            </label>
                            <select
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100"
                            >
                                <option value="DETERIORO">Rotura / Desgaste</option>
                                <option value="VENCIMIENTO">Vencimiento Próximo</option>
                                <option value="EXTRAVIO">Pérdida / Extravío</option>
                                <option value="NUEVA_TAREA">Nueva Tarea / Obra</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                Talle (si aplica)
                            </label>
                            <input
                                type="text"
                                value={talle}
                                onChange={(e) => setTalle(e.target.value)}
                                placeholder="Ej: 42, L, XL"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                            Aclaración o Comentario (Opcional)
                        </label>
                        <textarea
                            rows={3}
                            value={comentario}
                            onChange={(e) => setComentario(e.target.value)}
                            placeholder="Describa el motivo o urgencia de la solicitud..."
                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 resize-none"
                        />
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar Solicitud
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
