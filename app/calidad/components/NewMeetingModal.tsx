import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card text-card-foreground w-full max-w-2xl rounded-3xl shadow-xl flex flex-col max-h-[95vh] border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 rounded-t-3xl shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{initialData ? 'Editar Reunión' : 'Programar Reunión'}</h2>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">{initialData ? 'Modifique los detalles de la sesión.' : 'Agende una sesión para debatir el tratamiento de la NC.'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex-1">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-2xl flex items-start gap-3 text-sm font-medium">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form id="reunion-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Agenda / Asunto *</label>
                            <input 
                                required
                                type="text"
                                className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none transition-colors dark:text-slate-100"
                                value={formData.agenda}
                                onChange={e => setFormData({...formData, agenda: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha y Hora *</label>
                            <input 
                                type="datetime-local" 
                                required
                                className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none transition-colors dark:text-slate-100"
                                value={formData.fecha}
                                onChange={e => setFormData({...formData, fecha: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Convocados / Participantes</label>
                            <OperatorMultiSelect 
                                operators={operators}
                                selectedIds={formData.participantes}
                                onChange={ids => setFormData({...formData, participantes: ids})}
                            />
                            <p className="text-xs font-medium text-slate-400 mt-1">Escriba el nombre para buscar y seleccione los participantes.</p>
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 rounded-b-3xl shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-slate-600 dark:text-slate-300 text-xs transition-all shadow-sm" disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" form="reunion-form" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10" disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Reunión
                    </button>
                </div>
            </div>
        </div>
    );
}
