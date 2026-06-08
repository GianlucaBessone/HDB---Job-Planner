import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';
import OperatorMultiSelect from '@/components/OperatorMultiSelect';

interface NewRootCauseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    ncId: string;
}

export default function NewRootCauseModal({ isOpen, onClose, onSuccess, ncId }: NewRootCauseModalProps) {
    useModalScroll(isOpen);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [operators, setOperators] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        metodologia: '5 Porqués',
        descripcion: '',
        participantes: [] as string[],
        fechaAnalisis: new Date().toISOString().slice(0, 10)
    });

    useEffect(() => {
        if (isOpen) {
            fetch('/api/operators')
                .then(res => res.json())
                .then(data => setOperators(data))
                .catch(err => console.error("Error fetching operators:", err));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/sgi/nc/${ncId}/causa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar el análisis');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-2xl rounded-xl shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold">Registrar Análisis Causa Raíz</h2>
                        <p className="text-sm text-muted-foreground">Indique los detalles de la investigación del desvío.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg flex items-start gap-2 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form id="causa-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Metodología *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.metodologia}
                                    onChange={e => setFormData({...formData, metodologia: e.target.value})}
                                >
                                    <option value="5 Porqués">Los 5 Porqués</option>
                                    <option value="Ishikawa">Diagrama de Ishikawa</option>
                                    <option value="Lluvia de Ideas">Lluvia de Ideas</option>
                                    <option value="Árbol de Fallas">Árbol de Fallas</option>
                                    <option value="Otra">Otra</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Fecha de Análisis *</label>
                                <input 
                                    type="date" 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.fechaAnalisis}
                                    onChange={e => setFormData({...formData, fechaAnalisis: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descripción del Análisis / Conclusión *</label>
                            <textarea 
                                required
                                rows={6}
                                placeholder="Desarrolle el análisis detallando la causa raíz identificada..."
                                className="w-full p-3 bg-background border rounded-md resize-none"
                                value={formData.descripcion}
                                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Participantes</label>
                            <OperatorMultiSelect 
                                operators={operators}
                                selectedIds={formData.participantes}
                                onChange={ids => setFormData({...formData, participantes: ids})}
                            />
                            <p className="text-xs text-muted-foreground">Escriba el nombre para buscar y seleccione los participantes.</p>
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/20">
                    <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md hover:bg-muted text-sm transition-colors" disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" form="causa-form" className="btn-primary flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Análisis
                    </button>
                </div>
            </div>
        </div>
    );
}
