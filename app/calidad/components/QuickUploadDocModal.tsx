'use client';

import { useState, useRef, useEffect } from 'react';
import {
    X,
    UploadCloud,
    FileText,
    FileSpreadsheet,
    FileImage,
    Check,
    Loader2,
    FolderTree,
    Tag,
    UserCheck,
    ShieldCheck
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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

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
    const [tipoDocumento, setTipoDocumento] = useState('PG');
    const [area, setArea] = useState('GLB');
    const [observaciones, setObservaciones] = useState('');

    const [operators, setOperators] = useState<any[]>([]);
    const [revisadorId, setRevisadorId] = useState('');
    const [aprobadorId, setAprobadorId] = useState('');

    const [previewCode, setPreviewCode] = useState<string>('Calculando...');
    const [previewError, setPreviewError] = useState<string>('');

    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load operators and pre-select Hernan Bassignana
    useEffect(() => {
        safeApiRequest('/api/operators')
            .then(res => res.json())
            .then((ops: any[]) => {
                if (Array.isArray(ops)) {
                    setOperators(ops);
                    const hernan = ops.find(op => 
                        (op.nombreCompleto || '').toLowerCase().includes('bassignana') ||
                        (op.nombre || '').toLowerCase().includes('bassignana')
                    );
                    if (hernan) {
                        setAprobadorId(hernan.id);
                    }
                }
            })
            .catch(err => console.error('Error al cargar operadores:', err));
    }, []);

    // Calculate document code identically to NewDocumentModal
    useEffect(() => {
        if (tipoDocumento && area) {
            setPreviewCode('Calculando...');
            setPreviewError('');
            safeApiRequest(`/api/documentos/next-code?tipo=${tipoDocumento}&area=${area}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        setPreviewError(data.error);
                        setPreviewCode('');
                    } else if (data.nextCode) {
                        setPreviewCode(data.nextCode);
                    }
                })
                .catch(() => {
                    setPreviewError('Error al calcular identificador');
                    setPreviewCode('');
                });
        }
    }, [tipoDocumento, area]);

    const handleFileSelect = (file: File) => {
        if (!file) return;

        // Auto-detect title from file name
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setTitulo(cleanName);

        // Auto-detect type suggestion matching exact allowed types (MQ, PG, FR, IT)
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') setTipoDocumento('PG');
        else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') setTipoDocumento('FR');
        else if (ext === 'docx' || ext === 'doc') setTipoDocumento('IT');

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
        if (!revisadorId) {
            showToast('Debes seleccionar quién es el revisor del documento', 'error');
            return;
        }

        const revOp = operators.find(op => op.id === revisadorId);
        const apOp = operators.find(op => op.id === aprobadorId);

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
                    codigoDocumental: previewCode || undefined,
                    revisadorId: revisadorId || null,
                    revisadorNombre: revOp?.nombreCompleto || revOp?.nombre || null,
                    aprobadorId: aprobadorId || null,
                    aprobadorNombre: apOp?.nombreCompleto || apOp?.nombre || 'Hernán Bassignana',
                    observaciones: observaciones.trim() || undefined,
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
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-16 sm:pt-20 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Subir Archivo Propio a la Biblioteca"
        >
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
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Drag & Drop Zone */}
                    <div
                        onDragOver={e => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
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
                            <div className="space-y-2 py-1">
                                <div className="w-10 h-10 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                    <UploadCloud className="w-5 h-5" />
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

                    {/* Identificador & Tipo de Documento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Código Documental
                            </label>
                            <div className="w-full bg-secondary text-secondary-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] flex items-center justify-between">
                                {previewCode ? (
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                                        {previewCode}
                                    </span>
                                ) : (
                                    <span className="text-xs font-bold text-red-500">{previewError}</span>
                                )}
                                {previewCode === 'Calculando...' && (
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Tipo de Documento
                            </label>
                            <select
                                value={tipoDocumento}
                                onChange={e => setTipoDocumento(e.target.value)}
                                className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="MQ">MQ - Manual de Calidad</option>
                                <option value="PG">PG - Procedimientos Generales</option>
                                <option value="FR">FR - Formularios y Registros (Evidencia)</option>
                                <option value="IT">IT - Instructivos Técnicos</option>
                            </select>
                        </div>
                    </div>

                    {/* Área / Sector & Sub-Acceso SGI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Área / Sector
                            </label>
                            <select
                                value={area}
                                onChange={e => setArea(e.target.value)}
                                className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="GLB">GLB - Globales</option>
                                <option value="MNG">MNG - Gerencia</option>
                                <option value="OPR">OPR - Operaciones</option>
                                <option value="ADM">ADM - Administración</option>
                                <option value="QAC">QAC - Aseguramiento y Control de Calidad</option>
                                <option value="HRM">HRM - Gestión de Recursos Humanos</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                                <FolderTree className="w-3.5 h-3.5 text-primary" />
                                <span>Sub-Acceso / Proceso SGI</span>
                            </label>
                            <select
                                value={subAccessId}
                                onChange={e => setSubAccessId(e.target.value)}
                                className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="">(Sin asignar a sub-acceso)</option>
                                {modules.map(mod => (
                                    <optgroup key={mod.id} label={`Módulo ${mod.codigo}: ${mod.nombre}`}>
                                        {mod.subAccesses?.map(sub => (
                                            <option key={sub.id} value={sub.id}>
                                                {sub.codigo} - {sub.nombre}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Document Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-primary" />
                            <span>Título del Documento *</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Nombre oficial o descriptivo del documento..."
                            value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                            className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                            required
                        />
                    </div>

                    {/* Revisor & Aprobador Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-primary" />
                                <span>Revisado Por (Supervisor/QA) <span className="text-rose-500">*</span></span>
                            </label>
                            <select
                                required
                                value={revisadorId}
                                onChange={e => setRevisadorId(e.target.value)}
                                className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="">(Seleccionar revisor...)</option>
                                {operators
                                    .filter(op => ['supervisor', 'admin', 'qa'].includes((op.role || '').toLowerCase()))
                                    .map(op => (
                                        <option key={op.id} value={op.id}>
                                            {op.nombreCompleto || op.nombre}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                <span>Aprobado Por (QA/Gerente) <span className="text-rose-500">*</span></span>
                            </label>
                            <select
                                required
                                value={aprobadorId}
                                onChange={e => setAprobadorId(e.target.value)}
                                className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                {operators
                                    .filter(op => (op.nombreCompleto || '').toLowerCase().includes('bassignana') || ['supervisor', 'admin', 'qa'].includes((op.role || '').toLowerCase()))
                                    .map(op => (
                                        <option key={op.id} value={op.id}>
                                            {op.nombreCompleto || op.nombre}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Observaciones */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Observaciones o Notas (Opcional)
                        </label>
                        <input
                            type="text"
                            placeholder="Notas sobre el documento, alcance o procedencia"
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-xs font-medium outline-none focus:border-indigo-500"
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
                            disabled={loading || !fileData || !previewCode || previewCode === 'Calculando...'}
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
