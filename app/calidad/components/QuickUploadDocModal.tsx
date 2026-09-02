'use client';

import { useState, useRef } from 'react';
import {
    X,
    UploadCloud,
    FileText,
    FileSpreadsheet,
    FileImage,
    Check,
    Loader2,
    AlertCircle,
    FolderTree,
    Tag,
    Shield
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { useModalScroll } from '@/lib/useModalScroll';

interface ModuleItem {
    id: string;
    codigo: string;
    nombre: string;
    subAccesses: {
        id: string;
        codigo: string;
        nombre: string;
    }[];
}

interface QuickUploadDocModalProps {
    modules: ModuleItem[];
    initialSubAccessId?: string | null;
    user: any;
    onClose: () => void;
    onSuccess: (newDocId: string) => void;
}

export default function QuickUploadDocModal({
    modules,
    initialSubAccessId = null,
    user,
    onClose,
    onSuccess
}: QuickUploadDocModalProps) {
    useModalScroll(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial sub-access selection
    const firstSubAccessId = modules[0]?.subAccesses[0]?.id || '';
    const [subAccessId, setSubAccessId] = useState<string>(initialSubAccessId || firstSubAccessId);

    const [fileData, setFileData] = useState<{
        name: string;
        size: number;
        type: string;
        content: string; // Base64
    } | null>(null);

    const [titulo, setTitulo] = useState('');
    const [tipoDocumento, setTipoDocumento] = useState('DOC');
    const [area, setArea] = useState('GLB');
    const [nivelCriticidad, setNivelCriticidad] = useState('media');
    const [observaciones, setObservaciones] = useState('');
    const [codigoPersonalizado, setCodigoPersonalizado] = useState('');

    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleFileSelect = (file: File) => {
        if (!file) return;

        // Auto-detect title from file name
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setTitulo(cleanName);

        // Auto-detect type suggestion
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') setTipoDocumento('PG');
        else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') setTipoDocumento('FC');
        else if (ext === 'docx' || ext === 'doc') setTipoDocumento('IN');

        const reader = new FileReader();
        reader.onload = () => {
            setFileData({
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                content: reader.result as string
            });
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileData) {
            showToast('Por favor selecciona o arrastra un archivo', 'error');
            return;
        }
        if (!titulo.trim()) {
            showToast('El título del documento es obligatorio', 'error');
            return;
        }

        setLoading(true);
        try {
            const res = await safeApiRequest('/api/documentos/quick-upload', {
                method: 'POST',
                body: JSON.stringify({
                    fileName: fileData.name,
                    fileType: fileData.type,
                    fileSize: fileData.size,
                    fileContent: fileData.content,
                    subAccessId: subAccessId || null,
                    titulo: titulo.trim(),
                    tipoDocumento,
                    area,
                    nivelCriticidad,
                    observaciones: observaciones.trim() || undefined,
                    codigoDocumental: codigoPersonalizado.trim() || undefined,
                    userId: user?.id,
                    userName: user?.nombreCompleto || user?.nombre
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`Archivo "${fileData.name}" subido exitosamente`, 'success');
                onSuccess(data.document.id);
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al subir el archivo', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red al procesar la subida', 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (mimeOrName: string) => {
        const lower = mimeOrName.toLowerCase();
        if (lower.includes('excel') || lower.includes('spreadsheet') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
            return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
        }
        if (lower.includes('image') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
            return <FileImage className="w-8 h-8 text-blue-500" />;
        }
        return <FileText className="w-8 h-8 text-indigo-500" />;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-16 sm:pt-20 overflow-y-auto">
            <div className="relative bg-card text-card-foreground rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden my-4 animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-muted/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                            <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                Subir Archivo Propio a la Biblioteca
                            </h2>
                            <p className="text-xs text-slate-400 font-bold">
                                Asigna directamente tu archivo (PDF, Word, Excel, Planilla) al proceso correspondiente
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Drag & Drop Zone */}
                    <div
                        onDragOver={e => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                            isDragging
                                ? 'border-primary bg-primary/5 scale-[0.99]'
                                : fileData
                                ? 'border-emerald-400/60 bg-emerald-500/5'
                                : 'border-slate-300 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                    handleFileSelect(e.target.files[0]);
                                }
                            }}
                        />

                        {fileData ? (
                            <div className="flex items-center justify-between gap-4 p-2">
                                <div className="flex items-center gap-3 text-left">
                                    {getFileIcon(fileData.name)}
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-sm">
                                            {fileData.name}
                                        </p>
                                        <p className="text-xs font-semibold text-slate-400">
                                            {formatBytes(fileData.size)}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 px-3 py-1 rounded-xl">
                                    Archivo cargado
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-2 py-2">
                                <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                    <UploadCloud className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                        Haz clic o arrastra tu archivo aquí
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Soporta PDF, DOCX, XLSX, XLS, PPTX, JPG, PNG, etc.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sub-Access Selector */}
                    <div>
                        <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <FolderTree className="w-3.5 h-3.5 text-primary" />
                            <span>Sub-Acceso / Proceso de Destino *</span>
                        </label>
                        <select
                            value={subAccessId}
                            onChange={e => setSubAccessId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            required
                        >
                            {modules.map(mod => (
                                <optgroup key={mod.id} label={`Módulo ${mod.codigo}: ${mod.nombre}`}>
                                    {mod.subAccesses.map(sub => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.codigo} - {sub.nombre}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Document Title */}
                    <div>
                        <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-primary" />
                            <span>Título del Documento *</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Nombre oficial o descriptivo del documento"
                            value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            required
                        />
                    </div>

                    {/* Type, Area & Criticidad Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                Tipo
                            </label>
                            <select
                                value={tipoDocumento}
                                onChange={e => setTipoDocumento(e.target.value)}
                                className="w-full px-3 py-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            >
                                <option value="PG">Procedimiento General (PG)</option>
                                <option value="IN">Instructivo Técnico (IN)</option>
                                <option value="FC">Formulario / Registro (FC)</option>
                                <option value="MQ">Manual de Calidad (MQ)</option>
                                <option value="POL">Política (POL)</option>
                                <option value="FR">Formulario Rápido (FR)</option>
                                <option value="DOC">Documento / Archivo (DOC)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                Área
                            </label>
                            <select
                                value={area}
                                onChange={e => setArea(e.target.value)}
                                className="w-full px-3 py-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            >
                                <option value="GLB">GLB (Global / General)</option>
                                <option value="CAL">CAL (Calidad)</option>
                                <option value="TEC">TEC (Técnica / Operaciones)</option>
                                <option value="COM">COM (Comercial)</option>
                                <option value="SST">SST (Seguridad y Salud)</option>
                                <option value="LOG">LOG (Logística / Compras)</option>
                                <option value="ADM">ADM (Administración)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Shield className="w-3 h-3 text-primary" />
                                <span>Criticidad</span>
                            </label>
                            <select
                                value={nivelCriticidad}
                                onChange={e => setNivelCriticidad(e.target.value)}
                                className="w-full px-3 py-2 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-primary"
                            >
                                <option value="baja">Baja</option>
                                <option value="media">Media</option>
                                <option value="alta">Alta</option>
                                <option value="critica">Crítica</option>
                            </select>
                        </div>
                    </div>

                    {/* Observaciones */}
                    <div>
                        <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Observaciones o Notas (Opcional)
                        </label>
                        <input
                            type="text"
                            placeholder="Notas sobre el documento, alcance o procedencia"
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-primary"
                        />
                    </div>

                    {/* Footer buttons */}
                    <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !fileData}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Subiendo archivo...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Guardar y Publicar en Biblioteca</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
