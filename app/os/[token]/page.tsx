'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { CheckCircle2, Loader2, FileText, User, Package, Clock, AlertCircle, PenLine, X, Star, MessageSquare, ThumbsUp, Smile, Download } from 'lucide-react';
import CodeBadge from '@/components/CodeBadge';
import { formatDate, formatDateTime, formatTime } from '@/lib/formatDate';
import { useTheme } from 'next-themes';

interface Firma {
    nombre: string;
    dni: string;
    firmaImagen: string;
    fechaFirma: string;
}

interface OrdenServicio {
    id: string;
    codigoOS?: string;
    linkPublico: string;
    estado: string;
    reporte: string;
    comentario?: string;
    fechaCreacion: string;
    project: {
        nombre: string;
        codigoProyecto?: string;
        cliente?: string;
        fechaInicio?: string;
        fechaFin?: string;
        client?: { nombre: string };
        responsableUser?: { nombreCompleto: string };
    };
    materiales: { id: string; material: string; cantidad: number; unidadMedida: string }[];
    operadores: { id: string; horas: number; isExtra?: boolean; operador: { id: string; nombreCompleto: string } }[];
    firma?: Firma;
}

export interface SignatureRef {
    clear: () => void;
    isEmpty: () => boolean;
    getDataUrl: () => string;
}

// ─── Signature Canvas (Fullscreen-optimized, dark-mode aware) ──────────────────
const SignatureCanvas = forwardRef<SignatureRef, { fullscreen?: boolean }>((props, ref) => {
    const { fullscreen = false } = props;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    // Dynamic canvas sizing
    useEffect(() => {
        const resizeCanvas = () => {
            const container = containerRef.current;
            const canvas = canvasRef.current;
            if (!container || !canvas) return;
            
            // If user has drawn, resizing will wipe the canvas buffer. Avoid this.
            if (canvas.getAttribute('data-has-strokes') === 'true') return;

            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
            }
        };

        resizeCanvas();
        // Resize again after the modal open transition settles
        const timeout = setTimeout(resizeCanvas, 350);
        window.addEventListener('resize', resizeCanvas);
        
        return () => {
            clearTimeout(timeout);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, []);

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
        
        // Compute correct scale using internal resolution vs CSS resolution
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
        
        canvas.setAttribute('data-has-strokes', 'true');
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
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        // Always draw with dark slate ink. The canvas has `dark:invert` so it renders 
        // as white in dark mode visually, but saves as dark ink for the PDFs.
        ctx.lineWidth = 3 * dpr;
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
        // clearRect needs to wipe the entire internal buffer correctly
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.setAttribute('data-has-strokes', 'false');
        setHasStrokes(false);
    };

    return (
        <div className="relative group flex-1 flex flex-col">
            <div
                ref={containerRef}
                className={`relative border-2 border-slate-200 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-800 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/20 ${
                    fullscreen ? 'rounded-2xl flex-1' : 'rounded-2xl aspect-[3/2]'
                }`}
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-full touch-none cursor-crosshair block absolute inset-0 dark:invert transition-all"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />
                {!hasStrokes && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                        <PenLine className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-2" />
                        <p className="text-slate-400 dark:text-slate-500 font-bold text-base">Firmá aquí</p>
                        <p className="text-slate-300 dark:text-slate-600 font-medium text-xs mt-1">Dibujá con el dedo o el mouse</p>
                    </div>
                )}
                {/* Baseline guide */}
                <div className={`absolute left-[10%] right-[10%] h-px bg-slate-200 dark:bg-slate-600 pointer-events-none ${fullscreen ? 'bottom-[20%]' : 'bottom-[22%]'}`} />
            </div>
            {hasStrokes && (
                <button
                    onClick={clear}
                    type="button"
                    className="absolute top-3 right-3 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm text-slate-500 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-600 transition-all active:scale-95 z-10"
                >
                    Limpiar
                </button>
            )}
        </div>
    );
});
SignatureCanvas.displayName = 'SignatureCanvas';

