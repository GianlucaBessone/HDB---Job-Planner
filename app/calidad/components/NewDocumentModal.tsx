'use client';

import { useState, useEffect, useRef } from 'react';
import { X, FileText, Loader2, FileSignature, Check } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';

export default function NewDocumentModal({ onClose, onSuccess, user }: { onClose: () => void, onSuccess: (newDocId: string) => void, user: any }) {
    const [loading, setLoading] = useState(false);
    const [operators, setOperators] = useState<any[]>([]);
    const [tagsList, setTagsList] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        codigoDocumental: '',
        titulo: '',
        descripcion: '',
        tipoDocumento: 'Procedimiento',
        area: 'Operaciones',
        nivelCriticidad: 'medio',
        requiereConfirmacionLectura: true,
        requiereCapacitacion: false,
        revisadorId: '',
        aprobadorId: '',
        tags: [] as string[]
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const getCoordinates = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: any) => {
        const coords = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const coords = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    useEffect(() => {
        Promise.all([
            safeApiRequest('/api/operators').then(res => res.json()),
            safeApiRequest('/api/config/tags').then(res => res.json())
        ]).then(([opsData, tagsData]) => {
            if (Array.isArray(opsData)) setOperators(opsData);
            if (Array.isArray(tagsData)) setTagsList(tagsData);
        }).catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const signatureData = canvas.toDataURL('image/png');
        
        // Basic check for empty signature
        const isBlank = !isDrawing && canvas.toDataURL() === document.createElement('canvas').toDataURL();
        if (isBlank) {
            alert('Debe firmar el documento para crearlo (Firma Digital del Creador)');
            return;
        }

        setLoading(true);
        try {
            const revisador = operators.find(o => o.id === formData.revisadorId);
            const aprobador = operators.find(o => o.id === formData.aprobadorId);

            const res = await safeApiRequest('/api/documentos', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    autorId: user?.id,
                    autorNombre: user?.nombreCompleto || user?.nombre,
                    userId: user?.id,
                    userName: user?.nombreCompleto || user?.nombre,
                    revisadorNombre: revisador?.nombreCompleto || revisador?.nombre,
                    aprobadorNombre: aprobador?.nombreCompleto || aprobador?.nombre,
                    creatorSignature: signatureData
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

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción Larga</label>
                        <textarea
                            placeholder="Descripción detallada del propósito del documento..."
                            value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-indigo-500 outline-none h-20 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Revisado Por</label>
                            <select
                                value={formData.revisadorId} onChange={e => setFormData({ ...formData, revisadorId: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="">(Sin asignar)</option>
                                {operators.map(op => (
                                    <option key={op.id} value={op.id}>{op.nombreCompleto || op.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Aprobado Por</label>
                            <select
                                value={formData.aprobadorId} onChange={e => setFormData({ ...formData, aprobadorId: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option value="">(Sin asignar)</option>
                                {operators.map(op => (
                                    <option key={op.id} value={op.id}>{op.nombreCompleto || op.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Área / Sector</label>
                            <select
                                value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                            >
                                <option>Operaciones</option>
                                <option>Ventas</option>
                                <option>Administración</option>
                                <option>Gerencia</option>
                                <option>Calidad</option>
                                <option>Seguridad e Higiene</option>
                                <option>Mantenimiento</option>
                            </select>
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

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Etiquetas (Tipo de Actividad)</label>
                        <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[44px]">
                            {tagsList.map(tag => (
                                <label key={tag.id} className={`cursor-pointer px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${formData.tags.includes(tag.name) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.tags.includes(tag.name)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, tags: [...formData.tags, tag.name] });
                                            } else {
                                                setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag.name) });
                                            }
                                        }}
                                    />
                                    {tag.name}
                                </label>
                            ))}
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

                    {/* Firma digital del creador */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                            <FileSignature className="w-3.5 h-3.5 text-indigo-500" /> Firma Digital del Creador <span className="text-red-500">*</span>
                        </label>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                            <canvas
                                ref={canvasRef}
                                width={416}
                                height={150}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full bg-white dark:bg-slate-950 cursor-crosshair touch-none h-[150px]"
                            />
                            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                                <span className="text-[10px] font-bold text-slate-400">Dibuje su firma arriba con el mouse o dedo</span>
                                <button
                                    type="button"
                                    onClick={clearCanvas}
                                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
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
