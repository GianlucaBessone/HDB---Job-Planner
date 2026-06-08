import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';

interface NewNcModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: any;
}

export default function NewNcModal({ isOpen, onClose, onSuccess, user }: NewNcModalProps) {
    useModalScroll(isOpen);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [operators, setOperators] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        fechaDeteccion: new Date().toISOString().slice(0, 10),
        origen: 'Hallazgo operativo',
        tipoNC: 'Menor',
        categoria: '',
        descripcion: '',
        procesoAfectado: '',
        areaAfectada: '',
        criticidad: 'Media',
        impacto: '',
        responsableTratamientoId: ''
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
            const res = await fetch('/api/sgi/nc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    responsableRegistroId: user?.id
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar la No Conformidad');
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
                        <h2 className="text-xl font-bold">Registrar No Conformidad</h2>
                        <p className="text-sm text-muted-foreground">Complete los datos para generar un nuevo desvío.</p>
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

                    <form id="nc-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Fecha de Detección *</label>
                                <input 
                                    type="date" 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.fechaDeteccion}
                                    onChange={e => setFormData({...formData, fechaDeteccion: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Origen *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.origen}
                                    onChange={e => setFormData({...formData, origen: e.target.value})}
                                >
                                    <option value="Auditoría interna">Auditoría interna</option>
                                    <option value="Auditoría externa">Auditoría externa</option>
                                    <option value="Reclamo de cliente">Reclamo de cliente</option>
                                    <option value="Hallazgo operativo">Hallazgo operativo</option>
                                    <option value="Incidente">Incidente</option>
                                    <option value="Inspección">Inspección</option>
                                    <option value="Revisión por la dirección">Revisión por la dirección</option>
                                    <option value="Indicador fuera de objetivo">Indicador fuera de objetivo</option>
                                    <option value="Sugerencia de mejora">Sugerencia de mejora</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo NC *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.tipoNC}
                                    onChange={e => setFormData({...formData, tipoNC: e.target.value})}
                                >
                                    <option value="Menor">Menor</option>
                                    <option value="Mayor">Mayor</option>
                                    <option value="Observación">Observación</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Criticidad *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.criticidad}
                                    onChange={e => setFormData({...formData, criticidad: e.target.value})}
                                >
                                    <option value="Baja">Baja</option>
                                    <option value="Media">Media</option>
                                    <option value="Alta">Alta</option>
                                    <option value="Crítica">Crítica</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Categoría *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.categoria}
                                    onChange={e => setFormData({...formData, categoria: e.target.value})}
                                >
                                    <option value="" disabled>Seleccione una categoría</option>
                                    <option value="Calidad">Calidad</option>
                                    <option value="Seguridad">Seguridad</option>
                                    <option value="Medio Ambiente">Medio Ambiente</option>
                                    <option value="Operaciones">Operaciones</option>
                                    <option value="Administrativa">Administrativa</option>
                                    <option value="Recursos Humanos">Recursos Humanos</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descripción del Hallazgo *</label>
                            <textarea 
                                required
                                rows={4}
                                placeholder="Describa el desvío encontrado de manera clara y objetiva..."
                                className="w-full p-3 bg-background border rounded-md resize-none"
                                value={formData.descripcion}
                                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Proceso Afectado *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.procesoAfectado}
                                    onChange={e => setFormData({...formData, procesoAfectado: e.target.value})}
                                >
                                    <option value="" disabled>Seleccione un proceso</option>
                                    <option value="Gestión Documental">Gestión Documental</option>
                                    <option value="Control de Calidad">Control de Calidad</option>
                                    <option value="Fabricación / Montaje">Fabricación / Montaje</option>
                                    <option value="Despacho">Despacho</option>
                                    <option value="Compras">Compras</option>
                                    <option value="Capacitación">Capacitación</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Área Afectada *</label>
                                <select 
                                    required
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.areaAfectada}
                                    onChange={e => setFormData({...formData, areaAfectada: e.target.value})}
                                >
                                    <option value="" disabled>Seleccione un área</option>
                                    <option value="Operaciones / Producción">Operaciones / Producción</option>
                                    <option value="Calidad (QA/QC)">Calidad (QA/QC)</option>
                                    <option value="Mantenimiento">Mantenimiento</option>
                                    <option value="Almacén / Logística">Almacén / Logística</option>
                                    <option value="Ingeniería">Ingeniería</option>
                                    <option value="Recursos Humanos">Recursos Humanos</option>
                                    <option value="Administración / Finanzas">Administración / Finanzas</option>
                                    <option value="Comercial">Comercial</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Impacto Potencial/Real</label>
                                <input 
                                    type="text"
                                    placeholder="Ej. Retraso en entrega, riesgo de seguridad..."
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.impacto}
                                    onChange={e => setFormData({...formData, impacto: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Responsable de la NC</label>
                                <select
                                    className="w-full h-10 px-3 bg-background border rounded-md"
                                    value={formData.responsableTratamientoId}
                                    onChange={e => setFormData({...formData, responsableTratamientoId: e.target.value})}
                                >
                                    <option value="">Sin asignar (Pendiente)</option>
                                    {operators.filter(op => op.activo !== false).map(op => (
                                        <option key={op.id} value={op.id}>
                                            {op.nombreCompleto} {op.posicion ? `(${op.posicion})` : ''}
                                        </option>
                                    ))}
                                </select>
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
                        form="nc-form"
                        className="btn-primary flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Registrar NC
                    </button>
                </div>
            </div>
        </div>
    );
}
