'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    X, Bug, Sparkles, Lightbulb, HelpCircle, ArrowLeft, ArrowRight,
    Check, Loader2, Paperclip, Trash2, Copy, CheckCircle2, AlertTriangle,
    Monitor, Send, Info,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import {
    computePrioridad,
    TICKET_DESCRIPCION_MIN,
    TICKET_IMPACTOS,
    TICKET_TITULO_MAX,
    TICKET_TIPOS,
    TICKET_URGENCIAS,
    TICKET_PRIORIDAD_LABEL,
    type TicketAdjunto,
    type TicketContexto,
    type TicketImpacto,
    type TicketTipo,
    type TicketUrgencia,
} from '@/lib/tickets';

interface ReportTicketModalProps {
    open: boolean;
    onClose: () => void;
    onCreated?: (ticket: any) => void;
    initialTipo?: TicketTipo;
}

const TIPO_ICONS: Record<TicketTipo, any> = {
    error: Bug,
    funcionalidad: Sparkles,
    sugerencia: Lightbulb,
    consulta: HelpCircle,
};

const STEPS = [
    { id: 0, label: 'Tipo' },
    { id: 1, label: 'Detalle' },
    { id: 2, label: 'Impacto' },
    { id: 3, label: 'Enviar' },
];

function getStoredUser(): { id?: string; nombreCompleto?: string } {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
        return {};
    }
}

