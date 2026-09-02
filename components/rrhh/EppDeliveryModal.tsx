'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    Plus, 
    Trash2, 
    ShieldCheck, 
    Camera, 
    UserCheck, 
    AlertCircle, 
    CheckCircle2, 
    Send, 
    PenTool, 
    Loader2, 
    Package,
    Sparkles
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { createEppDelivery, getEppCatalog } from '@/app/rrhh/personal/epp/actions';
import EppScannerModal from './EppScannerModal';

interface EppDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeliveryCreated: () => void;
    preselectedOperatorId?: string | null;
    operadores: any[];
    eppGlobales: any[];
    matriz: Record<string, Record<string, any>>;
}

export default function EppDeliveryModal({
    isOpen,
    onClose,
    onDeliveryCreated,
    preselectedOperatorId,
    operadores,
    eppGlobales,
    matriz
}: EppDeliveryModalProps) {
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
    const [entregadoPor, setEntregadoPor] = useState<string>('');
    const [observaciones, setObservaciones] = useState<string>('');
    const [itemsToDeliver, setItemsToDeliver] = useState<Array<{
        eppItemId: string;
        cantidad: number;
        talle?: string;
    }>>([]);

    const [catalog, setCatalog] = useState<any[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);

    // Modo de firma: 'remota' (operador firma en Mis EPP) o 'presencial' (firma en canvas ahora)
    const [signatureMode, setSignatureMode] = useState<'remota' | 'presencial'>('remota');
    const [confirmedItemsPresencial, setConfirmedItemsPresencial] = useState<string[]>([]);
    
    // Canvas para firma presencial
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

    // Catálogo item selector temporal
    const [tempItemId, setTempItemId] = useState<string>('');
    const [tempCantidad, setTempCantidad] = useState<number>(1);
    const [tempTalle, setTempTalle] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setSelectedOperatorId(preselectedOperatorId || '');
            setItemsToDeliver([]);
            setObservaciones('');
            setHasDrawnSignature(false);
            setSignatureMode('remota');

            // Cargar usuario actual desde localStorage si existe
            try {
                const storedUser = localStorage.getItem('currentUser');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    setEntregadoPor(parsed.nombreCompleto || 'Supervisor');
                }
            } catch (e) {}

            // Cargar catálogo completo
            setLoadingCatalog(true);
            getEppCatalog()
                .then(res => {
                    if (res.success) setCatalog(res.data || []);
                })
                .finally(() => setLoadingCatalog(false));
        }
    }, [isOpen, preselectedOperatorId]);

    // Canvas drawing helpers
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
        setHasDrawnSignature(true);
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
        setHasDrawnSignature(false);
    };

    // Auto-sugerencia de items faltantes o vencidos
    const autoSuggestMissingItems = () => {
        if (!selectedOperatorId || !matriz[selectedOperatorId]) {
            showToast('Seleccione un operador primero', 'error');
            return;
        }

        const opMatrix = matriz[selectedOperatorId];
        const missingOrExpired: Array<{ eppItemId: string; cantidad: number; talle?: string }> = [];

        eppGlobales.forEach(epp => {
            const cell = opMatrix[epp.id];
            if (!cell || cell.estado === 'SIN_ENTREGA' || cell.estado === 'VENCIDO') {
                // Verificar que no esté ya agregado en la lista
                const alreadyAdded = itemsToDeliver.some(it => it.eppItemId === epp.id);
                if (!alreadyAdded) {
                    missingOrExpired.push({
                        eppItemId: epp.id,
                        cantidad: 1,
                        talle: epp.talle || ''
                    });
                }
            }
        });

        if (missingOrExpired.length === 0) {
            showToast('El operador no tiene EPP globales faltantes o vencidos', 'info');
            return;
        }

        setItemsToDeliver(prev => [...prev, ...missingOrExpired]);
        showToast(`Se agregaron ${missingOrExpired.length} EPP sugeridos`, 'success');
    };

    const handleAddItem = () => {
        if (!tempItemId) {
            showToast('Seleccione un elemento de EPP', 'error');
            return;
        }

        const dbItem = catalog.find(c => c.id === tempItemId);
        if (!dbItem) return;

        if (dbItem.stockActual < tempCantidad) {
            showToast(`Stock insuficiente. Disponible: ${dbItem.stockActual}`, 'error');
            return;
        }

        const existingIndex = itemsToDeliver.findIndex(it => it.eppItemId === tempItemId);
        if (existingIndex >= 0) {
            const updated = [...itemsToDeliver];
            updated[existingIndex].cantidad += tempCantidad;
            setItemsToDeliver(updated);
        } else {
            setItemsToDeliver(prev => [
                ...prev,
                {
                    eppItemId: tempItemId,
                    cantidad: tempCantidad,
                    talle: tempTalle || dbItem.talle || ''
                }
            ]);
        }

        setTempItemId('');
        setTempCantidad(1);
        setTempTalle('');
    };

    const handleRemoveItem = (index: number) => {
        setItemsToDeliver(prev => prev.filter((_, i) => i !== index));
    };

    const handleScanSuccess = (scannedText: string) => {
        // Puede ser "OPERATOR:id" o DNI directo
        let found = operadores.find(o => o.id === scannedText || o.dni === scannedText);

        if (!found) {
            // Check si contiene subcadena de DNI
            const parts = scannedText.split('@');
            if (parts.length > 4) {
                // Formato DNI argentino (apellidos@nombres@sexo@dni...)
                const scannedDni = parts[4].trim();
                found = operadores.find(o => o.dni === scannedDni);
            }
        }

        if (found) {
            setSelectedOperatorId(found.id);
            showToast(`Operador identificado: ${found.nombreCompleto}`, 'success');
        } else {
            showToast('No se encontró operador coincidente con el código escaneado', 'error');
        }
    };

    const handleSubmit = async () => {
        if (!selectedOperatorId) {
            showToast('Seleccione un operador', 'error');
            return;
        }
        if (itemsToDeliver.length === 0) {
            showToast('Agregue al menos un elemento de EPP a la entrega', 'error');
            return;
        }

        let firmaPresencialBase64: string | undefined = undefined;

        if (signatureMode === 'presencial') {
            if (!hasDrawnSignature || !canvasRef.current) {
                showToast('El operador debe estampar su firma en el recuadro para entrega presencial', 'error');
                return;
            }
            firmaPresencialBase64 = canvasRef.current.toDataURL('image/png');
        }

        setSubmitting(true);
        try {
            const res = await createEppDelivery({
                operatorId: selectedOperatorId,
                items: itemsToDeliver,
                entregadoPor,
                observaciones,
                firmaPresencialBase64
            });

            if (res.success) {
                showToast(
                    signatureMode === 'presencial' 
                        ? '¡Entrega presencial registrada y firmada con éxito!' 
                        : '¡Entrega despachada! El operario puede firmarla en "Mis EPP".', 
                    'success'
                );
                onDeliveryCreated();
                onClose();
            } else {
                showToast(res.error || 'Error al registrar entrega', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Error de red', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const selectedOp = operadores.find(o => o.id === selectedOperatorId);

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl my-8">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                                    Despacho y Entrega de EPP
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Asignación múltiple, descuento de stock y trazabilidad
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                        {/* 1. Selección de Operador */}
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                                <span>Operador Receptor *</span>
                                <button
                                    type="button"
                                    onClick={() => setScannerOpen(true)}
                                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 text-xs normal-case"
                                >
                                    <Camera className="w-3.5 h-3.5" />
                                    Escanear QR / DNI
                                </button>
                            </label>

                            <select
                                value={selectedOperatorId}
                                onChange={(e) => setSelectedOperatorId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">-- Seleccione un operador --</option>
                                {operadores.map(op => (
                                    <option key={op.id} value={op.id}>
                                        {op.nombreCompleto} (DNI: {op.dni || 'S/D'}) · {op.posicion || op.role}
                                    </option>
                                ))}
                            </select>

                            {selectedOp && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <UserCheck className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                            {selectedOp.nombreCompleto}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={autoSuggestMissingItems}
                                        className="text-xs text-emerald-700 dark:text-emerald-300 font-bold hover:underline flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700/60 shadow-xs"
                                    >
                                        <Sparkles className="w-3 h-3 text-amber-500" />
                                        Cargar faltantes y vencidos
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 2. Agregar Elementos de EPP */}
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                                Elementos a Entregar ({itemsToDeliver.length})
                            </label>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                    <div className="sm:col-span-6">
                                        <select
                                            value={tempItemId}
                                            onChange={(e) => setTempItemId(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100"
                                        >
                                            <option value="">Seleccionar EPP del catálogo...</option>
                                            {catalog.map(cat => (
                                                <option key={cat.id} value={cat.id} disabled={cat.stockActual <= 0}>
                                                    {cat.nombre} (Stock: {cat.stockActual}) {cat.esGlobal ? '· [Global]' : '· [Específico]'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="sm:col-span-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={tempCantidad}
                                            onChange={(e) => setTempCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                                            placeholder="Cant."
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-center text-slate-800 dark:text-slate-100"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <input
                                            type="text"
                                            value={tempTalle}
                                            onChange={(e) => setTempTalle(e.target.value)}
                                            placeholder="Talle (opc.)"
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Agregar
                                        </button>
                                    </div>
                                </div>

                                {/* Lista de Items Seleccionados */}
                                {itemsToDeliver.length === 0 ? (
                                    <p className="text-center py-4 text-xs text-slate-400 font-medium">
                                        No hay elementos seleccionados en esta entrega
                                    </p>
                                ) : (
                                    <div className="space-y-1.5 pt-2">
                                        {itemsToDeliver.map((item, idx) => {
                                            const catItem = catalog.find(c => c.id === item.eppItemId);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs shadow-xs"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                                            {item.cantidad}x
                                                        </span>
                                                        <div>
                                                            <span className="font-bold text-slate-800 dark:text-slate-100">
                                                                {catItem?.nombre || 'Elemento EPP'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 block">
                                                                {catItem?.categoria} {item.talle ? `· Talle: ${item.talle}` : ''} · Vigencia: {catItem?.diasValidez || 365} días
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Modalidad de Firma */}
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                                Modalidad de Conformidad y Firma
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSignatureMode('remota')}
                                    className={`p-3 rounded-2xl border text-left transition-all ${
                                        signatureMode === 'remota'
                                            ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Send className="w-4 h-4 text-indigo-600" />
                                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                                            Firma en "Mis EPP"
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                        El operario ingresa desde su usuario y firma con checksum oficial
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSignatureMode('presencial')}
                                    className={`p-3 rounded-2xl border text-left transition-all ${
                                        signatureMode === 'presencial'
                                            ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <PenTool className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                                            Firma Presencial Ahora
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                        El operario firma en la pantalla en este momento
                                    </p>
                                </button>
                            </div>

                            {/* Panel de Firma Presencial si está activo */}
                            {signatureMode === 'presencial' && (
                                <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl space-y-3 animate-in fade-in">
                                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                        El operario declara recibir los {itemsToDeliver.length} elementos en perfecto estado de conservación:
                                    </p>

                                    <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                                        <canvas
                                            ref={canvasRef}
                                            width={500}
                                            height={150}
                                            className="w-full h-[140px] cursor-crosshair touch-none"
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDrawing}
                                        />
                                        {!hasDrawnSignature && (
                                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs font-bold uppercase tracking-wider">
                                                Estampe su firma aquí
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={clearCanvas}
                                            className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors"
                                        >
                                            Limpiar firma
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Observaciones y Supervisor */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    Supervisor / Pañolero que Despacha
                                </label>
                                <input
                                    type="text"
                                    value={entregadoPor}
                                    onChange={(e) => setEntregadoPor(e.target.value)}
                                    placeholder="Nombre del supervisor"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    Observaciones del Acta (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    placeholder="Ej: Entrega anual de indumentaria"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                            * Se descontará automáticamente el stock del pañol
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Confirmar Entrega
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Escáner de Operador */}
            <EppScannerModal
                isOpen={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />
        </>
    );
}
