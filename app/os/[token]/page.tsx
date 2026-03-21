'use client';

import { useState, useEffect, useRef } from 'react';
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

function SignatureCanvas({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

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
        e.preventDefault();
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
        e.preventDefault();
        if (!isDrawing || !lastPos.current) return;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const pos = getPos(e);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1e293b';
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

    const save = () => {
        if (!hasStrokes) return;
        const canvas = canvasRef.current!;
        onSave(canvas.toDataURL('image/png'));
    };

    return (
        <div className="space-y-3">
            <div className="relative border-2 border-slate-200 rounded-2xl overflow-hidden bg-white shadow-inner">
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full touch-none cursor-crosshair block"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />
                {!hasStrokes && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-slate-300 font-medium text-sm flex items-center gap-2">
                            <PenLine className="w-4 h-4" />
                            Firma aquí
                        </p>
                    </div>
                )}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-px bg-slate-200" />
            </div>
            <div className="flex gap-2">
                <button onClick={clear} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95">
                    Limpiar
                </button>
                <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95">
                    Cancelar
                </button>
                <button
                    onClick={save}
                    disabled={!hasStrokes}
                    className="flex-[2] py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200"
                >
                    Confirmar Firma
                </button>
            </div>
        </div>
    );
}

export default function OSPublicPage({ params }: { params: { token: string } }) {
    const { token } = params;
    const [os, setOs] = useState<OrdenServicio | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Firma flow
    const [showFirmaModal, setShowFirmaModal] = useState(false);
    const [firmaStep, setFirmaStep] = useState<'datos' | 'canvas' | 'done'>('datos');
    const [firmaNombre, setFirmaNombre] = useState('');
    const [firmaDni, setFirmaDni] = useState('');
    const [firmaImagen, setFirmaImagen] = useState('');
    const [submittingFirma, setSubmittingFirma] = useState(false);
    const [firmaError, setFirmaError] = useState('');

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

    const handleSubmitFirma = async () => {
        if (!firmaImagen) return;
        setFirmaError('');
        setSubmittingFirma(true);
        try {
            const res = await fetch(`/api/ordenes-servicio/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: firmaNombre, dni: firmaDni, firmaImagen }),
            });
            if (!res.ok) {
                const err = await res.json();
                setFirmaError(err.error || 'Error al registrar la firma');
                return;
            }
            setFirmaStep('done');
            setShowFirmaModal(false);
            await loadOS();
        } catch {
            setFirmaError('Error de conexión');
        } finally {
            setSubmittingFirma(false);
        }
    };

    const openFirmaModal = () => {
        setFirmaStep('datos');
        setFirmaNombre('');
        setFirmaDni('');
        setFirmaImagen('');
        setFirmaError('');
        setShowFirmaModal(true);
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
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300 max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-800">Firmar Orden de Servicio</h3>
                            <button onClick={() => setShowFirmaModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {firmaStep === 'datos' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500 font-medium">Por favor ingresá tus datos antes de firmar.</p>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo *</label>
                                        <input
                                            type="text"
                                            value={firmaNombre}
                                            onChange={e => setFirmaNombre(e.target.value)}
                                            placeholder="Ingresá tu nombre completo"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DNI *</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={firmaDni}
                                            onChange={e => setFirmaDni(e.target.value)}
                                            placeholder="Ej: 12345678"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                                {firmaError && (
                                    <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" />{firmaError}
                                    </p>
                                )}
                                <button
                                    onClick={() => {
                                        if (!firmaNombre.trim() || !firmaDni.trim()) {
                                            setFirmaError('Nombre y DNI son obligatorios');
                                            return;
                                        }
                                        setFirmaError('');
                                        setFirmaStep('canvas');
                                    }}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
                                >
                                    Continuar a Firma
                                </button>
                            </div>
                        )}

                        {firmaStep === 'canvas' && (
                            <div className="space-y-4">
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                                    <p className="text-xs font-bold text-slate-500">Firmante: <span className="text-slate-700">{firmaNombre}</span></p>
                                    <p className="text-xs font-bold text-slate-500">DNI: <span className="text-slate-700">{firmaDni}</span></p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dibujá tu firma abajo</p>
                                    <SignatureCanvas
                                        onSave={async (dataUrl) => {
                                            setFirmaImagen(dataUrl);
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
                                                    setFirmaStep('datos');
                                                    return;
                                                }
                                                setShowFirmaModal(false);
                                                await loadOS();
                                            } catch {
                                                setFirmaError('Error de conexión');
                                                setFirmaStep('datos');
                                            } finally {
                                                setSubmittingFirma(false);
                                            }
                                        }}
                                        onCancel={() => setFirmaStep('datos')}
                                    />
                                </div>
                                {submittingFirma && (
                                    <div className="flex items-center justify-center gap-2 text-blue-600">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm font-medium">Guardando firma...</span>
                                    </div>
                                )}
                                {firmaError && (
                                    <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" />{firmaError}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
