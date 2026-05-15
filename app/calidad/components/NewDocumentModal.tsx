'use client';

import { useState } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';

export default function NewDocumentModal({ onClose, onSuccess, user }: { onClose: () => void, onSuccess: (newDocId: string) => void, user: any }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        codigoDocumental: '',
        titulo: '',
        tipoDocumento: 'Procedimiento',
        area: '',
        nivelCriticidad: 'medio',
        requiereConfirmacionLectura: true,
        requiereCapacitacion: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await safeApiRequest('/api/documentos', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    autorId: user?.id,
                    autorNombre: user?.nombreCompleto || user?.nombre,
                    userId: user?.id,
                    userName: user?.nombreCompleto || user?.nombre,
                })
            });
            if (res.ok) {
                const data = await res.json();
                onSuccess(data.id);
            } else {
                const err = await res.json();
                alert(err.error || 'Error al crear documento');
            }
        } catch (e) {
            console.error(e);
            alert('Error de red');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nuevo Documento</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Código</label>
                            <input
                                required type="text" placeholder="Ej. PR-001"
                                value={formData.codigoDocumental} onChange={e => setFormData({ ...formData, codigoDocumental: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                            <select
                                value={formData.tipoDocumento} onChange={e => setFormData({ ...formData, tipoDocumento: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option>Procedimiento</option>
                                <option>Instructivo</option>
                                <option>Manual técnico</option>
                                <option>Formulario</option>
                                <option>Política</option>
                                <option>Norma de seguridad</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                        <input
                            required type="text" placeholder="Título descriptivo..."
                            value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Área / Sector</label>
                            <input
                                required type="text" placeholder="Ej. Operaciones"
                                value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Criticidad</label>
                            <select
                                value={formData.nivelCriticidad} onChange={e => setFormData({ ...formData, nivelCriticidad: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="bajo">Bajo</option>
                                <option value="medio">Medio</option>
                                <option value="alto">Alto</option>
                                <option value="critico">Crítico</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={formData.requiereConfirmacionLectura}
                                    onChange={e => setFormData({ ...formData, requiereConfirmacionLectura: e.target.checked })}
                                    className="peer sr-only"
                                />
                                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Requiere Confirmación de Lectura (OS)</span>
                        </label>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button disabled={loading} type="submit" className="px-6 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Crear e ir al detalle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
