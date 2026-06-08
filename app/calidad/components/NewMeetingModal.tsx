import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';
import OperatorMultiSelect from '@/components/OperatorMultiSelect';

interface NewMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    ncId: string;
    initialData?: any;
}

export default function NewMeetingModal({ isOpen, onClose, onSuccess, ncId, initialData }: NewMeetingModalProps) {
    useModalScroll(isOpen);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [operators, setOperators] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        agenda: 'Reunión de Análisis de Desvío',
        fecha: new Date().toISOString().slice(0, 16), // datetime-local format
        participantes: [] as string[]
    });

    useEffect(() => {
        if (isOpen) {
            fetch('/api/operators')
                .then(res => res.json())
                .then(data => {
                    setOperators(data);
                    if (initialData) {
                        const initialIds = (initialData.participantes || []).map((name: string) => {
                            const op = data.find((o: any) => o.nombreCompleto === name);
                            return op ? op.id : null;
                        }).filter(Boolean);

                        setFormData({
                            agenda: initialData.agenda || '',
                            fecha: new Date(initialData.fecha).toISOString().slice(0, 16),
                            participantes: initialIds
                        });
                    } else {
                        setFormData({
                            agenda: 'Reunión de Análisis de Desvío',
                            fecha: new Date().toISOString().slice(0, 16),
                            participantes: []
                        });
                    }
                })
                .catch(err => console.error("Error fetching operators:", err));
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const url = initialData 
                ? `/api/sgi/reunion/${initialData.id}` 
                : `/api/sgi/nc/${ncId}/reunion`;

            const res = await fetch(url, {
                method: initialData ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar la reunión');
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
                        <h2 className="text-xl font-bold">{initialData ? 'Editar Reunión' : 'Programar Reunión'}</h2>
                        <p className="text-sm text-muted-foreground">{initialData ? 'Modifique los detalles de la sesión.' : 'Agende una sesión para debatir el tratamiento de la NC.'}</p>
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

                    <form id="reunion-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Agenda / Asunto *</label>
                            <input 
                                required
                                type="text"
                                className="w-full h-10 px-3 bg-background border rounded-md"
                                value={formData.agenda}
                                onChange={e => setFormData({...formData, agenda: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fecha y Hora *</label>
                            <input 
                                type="datetime-local" 
                                required
                                className="w-full h-10 px-3 bg-background border rounded-md"
                                value={formData.fecha}
                                onChange={e => setFormData({...formData, fecha: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Convocados / Participantes</label>
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
                    <button type="submit" form="reunion-form" className="btn-primary flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Reunión
                    </button>
                </div>
            </div>
        </div>
    );
}
