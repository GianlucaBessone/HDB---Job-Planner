'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, AlertCircle, MessageSquare, Loader2, Send, CheckCircle2, Wrench, ShieldAlert, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface TechAssistantChatProps {
    projectId?: string;
    osId?: string;
    user?: {
        id: string;
        nombre: string;
        nombreCompleto?: string;
        role: string;
    };
}

interface CausaPosible {
    causa: string;
    probabilidad: 'alta' | 'media' | 'baja';
    justificacion: string;
}

interface Diagnosis {
    causasPosibles: CausaPosible[];
    pasosDiagnostico: string[];
    recomendacionesSeguridad: string[];
    verificacionesRequeridas: string[];
    prioridadProblema: 'critica' | 'alta' | 'media' | 'baja';
    tiempoEstimadoResolucion: string;
}

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export default function TechAssistantChat({ projectId, osId, user }: TechAssistantChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Initial fields
    const [falla, setFalla] = useState('');
    const [sintomas, setSintomas] = useState('');
    const [observaciones, setObservaciones] = useState('');

    // Active Diagnosis and Chat
    const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [followUpText, setFollowUpText] = useState('');
    const [followUpLoading, setFollowUpLoading] = useState(false);
    
    // Checked steps in the diagnosis checklist
    const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

    // Projects dropdown/selector state
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [projectSearch, setProjectSearch] = useState('');
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);

    useEffect(() => {
        fetch('/api/projects')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setProjects(data.filter(p => p.activo !== false));
                }
            })
            .catch(err => console.error('Error fetching projects:', err));
    }, []);

    useEffect(() => {
        if (projectId) {
            setSelectedProjectId(projectId);
        }
    }, [projectId]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleStartDiagnosis = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId && !projectId) {
            setError('Por favor seleccione un proyecto o instalación.');
            return;
        }
        if (!falla.trim() || !sintomas.trim()) {
            setError('Por favor complete la falla y síntomas observados.');
            return;
        }

        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/ai/technical-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    falla,
                    sintomas,
                    observaciones,
                    projectId: selectedProjectId || projectId,
                    userId: user?.id || 'anonymous_tech',
                    userName: user?.nombreCompleto || user?.nombre || 'Técnico de Campo',
                    userRole: user?.role || 'OPERATOR'
                })
            });

            const data = await res.json();
            if (res.ok && data.success && data.diagnosis) {
                setDiagnosis(data.diagnosis);
                setConversationId(data.conversationId);
                setMessages([
                    { role: 'user', content: `Falla: ${falla}. Síntomas: ${sintomas}.` },
                    { role: 'model', content: 'Diagnóstico inicial generado. Revise las causas y pasos sugeridos.' }
                ]);
                setCheckedSteps({});
            } else {
                setError(data.error || 'Error al iniciar diagnóstico con IA.');
            }
        } catch (err) {
            setError('Error de red al conectar con el servicio de IA.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendFollowUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!followUpText.trim() || followUpLoading || !conversationId) return;

        const query = followUpText.trim();
        setFollowUpText('');
        setFollowUpLoading(true);
        setError('');

        // Append user query to chat log
        setMessages(prev => [...prev, { role: 'user', content: query }]);

        try {
            const res = await fetch('/api/ai/technical-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    falla: `Seguimiento: ${query}`,
                    sintomas: `Técnico informa: ${query}`,
                    conversationId,
                    projectId: selectedProjectId || projectId,
                    userId: user?.id || 'anonymous_tech',
                    userName: user?.nombreCompleto || user?.nombre || 'Técnico de Campo',
                    userRole: user?.role || 'OPERATOR'
                })
            });

            const data = await res.json();
            if (res.ok && data.success && data.diagnosis) {
                setDiagnosis(data.diagnosis);
                setMessages(prev => [...prev, { role: 'model', content: `Diagnóstico actualizado en base a: "${query}"` }]);
            } else {
                setError(data.error || 'Error al procesar consulta de seguimiento.');
            }
        } catch (err) {
            setError('Error de red al enviar consulta.');
        } finally {
            setFollowUpLoading(false);
        }
    };

    const toggleStep = (idx: number) => {
        setCheckedSteps(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const getPriorityColor = (prio: string) => {
        switch (prio) {
            case 'critica':
                return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900';
            case 'alta':
                return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900';
            case 'media':
                return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900';
            default:
                return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900';
        }
    };

    const getProbabilityBadge = (prob: string) => {
        switch (prob) {
            case 'alta':
                return 'bg-red-500/10 text-red-500 border border-red-500/20';
            case 'media':
                return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
            default:
                return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
        }
    };

    const filteredProjects = projects.filter(p => 
        p.nombre.toLowerCase().includes(projectSearch.toLowerCase()) ||
        (p.codigoProyecto && p.codigoProyecto.toLowerCase().includes(projectSearch.toLowerCase()))
    );

    const selectedProjectName = projects.find(p => p.id === selectedProjectId)?.nombre || 'Seleccionar Proyecto...';

    return (
        <>
            {/* Floating FAB */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-[9998] w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-750 hover:to-indigo-750 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-90 hover:scale-105 transition-all focus:outline-none"
            >
                <Sparkles className="w-6 h-6 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
            </button>

            {/* Slider Drawer Panel */}
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    {/* Drawer Content */}
                    <div className="w-full sm:w-[480px] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-350 ease-out relative">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider block">Asistente de Campo IA</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Copiloto de Mantenimiento Gemini</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {error && (
                                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-[11px] font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {!diagnosis ? (
                                /* DIAGNOSIS INITIAL FORM */
                                <form onSubmit={handleStartDiagnosis} className="space-y-4">
                                    <div className="text-[11px] text-slate-400 font-bold leading-relaxed">
                                        ¿Tenés algún inconveniente en la instalación? Describí la falla y los síntomas. Gemini cruzará datos con el historial del proyecto para recomendarte un diagnóstico ordenado.
                                    </div>
                                    
                                    <div className="space-y-3.5">
                                        {/* Selector de Proyecto con Buscador */}
                                        <div className="relative space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Proyecto / Instalación <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                                                    className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-200 hover:border-indigo-500 transition-all text-left"
                                                >
                                                    <span className="truncate">{selectedProjectName}</span>
                                                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                                </button>

                                                {showProjectDropdown && (
                                                    <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in duration-100 max-h-60 flex flex-col">
                                                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                                                            <input
                                                                type="text"
                                                                placeholder="Buscar proyecto..."
                                                                value={projectSearch}
                                                                onChange={e => setProjectSearch(e.target.value)}
                                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 dark:divide-slate-850">
                                                            {filteredProjects.length === 0 ? (
                                                                <div className="p-4 text-xs text-slate-400 text-center">No se encontraron proyectos</div>
                                                            ) : (
                                                                filteredProjects.map((p) => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedProjectId(p.id);
                                                                            setShowProjectDropdown(false);
                                                                            setProjectSearch('');
                                                                        }}
                                                                        className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col gap-0.5 ${
                                                                            selectedProjectId === p.id 
                                                                                ? 'bg-indigo-50/40 dark:bg-indigo-950/20 font-black text-indigo-600 dark:text-indigo-400' 
                                                                                : 'text-slate-700 dark:text-slate-200'
                                                                        }`}
                                                                    >
                                                                        <span className="font-bold">{p.nombre}</span>
                                                                        {p.codigoProyecto && (
                                                                            <span className="text-[9px] font-mono text-slate-400 uppercase">{p.codigoProyecto}</span>
                                                                        )}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Falla detectada <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej. El motor reductor se sobrecalienta"
                                                value={falla}
                                                onChange={e => setFalla(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold focus:border-indigo-500 outline-none transition-all focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Síntomas observados <span className="text-red-500">*</span></label>
                                            <textarea
                                                required
                                                rows={3}
                                                placeholder="Ej. Vibraciones inusuales, temperatura elevada al tacto, ruido metálico intermitente."
                                                value={sintomas}
                                                onChange={e => setSintomas(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold focus:border-indigo-500 outline-none transition-all focus:bg-white resize-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Observaciones previas (Opcional)</label>
                                            <textarea
                                                rows={2}
                                                placeholder="Ej. Se verificó tensión en bornes (correcto 380V). El acople parece estar alineado."
                                                value={observaciones}
                                                onChange={e => setObservaciones(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold focus:border-indigo-500 outline-none transition-all focus:bg-white resize-none"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-750 hover:to-indigo-750 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-75 disabled:active:scale-100"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Gemini analizando el proyecto...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                <span>Iniciar Diagnóstico Asistido</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                /* ACTIVE DIAGNOSIS REPORT AND CONVERSATION */
                                <div className="space-y-5">
                                    {/* Diagnosis Card */}
                                    <div className="bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
                                        <div className="flex justify-between items-center flex-wrap gap-2">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${getPriorityColor(diagnosis.prioridadProblema)}`}>
                                                Prioridad: {diagnosis.prioridadProblema}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {diagnosis.tiempoEstimadoResolucion}
                                            </span>
                                        </div>

                                        {/* Causes */}
                                        <div className="space-y-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <AlertCircle className="w-3.5 h-3.5 text-indigo-500" />
                                                Causas Posibles Detectadas:
                                            </span>
                                            <div className="space-y-2">
                                                {diagnosis.causasPosibles.map((c, i) => (
                                                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 space-y-1.5 shadow-sm">
                                                        <div className="flex justify-between items-start">
                                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xs flex-1">{c.causa}</p>
                                                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${getProbabilityBadge(c.probabilidad)}`}>
                                                                {c.probabilidad}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">{c.justificacion}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Steps checklist */}
                                        <div className="space-y-2.5">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                                                Pasos de Diagnóstico Sugeridos:
                                            </span>
                                            <div className="space-y-1.5">
                                                {diagnosis.pasosDiagnostico.map((p, idx) => (
                                                    <label 
                                                        key={idx}
                                                        onClick={() => toggleStep(idx)}
                                                        className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer select-none transition-all ${
                                                            checkedSteps[idx] 
                                                                ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800/80 line-through dark:bg-emerald-950/10 dark:border-emerald-900/40 dark:text-emerald-400/80' 
                                                                : 'bg-white border-slate-100 hover:bg-slate-50/50 dark:bg-slate-900 dark:border-slate-800/80 text-slate-700 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <input 
                                                            type="checkbox" 
                                                            checked={!!checkedSteps[idx]}
                                                            onChange={() => {}} // handled by click
                                                            className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
                                                        />
                                                        <span className="text-xs font-bold leading-tight">{p}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Safety Recommendations */}
                                        {diagnosis.recomendacionesSeguridad && diagnosis.recomendacionesSeguridad.length > 0 && (
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <ShieldAlert className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                                    Recomendaciones Críticas de Seguridad (LOTO / EPP):
                                                </span>
                                                <div className="bg-red-50/40 dark:bg-red-950/10 border border-red-100 dark:border-red-950/40 rounded-2xl p-3 space-y-1">
                                                    {diagnosis.recomendacionesSeguridad.map((rec, i) => (
                                                        <p key={i} className="text-[10.5px] font-bold text-red-700 dark:text-red-400 flex items-start gap-1">
                                                            <span className="text-red-500 shrink-0">•</span>
                                                            <span>{rec}</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Chat log wrapper */}
                                    <div className="space-y-3 pt-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                                            Seguimiento y Consultas Adicionales:
                                        </span>
                                        
                                        <div className="border border-slate-100 dark:border-slate-800 rounded-3xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3.5 max-h-[220px] overflow-y-auto">
                                            {messages.map((msg, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs ${
                                                        msg.role === 'user' 
                                                            ? 'bg-indigo-600 text-white font-bold rounded-tr-none' 
                                                            : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-650 dark:text-slate-300 font-bold rounded-tl-none leading-relaxed'
                                                    }`}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            ))}
                                            {followUpLoading && (
                                                <div className="flex justify-start">
                                                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2.5 flex items-center gap-2">
                                                        <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                                                        <span className="text-xs font-bold text-slate-400 animate-pulse">Gemini refinando diagnóstico...</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer / Input field */}
                        {diagnosis && (
                            <form onSubmit={handleSendFollowUp} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Ej. Medí continuidad y da infinito, ¿qué hago?"
                                    value={followUpText}
                                    onChange={e => setFollowUpText(e.target.value)}
                                    disabled={followUpLoading}
                                    className="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all disabled:opacity-70"
                                />
                                <button
                                    type="submit"
                                    disabled={!followUpText.trim() || followUpLoading}
                                    className="px-4 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-sm"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        )}
                        
                        {/* Option to clear/reset conversation */}
                        {diagnosis && (
                            <div className="p-2 border-t border-slate-100 dark:border-slate-805 bg-slate-50 dark:bg-slate-950 text-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDiagnosis(null);
                                        setConversationId(null);
                                        setMessages([]);
                                        setFalla('');
                                        setSintomas('');
                                        setObservaciones('');
                                    }}
                                    className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                                >
                                    Nueva Consulta / Limpiar Chat
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
