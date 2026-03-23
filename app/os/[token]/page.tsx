'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { CheckCircle2, Loader2, FileText, User, Package, Clock, AlertCircle, PenLine, X } from 'lucide-react';

interface Firma {
    nombre: string;
    dni: string;
    firmaImagen: string;
    fechaFirma: string;
}

interface OrdenServicio {
    id: string;
    linkPublico: string;
    estado: string;
    reporte: string;
    fechaCreacion: string;
    project: {
        nombre: string;
        cliente?: string;
        fechaInicio?: string;
        fechaFin?: string;
        client?: { nombre: string };
        responsableUser?: { nombreCompleto: string };
    };
    materiales: { id: string; material: string; cantidad: number; unidadMedida: string }[];
    operadores: { id: string; horas: number; operador: { id: string; nombreCompleto: string } }[];
    firma?: Firma;
}

export interface SignatureRef {
    clear: () => void;
    isEmpty: () => boolean;
    getDataUrl: () => string;
}

const SignatureCanvas = forwardRef<SignatureRef, {}>((props, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
        clear: clear,
        isEmpty: () => !hasStrokes,
        getDataUrl: () => {
            return canvasRef.current?.toDataURL('image/png') || '';
        }
    }));

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        lastPos.current = pos;
        setIsDrawing(true);
        setHasStrokes(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        if (!isDrawing || !lastPos.current) return;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const pos = getPos(e);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        lastPos.current = pos;
    };

    const endDraw = () => {
        setIsDrawing(false);
        lastPos.current = null;
    };

    const clear = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasStrokes(false);
    };

    return (
        <div className="relative group">
            <div className="relative border-2 border-slate-200 rounded-2xl overflow-hidden bg-slate-50 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/20">
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={400}
                    className="w-full aspect-[3/2] touch-none cursor-crosshair block"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />
                {!hasStrokes && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-50">
                        <PenLine className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-slate-500 font-bold text-sm">Firma aquí</p>
                    </div>
                )}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 h-px bg-slate-300 pointer-events-none" />
            </div>
            {hasStrokes && (
                <button 
                    onClick={clear}
                    type="button"
                    className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm border border-slate-200 transition-all active:scale-95"
                >
                    Limpiar
                </button>
            )}
        </div>
    );
});
SignatureCanvas.displayName = 'SignatureCanvas';

