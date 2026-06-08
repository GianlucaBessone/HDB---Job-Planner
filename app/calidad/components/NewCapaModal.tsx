import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';

interface NewCapaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: any;
    initialNcId?: string;
}

export default function NewCapaModal({ isOpen, onClose, onSuccess, user, initialNcId }: NewCapaModalProps) {
    useModalScroll(isOpen);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        tipoAccion: 'Mejora Continua',
        origen: initialNcId ? 'No Conformidad' : 'Hallazgo Operativo',
        prioridad: 'Media',
        descripcion: '',
        justificacion: '',
        beneficioEsperado: '',
        fechaInicio: '',
        fechaCompromiso: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/sgi/capa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    ncId: initialNcId || undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar la Acción CAPA');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-3xl rounded-xl shadow-xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold">Registrar Nueva Acción (CAPA)</h2>
                        <p className="text-sm text-muted-foreground">Cree una acción correctiva, preventiva o de mejora continua.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg flex items-start gap-2 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form id="capa-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo de Acción *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.tipoAccion}
                                    onChange={e => setFormData({...formData, tipoAccion: e.target.value})}
                                >
                                    <option value="Correctiva">Acción Correctiva</option>
                                    <option value="Preventiva">Acción Preventiva</option>
                                    <option value="Mejora Continua">Mejora Continua</option>
                                    <option value="Mitigación de Riesgo">Mitigación de Riesgo</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Origen *</label>
                                <select 
                                    required
                                    disabled={!!initialNcId}
                                    className="w-full h-10 px-3 bg-background border rounded-md disabled:opacity-50"
                                    value={formData.origen}
                                    onChange={e => setFormData({...formData, origen: e.target.value})}
                                >
                                    <option value="No Conformidad">No Conformidad</option>
                                    <option value="Riesgo">Riesgo</option>
                                    <option value="Auditoría Interna">Auditoría Interna</option>
                                    <option value="Auditoría Externa">Auditoría Externa</option>
                                    <option value="Revisión por la Dirección">Revisión por la Dirección</option>
                                    <option value="Reclamo de Cliente">Reclamo de Cliente</option>
                                    <option value="Sugerencia de Mejora">Sugerencia de Mejora</option>
                                    <option value="Hallazgo Operativo">Hallazgo Operativo</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Prioridad *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.prioridad}
                                    onChange={e => setFormData({...formData, prioridad: e.target.value})}
                                >
                                    <option value="Baja">Baja</option>
                                    <option value="Media">Media</option>
                                    <option value="Alta">Alta</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descripción de la Acción *</label>
                            <textarea 
                                required
                                rows={3}
                                placeholder="Describa el plan de acción a ejecutar..."
                                className="w-full p-3 bg-background border rounded-md resize-none"
                                value={formData.descripcion}
                                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Justificación (Opcional)</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Motivo por el cual se implementa esta acción..."
                                    className="w-full p-3 bg-background border rounded-md resize-none"
                                    value={formData.justificacion}
                                    onChange={e => setFormData({...formData, justificacion: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Beneficio Esperado (Opcional)</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Impacto positivo que generará la implementación..."
                                    className="w-full p-3 bg-background border rounded-md resize-none"
                                    value={formData.beneficioEsperado}
                                    onChange={e => setFormData({...formData, beneficioEsperado: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Fecha Inicio Proyectada</label>
                                <input 
                                    type="date"
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.fechaInicio}
                                    onChange={e => setFormData({...formData, fechaInicio: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Fecha Vencimiento (Compromiso)</label>
                                <input 
                                    type="date"
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.fechaCompromiso}
                                    onChange={e => setFormData({...formData, fechaCompromiso: e.target.value})}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/20">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md hover:bg-muted font-medium text-sm transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        form="capa-form"
                        className="btn-primary flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Crear Acción
                    </button>
                </div>
            </div>
        </div>
    );
}