export default function ReportTicketModal({ open, onClose, onCreated, initialTipo }: ReportTicketModalProps) {
    const [step, setStep] = useState(0);
    const [tipo, setTipo] = useState<TicketTipo>(initialTipo || 'error');
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [pasosReproducir, setPasosReproducir] = useState('');
    const [comportamientoEsperado, setComportamientoEsperado] = useState('');
    const [urgencia, setUrgencia] = useState<TicketUrgencia>('media');
    const [impacto, setImpacto] = useState<TicketImpacto>('usuario_unico');
    const [etiquetas, setEtiquetas] = useState('');
    const [contexto, setContexto] = useState<TicketContexto>({});
    const [adjuntos, setAdjuntos] = useState<TicketAdjunto[]>([]);
    const [autoFixPermitido, setAutoFixPermitido] = useState(true);
    const [subiendo, setSubiendo] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [creado, setCreado] = useState<any>(null);
    const [analisisIa, setAnalisisIa] = useState<'idle' | 'analizando' | 'listo' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const prioridad = useMemo(() => computePrioridad(tipo, urgencia, impacto), [tipo, urgencia, impacto]);
    const esError = tipo === 'error';

    useEffect(() => {
        if (!open) return;
        setStep(0);
        setTipo(initialTipo || 'error');
        setTitulo('');
        setDescripcion('');
        setPasosReproducir('');
        setComportamientoEsperado('');
        setUrgencia('media');
        setImpacto('usuario_unico');
        setEtiquetas('');
        setAdjuntos([]);
        setAutoFixPermitido(true);
        setCreado(null);
        setAnalisisIa('idle');
        setError(null);
        setContexto({
            ruta: window.location.pathname + window.location.search,
            url: window.location.href,
            navegador: navigator.userAgent,
            plataforma: navigator.platform,
            pantalla: `${window.innerWidth}x${window.innerHeight}`,
            zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
            version: 'v2.0',
        });
    }, [open, initialTipo]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const puedeAvanzar = () => {
        if (step === 0) return !!tipo;
        if (step === 1) return titulo.trim().length >= 5 && descripcion.trim().length >= TICKET_DESCRIPCION_MIN;
        if (step === 2) return !!urgencia && !!impacto;
        return true;
    };

    const siguiente = () => {
        setError(null);
        if (!puedeAvanzar()) {
            if (step === 1) {
                setError(`Completá un título y una descripción de al menos ${TICKET_DESCRIPCION_MIN} caracteres.`);
            }
            return;
        }
        setStep(s => Math.min(s + 1, STEPS.length - 1));
    };

    const subirArchivos = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const disponibles = 3 - adjuntos.length;
        if (disponibles <= 0) {
            showToast('Ya agregaste el máximo de 3 archivos.', 'info');
            return;
        }

        const formData = new FormData();
        Array.from(files).slice(0, disponibles).forEach(f => formData.append('files', f));

        setSubiendo(true);
        try {
            const res = await fetch('/api/tickets/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al subir');
            setAdjuntos(prev => [...prev, ...(data.archivos || [])]);
        } catch (err: any) {
            showToast(err.message || 'No se pudieron subir los archivos.', 'error');
        } finally {
            setSubiendo(false);
        }
    };

    const enviar = async () => {
        if (!puedeAvanzar()) return;
        setEnviando(true);
        setError(null);

        const user = getStoredUser();

        try {
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo,
                    titulo: titulo.trim(),
                    descripcion: descripcion.trim(),
                    pasosReproducir: pasosReproducir.trim() || null,
                    comportamientoEsperado: comportamientoEsperado.trim() || null,
                    urgencia,
                    impacto,
                    contexto,
                    adjuntos,
                    etiquetas: etiquetas
                        .split(',')
                        .map(e => e.trim())
                        .filter(Boolean)
                        .slice(0, 10),
                    autoFixPermitido: esError ? autoFixPermitido : false,
                    reportadoPorId: user.id || null,
                    reportadoPorNombre: user.nombreCompleto || null,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo crear el ticket.');

            setCreado(data);
            showToast(`Ticket ${data.codigo} creado`, 'success');
            onCreated?.(data);

            // Triaje online best-effort: no bloquea ni condiciona la creación.
            if (data?.id) {
                setAnalisisIa('analizando');
                fetch(`/api/tickets/${data.id}/analizar`, { method: 'POST' })
                    .then(res => setAnalisisIa(res.ok ? 'listo' : 'error'))
                    .catch(() => setAnalisisIa('error'));
            }
        } catch (err: any) {
            setError(err.message || 'Error de red al enviar el ticket.');
            showToast(err.message || 'Error al enviar el ticket.', 'error');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-label="Reportar una falla o sugerencia"
                className="relative w-full max-w-2xl bg-card text-card-foreground rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 my-auto"
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 shrink-0">
                            <Bug className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">
                                {creado ? 'Ticket creado' : 'Reportar una falla o sugerencia'}
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                Soporte SGI · Te guiamos paso a paso
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {creado ? (
                    <div className="p-6 sm:p-8 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Tu ticket fue registrado</p>
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{creado.codigo}</p>
                            <button
                                onClick={() => {
                                    navigator.clipboard?.writeText(creado.codigo);
                                    showToast('Código copiado', 'success');
                                }}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                                title="Copiar código"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium max-w-sm mx-auto">
                            El equipo de soporte lo va a evaluar y te avisará cuando cambie de estado.
                            Prioridad inicial: <span className="font-bold text-slate-600 dark:text-slate-300">{TICKET_PRIORIDAD_LABEL[creado.prioridad as keyof typeof TICKET_PRIORIDAD_LABEL] || creado.prioridad}</span>.
                        </p>

                        <div className="mt-4 min-h-[20px] flex items-center justify-center">
                            {analisisIa === 'analizando' && (
                                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    La IA está clasificando el ticket…
                                </p>
                            )}
                            {analisisIa === 'listo' && (
                                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Análisis de IA listo para el equipo de soporte
                                </p>
                            )}
                            {analisisIa === 'error' && (
                                <p className="text-[11px] font-semibold text-slate-400">
                                    El análisis automático no estuvo disponible; el equipo lo revisará manualmente.
                                </p>
                            )}
                        </div>
                        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => {
                                    setCreado(null);
                                    setStep(0);
                                    setTitulo('');
                                    setDescripcion('');
                                    setPasosReproducir('');
                                    setComportamientoEsperado('');
                                    setUrgencia('media');
                                    setImpacto('usuario_unico');
                                    setEtiquetas('');
                                    setAdjuntos([]);
                                    setAutoFixPermitido(true);
                                    setError(null);
                                    setAnalisisIa('idle');
                                }}
                                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors"
                            >
                                Reportar otro
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Progress */}
                        <div className="px-5 pt-4">
                            <div className="flex items-center gap-2">
                                {STEPS.map((s, i) => {
                                    const active = step === s.id;
                                    const done = step > s.id;
                                    return (
                                        <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`flex items-center gap-2 min-w-0 ${active || done ? '' : 'opacity-40'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                                                    done ? 'bg-emerald-500 text-white' :
                                                    active ? 'bg-rose-600 text-white' :
                                                    'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                                }`}>
                                                    {done ? <Check className="w-3.5 h-3.5" /> : s.id + 1}
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest truncate hidden sm:block ${
                                                    active ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                                                }`}>
                                                    {s.label}
                                                </span>
                                            </div>
                                            {i < STEPS.length - 1 && (
                                                <div className={`h-[2px] flex-1 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-5 sm:p-6 min-h-[340px]">
                            {/* Paso 1: tipo */}
                            {step === 0 && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">¿Qué querés reportar?</h3>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-4">Elegí la opción que mejor describa tu caso.</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {TICKET_TIPOS.map(t => {
                                            const Icon = TIPO_ICONS[t.value];
                                            const selected = tipo === t.value;
                                            return (
                                                <button
                                                    key={t.value}
                                                    type="button"
                                                    onClick={() => setTipo(t.value)}
                                                    className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                                                        selected
                                                            ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-900/10'
                                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <div className={`p-2 rounded-lg shrink-0 ${
                                                            selected ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                        }`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-bold ${selected ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {t.label}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-snug mt-0.5">
                                                                {t.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Paso 2: detalle */}
                            {step === 1 && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-200 space-y-4">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">Contanos qué pasó</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                            No hace falta que sea técnico. Escribí con tus palabras.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                            Título corto <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={titulo}
                                            onChange={e => setTitulo(e.target.value.slice(0, TICKET_TITULO_MAX))}
                                            placeholder={esError ? 'Ej: El botón Guardar no responde en Proyectos' : 'Ej: Poder exportar el cronograma a Excel'}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                                        />
                                        <p className="text-[10px] text-slate-400 text-right mt-1">{titulo.length}/{TICKET_TITULO_MAX}</p>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                            Descripción <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            value={descripcion}
                                            onChange={e => setDescripcion(e.target.value.slice(0, 8000))}
                                            rows={4}
                                            placeholder={esError ? 'Ej: Estaba cargando un proyecto y al hacer clic en Guardar no pasó nada. Probé dos veces.' : 'Ej: Hoy tenemos que pasar el cronograma a mano a Excel. Nos llevaría 10 minutos menos por día.'}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                                        />
                                    </div>

                                    {esError && (
                                        <>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                                    ¿Cómo lo reproducimos? <span className="text-slate-300 dark:text-slate-600">(opcional)</span>
                                                </label>
                                                <textarea
                                                    value={pasosReproducir}
                                                    onChange={e => setPasosReproducir(e.target.value.slice(0, 4000))}
                                                    rows={3}
                                                    placeholder={'1. Entrar a Proyectos\n2. Abrir un proyecto\n3. Tocar Guardar'}
                                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                                    ¿Qué esperabas que pasara? <span className="text-slate-300 dark:text-slate-600">(opcional)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={comportamientoEsperado}
                                                    onChange={e => setComportamientoEsperado(e.target.value.slice(0, 2000))}
                                                    placeholder="Ej: Que el proyecto se guarde y me lleve al listado"
                                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Paso 3: impacto y urgencia */}
                            {step === 2 && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-200 space-y-5">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">¿Qué tan urgente es?</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-3">
                                            Esto nos ayuda a ordenar la cola. No hace falta exagerar: elegí lo que más se parezca.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {TICKET_URGENCIAS.map(u => {
                                                const selected = urgencia === u.value;
                                                return (
                                                    <button
                                                        key={u.value}
                                                        type="button"
                                                        onClick={() => setUrgencia(u.value)}
                                                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                                                            selected
                                                                ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-900/10'
                                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className={`w-2 h-2 rounded-full ${
                                                                u.value === 'critica' ? 'bg-rose-600' :
                                                                u.value === 'alta' ? 'bg-orange-500' :
                                                                u.value === 'media' ? 'bg-amber-400' : 'bg-slate-400'
                                                            }`} />
                                                            <p className={`text-sm font-bold ${selected ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {u.label}
                                                            </p>
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-snug">{u.description}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">¿A quién afecta?</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                            {TICKET_IMPACTOS.map(i => {
                                                const selected = impacto === i.value;
                                                return (
                                                    <button
                                                        key={i.value}
                                                        type="button"
                                                        onClick={() => setImpacto(i.value)}
                                                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                                                            selected
                                                                ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-900/10'
                                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                        }`}
                                                    >
                                                        <p className={`text-sm font-bold ${selected ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                                            {i.label}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-snug">{i.description}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                        <Info className="w-4 h-4 text-slate-400 shrink-0" />
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            Prioridad estimada: <span className="font-black text-slate-700 dark:text-slate-200">{TICKET_PRIORIDAD_LABEL[prioridad]}</span>.
                                            El equipo puede ajustarla después.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Paso 4: contexto y envío */}
                            {step === 3 && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-200 space-y-4">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">Revisá y enviá</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                            Adjuntamos automáticamente el contexto técnico para que podamos reproducirlo.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-3.5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Monitor className="w-3.5 h-3.5 text-slate-400" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contexto automático</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            <p><span className="text-slate-400">Pantalla:</span> {contexto.ruta || '—'}</p>
                                            <p><span className="text-slate-400">Resolución:</span> {contexto.pantalla || '—'}</p>
                                            <p className="truncate"><span className="text-slate-400">Zona:</span> {contexto.zonaHoraria || '—'}</p>
                                            <p className="truncate"><span className="text-slate-400">Versión:</span> {contexto.version || '—'}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capturas (opcional)</p>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400">{adjuntos.length}/3</span>
                                        </div>

                                        {adjuntos.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {adjuntos.map((a, i) => (
                                                    <div key={a.url} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 max-w-full">
                                                        <Paperclip className="w-3 h-3 shrink-0" />
                                                        <span className="truncate max-w-[140px]">{a.nombre}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAdjuntos(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="text-slate-400 hover:text-rose-500 shrink-0"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:border-rose-400 hover:text-rose-600 transition-colors ${adjuntos.length >= 3 || subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                                            {subiendo ? 'Subiendo…' : 'Adjuntar imagen o PDF'}
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                                                className="hidden"
                                                onChange={e => {
                                                    subirArchivos(e.target.files);
                                                    e.currentTarget.value = '';
                                                }}
                                            />
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                            Etiquetas <span className="text-slate-300 dark:text-slate-600">(opcional, separadas por coma)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={etiquetas}
                                            onChange={e => setEtiquetas(e.target.value)}
                                            placeholder="Ej: proyectos, mobile, exportación"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                                        />
                                    </div>

                                    {esError && (
                                        <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-900/40 p-3">
                                            <label className="flex items-start gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={autoFixPermitido}
                                                    onChange={e => setAutoFixPermitido(e.target.checked)}
                                                    className="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 leading-snug">
                                                    Autorizo que el agente analice este error y, si el riesgo es bajo, proponga una corrección automática.
                                                    Si es riesgoso o es un cambio grande, va a quedar para aprobación humana.
                                                </span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">{error}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                            <button
                                type="button"
                                onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {step === 0 ? 'Cancelar' : 'Atrás'}
                            </button>

                            {step < STEPS.length - 1 ? (
                                <button
                                    type="button"
                                    onClick={siguiente}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-[13px] font-bold hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
                                    disabled={!puedeAvanzar()}
                                >
                                    Siguiente
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={enviar}
                                    disabled={enviando}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-[13px] font-bold hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-60"
                                >
                                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {enviando ? 'Enviando…' : 'Crear ticket'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
