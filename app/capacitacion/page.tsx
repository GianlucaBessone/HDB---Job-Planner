'use client';

import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, Clock, AlertCircle, Play, FileText, Download, Award, ChevronRight, X, Loader2, ShieldAlert } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';

export default function CapacitacionPage() {
    const [user, setUser] = useState<any>(null);
    const [trainings, setTrainings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTraining, setSelectedTraining] = useState<any>(null);
    const [docDetail, setDocDetail] = useState<any>(null);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [quizResult, setQuizResult] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'list' | 'detail' | 'quiz'>('list');
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        if (typeof window !== 'undefined') {
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            }
        };
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try { setUser(JSON.parse(stored)); } catch (e) {}
        }
    }, []);

    useEffect(() => {
        if (user?.id) loadTrainings();
    }, [user]);

    const loadTrainings = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest(`/api/qms/capacitaciones?operatorId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setTrainings(Array.isArray(data) ? data : []);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const openTraining = async (training: any) => {
        setSelectedTraining(training);
        setQuizAnswers({});
        setQuizResult(null);
        setLoadingDoc(true);
        setViewMode('detail');
        try {
            const res = await safeApiRequest(`/api/documentos/${training.documentId}`);
            if (res.ok) setDocDetail(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoadingDoc(false); }
    };

    const getYoutubeEmbedUrl = (url: string) => {
        if (!url) return null;
        const m = url.match(/(?:youtu\.be\/|v=|embed\/)([^#&?]{11})/);
        return m ? `https://www.youtube.com/embed/${m[1]}` : null;
    };

    const handleSubmitQuiz = async () => {
        if (!selectedTraining) return;
        setSubmitting(true);
        try {
            const res = await safeApiRequest('/api/qms/capacitaciones', {
                method: 'POST',
                body: JSON.stringify({ id: selectedTraining.id, respuestas: quizAnswers })
            });
            if (res.ok) {
                const result = await res.json();
                setQuizResult(result);
                showToast(result.approved ? '¡Capacitación aprobada!' : 'No alcanzó el puntaje mínimo', result.approved ? 'success' : 'error');
                loadTrainings();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al enviar evaluación', 'error');
            }
        } catch (e: any) {
            showToast('Error de red', 'error');
        } finally { setSubmitting(false); }
    };

    const handleMarkAsRead = async () => {
        if (!selectedTraining) return;
        setSubmitting(true);
        try {
            const res = await safeApiRequest('/api/qms/capacitaciones', {
                method: 'POST',
                body: JSON.stringify({ id: selectedTraining.id, respuestas: {} })
            });
            if (res.ok) {
                showToast('Capacitación marcada como leída y completada', 'success');
                setQuizResult({ approved: true, score: 100 });
                loadTrainings();
            }
        } catch (e: any) {
            showToast('Error de red', 'error');
        } finally { setSubmitting(false); }
    };

    const pendingCount = trainings.filter(t => t.estado === 'pendiente').length;
    const approvedCount = trainings.filter(t => t.estado === 'aprobado').length;
    const failedCount = trainings.filter(t => t.estado === 'reprobado').length;

    // Parse digital data from document description
    let digitalData: any = null;
    if (docDetail?.descripcion) {
        try {
            const parsed = JSON.parse(docDetail.descripcion);
            if (parsed.isDigital) digitalData = parsed;
        } catch (e) {}
    }

    const quiz = selectedTraining?.cuestionario
        ? (Array.isArray(selectedTraining.cuestionario) ? selectedTraining.cuestionario : JSON.parse(selectedTraining.cuestionario))
        : [];
    const hasQuiz = quiz.length > 0;
    const youtubeUrl = digitalData?.videoUrl ? getYoutubeEmbedUrl(digitalData.videoUrl) : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    // DETAIL / QUIZ VIEW
    if (viewMode !== 'list' && selectedTraining) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={() => { setViewMode('list'); setSelectedTraining(null); setDocDetail(null); setQuizResult(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedTraining.document?.titulo || 'Capacitación'}</h1>
                        <p className="text-xs text-slate-400">
                            {selectedTraining.estado === 'aprobado' ? '✅ Completada' : selectedTraining.estado === 'reprobado' ? '❌ No aprobada' : '⏳ Pendiente'}
                        </p>
                    </div>
                </div>

                {loadingDoc ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                ) : quizResult ? (
                    /* RESULT VIEW */
                    <div className={`p-8 rounded-3xl border-2 text-center space-y-4 ${quizResult.approved ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'}`}>
                        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${quizResult.approved ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-rose-100 dark:bg-rose-900/50'}`}>
                            {quizResult.approved ? <CheckCircle2 className="w-10 h-10 text-emerald-600" /> : <AlertCircle className="w-10 h-10 text-rose-600" />}
                        </div>
                        <h2 className={`text-2xl font-black ${quizResult.approved ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                            {quizResult.approved ? '¡Aprobado!' : 'No Aprobado'}
                        </h2>
                        <p className="text-4xl font-black text-slate-800 dark:text-slate-100">{Math.round(quizResult.score)}%</p>
                        <p className="text-sm text-slate-500">{quizResult.approved ? 'Su competencia ha sido acreditada exitosamente.' : 'Debe volver a intentarlo para acreditar esta competencia.'}</p>
                        <button onClick={() => { setViewMode('list'); setSelectedTraining(null); setQuizResult(null); }} className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors">
                            Volver a Mis Capacitaciones
                        </button>
                    </div>
                ) : viewMode === 'quiz' ? (
                    /* QUIZ VIEW */
                    <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                            <p className="text-xs font-bold text-indigo-600">Responda todas las preguntas. Puntaje mínimo: {selectedTraining.puntajeMinimo || 70}%</p>
                        </div>
                        {quiz.map((q: any, qIdx: number) => (
                            <div key={qIdx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex items-start gap-3">
                                    <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs font-black flex items-center justify-center flex-shrink-0">{qIdx + 1}</span>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 pt-1">{q.question}</p>
                                </div>
                                <div className="space-y-2 pl-10">
                                    {q.options?.map((opt: string, oIdx: number) => (
                                        <button key={oIdx} onClick={() => setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx })}
                                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border ${quizAnswers[qIdx] === oIdx
                                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                                                : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}>
                                            <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)})</span> {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setViewMode('detail')} className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Volver</button>
                            <button onClick={handleSubmitQuiz} disabled={submitting || Object.keys(quizAnswers).length < quiz.length}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50">
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                                {submitting ? 'Evaluando...' : 'Enviar Evaluación'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* CONTENT DETAIL VIEW */
                    <div className="space-y-5">
                        {/* Video */}
                        {youtubeUrl && isOnline && (
                            <div className="bg-black rounded-2xl overflow-hidden border border-slate-700">
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900">
                                    <Play className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-slate-300">Video de Capacitación</span>
                                </div>
                                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                    <iframe src={youtubeUrl} title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full" />
                                </div>
                            </div>
                        )}

                        {youtubeUrl && !isOnline && (
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 text-center border border-slate-200 dark:border-slate-700">
                                <Play className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-500">Video no disponible sin conexión a internet</p>
                            </div>
                        )}

                        {/* Digital sections */}
                        {digitalData && (
                            <>
                                {[
                                    { title: 'Objetivo', content: digitalData.objetivo },
                                    { title: 'Alcance', content: digitalData.alcance },
                                    { title: 'Desarrollo', content: digitalData.desarrollo },
                                    { title: 'Responsabilidades', content: digitalData.responsabilidades },
                                ].filter(s => s.content).map((s, i) => (
                                    <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">{s.title}</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{s.content}</p>
                                    </div>
                                ))}
                                {digitalData.definiciones?.length > 0 && (
                                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Definiciones</p>
                                        <div className="space-y-1">
                                            {digitalData.definiciones.map((d: any, i: number) => (
                                                <div key={i} className="flex gap-2 text-xs"><span className="font-black text-indigo-600 min-w-[50px]">{d.term}</span><span className="text-slate-500">{d.definition}</span></div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Plain description fallback */}
                        {!digitalData && docDetail?.descripcion && (
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción</p>
                                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{docDetail.descripcion}</p>
                            </div>
                        )}

                        {/* Download file */}
                        {docDetail?.versions?.[0]?.files?.some((f: any) => f.esPrincipal) && (
                            <a href={`/api/documentos/${docDetail.id}/download`} download className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center"><FileText className="w-5 h-5 text-indigo-600" /></div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{docDetail.versions[0].files.find((f: any) => f.esPrincipal)?.nombreArchivo || 'Documento'}</p>
                                    <p className="text-[10px] text-slate-400">Toque para descargar</p>
                                </div>
                                <Download className="w-4 h-4 text-indigo-500" />
                            </a>
                        )}

                        {/* Actions */}
                        {selectedTraining.estado === 'pendiente' && (
                            <div className="flex flex-col gap-3 pt-2">
                                {hasQuiz ? (
                                    <button onClick={() => setViewMode('quiz')} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                                        <Award className="w-5 h-5" /> Comenzar Evaluación ({quiz.length} preguntas)
                                    </button>
                                ) : (
                                    <button onClick={handleMarkAsRead} disabled={submitting} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50">
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                        {submitting ? 'Procesando...' : 'Marcar como Leída y Completar'}
                                    </button>
                                )}
                            </div>
                        )}

                        {selectedTraining.estado === 'reprobado' && hasQuiz && (
                            <button onClick={() => { setQuizAnswers({}); setViewMode('quiz'); }} className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                                <Award className="w-5 h-5" /> Reintentar Evaluación
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Capacitación LMS</h1>
                <p className="text-sm text-slate-500 mt-1">Documentos y capacitaciones obligatorias asignadas a su perfil.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800 text-center">
                    <span className="text-2xl font-black text-amber-700 dark:text-amber-300">{pendingCount}</span>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-1">Pendientes</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
                    <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{approvedCount}</span>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Aprobadas</p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800 text-center">
                    <span className="text-2xl font-black text-rose-700 dark:text-rose-300">{failedCount}</span>
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">No Aprobadas</p>
                </div>
            </div>

            {/* Training List */}
            {trainings.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">No tiene capacitaciones asignadas actualmente.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Pending first, then failed, then approved */}
                    {[...trainings].filter(t => t.estado !== 'obsoleto').sort((a, b) => {
                        const order: Record<string, number> = { pendiente: 0, reprobado: 1, aprobado: 2 };
                        return (order[a.estado] ?? 3) - (order[b.estado] ?? 3);
                    }).map(t => {
                        const isExpired = t.vencimiento && new Date(t.vencimiento) < new Date();
                        const isNewVersion = t.estado === 'pendiente' && t.document?.versions?.[0]?.versionMayor > 1;
                        return (
                            <button key={t.id} onClick={() => openTraining(t)} className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all flex items-center gap-4 group">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    t.estado === 'aprobado' ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                                    t.estado === 'reprobado' ? 'bg-rose-100 dark:bg-rose-900/40' :
                                    'bg-amber-100 dark:bg-amber-900/40'
                                }`}>
                                    {t.estado === 'aprobado' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                                     t.estado === 'reprobado' ? <AlertCircle className="w-5 h-5 text-rose-600" /> :
                                     <Clock className="w-5 h-5 text-amber-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{t.document?.titulo || 'Documento'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                                            t.estado === 'aprobado' ? 'text-emerald-600' : t.estado === 'reprobado' ? 'text-rose-600' : 'text-amber-600'
                                        }`}>{t.estado === 'aprobado' ? 'Completada' : t.estado === 'reprobado' ? 'No aprobada' : 'Pendiente'}</span>
                                        {isNewVersion && (
                                            <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                                Nueva Versión
                                            </span>
                                        )}
                                        {t.puntaje !== null && t.puntaje !== undefined && <span className="text-[10px] text-slate-400">• {Math.round(t.puntaje)}%</span>}
                                        {isExpired && <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5"><ShieldAlert className="w-3 h-3" /> Vencida</span>}
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
