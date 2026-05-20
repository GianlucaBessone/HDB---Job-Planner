import { useState, useEffect, useRef } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { formatDateInline } from '@/lib/formatDate';
import { 
    BookOpen, Award, CheckCircle2, XCircle, Play, 
    ArrowLeft, HelpCircle, GraduationCap, Clock, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LmsTab({ user }: { user: any }) {
    const [trainings, setTrainings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCourse, setActiveCourse] = useState<any>(null);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [quizResult, setQuizResult] = useState<any>(null);
    const [seconds, setSeconds] = useState(0);
    const timerRef = useRef<any>(null);

    const isTech = !(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'supervisor' || user?.role?.toLowerCase() === 'qa');

    useEffect(() => {
        loadTrainings();
    }, []);

    useEffect(() => {
        if (activeCourse && activeCourse.estado !== 'aprobado' && !quizResult) {
            setSeconds(0);
            timerRef.current = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [activeCourse, quizResult]);

    const loadTrainings = async () => {
        setIsLoading(true);
        try {
            const url = isTech ? `/api/qms/capacitaciones?operatorId=${user.id}` : '/api/qms/capacitaciones';
            const res = await safeApiRequest(url);
            if (res.ok) {
                setTrainings(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectCourse = (course: any) => {
        setActiveCourse(course);
        setAnswers({});
        setQuizResult(null);
    };

    const handleAnswerSelect = (qIndex: number, optionIndex: number) => {
        setAnswers(prev => ({
            ...prev,
            [qIndex]: optionIndex
        }));
    };

    const handleSubmitQuiz = async () => {
        const quiz = activeCourse.cuestionario ? (Array.isArray(activeCourse.cuestionario) ? activeCourse.cuestionario : JSON.parse(activeCourse.cuestionario as string)) : [];
        if (quiz.length > 0 && Object.keys(answers).length < quiz.length) {
            alert('Por favor, responde todas las preguntas del cuestionario.');
            return;
        }

        try {
            const res = await safeApiRequest('/api/qms/capacitaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeCourse.id,
                    respuestas: answers,
                    tiempoInvertido: seconds
                })
            });

            if (res.ok) {
                const data = await res.json();
                setQuizResult(data);
                loadTrainings();
            } else {
                alert('Error al enviar la evaluación.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (activeCourse) {
        const quiz = activeCourse.cuestionario ? (Array.isArray(activeCourse.cuestionario) ? activeCourse.cuestionario : JSON.parse(activeCourse.cuestionario as string)) : [];

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <button 
                    onClick={() => setActiveCourse(null)}
                    className="flex items-center gap-2 text-sm font-black text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver a capacitaciones
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Contenido / Material */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary dark:text-primary-light px-2.5 py-1 rounded-full">
                                        Material de Estudio
                                    </span>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{activeCourse.titulo}</h3>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full">
                                    <Clock className="w-4 h-4" />
                                    <span>{Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}</span>
                                </div>
                            </div>

                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                Por favor, lee y estudia detalladamente el siguiente procedimiento controlado antes de proceder a la realización del cuestionario de suficiencia teórica obligatoria.
                            </p>

                            {/* Visualización de Documento Real */}
                            {(() => {
                                const doc = activeCourse.document;
                                const digitalData = typeof doc?.descripcion === 'string' ? (() => { try { return JSON.parse(doc.descripcion); } catch(e) { return null; } })() : doc?.descripcion;
                                const isDigital = digitalData?.isDigital === true;
                                const pdfFile = doc?.versions?.[0]?.files?.find((f: any) => f.esPrincipal) || doc?.versions?.[0]?.files?.[0];
                                
                                if (isDigital && digitalData) {
                                    const ytUrl = digitalData.videoUrl?.includes('youtube.com/watch?v=') 
                                        ? digitalData.videoUrl.replace('watch?v=', 'embed/') 
                                        : digitalData.videoUrl;

                                    return (
                                        <div className="space-y-4">
                                            {ytUrl && (
                                                <div className="bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
                                                        <Play className="w-4 h-4 text-primary" />
                                                        <span className="text-xs font-bold text-slate-300">Video de Capacitación</span>
                                                    </div>
                                                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                                        <iframe src={ytUrl} allow="autoplay; encrypted-media" allowFullScreen className="absolute inset-0 w-full h-full" />
                                                    </div>
                                                </div>
                                            )}

                                            {[
                                                { title: 'Objetivo', content: digitalData.objetivo },
                                                { title: 'Alcance', content: digitalData.alcance },
                                                { title: 'Desarrollo', content: digitalData.desarrollo },
                                                { title: 'Responsabilidades', content: digitalData.responsabilidades },
                                            ].filter(s => s.content).map((section, idx) => (
                                                <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">{section.title}</p>
                                                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{section.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                } else if (pdfFile) {
                                    return (
                                        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-900">
                                            <iframe 
                                                src={pdfFile.url} 
                                                className="absolute inset-0 w-full h-full"
                                                title="Visor PDF"
                                            />
                                        </div>
                                    );
                                }

                                return (
                                    <div className="aspect-video bg-slate-950 rounded-2xl flex flex-col items-center justify-center border border-slate-800 p-6 text-center space-y-4">
                                        <BookOpen className="w-16 h-16 text-primary animate-pulse" />
                                        <div>
                                            <h4 className="text-base font-black text-white">{activeCourse.document?.titulo || activeCourse.titulo}</h4>
                                            <p className="text-xs font-bold text-slate-400 mt-1">Procedimiento de Calidad QMS • PDF Oficial Autorizado</p>
                                        </div>
                                        {activeCourse.urlContenido && (
                                            <a 
                                                href={activeCourse.urlContenido} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="bg-primary hover:bg-primary-dark text-white font-black text-xs px-6 py-3 rounded-full transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                                            >
                                                <Play className="w-4 h-4" /> Abrir Documento Controlado
                                            </a>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Examen / Quiz */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                            <div className="space-y-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                    quiz.length > 0 
                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                        : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                }`}>
                                    {quiz.length > 0 ? 'Examen de Suficiencia' : 'Confirmación de Lectura'}
                                </span>
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                    {quiz.length > 0 ? 'Cuestionario QMS' : 'Conformidad de Documento'}
                                </h3>
                            </div>

                            {quizResult ? (
                                <div className="space-y-6 text-center py-4 animate-in zoom-in-95 duration-300">
                                    {quizResult.approved ? (
                                        <div className="space-y-4">
                                            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                                                <Award className="w-10 h-10" />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400">¡Completado!</h4>
                                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                                                    Has completado la capacitación con éxito. Tu competencia técnica ha sido actualizada a "Vigente".
                                                </p>
                                            </div>
                                            {quiz.length > 0 && (
                                                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl">
                                                    <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{Math.round(quizResult.score)}%</p>
                                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">Score Obtenido</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                                                <XCircle className="w-10 h-10" />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-red-600 dark:text-red-400">Desaprobado</h4>
                                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                                                    Tu puntaje no alcanzó el mínimo requerido ({activeCourse.puntajeMinimo}%). Por favor repasa el documento e inténtalo nuevamente.
                                                </p>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl">
                                                <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{Math.round(quizResult.score)}%</p>
                                                <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mt-1">Score Obtenido</p>
                                            </div>
                                            <button 
                                                onClick={() => setQuizResult(null)}
                                                className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 font-black text-xs py-3 rounded-xl transition-all"
                                            >
                                                Intentar de Nuevo
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : activeCourse.estado === 'aprobado' ? (
                                <div className="space-y-4 text-center py-6">
                                    <div className="mx-auto w-12 h-12 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-emerald-600 dark:text-emerald-400">Capacitación Completada</h4>
                                        {quiz.length > 0 ? (
                                            <p className="text-xs font-medium text-slate-500 mt-1">Ya has aprobado este curso con un score de {Math.round(activeCourse.puntaje || 100)}%</p>
                                        ) : (
                                            <p className="text-xs font-medium text-slate-500 mt-1">Has leído y firmado en conformidad este documento controlado.</p>
                                        )}
                                    </div>
                                </div>
                            ) : quiz.length > 0 ? (
                                <div className="space-y-6">
                                    {quiz.map((q: any, qIndex: number) => (
                                        <div key={qIndex} className="space-y-3">
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-200 flex gap-2">
                                                <span className="text-primary font-black">{qIndex + 1}.</span> {q.question}
                                            </p>
                                            <div className="space-y-2">
                                                {q.options.map((opt: string, optIndex: number) => {
                                                    const isSelected = answers[qIndex] === optIndex;
                                                    return (
                                                        <button
                                                            key={optIndex}
                                                            onClick={() => handleAnswerSelect(qIndex, optIndex)}
                                                            className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                                                                isSelected 
                                                                    ? 'border-primary bg-primary/5 text-primary' 
                                                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            <span>{opt}</span>
                                                            {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={handleSubmitQuiz}
                                        className="w-full bg-primary hover:bg-primary-dark text-white font-black text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                    >
                                        <GraduationCap className="w-4 h-4" /> Enviar Cuestionario
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 text-center py-4">
                                    <div className="mx-auto w-12 h-12 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                                        <BookOpen className="w-6 h-6 animate-bounce" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Lectura Obligatoria</h4>
                                        <p className="text-xs text-slate-500 max-w-[240px] mx-auto">
                                            Este documento no tiene evaluación. Por favor ábrelo y léelo con atención. Una vez hecho, confírmalo a continuación.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSubmitQuiz}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" /> Marcar como Leída y Completar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary dark:text-primary-light rounded-2xl">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Mini LMS Interno</h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {isTech ? 'Completa tus capacitaciones y evaluaciones obligatorias' : 'Monitoreo de capacitaciones obligatorias de técnicos'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trainings.map(t => {
                    const isPending = t.estado === 'pendiente' || t.estado === 'en_progreso';
                    const isApproved = t.estado === 'aprobado';
                    const isReproved = t.estado === 'reprobado';

                    return (
                        <div 
                            key={t.id}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow"
                        >
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-2 items-center">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                            isApproved 
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                                                : isReproved 
                                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                                    : t.estado === 'obsoleto'
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                        }`}>
                                            {t.estado === 'pendiente' ? 'Pendiente' : t.estado === 'aprobado' ? 'Aprobado' : t.estado === 'reprobado' ? 'Reprobado' : 'Historial Obsoleto'}
                                        </span>
                                        {t.estado === 'pendiente' && t.document?.versions?.[0]?.versionMayor > 1 && (
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                Nueva Versión
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        v{t.document?.versiones?.[0]?.versionLabel || '1.0'}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-2">{t.titulo}</h4>
                                    {!isTech && (
                                        <p className="text-xs font-bold text-slate-500">Técnico: {t.operator?.nombreCompleto}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Tipo:</span>
                                    <span className="text-slate-800 dark:text-slate-100">
                                        {t.cuestionario && (Array.isArray(t.cuestionario) ? t.cuestionario : JSON.parse(t.cuestionario as string)).length > 0
                                            ? 'Examen Teórico'
                                            : 'Lectura Obligatoria'}
                                    </span>
                                </div>
                                {t.document?.validezMeses && (
                                    <div className="flex justify-between text-xs font-bold text-slate-500">
                                        <span>Periodo Validez:</span>
                                        <span className="text-slate-800 dark:text-slate-100">{t.document.validezMeses} meses</span>
                                    </div>
                                )}
                                {t.fechaFin && (
                                    <div className="flex justify-between text-xs font-bold text-slate-500">
                                        <span>Completado el:</span>
                                        <span className="text-slate-800 dark:text-slate-100">{formatDateInline(t.fechaFin)}</span>
                                    </div>
                                )}
                                {t.puntaje !== null && (
                                    <div className="flex justify-between text-xs font-bold text-slate-500">
                                        <span>Puntaje obtenido:</span>
                                        <span className={`font-black ${isApproved ? 'text-emerald-600' : 'text-red-500'}`}>{Math.round(t.puntaje)}%</span>
                                    </div>
                                )}

                                {(isTech || t.operatorId === user?.id) && (
                                    <button
                                        onClick={() => handleSelectCourse(t)}
                                        className={`w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 mt-2 ${
                                            isApproved 
                                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300' 
                                                : 'bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/10'
                                        }`}
                                    >
                                        {isApproved ? 'Ver Detalles' : 'Iniciar Capacitación'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {trainings.length === 0 && (
                    <div className="col-span-full bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
                        <GraduationCap className="w-12 h-12 mx-auto text-slate-400 mb-3 animate-bounce" />
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">Sin Capacitaciones</h4>
                        <p className="text-xs font-medium text-slate-500 mt-1">No hay cursos ni capacitaciones obligatorias asignadas.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
