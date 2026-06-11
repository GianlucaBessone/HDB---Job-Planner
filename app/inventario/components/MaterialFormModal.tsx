import { FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface FormData {
    codigo: string;
    nombre: string;
    precioVenta: string;
    costo: string;
}

interface MaterialFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (e: FormEvent) => void;
    currentCode: string;
    formData: FormData;
    setFormData: (data: FormData) => void;
    isSaving: boolean;
}

export function MaterialFormModal({ 
    isOpen, 
    onClose, 
    onSave, 
    currentCode, 
    formData, 
    setFormData, 
    isSaving 
}: MaterialFormModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{currentCode ? 'Editar Material' : 'Nuevo Material'}</h3>
                    <button onClick={onClose} aria-label="Cerrar modal" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full hover:text-slate-600 hover:bg-slate-200 transition-colors">
                        <X className="w-5 h-5"/>
                    </button>
                </div>
                <form onSubmit={onSave} className="space-y-4">
                    <Input 
                        label="Código"
                        required 
                        disabled={!!currentCode} 
                        type="text" 
                        value={formData.codigo} 
                        onChange={e => setFormData({...formData, codigo: e.target.value.toUpperCase()})} 
                        className="font-mono" 
                        placeholder="Ej: MAT-001"
                    />
                    <Input 
                        label="Material (Nombre)"
                        required 
                        type="text" 
                        value={formData.nombre} 
                        onChange={e => setFormData({...formData, nombre: e.target.value})} 
                        className="font-medium" 
                        placeholder="Ej: Cable unipolar 2.5mm..."
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input 
                            label="Precio Venta"
                            type="number" 
                            step="any" 
                            min="0" 
                            value={formData.precioVenta} 
                            onChange={e => setFormData({...formData, precioVenta: e.target.value})} 
                            className="font-bold text-emerald-600 focus:border-emerald-500" 
                            placeholder="Vacio = sin precio"
                        />
                        <Input 
                            label="Costo"
                            type="number" 
                            step="any" 
                            min="0" 
                            value={formData.costo} 
                            onChange={e => setFormData({...formData, costo: e.target.value})} 
                            className="font-bold text-slate-600 dark:text-slate-300" 
                            placeholder="Opcional"
                        />
                    </div>
                    <Button 
                        type="submit" 
                        className="w-full mt-4"
                        isLoading={isSaving}
                    >
                        Guardar Material
                    </Button>
                </form>
            </div>
        </div>
    );
}