// ─── Rating Button ─────────────────────────────────────────────────────────────
function RatingButton({ value, selected, onClick, min, max }: { value: number; selected: boolean; onClick: () => void; min: number; max: number }) {
    const normalized = (value - min) / (max - min);
    let bg = '';
    let textColor = '';
    if (selected) {
        if (normalized <= 0.3) { bg = 'bg-rose-500'; textColor = 'text-white'; }
        else if (normalized <= 0.6) { bg = 'bg-amber-400'; textColor = 'text-white'; }
        else { bg = 'bg-emerald-500'; textColor = 'text-white'; }
    }
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                w-full h-11 rounded-xl text-sm font-black transition-all duration-150 active:scale-90 border
                ${selected
                    ? `${bg} ${textColor} border-transparent shadow-md scale-105`
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }
            `}
        >
            {value}
        </button>
    );
}

// ─── Scale Selector ────────────────────────────────────────────────────────────
function ScaleSelector({
    value,
    onChange,
    min,
    max,
    labelLeft,
    labelRight,
}: {
    value: number | null;
    onChange: (v: number) => void;
    min: number;
    max: number;
    labelLeft: string;
    labelRight: string;
}) {
    const values = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    const total = values.length;
    // For 10 items: 2 rows of 5. For other counts: single row grid.
    const cols = total === 10 ? 5 : total;
    return (
        <div className="space-y-2">
            {/* p-1 gives breathing room so scale-105 + shadow never gets clipped */}
            <div
                className="p-1"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px' }}
            >
                {values.map(v => (
                    <RatingButton
                        key={v}
                        value={v}
                        selected={value === v}
                        onClick={() => onChange(v)}
                        min={min}
                        max={max}
                    />
                ))}
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1">
                <span>{labelLeft}</span>
                <span>{labelRight}</span>
            </div>
        </div>
    );
}

// ─── Survey Step Component ────────────────────────────────────────────────────
type SurveyData = {
    atencion: number | null;
    calidad: number | null;
    tiempo: number | null;
    nps: number | null;
    comentario: string;
};

function SurveyView({
    osId,
    onDone,
    onSkip,
}: {
    osId: string;
    onDone: () => void;
    onSkip: () => void;
}) {
    const [data, setData] = useState<SurveyData>({
        atencion: null, calidad: null, tiempo: null, nps: null, comentario: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const handleSubmit = async () => {
        if (data.atencion === null || data.calidad === null || data.tiempo === null || data.nps === null) {
            setError('Por favor respondé todas las preguntas antes de enviar.');
            return;
        }
        setError('');
        setSubmitting(true);
        try {
            const res = await fetch('/api/encuesta-servicio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ordenServicioId: osId,
                    atencion: data.atencion,
                    calidad: data.calidad,
                    tiempo: data.tiempo,
                    nps: data.nps,
                    comentario: data.comentario,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                setError(err.error || 'Error al enviar la encuesta');
                return;
            }
            setDone(true);
        } catch {
            setError('Error de conexión. Por favor intentá de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div className="text-center space-y-5 py-6">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">¡Gracias por tu respuesta! 🙌</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Tu opinión nos ayuda a mejorar cada día.</p>
                </div>
                <button
                    onClick={onDone}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
                >
                    Volver a la Orden de Servicio
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-1">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Star className="w-7 h-7 text-blue-500" fill="currentColor" />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Encuesta de Satisfacción</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Menos de 30 segundos · Tu opinión importa</p>
            </div>

            {/* Q1 — Atención */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-600 text-[10px] font-black rounded-lg px-2 py-1 uppercase tracking-widest shrink-0">1 de 4</span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">¿Cómo calificás la atención recibida por el técnico?</p>
                </div>
                <ScaleSelector
                    value={data.atencion}
                    onChange={v => setData(d => ({ ...d, atencion: v }))}
                    min={1} max={10}
                    labelLeft="Muy mala"
                    labelRight="Excelente"
                />
            </div>

            {/* Q2 — Calidad */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                    <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black rounded-lg px-2 py-1 uppercase tracking-widest shrink-0">2 de 4</span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">¿Cómo calificás el resultado final del trabajo?</p>
                </div>
                <ScaleSelector
                    value={data.calidad}
                    onChange={v => setData(d => ({ ...d, calidad: v }))}
                    min={1} max={10}
                    labelLeft="Muy malo"
                    labelRight="Excelente"
                />
            </div>

            {/* Q3 — Tiempo */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                    <span className="bg-amber-100 text-amber-600 text-[10px] font-black rounded-lg px-2 py-1 uppercase tracking-widest shrink-0">3 de 4</span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">¿Cómo evaluás el tiempo en que se realizó el servicio?</p>
                </div>
                <ScaleSelector
                    value={data.tiempo}
                    onChange={v => setData(d => ({ ...d, tiempo: v }))}
                    min={1} max={10}
                    labelLeft="Muy lento"
                    labelRight="Adecuado"
                />
            </div>

            {/* Q4 — NPS */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                    <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black rounded-lg px-2 py-1 uppercase tracking-widest shrink-0">4 de 4</span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">¿Qué tan probable es que recomiendes nuestra empresa?</p>
                </div>
                <ScaleSelector
                    value={data.nps}
                    onChange={v => setData(d => ({ ...d, nps: v }))}
                    min={0} max={10}
                    labelLeft="Nada probable"
                    labelRight="Totalmente probable"
                />
            </div>

            {/* Q5 — Comentario opcional */}
            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comentarios adicionales <span className="normal-case font-medium text-slate-300">(opcional)</span>
                </label>
                <textarea
                    value={data.comentario}
                    onChange={e => setData(d => ({ ...d, comentario: e.target.value }))}
                    placeholder="Contanos tu experiencia..."
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all resize-none"
                />
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    onClick={onSkip}
                    type="button"
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    type="button"
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Enviando...
                        </>
                    ) : (
                        <>
                            <ThumbsUp className="w-4 h-4" />
                            Enviar encuesta
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── Post-signature Modal ──────────────────────────────────────────────────────
function PostFirmaModal({
    osId,
    onClose,
}: {
    osId: string;
    onClose: () => void;
}) {
    const [showSurvey, setShowSurvey] = useState(false);

    if (showSurvey) {
        return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl shadow-2xl p-6 sm:p-8 space-y-0 animate-in slide-in-from-bottom-4 duration-300 max-h-[95dvh] overflow-y-auto overscroll-contain">
                    <SurveyView
                        osId={osId}
                        onDone={onClose}
                        onSkip={onClose}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-7 animate-in zoom-in-95 duration-300 space-y-5">
                {/* Icon */}
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-200">
                    <Smile className="w-9 h-9 text-white" />
                </div>

                {/* Text */}
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                        ¡Gracias por confirmar la Orden de Servicio! 🙌
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Tu opinión es muy importante para nosotros.<br />
                        ¿Te gustaría responder una breve encuesta sobre el servicio?
                    </p>
                </div>

                {/* Actions */}
                <div className="space-y-2.5 pt-1">
                    <button
                        onClick={() => setShowSurvey(true)}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <Star className="w-5 h-5" fill="currentColor" />
                        Responder encuesta
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all"
                    >
                        Ahora no
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OSPublicPage({ params }: { params: { token: string } }) {
    const { token } = params;
    const [os, setOs] = useState<OrdenServicio | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Theme for canvas stroke
    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isDark = currentTheme === 'dark';

    // Firma flow
    const [showFirmaModal, setShowFirmaModal] = useState(false);
    const [firmaStep, setFirmaStep] = useState(1);
    const [firmaNombre, setFirmaNombre] = useState('');
    const [firmaDni, setFirmaDni] = useState('');
    const [submittingFirma, setSubmittingFirma] = useState(false);
    const [firmaError, setFirmaError] = useState('');
    const sigRef = useRef<SignatureRef>(null);

    // Post-firma survey modal — only shown once per session
    const [showPostFirmaModal, setShowPostFirmaModal] = useState(false);
    const alreadyShownRef = useRef(false);

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

    const handleNextStep = () => {
        if (!firmaNombre.trim() || !firmaDni.trim()) {
            setFirmaError('Debe completar su nombre y DNI.');
            return;
        }
        setFirmaError('');
        setFirmaStep(2);
        // Ensure canvas clears after state update gives it a size
        setTimeout(() => {
            if (sigRef.current) sigRef.current.clear();
        }, 150);
    };

    const handleConfirm = async () => {
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

            // Show post-firma modal (only once per session)
            if (!alreadyShownRef.current) {
                alreadyShownRef.current = true;
                // Check if survey already answered
                const surveyRes = await fetch(`/api/encuesta-servicio/${token}`);
                const surveyData = await surveyRes.json();
                if (!surveyData) {
                    setShowPostFirmaModal(true);
                }
            }
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
        setFirmaStep(1);
        setShowFirmaModal(true);
    };

    const handleDownload = () => {
        if (!os) return;
        // Use the same server-side PDF API as the internal OS view — works on all devices including mobile
        window.location.href = `/api/ordenes-servicio/${token}/pdf`;
    };

    const handlePrint = () => {
        if (!os) return;
        const printStyles = `
            <style>
                @page { margin: 0; size: A4 portrait; }
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20mm; color: #1e293b; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                * { box-sizing: border-box; }
                .header { border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
                .logo { max-height: 80px; object-fit: contain; }
                .badge { padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
                .badge.firmada { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
                .badge.pendiente { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
                h2 { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 4px; }
                h3 { font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
                .section { margin-bottom: 22px; page-break-inside: avoid; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .field label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px; }
                .field p { font-size: 13px; font-weight: 700; color: #1e293b; margin: 0; }
                .reporte-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #f8fafc; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
                tr { page-break-inside: avoid; }
                td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 600; }
                .firma-box { border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; background: #f0fdf4; page-break-inside: avoid; }
                .firma-box img { max-width: 200px; max-height: 80px; border: 1px solid #d1fae5; border-radius: 6px; padding: 4px; background: white; }
                .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
            </style>
        `;

        const clienteName = os.project.client?.nombre || os.project.cliente || 'No especificado';
        const isFirmada = os.estado === 'firmada';
        const firmaImageUrl = os.firma?.firmaImagen || null;

        const content = `
            <div class="header">
                <div>
                    <img class="logo" src="${window.location.origin}/logo-hdb.jpg" alt="HDB Servicios Electricos" />
                    <h2 style="margin-top:10px;">Orden de Servicio — ${os.codigoOS || 'OS #' + os.id.slice(-8).toUpperCase()}</h2>
                    <p style="font-size:12px;color:#64748b;margin:4px 0 0;">${os.project.codigoProyecto ? os.project.codigoProyecto + ' | ' : ''}${os.project.nombre}</p>
                </div>
                <div>
                    <div class="badge ${isFirmada ? 'firmada' : 'pendiente'}">${isFirmada ? '✓ Firmada' : 'Pendiente de firma'}</div>
                    <p style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:right;">Emitida: ${formatDate(os.fechaCreacion)}</p>
                </div>
            </div>

            <div class="section">
                <h3>Datos del Proyecto</h3>
                <div class="grid-2">
                    <div class="field" style="grid-column: 1 / -1"><label>Cliente</label><p>${clienteName}</p></div>
                </div>
            </div>

            <div class="section">
                <h3>Reporte del Trabajo</h3>
                <div class="reporte-box">${os.reporte}</div>
            </div>

            <div class="section">
                <h3>Operadores</h3>
                <table>
                    <thead><tr><th>Nombre</th><th>Horas</th></tr></thead>
                    <tbody>
                        ${os.operadores.map((op: any) => `<tr><td>${op.operador.nombreCompleto}</td><td>${op.horas}h</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>

            ${os.materiales.length > 0 ? `
            <div class="section">
                <h3>Materiales Utilizados</h3>
                <table>
                    <thead><tr><th>Material</th><th>Cantidad</th><th>Unidad</th></tr></thead>
                    <tbody>
                        ${os.materiales.map((m: any) => `<tr><td>${m.material}</td><td>${m.cantidad}</td><td>${m.unidadMedida}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>` : ''}

            ${os.comentario ? `
            <div class="section">
                <h3>Comentario Adicional</h3>
                <div class="reporte-box" style="border-color: #e2e8f0; background: #fdfdfd;">${os.comentario}</div>
            </div>` : ''}

            ${isFirmada && os.firma ? `
            <div class="section">
                <h3>Firma del Cliente</h3>
                <div class="firma-box">
                    <div class="grid-2" style="margin-bottom:10px;">
                        <div class="field"><label>Nombre</label><p>${os.firma.nombre}</p></div>
                        <div class="field"><label>DNI</label><p>${os.firma.dni}</p></div>
                        <div class="field"><label>Fecha de firma</label><p>${formatDateTime(os.firma.fechaFirma)}</p></div>
                    </div>
                    ${firmaImageUrl ? `<img src="${firmaImageUrl}" alt="Firma" />` : '<p style="font-size:10px;color:gray;">Firma no cargada</p>'}
                </div>
            </div>` : ''}

            <div class="footer">
                <span>HDB Job Planner — Gestión de Órdenes de Servicio</span>
                <span>${os.codigoOS || 'OS #' + os.id.slice(-8).toUpperCase()} — ${os.project.codigoProyecto || ''} — ${formatDate(os.fechaCreacion)}</span>
            </div>
        `;

        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OS - ${os.project.nombre}</title>${printStyles}</head><body>${content}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Cargando orden de servicio...</p>
                </div>
            </div>
        );
    }

    if (error || !os) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-lg border border-red-100 text-center space-y-4 max-w-sm w-full">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">No encontrada</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{error || 'Orden de servicio no encontrada.'}</p>
                </div>
            </div>
        );
    }

    const clienteName = os.project.client?.nombre || os.project.cliente || 'No especificado';
    const isFirmada = os.estado === 'firmada';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800/50">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-[10px] font-black text-blue-600/70 uppercase tracking-widest">HDB Job Planner</p>
                            {os.codigoOS && <CodeBadge code={os.codigoOS} variant="os" size="sm" showCopy={false} />}
                        </div>
                        <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">Orden de Servicio</h1>
                    </div>
                    <div className="ml-auto shrink-0 flex items-center gap-2">
                        <span className={`whitespace-nowrap px-2 py-1.5 md:px-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider ${isFirmada ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                            {isFirmada ? '✓ Firmada' : 'Pendiente'}
                        </span>
                        <button
                            onClick={handlePrint}
                            className="bg-slate-100 p-1.5 md:p-2 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center shadow-sm"
                            title="Imprimir"
                        >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                        </button>
                        <button
                            onClick={handleDownload}
                            className="bg-blue-50 p-1.5 md:p-2 hover:bg-blue-100 text-blue-600 rounded-xl transition-all border border-blue-200 inline-flex items-center justify-center shadow-sm"
                            title="Descargar PDF"
                        >
                            <Download className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">

                {/* Project Info */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50">
                        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Proyecto</h2>
                    </div>
                    <div className="px-6 py-5 grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Nombre del Proyecto</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-lg font-black text-slate-800 dark:text-slate-100">{os.project.nombre}</p>
                                {os.project.codigoProyecto && <CodeBadge code={os.project.codigoProyecto} variant="project" size="sm" showCopy={false} />}
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Cliente</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{clienteName}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Fecha de emisión</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(os.fechaCreacion)}</p>
                        </div>
                        {os.project.responsableUser && (
                            <div className="col-span-2">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Responsable</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{os.project.responsableUser.nombreCompleto}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reporte */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Reporte del Trabajo</h2>
                    </div>
                    <div className="px-6 py-5">
                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">{os.reporte}</p>
                    </div>
                </div>

                {/* Operadores */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operadores</h2>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {os.operadores.map(op => (
                            <div key={op.id} className="px-6 py-3.5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs">
                                        {op.operador.nombreCompleto.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{op.operador.nombreCompleto}</p>
                                        {op.isExtra && (
                                            <span className="text-[10px] text-amber-600 font-black uppercase tracking-tight">Horas Extras</span>
                                        )}
                                    </div>
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
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                            <Package className="w-4 h-4 text-amber-500" />
                            <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Materiales Utilizados</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-50">
                                        <th className="text-left px-6 py-2.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Material</th>
                                        <th className="text-right px-6 py-2.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cantidad</th>
                                        <th className="text-right px-6 py-2.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {os.materiales.map(m => (
                                        <tr key={m.id}>
                                            <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">{m.material}</td>
                                            <td className="px-6 py-3 text-right font-bold text-slate-800 dark:text-slate-100">{m.cantidad}</td>
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

                {/* Comentario Adicional */}
                {os.comentario && (
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Comentario Adicional</h2>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">{os.comentario}</p>
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
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{os.firma.nombre}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">DNI</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{os.firma.dni}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Fecha de firma</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(os.firma.fechaFirma)}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Firma</p>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-emerald-100 p-3">
                                    <img src={os.firma.firmaImagen} alt="Firma del cliente" className="max-h-32 mx-auto" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    !isFirmada && (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-amber-200 shadow-sm p-6 text-center space-y-4">
                            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                                <PenLine className="w-7 h-7 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Pendiente de firma</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Firmá esta orden de servicio para confirmar la aceptación del trabajo realizado.</p>
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

            {/* Firma Modal (2-Step) */}
            {showFirmaModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-all focus:outline-none">
                    <div className={`bg-white dark:bg-slate-800 shadow-2xl space-y-6 animate-in slide-in-from-bottom-4 duration-300 flex flex-col w-full overscroll-contain
                        ${firmaStep === 2 
                            ? 'h-[90dvh] sm:h-[85vh] sm:max-w-2xl sm:rounded-3xl rounded-t-3xl p-4 sm:p-6' 
                            : 'max-h-[85dvh] max-w-lg sm:rounded-3xl rounded-t-3xl p-6 sm:p-8 overflow-y-auto'
                        }`}
                    >
                        <div className="flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                                    {firmaStep === 1 ? 'Datos del Firmante' : 'Firma de Conformidad'}
                                </h3>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                    Paso {firmaStep} de 2
                                </p>
                            </div>
                            <button onClick={() => setShowFirmaModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors self-start shrink-0">
                                <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                            </button>
                        </div>

                        {firmaStep === 1 ? (
                            <div className="space-y-6 flex-1">
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                    Por favor ingresá tu nombre y DNI para validar la firma de la orden de servicio.
                                </p>

                                <div className="space-y-4">
                                    <div className="space-y-1.5 focus-within:z-10 relative">
                                        <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nombre Completo *</label>
                                        <input
                                            type="text"
                                            value={firmaNombre}
                                            onChange={e => {
                                                setFirmaNombre(e.target.value);
                                                if (firmaError) setFirmaError('');
                                            }}
                                            onFocus={e => {
                                                setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                                            }}
                                            placeholder="Ingresá tu nombre completo"
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all dark:focus:bg-slate-800"
                                        />
                                    </div>
                                    <div className="space-y-1.5 focus-within:z-10 relative">
                                        <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">DNI *</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={firmaDni}
                                            onChange={e => {
                                                setFirmaDni(e.target.value);
                                                if (firmaError) setFirmaError('');
                                            }}
                                            onFocus={e => {
                                                setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                                            }}
                                            placeholder="Ej: 12345678"
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all dark:focus:bg-slate-800"
                                        />
                                    </div>
                                </div>

                                {firmaError && (
                                    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p>{firmaError}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2 shrink-0">
                                    <button
                                        onClick={() => setShowFirmaModal(false)}
                                        type="button"
                                        className="flex-1 py-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleNextStep}
                                        type="button"
                                        className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        Siguiente Paso
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                <div className="flex-1 flex flex-col min-h-0 relative">
                                    <SignatureCanvas 
                                        ref={sigRef} 
                                        fullscreen={true} 
                                    />
                                </div>

                                {firmaError && (
                                    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shrink-0">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p>{firmaError}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 shrink-0">
                                    <button
                                        onClick={() => { setFirmaError(''); setFirmaStep(1); }}
                                        type="button"
                                        className="flex-1 py-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all"
                                    >
                                        Volver Atrás
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={submittingFirma}
                                        type="button"
                                        className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                                    >
                                        {submittingFirma ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Confirmando...
                                            </>
                                        ) : (
                                            'Finalizar Firma'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Post-firma modal */}
            {showPostFirmaModal && (
                <PostFirmaModal
                    osId={token}
                    onClose={() => setShowPostFirmaModal(false)}
                />
            )}
        </div>
    );
}
