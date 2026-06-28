import { FormEvent, RefObject } from 'react';
import { Upload, X, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ImportMaterialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: FormEvent) => void;
    importFile: File | null;
    setImportFile: (file: File | null) => void;
    isImporting: boolean;
    fileInputRef: RefObject<HTMLInputElement>;
    onDownloadTemplate: () => void;
}

export function ImportMaterialModal({
    isOpen,
    onClose,
    onSubmit,
    importFile,
    setImportFile,
    isImporting,
    fileInputRef,
    onDownloadTemplate
}: ImportMaterialModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card text-card-foreground w-full max-w-md rounded-[2rem] shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Upload className="w-5 h-5"/> Importar Excel</h3>
                    <button onClick={onClose} aria-label="Cerrar modal" className="p-2 bg-muted text-muted-foreground text-slate-400 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <h4 className="text-xs font-black text-amber-700 uppercase mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Importante</h4>
                    <p className="text-xs text-amber-600 mb-2">Para importar, el archivo Excel <b>DEBE</b> tener exactamente las columnas: <code className="font-bold">Codigo, Material, Precio Venta, Costo</code>.</p>
                    <p className="text-xs text-amber-600">Si un Código ya existe será actualizado (sobreescribiendo cualquier precio manual anterior).</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div 
                        className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className={`w-8 h-8 mb-3 ${importFile ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{importFile ? importFile.name : 'Seleccionar archivo .xlsx'}</p>
                        <p className="text-xs font-medium text-slate-400 mt-1">Haz clic para explorar</p>
                        <input type="file" ref={fileInputRef} accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files) setImportFile(e.target.files[0])}} />
                    </div>

                    <Button 
                        type="button" 
                        variant="secondary"
                        className="w-full text-sm font-bold flex items-center justify-center gap-2"
                        onClick={onDownloadTemplate}
                    >
                        <Download className="w-4 h-4"/> Descargar Plantilla Vacía
                    </Button>

                    <Button 
                        type="submit" 
                        disabled={!importFile || isImporting} 
                        className="w-full flex items-center justify-center gap-2"
                        isLoading={isImporting}
                    >
                        Procesar Importación
                    </Button>
                </form>
            </div>
        </div>
    );
}