export default function OSPublicPage({ params }: { params: { token: string } }) {
    const { token } = params;
    const [os, setOs] = useState<OrdenServicio | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Firma flow
    const [showFirmaModal, setShowFirmaModal] = useState(false);
    const [firmaNombre, setFirmaNombre] = useState('');
    const [firmaDni, setFirmaDni] = useState('');
    const [submittingFirma, setSubmittingFirma] = useState(false);
    const [firmaError, setFirmaError] = useState('');
    const sigRef = useRef<SignatureRef>(null);

    useEffect(() => {
        loadOS();
    }, [token]);

    const loadOS = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/ordenes-servicio/${token}`);
            if (!res.ok) {
                setError('Orden de servicio no encontrada o enlace inválido.');
                return;
            }
            const data = await res.json();
            setOs(data);
        } catch {
            setError('Error al cargar la orden de servicio.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!firmaNombre.trim() || !firmaDni.trim()) {
            setFirmaError('Debe completar su nombre y DNI.');
            return;
        }
        if (!sigRef.current || sigRef.current.isEmpty()) {
            setFirmaError('Debe dibujar su firma en el recuadro.');
            return;
        }
        
        setFirmaError('');
        const dataUrl = sigRef.current.getDataUrl();
        setSubmittingFirma(true);
        try {
            const res = await fetch(`/api/ordenes-servicio/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: firmaNombre, dni: firmaDni, firmaImagen: dataUrl }),
            });
            if (!res.ok) {
                const err = await res.json();
                setFirmaError(err.error || 'Error al guardar la firma');
                return;
            }
            setShowFirmaModal(false);
            await loadOS();
        } catch {
            setFirmaError('Error de conexión');
        } finally {
            setSubmittingFirma(false);
        }
    };

    const openFirmaModal = () => {
        setFirmaNombre('');
        setFirmaDni('');
        setFirmaError('');
        setShowFirmaModal(true);
        setTimeout(() => {
            if (sigRef.current) sigRef.current.clear();
        }, 100);
    };

    const formatDate = (d: string) => {
        try {
            return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return d; }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                    <p className="text-slate-500 font-medium">Cargando orden de servicio...</p>
                </div>
            </div>
        );
    }

    if (error || !os) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 shadow-lg border border-red-100 text-center space-y-4 max-w-sm w-full">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800">No encontrada</h2>
                    <p className="text-slate-500 text-sm">{error || 'Orden de servicio no encontrada.'}</p>
                </div>
            </div>
        );
    }

    const clienteName = os.project.client?.nombre || os.project.cliente || 'No especificado';
    const isFirmada = os.estado === 'firmada';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-600/70 uppercase tracking-widest">HDB Job Planner</p>
                        <h1 className="text-lg font-black text-slate-800 leading-tight">Orden de Servicio</h1>
                    </div>
                    <div className="ml-auto">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${isFirmada ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                            {isFirmada ? '✓ Firmada' : 'Pendiente de firma'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">

                {/* Project Info */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Proyecto</h2>
                    </div>
                    <div className="px-6 py-5 grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nombre del Proyecto</p>
                            <p className="text-lg font-black text-slate-800">{os.project.nombre}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Cliente</p>
                            <p className="text-sm font-bold text-slate-700">{clienteName}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Fecha de emisión</p>
                            <p className="text-sm font-bold text-slate-700">{formatDate(os.fechaCreacion)}</p>
                        </div>
                        {os.project.responsableUser && (
                            <div className="col-span-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Responsable</p>
                                <p className="text-sm font-bold text-slate-700">{os.project.responsableUser.nombreCompleto}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reporte */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Reporte del Trabajo</h2>
                    </div>
                    <div className="px-6 py-5">
                        <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{os.reporte}</p>
                    </div>
                </div>

                {/* Operadores */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Operadores</h2>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {os.operadores.map(op => (
                            <div key={op.id} className="px-6 py-3.5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs">
                                        {op.operador.nombreCompleto.charAt(0)}
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">{op.operador.nombreCompleto}</p>
                                </div>
                                <div className="flex items-center gap-1 text-sm font-black text-indigo-600">
                                    <Clock className="w-3.5 h-3.5" />
                                    {op.horas}h
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Materiales */}
                {os.materiales.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                            <Package className="w-4 h-4 text-amber-500" />
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Materiales Utilizados</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-50">
                                        <th className="text-left px-6 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material</th>
                                        <th className="text-right px-6 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</th>
                                        <th className="text-right px-6 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {os.materiales.map(m => (
                                        <tr key={m.id}>
                                            <td className="px-6 py-3 font-medium text-slate-700">{m.material}</td>
                                            <td className="px-6 py-3 text-right font-bold text-slate-800">{m.cantidad}</td>
                                            <td className="px-6 py-3 text-right">
                                                <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100 uppercase">{m.unidadMedida}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Firma del cliente */}
                {isFirmada && os.firma ? (
                    <div className="bg-emerald-50 rounded-3xl border border-emerald-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-emerald-100 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <h2 className="text-xs font-black text-emerald-600 uppercase tracking-widest">Firma del Cliente</h2>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Nombre</p>
                                    <p className="text-sm font-bold text-slate-700">{os.firma.nombre}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">DNI</p>
                                    <p className="text-sm font-bold text-slate-700">{os.firma.dni}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Fecha de firma</p>
                                    <p className="text-sm font-bold text-slate-700">{formatDate(os.firma.fechaFirma)}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Firma</p>
                                <div className="bg-white rounded-2xl border border-emerald-100 p-3">
                                    <img src={os.firma.firmaImagen} alt="Firma del cliente" className="max-h-32 mx-auto" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    !isFirmada && (
                        <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-6 text-center space-y-4">
                            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                                <PenLine className="w-7 h-7 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">Pendiente de firma</h3>
                                <p className="text-sm text-slate-500 font-medium mt-1">Firmá esta orden de servicio para confirmar la aceptación del trabajo realizado.</p>
                            </div>
                            <button
                                onClick={openFirmaModal}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
                            >
                                Firmar Orden de Servicio
                            </button>
                        </div>
                    )
                )}
            </div>

            {/* Firma Modal */}
            {showFirmaModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm transition-all">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom-4 duration-300 max-h-[92dvh] overflow-y-auto overscroll-contain">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-800">Firmar Orden de Servicio</h3>
                            <button onClick={() => setShowFirmaModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <p className="text-sm text-slate-500 font-medium">Por favor ingresá tus datos y firmá en el cuadro inferior.</p>
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5 focus-within:z-10 relative">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        value={firmaNombre}
                                        onChange={e => {
                                            setFirmaNombre(e.target.value);
                                            if (firmaError) setFirmaError('');
                                        }}
                                        onFocus={e => {
                                            setTimeout(() => {
                                                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }, 300);
                                        }}
                                        placeholder="Ingresá tu nombre completo"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:z-10 relative">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">DNI *</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={firmaDni}
                                        onChange={e => {
                                            setFirmaDni(e.target.value);
                                            if (firmaError) setFirmaError('');
                                        }}
                                        onFocus={e => {
                                            setTimeout(() => {
                                                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }, 300);
                                        }}
                                        placeholder="Ej: 12345678"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Dibujá tu firma *</label>
                                <SignatureCanvas ref={sigRef} />
                            </div>

                            {firmaError && (
                                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p>{firmaError}</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => setShowFirmaModal(false)}
                                    type="button"
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={submittingFirma}
                                    type="button"
                                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {submittingFirma ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        'Confirmar Firma'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
