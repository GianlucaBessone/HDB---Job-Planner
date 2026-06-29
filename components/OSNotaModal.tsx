'use client';

import { useState } from 'react';
import { Loader2, StickyNote, X } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface OSNotaModalProps {
    os: any;
    onClose: () => void;
    onSaveSuccess: (updated: any) => void;
}

export default function OSNotaModal({ os, onClose, onSaveSuccess }: OSNotaModalProps) {
    const [note, setNote] = useState<string>(os.notaInterna || '');
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/ordenes-servicio/${os.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notaInterna: note || null })
            });
            if (res.ok) {
                const updated = await res.json();
                onSaveSuccess(updated);
                showToast('Nota interna guardada', 'success');
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al guardar la nota', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card text-card-foreground w-full max-w-lg rounded-t-3xl md:rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <StickyNote className="w-5 h-5 text-amber-500" />
                        Nota Interna (Privada)
                    </h3>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        OS: {os.codigoOS || os.id.slice(-8).toUpperCase()} | {os.project.nombre}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Esta nota es estrictamente de uso interno para la empresa. No se plasmará en ningún PDF, factura, ni link público que vea el cliente.
                    </p>
                </div>

                <textarea
                    rows={6}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Escribe comentarios u observaciones sobre este servicio..."
                    className="w-full text-sm bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-200 transition-all font-medium resize-none placeholder:text-slate-400"
                />

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Guardar Nota
                    </button>
                </div>
            </div>
        </div>
    );
}
