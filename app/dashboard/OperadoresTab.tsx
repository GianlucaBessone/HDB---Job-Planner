import { useState, useEffect } from 'react';
import { safeApiRequest } from '@/lib/offline';
import {
    Award, Star, GraduationCap, Clock, AlertTriangle,
    Calendar, CheckCircle, Activity, Heart, ShieldAlert, Sparkles, Loader2, User,
    Check, X, Trash2, FileText, CheckCircle2, Shield, Eye, ThumbsUp, ThumbsDown, Info, Settings
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ScoreConfig {
    enableCompetency: boolean;
    enableCsat: boolean;
    enableAttendance: boolean;
    enableCompliance: boolean;
    enableSafetyPenalty: boolean;
    enableReworkPenalty: boolean;
    enableDelayPenalty: boolean;
    enableOvertimeBonus: boolean;
}

const DEFAULT_SCORE_CONFIG: ScoreConfig = {
    enableCompetency: true,
    enableCsat: true,
    enableAttendance: true,
    enableCompliance: false, // Disabled by default (GPS feature not fully rolled out)
    enableSafetyPenalty: true,
    enableReworkPenalty: true,
    enableDelayPenalty: true,
    enableOvertimeBonus: true,
};

const SCORE_CONFIG_ITEMS: { key: keyof ScoreConfig; label: string; description: string; category: 'base' | 'modifier'; icon: string }[] = [
    { key: 'enableCompetency', label: 'Competencias Técnicas', description: 'Matriz de habilidades ponderada (Peso base: 35%)', category: 'base', icon: '🎓' },
    { key: 'enableCsat', label: 'Opinión Cliente (CSAT/NPS)', description: 'Satisfacción del cliente y encuestas (Peso base: 20%)', category: 'base', icon: '⭐' },
    { key: 'enableAttendance', label: 'Asistencia / Presentismo', description: 'Faltas justificadas e injustificadas (Peso base: 20%)', category: 'base', icon: '📅' },
    { key: 'enableCompliance', label: 'Cumplimiento de Fichaje', description: 'Horas trabajadas vs horas esperadas (Peso base: 25%)', category: 'base', icon: '⏱️' },
    { key: 'enableSafetyPenalty', label: 'Penalidad SST (Seguridad)', description: 'Infracciones de seguridad (-15 pts c/u)', category: 'modifier', icon: '🛡️' },
    { key: 'enableReworkPenalty', label: 'Penalidad Re-Trabajos (FTFR)', description: 'Órdenes repetidas (hasta -30 pts)', category: 'modifier', icon: '🔄' },
    { key: 'enableDelayPenalty', label: 'Penalidad por Demoras', description: 'Retrasos en proyectos (hasta -10 pts)', category: 'modifier', icon: '⏳' },
    { key: 'enableOvertimeBonus', label: 'Bono Horas Extras', description: 'Horas sobre las 180hs mensuales (+pts)', category: 'modifier', icon: '💪' },
];

export default function OperadoresTab() {
    const [scoreboard, setScoreboard] = useState<any[]>([]);
    const [selectedOperator, setSelectedOperator] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [scoreConfig, setScoreConfig] = useState<ScoreConfig>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('scoreConfig');
            if (saved) { try { return { ...DEFAULT_SCORE_CONFIG, ...JSON.parse(saved) }; } catch { } }
        }
        return DEFAULT_SCORE_CONFIG;
    });

    // Competencies and Certificates states
    const [competencies, setCompetencies] = useState<any[]>([]);
    const [loadingCompetencies, setLoadingCompetencies] = useState(false);
    const [certificates, setCertificates] = useState<any[]>([]);
    const [loadingCertificates, setLoadingCertificates] = useState(false);
    const [previewCert, setPreviewCert] = useState<any>(null);
    const [isEditingCert, setIsEditingCert] = useState(false);
    const [editCertData, setEditCertData] = useState<any>({
        nombreCurso: '',
        institucion: '',
        horas: '',
        fechaEmision: '',
        descripcion: '',
        habilidadesRelevantes: '',
        otrasHabilidades: ''
    });

    useEffect(() => {
        // Load current user from local storage
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                setCurrentUser(JSON.parse(stored));
            } catch (e) {
                console.error(e);
            }
        }
        loadScoreboard();
    }, []);

    // Load competencies and certificates when selected operator changes
    useEffect(() => {
        if (selectedOperator?.operatorId) {
            loadOperatorCompetencies(selectedOperator.operatorId);
            loadOperatorCertificates(selectedOperator.operatorId);
        }
    }, [selectedOperator?.operatorId]);

    const isSupervisorOrAdmin =
        currentUser?.role?.toLowerCase() === 'supervisor' ||
        currentUser?.role?.toLowerCase() === 'admin' ||
        currentUser?.role?.toLowerCase() === 'qa';

    const buildFlagParams = (config: ScoreConfig) => {
        const params = new URLSearchParams();
        Object.entries(config).forEach(([k, v]) => {
            if (!v) params.set(k, 'false');
        });
        return params.toString();
    };

    const loadScoreboard = async (config?: ScoreConfig) => {
        setLoading(true);
        try {
            const flagStr = buildFlagParams(config || scoreConfig);
            const url = `/api/dashboard/operator-scoreboard${flagStr ? `?${flagStr}` : ''}`;
            const res = await safeApiRequest(url);
            if (res.ok) {
                const data = await res.json();
                setScoreboard(data);
                if (data.length > 0) {
                    setSelectedOperator(data[0]); // default to first place
                }
            } else {
                showToast('Error al cargar la tabla de puntajes', 'error');
            }
        } catch (e) {
            console.error('Error fetching operator scoreboard:', e);
            showToast('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadOperatorCompetencies = async (operatorId: string, silent = false) => {
        if (!silent) setLoadingCompetencies(true);
        try {
            const res = await safeApiRequest(`/api/dashboard/operator-scoreboard/competencies?operatorId=${operatorId}`);
            if (res.ok) {
                const data = await res.json();
                setCompetencies(data.matrix || []);
            }
        } catch (e) {
            console.error('Error loading competencies:', e);
        } finally {
            if (!silent) setLoadingCompetencies(false);
        }
    };

    const loadOperatorCertificates = async (operatorId: string, silent = false) => {
        if (!silent) setLoadingCertificates(true);
        try {
            const res = await safeApiRequest(`/api/qms/certificados?operatorId=${operatorId}`);
            if (res.ok) {
                const data = await res.json();
                setCertificates(data || []);
            }
        } catch (e) {
            console.error('Error loading certificates:', e);
        } finally {
            if (!silent) setLoadingCertificates(false);
        }
    };

    // Toggle skill manually
    const handleToggleSkill = async (skillName: string, currentlyActive: boolean) => {
        if (!selectedOperator || !isSupervisorOrAdmin) return;
        try {
            const res = await safeApiRequest('/api/dashboard/operator-scoreboard/competencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operatorId: selectedOperator.operatorId,
                    skillName,
                    active: !currentlyActive,
                    userId: currentUser?.id,
                    userName: currentUser?.nombreCompleto
                })
            });

            if (res.ok) {
                showToast(`Competencia actualizada con éxito`, 'success');
                // Reload competencies and scoreboard to update score
                loadOperatorCompetencies(selectedOperator.operatorId, true);
                loadScoreboardSilently();
            } else {
                showToast('Error al actualizar competencia', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        }
    };

    // Approve/Reject skill extracted from external certificate
    const handleApproveCompetency = async (competencyId: string, approve: boolean) => {
        if (!selectedOperator || !isSupervisorOrAdmin) return;
        try {
            const res = await safeApiRequest('/api/dashboard/operator-scoreboard/competencies', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    competencyId,
                    approve,
                    userId: currentUser?.id,
                    userName: currentUser?.nombreCompleto
                })
            });

            if (res.ok) {
                showToast(approve ? 'Habilidad aprobada e incorporada a la matriz' : 'Habilidad rechazada', 'success');
                loadOperatorCompetencies(selectedOperator.operatorId, true);
                loadScoreboardSilently();
            } else {
                showToast('Error al procesar la habilidad', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        }
    };

    // Approve/Reject certificate
    const handleApproveCertificate = async (certificateId: string, approved: boolean) => {
        if (!selectedOperator || !isSupervisorOrAdmin) return;
        try {
            const res = await safeApiRequest('/api/qms/certificados', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: certificateId,
                    estado: approved ? 'aprobado' : 'rechazado',
                    userId: currentUser?.id,
                    userName: currentUser?.nombreCompleto
                })
            });

            if (res.ok) {
                showToast(approved ? 'Certificado aprobado' : 'Certificado rechazado', 'success');
                if (previewCert && previewCert.id === certificateId) {
                    setPreviewCert({ ...previewCert, estado: approved ? 'aprobado' : 'rechazado' });
                }
                loadOperatorCertificates(selectedOperator.operatorId, true);
                loadOperatorCompetencies(selectedOperator.operatorId, true);
                loadScoreboardSilently();
            } else {
                showToast('Error al procesar el certificado', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        }
    };

    // Delete certificate
    const handleDeleteCertificate = async (certificateId: string) => {
        if (!selectedOperator) return;
        if (!confirm('¿Está seguro de que desea eliminar este certificado? Esta acción eliminará también la habilidad sugerida asociada.')) return;

        try {
            const res = await safeApiRequest(`/api/qms/certificados?id=${certificateId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showToast('Certificado eliminado correctamente', 'success');
                if (previewCert && previewCert.id === certificateId) {
                    setPreviewCert(null);
                }
                loadOperatorCertificates(selectedOperator.operatorId, true);
                loadOperatorCompetencies(selectedOperator.operatorId, true);
                loadScoreboardSilently();
            } else {
                showToast('Error al eliminar certificado', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        }
    };

    // Save edited certificate data
    const handleSaveCertEdit = async () => {
        try {
            const res = await safeApiRequest('/api/qms/certificados', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: previewCert.id,
                    estado: previewCert.estado,
                    nombreCurso: editCertData.nombreCurso,
                    institucion: editCertData.institucion,
                    horas: editCertData.horas ? parseFloat(editCertData.horas) : null,
                    fechaEmision: editCertData.fechaEmision ? new Date(editCertData.fechaEmision).toISOString() : null,
                    descripcion: editCertData.descripcion,
                    aiData: {
                        ...previewCert.aiData,
                        habilidadesRelevantes: typeof editCertData.habilidadesRelevantes === 'string'
                            ? editCertData.habilidadesRelevantes.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : editCertData.habilidadesRelevantes,
                        otrasHabilidades: typeof editCertData.otrasHabilidades === 'string'
                            ? editCertData.otrasHabilidades.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : editCertData.otrasHabilidades
                    },
                    userId: currentUser?.id,
                    userName: currentUser?.nombreCompleto
                })
            });

            if (res.ok) {
                showToast('Certificado actualizado con éxito', 'success');
                setIsEditingCert(false);
                const updatedCert = {
                    ...previewCert,
                    ...editCertData,
                    horas: editCertData.horas ? parseFloat(editCertData.horas) : null,
                    aiData: {
                        ...previewCert.aiData,
                        habilidadesRelevantes: typeof editCertData.habilidadesRelevantes === 'string'
                            ? editCertData.habilidadesRelevantes.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : editCertData.habilidadesRelevantes,
                        otrasHabilidades: typeof editCertData.otrasHabilidades === 'string'
                            ? editCertData.otrasHabilidades.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : editCertData.otrasHabilidades
                    }
                };
                setPreviewCert(updatedCert);
                if (selectedOperator?.operatorId) {
                    loadOperatorCertificates(selectedOperator.operatorId, true);
                    loadOperatorCompetencies(selectedOperator.operatorId, true);
                }
            } else {
                showToast('Error al guardar los cambios', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        }
    };

    const loadScoreboardSilently = async (config?: ScoreConfig) => {
        try {
            const flagStr = buildFlagParams(config || scoreConfig);
            const url = `/api/dashboard/operator-scoreboard${flagStr ? `?${flagStr}` : ''}`;
            const res = await safeApiRequest(url);
            if (res.ok) {
                const data = await res.json();
                setScoreboard(data);
                const updatedTech = data.find((tech: any) => tech.operatorId === selectedOperator?.operatorId);
                if (updatedTech) {
                    setSelectedOperator(updatedTech);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleConfig = (key: keyof ScoreConfig) => {
        const updated = { ...scoreConfig, [key]: !scoreConfig[key] };
        setScoreConfig(updated);
        localStorage.setItem('scoreConfig', JSON.stringify(updated));
        loadScoreboardSilently(updated);
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                {/* Header skeleton */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
                    <div className="space-y-2">
                        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                        <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    </div>
                </div>

                {/* Main skeleton grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Sidebar list skeleton */}
                    <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0" />
                                        <div className="space-y-1.5 w-full">
                                            <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded-md" />
                                            <div className="h-2 w-1/3 bg-slate-250 dark:bg-slate-700 rounded-md" />
                                        </div>
                                    </div>
                                    <div className="w-10 h-6 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Details skeleton */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Header card skeleton */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-3xl shrink-0" />
                                <div className="space-y-2">
                                    <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                                    <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                                </div>
                            </div>
                            <div className="w-28 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
                        </div>

                        {/* Metrics grid skeleton */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                                        <div className="w-12 h-3 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
                                        <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50';
        if (score >= 75) return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50';
        if (score >= 60) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50';
        return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50';
    };

    const getScoreRingColor = (score: number) => {
        if (score >= 90) return 'stroke-emerald-500';
        if (score >= 75) return 'stroke-indigo-500';
        if (score >= 60) return 'stroke-amber-500';
        return 'stroke-rose-500';
    };

    // AI Insight Generator
    const getAiInsights = (op: any) => {
        const name = op.operatorName;
        const metrics = op.metrics;
        const score = op.globalScore;

        let diagnosis = '';
        let recommendation = '';

        if (score >= 90) {
            diagnosis = `${name} posee un desempeño sobresaliente en HDB Servicios Eléctricos, liderando el tablero de control de calidad.`;
            recommendation = `SGI Gemini aconseja considerarlo como mentor para nuevos ingresos y asignarle proyectos de alta complejidad técnica.`;
        } else if (metrics.safetyInfractionsCount > 0) {
            diagnosis = `${name} presenta un desvío crítico de seguridad (-${metrics.safetyPenalty} pts) debido a ${metrics.safetyInfractionsCount} infracciones o desvíos detectados en auditorías SST.`;
            recommendation = `SGI Gemini recomienda de manera prioritaria coordinar una re-capacitación en Normativa de Seguridad Eléctrica y uso obligatorio de EPP / LOTO.`;
        } else if (metrics.reworkCount > 0) {
            diagnosis = `${name} registra ${metrics.reworkCount} órdenes de servicio catalogadas como Re-Trabajo (FTFR), afectando negativamente la penalización de calidad.`;
            recommendation = `SGI Gemini sugiere revisar el procedimiento técnico en campo, auditar las órdenes originales y coordinar feedback técnico de mejora continua.`;
        } else if (metrics.absences > 0) {
            const unjustifiedText = metrics.unjustifiedAbsences > 0 ? `${metrics.unjustifiedAbsences} injustificadas` : '';
            const justifiedText = metrics.justifiedAbsences > 0 ? `${metrics.justifiedAbsences} justificadas` : '';
            const combinedText = [unjustifiedText, justifiedText].filter(Boolean).join(' y ');
            diagnosis = `${name} presenta un desvío en el score global debido a inasistencias registradas (${combinedText}).`;
            recommendation = `SGI Gemini sugiere programar una sesión de feedback con su supervisor directo para evaluar justificaciones y reajustar cronogramas en HDB Servicios Eléctricos.`;
        } else if (metrics.csat < 8.5) {
            diagnosis = `Se detecta margen de mejora en las calificaciones CSAT otorgadas por los clientes (${metrics.csat}/10).`;
            recommendation = `SGI Gemini recomienda inscribirlo en las capacitaciones internas de Calidad de Servicio y Habilidades Blandas del Formación LMS.`;
        } else if (metrics.completedTrainings < metrics.totalTrainings) {
            diagnosis = `El score de ${name} está penalizado por tener capacitaciones internas obligatorias aún pendientes de aprobación.`;
            recommendation = `SGI Gemini aconseja enviarle una notificación push automática para recordarle completar sus cuestionarios teóricos antes del vencimiento.`;
        } else {
            diagnosis = `${name} muestra un rendimiento sólido e íntegro en sus fichajes y trabajos técnicos.`;
            recommendation = `SGI Gemini sugiere continuar con el monitoreo preventivo estándar en el panel general de HDB SGI.`;
        }

        return { diagnosis, recommendation };
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-600 rounded-2xl text-white shadow-lg shadow-violet-200">
                        <Award className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Score de Operadores</h3>
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                            Evaluación integral de competencias · Capacitaciones · Desempeño y Asistencia
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all shadow-sm"
                    >
                        <Settings className="w-4 h-4" />
                        Configuración
                    </button>
                    <button
                        onClick={() => setShowAuditModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-2xl transition-all shadow-sm"
                    >
                        <Info className="w-4 h-4" />
                        Fórmula & Auditoría SGC
                    </button>
                </div>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* LEFT COLUMN: The Leaderboard */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wider">Ranking de Técnicos</h4>
                    <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                        {scoreboard.map((op, index) => {
                            const isSelected = selectedOperator?.operatorId === op.operatorId;
                            const isPodium = index < 3;
                            const scoreClass = getScoreColor(op.globalScore);

                            return (
                                <button
                                    key={op.operatorId}
                                    onClick={() => setSelectedOperator(op)}
                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${isSelected
                                            ? 'bg-slate-900 border-transparent text-white dark:bg-slate-100 dark:text-slate-950 shadow-md'
                                            : 'bg-slate-50/50 hover:bg-white dark:hover:bg-slate-800/80 border-slate-100 dark:border-slate-850 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Rank Badge */}
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isPodium
                                                ? index === 0
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : index === 1
                                                        ? 'bg-slate-200 text-slate-700'
                                                        : 'bg-amber-100 text-amber-800'
                                                : isSelected
                                                    ? 'bg-slate-800 text-slate-300 dark:bg-slate-200 dark:text-slate-700'
                                                    : 'bg-slate-200/60 text-slate-500'
                                            }`}>
                                            {index + 1}
                                        </div>

                                        <div className="min-w-0">
                                            <p className={`font-black text-xs truncate ${isSelected ? 'text-white dark:text-slate-950' : 'text-slate-800 dark:text-slate-100'}`}>
                                                {op.operatorName}
                                            </p>
                                            <p className={`text-[10px] font-medium truncate ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {op.role}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Global Score pill */}
                                    <div className={`px-2.5 py-1 rounded-xl border text-[11px] font-black tracking-tighter ${scoreClass} shrink-0`}>
                                        {op.globalScore} pts
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT COLUMN: Operator details */}
                <div className="lg:col-span-8 space-y-6">
                    {selectedOperator ? (
                        <>
                            {/* Operator Overview card */}
                            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-black shrink-0">
                                        {selectedOperator.operatorName.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                                                {selectedOperator.operatorName}
                                            </h3>
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                            {selectedOperator.role} · HDB Servicios Eléctricos
                                        </p>
                                    </div>
                                </div>

                                {/* Circular score indicator */}
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/80">
                                    <div className="relative w-16 h-16">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                            <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                            <circle cx="18" cy="18" r="16" fill="none"
                                                className={`transition-all duration-700 ${getScoreRingColor(selectedOperator.globalScore)}`}
                                                strokeWidth="3"
                                                strokeDasharray={`${selectedOperator.globalScore}, 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-sm text-slate-800 dark:text-slate-100">
                                            {selectedOperator.globalScore}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Score Global</p>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Nivel: {
                                            selectedOperator.globalScore >= 90 ? 'Excelente' :
                                                selectedOperator.globalScore >= 75 ? 'Destacado' :
                                                    selectedOperator.globalScore >= 60 ? 'Regular' : 'A mejorar'
                                        }</p>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Breakdown Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

                                {/* CSAT Client Score */}
                                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                                            <Star className="w-5 h-5" fill="currentColor" />
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            Opinión Cliente
                                            {!scoreConfig.enableCsat && (
                                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[8px] py-0.5 px-1.5 rounded-full uppercase tracking-wider font-extrabold ml-1">Neutro</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Satisfacción CSAT</p>
                                        <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                            {scoreConfig.enableCsat ? `${selectedOperator.metrics.csat} / 10` : '10 / 10'}
                                        </h4>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full mt-2.5 overflow-hidden">
                                            <div className="h-full bg-amber-500 rounded-full" style={{ width: scoreConfig.enableCsat ? `${selectedOperator.metrics.csat * 10}%` : '100%' }} />
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                        <span>NPS: {scoreConfig.enableCsat ? (selectedOperator.metrics.nps >= 0 ? `+${selectedOperator.metrics.nps}` : selectedOperator.metrics.nps) : '+100'}</span>
                                        <span>{selectedOperator.metrics.surveysCount} encuestas</span>
                                    </div>
                                </div>

                                {/* Competency Score */}
                                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                            <GraduationCap className="w-5 h-5" />
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            Competencias
                                            {!scoreConfig.enableCompetency && (
                                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[8px] py-0.5 px-1.5 rounded-full uppercase tracking-wider font-extrabold ml-1">Neutro</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Score Matriz</p>
                                        <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                            {scoreConfig.enableCompetency ? `${selectedOperator.metrics.competencyScore || 0}%` : '100%'}
                                        </h4>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full mt-2.5 overflow-hidden">
                                            <div className="h-full bg-indigo-600 rounded-full"
                                                style={{ width: scoreConfig.enableCompetency ? `${selectedOperator.metrics.competencyScore || 0}%` : '100%' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                        <span>LMS e Internas:</span>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedOperator.metrics.completedTrainings} / {selectedOperator.metrics.totalTrainings}</span>
                                    </div>
                                </div>

                                {/* Punch-in Compliance and worked hours */}
                                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                            <Activity className="w-5 h-5" />
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            Asistencia
                                            {(!scoreConfig.enableAttendance || !scoreConfig.enableCompliance) && (
                                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[8px] py-0.5 px-1.5 rounded-full uppercase tracking-wider font-extrabold ml-1">
                                                    {!scoreConfig.enableAttendance && !scoreConfig.enableCompliance ? 'Desact.' : !scoreConfig.enableAttendance ? 'Asist. Desact.' : 'Fich. Desact.'}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cumplimiento Fichaje</p>
                                        <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                            {scoreConfig.enableCompliance ? `${selectedOperator.metrics.timeCompliance}%` : '100%'}
                                        </h4>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full mt-2.5 overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: scoreConfig.enableCompliance ? `${selectedOperator.metrics.timeCompliance}%` : '100%' }} />
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/50 flex flex-col gap-1 text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                        <div className="flex justify-between">
                                            <span>Faltas Injustificadas:</span>
                                            <span className={`font-black ${selectedOperator.metrics.unjustifiedAbsences > 0 && scoreConfig.enableAttendance ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {scoreConfig.enableAttendance ? (selectedOperator.metrics.unjustifiedAbsences || 0) : '0 (Desact.)'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Faltas Justificadas:</span>
                                            <span className={`font-black ${selectedOperator.metrics.justifiedAbsences > 0 && scoreConfig.enableAttendance ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {scoreConfig.enableAttendance ? (selectedOperator.metrics.justifiedAbsences || 0) : '0 (Desact.)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Hours Workload & Recompense */}
                                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl">
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            Carga Horaria
                                            {!scoreConfig.enableOvertimeBonus && (
                                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[8px] py-0.5 px-1.5 rounded-full uppercase tracking-wider font-extrabold ml-1">Bono Desact.</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Horas Confirmadas</p>
                                        <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                            {selectedOperator.metrics.totalWorkedHours || 0} hs
                                        </h4>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full mt-2.5 overflow-hidden">
                                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, ((selectedOperator.metrics.totalWorkedHours || 0) / 180) * 100)}%` }} />
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                        <span>Bono Carga:</span>
                                        <span className="font-black text-emerald-500">
                                            {scoreConfig.enableOvertimeBonus ? `+${selectedOperator.metrics.hoursRewardBonus} pts` : '0 pts (Desact.)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Safety Audits Card */}
                                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className={`p-2 rounded-xl ${selectedOperator.metrics.safetyInfractionsCount > 0 && scoreConfig.enableSafetyPenalty ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                                            {selectedOperator.metrics.safetyInfractionsCount > 0 && scoreConfig.enableSafetyPenalty ? <ShieldAlert className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            Seguridad SST
                                            {!scoreConfig.enableSafetyPenalty && (
                                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[8px] py-0.5 px-1.5 rounded-full uppercase tracking-wider font-extrabold ml-1">Desact.</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Auditorías SST</p>
                                        <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                            {selectedOperator.metrics.safetyInfractionsCount > 0 && scoreConfig.enableSafetyPenalty ? `${selectedOperator.metrics.safetyInfractionsCount} Desvíos` : 'Sin desvíos'}
                                        </h4>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full mt-2.5 overflow-hidden">
                                            <div className={`h-full rounded-full ${selectedOperator.metrics.safetyInfractionsCount > 0 && scoreConfig.enableSafetyPenalty ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(0, 100 - (scoreConfig.enableSafetyPenalty ? (selectedOperator.metrics.safetyPenalty || 0) : 0))}%` }} />
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                        <span>Penalidad SST:</span>
                                        <span className={`font-black ${selectedOperator.metrics.safetyPenalty > 0 && scoreConfig.enableSafetyPenalty ? 'text-rose-500' : 'text-slate-500'}`}>
                                            {scoreConfig.enableSafetyPenalty ? `-${selectedOperator.metrics.safetyPenalty || 0} pts` : '0 pts (Desact.)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Rework (FTFR) Card */}
                                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className={`p-2 rounded-xl ${selectedOperator.metrics.reworkCount > 0 && scoreConfig.enableReworkPenalty ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                                            {selectedOperator.metrics.reworkCount > 0 && scoreConfig.enableReworkPenalty ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            Re-Trabajos
                                            {!scoreConfig.enableReworkPenalty && (
                                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[8px] py-0.5 px-1.5 rounded-full uppercase tracking-wider font-extrabold ml-1">Desact.</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ratio FTFR</p>
                                        <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                            {selectedOperator.metrics.reworkCount || 0} OS
                                        </h4>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full mt-2.5 overflow-hidden">
                                            <div className={`h-full rounded-full ${selectedOperator.metrics.reworkCount > 0 && scoreConfig.enableReworkPenalty ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(0, 100 - (scoreConfig.enableReworkPenalty ? (selectedOperator.metrics.reworkPenalty || 0) : 0))}%` }} />
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                        <span>Penalidad FTFR:</span>
                                        <span className={`font-black ${selectedOperator.metrics.reworkPenalty > 0 && scoreConfig.enableReworkPenalty ? 'text-rose-500' : 'text-slate-500'}`}>
                                            {scoreConfig.enableReworkPenalty ? `-${selectedOperator.metrics.reworkPenalty || 0} pts` : '0 pts (Desact.)'}
                                        </span>
                                    </div>
                                </div>

                            </div>

                            {/* Gemini AI Smart Insight Card */}
                            {(() => {
                                const insights = getAiInsights(selectedOperator);
                                return (
                                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                                        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-gradient opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500" />

                                        <div className="space-y-4 relative">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-5 h-5 text-yellow-300 animate-spin-slow" />
                                                <h4 className="font-black text-sm uppercase tracking-wider">Diagnóstico IA · HDB SGI</h4>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-sm font-bold text-indigo-100 leading-relaxed">
                                                    {insights.diagnosis}
                                                </p>
                                                <div className="bg-white/10 dark:bg-black/20 p-4 rounded-2xl border border-white/10">
                                                    <span className="block text-[10px] font-black text-yellow-300 uppercase tracking-widest mb-1">Recomendación Sugerida</span>
                                                    <p className="text-xs font-semibold leading-relaxed text-slate-100">
                                                        {insights.recommendation}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Competencies Matrix Panel */}
                            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                                <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">Matriz de Competencias (Habilidades)</h4>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                                            Pesos del score global · LMS · Certificados Externos · Supervisor
                                        </p>
                                    </div>
                                    <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black">
                                        Peso Total: {selectedOperator.metrics.competencyScore}% del Score de Matriz
                                    </div>
                                </div>

                                {loadingCompetencies ? (
                                    <div className="flex justify-center items-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {competencies.map((skill: any) => {
                                            const isActive = skill.status === 'vigente';
                                            const isPending = skill.status === 'pendiente';

                                            return (
                                                <div key={skill.name} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-sm transition-all">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-sm text-slate-800 dark:text-slate-100">{skill.name}</span>
                                                            <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                                                Peso: {skill.weight}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                                            Categoría: {skill.category}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider ${isActive
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                    : isPending
                                                                        ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse'
                                                                        : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800/40 dark:text-slate-500'
                                                                }`}>
                                                                {skill.status === 'vigente' ? 'Vigente' : skill.status === 'pendiente' ? 'Pendiente' : 'Inactiva'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                                {skill.source}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions / Toggles */}
                                                    <div>
                                                        {isPending && isSupervisorOrAdmin ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleApproveCompetency(skill.id, true)}
                                                                    className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl transition-colors shadow-sm"
                                                                    title="Aprobar habilidad"
                                                                >
                                                                    <ThumbsUp className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApproveCompetency(skill.id, false)}
                                                                    className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl transition-colors shadow-sm"
                                                                    title="Rechazar habilidad"
                                                                >
                                                                    <ThumbsDown className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : skill.source.startsWith('LMS') ? (
                                                            <span title="Validado automáticamente por LMS">
                                                                <Shield className="w-5 h-5 text-indigo-500/50" />
                                                            </span>
                                                        ) : isSupervisorOrAdmin ? (
                                                            <button
                                                                onClick={() => handleToggleSkill(skill.name, isActive)}
                                                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 focus:outline-none ${isActive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                                                                    }`}
                                                            >
                                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out transform ${isActive ? 'translate-x-6' : 'translate-x-0'
                                                                    }`} />
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-400">Solo Supervisor</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* External Certificates Management Panel */}
                            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                                <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">Certificados Externos Presentados</h4>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                                        Validación y control de acreditaciones de capacitación externa
                                    </p>
                                </div>

                                {loadingCertificates ? (
                                    <div className="flex justify-center items-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                    </div>
                                ) : certificates.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                                        <FileText className="w-12 h-12 mx-auto text-slate-350 dark:text-slate-700 mb-2" />
                                        <p className="text-sm font-bold">No hay certificados externos cargados</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {certificates.map((cert) => {
                                            const aiData = cert.aiData || {};
                                            return (
                                                <div key={cert.id} className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in duration-200">
                                                    <div className="space-y-1.5 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h5 className="font-black text-sm text-slate-800 dark:text-slate-100">{cert.nombreCurso}</h5>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider ${cert.estado === 'aprobado'
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                    : cert.estado === 'rechazado'
                                                                        ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'
                                                                        : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse'
                                                                }`}>
                                                                {cert.estado === 'pendiente' ? 'Pendiente' : cert.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                            Emitido por: <span className="font-bold text-slate-700 dark:text-slate-300">{cert.institucion}</span>
                                                        </p>
                                                        <div className="flex gap-4 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                            {cert.horas && <span>Duración: {cert.horas} hs</span>}
                                                            {cert.fechaEmision && (
                                                                <span>
                                                                    Emisión: {(() => {
                                                                        const d = new Date(cert.fechaEmision);
                                                                        return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
                                                                    })()}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Description snippet */}
                                                        {cert.descripcion && (
                                                            <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-100/50 dark:bg-slate-900/30 p-2 rounded-xl border border-slate-150 dark:border-slate-800/30 mt-1 max-w-2xl line-clamp-2">
                                                                "{cert.descripcion}"
                                                            </p>
                                                        )}

                                                        {/* AI Extraction Info */}
                                                        {((aiData.habilidadesRelevantes && aiData.habilidadesRelevantes.length > 0) || 
                                                          (aiData.otrasHabilidades && aiData.otrasHabilidades.length > 0)) && (
                                                            <div className="mt-2 p-3 bg-violet-500/10 dark:bg-violet-950/20 rounded-xl border border-violet-100 dark:border-violet-900/40 text-xs text-violet-700 dark:text-violet-300">
                                                                <span className="font-black text-[9px] uppercase tracking-widest block text-violet-600 dark:text-violet-400 mb-1">Extracción Gemini AI</span>
                                                                {aiData.habilidadesRelevantes && aiData.habilidadesRelevantes.length > 0 && (
                                                                    <div className="mb-1">
                                                                        <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider block">Habilidades Relevantes</span>
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {aiData.habilidadesRelevantes.map((hab: string, idx: number) => (
                                                                                <span key={idx} className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded text-[9px] font-bold">{hab}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {aiData.otrasHabilidades && aiData.otrasHabilidades.length > 0 && (
                                                                    <div className="mt-1.5">
                                                                        <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider block">Otras Habilidades</span>
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {aiData.otrasHabilidades.map((hab: string, idx: number) => (
                                                                                <span key={idx} className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 rounded text-[9px] font-bold">{hab}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Certificate Actions */}
                                                    <div className="flex items-center gap-2 self-end md:self-auto">
                                                        <button
                                                            onClick={() => {
                                                                setPreviewCert(cert);
                                                                setEditCertData({
                                                                    nombreCurso: cert.nombreCurso || '',
                                                                    institucion: cert.institucion || '',
                                                                    horas: cert.horas || '',
                                                                    fechaEmision: cert.fechaEmision ? cert.fechaEmision.split('T')[0] : '',
                                                                    descripcion: cert.descripcion || '',
                                                                    habilidadesRelevantes: cert.aiData?.habilidadesRelevantes?.join(', ') || '',
                                                                    otrasHabilidades: cert.aiData?.otrasHabilidades?.join(', ') || ''
                                                                });
                                                                setIsEditingCert(false);
                                                            }}
                                                            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl transition-colors shadow-sm"
                                                            title="Ver detalles y archivo"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>

                                                        {cert.estado === 'pendiente' && isSupervisorOrAdmin && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleApproveCertificate(cert.id, true)}
                                                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-colors shadow-sm"
                                                                >
                                                                    Aprobar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApproveCertificate(cert.id, false)}
                                                                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black rounded-xl transition-colors shadow-sm"
                                                                >
                                                                    Rechazar
                                                                </button>
                                                            </>
                                                        )}

                                                        <button
                                                            onClick={() => handleDeleteCertificate(cert.id)}
                                                            className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-xl transition-colors shadow-sm"
                                                            title="Eliminar certificado"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-64 flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] text-slate-500">
                            <User className="w-12 h-12 text-slate-400 mb-3" />
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">Seleccione un Operador</h4>
                            <p className="text-xs font-medium text-slate-500 mt-1">Haga clic en un técnico del ranking para analizar su perfil de competencias.</p>
                        </div>
                    )}
                </div>

            </div>

            {/* Detailed Certificate preview modal */}
            {previewCert && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex justify-center items-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[85vh] rounded-[2.5rem] overflow-hidden flex flex-col border border-slate-105 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
                            <div>
                                <h4 className="font-black text-slate-850 dark:text-slate-100 text-sm md:text-base">{previewCert.nombreCurso}</h4>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">SGI Acreditaciones</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                                    previewCert.estado === 'aprobado'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400'
                                        : previewCert.estado === 'rechazado'
                                            ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'
                                            : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse'
                                }`}>
                                    {previewCert.estado === 'pendiente' ? 'Pendiente' : previewCert.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                                </span>
                                <button
                                    onClick={() => { setPreviewCert(null); setIsEditingCert(false); }}
                                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Left Column: Iframe/Image file viewer */}
                            <div className="flex-1 bg-slate-100 dark:bg-slate-900 p-4 flex justify-center items-center overflow-auto min-h-[300px] md:min-h-0">
                                {previewCert.archivoUrl ? (
                                    previewCert.archivoUrl.startsWith('data:application/pdf') || previewCert.archivoUrl.endsWith('.pdf') ? (
                                        <iframe src={previewCert.archivoUrl} className="w-full h-full rounded-2xl border-0" />
                                    ) : (
                                        <img src={previewCert.archivoUrl} alt="Certificado" className="max-w-full max-h-full rounded-2xl shadow-md object-contain" />
                                    )
                                ) : (
                                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 text-xs">
                                        Vista previa no soportada para este formato de archivo.
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Metadata & AI details & Actions */}
                            <div className="w-full md:w-[450px] border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 overflow-y-auto flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5" /> Datos del Certificado
                                        </p>
                                        {previewCert.estado !== 'aprobado' && !isEditingCert && isSupervisorOrAdmin && (
                                            <button 
                                                onClick={() => setIsEditingCert(true)} 
                                                className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                            >
                                                Editar Datos
                                            </button>
                                        )}
                                    </div>

                                    {isEditingCert ? (
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">Curso / Título</label>
                                                <input type="text" value={editCertData.nombreCurso} onChange={(e) => setEditCertData({...editCertData, nombreCurso: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-750 dark:text-slate-250 focus:outline-none focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">Institución</label>
                                                <input type="text" value={editCertData.institucion} onChange={(e) => setEditCertData({...editCertData, institucion: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-755 dark:text-slate-250 focus:outline-none focus:border-indigo-500" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500">Horas</label>
                                                    <input type="number" step="any" value={editCertData.horas} onChange={(e) => setEditCertData({...editCertData, horas: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-760 dark:text-slate-250 focus:outline-none focus:border-indigo-500" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500">Fecha Emisión</label>
                                                    <input type="date" value={editCertData.fechaEmision} onChange={(e) => setEditCertData({...editCertData, fechaEmision: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-765 dark:text-slate-250 focus:outline-none focus:border-indigo-500" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">Descripción / Resumen</label>
                                                <textarea value={editCertData.descripcion} onChange={(e) => setEditCertData({...editCertData, descripcion: e.target.value})} className="w-full h-20 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-770 dark:text-slate-250 focus:outline-none focus:border-indigo-500 resize-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">Habilidades Relevantes (separadas por coma)</label>
                                                <input type="text" value={editCertData.habilidadesRelevantes} onChange={(e) => setEditCertData({...editCertData, habilidadesRelevantes: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-775 dark:text-slate-250 focus:outline-none focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">Otras Habilidades (separadas por coma)</label>
                                                <input type="text" value={editCertData.otrasHabilidades} onChange={(e) => setEditCertData({...editCertData, otrasHabilidades: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-780 dark:text-slate-250 focus:outline-none focus:border-indigo-500" />
                                            </div>
                                            <div className="flex gap-2 justify-end pt-2">
                                                <button onClick={() => setIsEditingCert(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancelar</button>
                                                <button onClick={handleSaveCertEdit} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1">
                                                    <Check className="w-3.5 h-3.5" /> Guardar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 text-xs">
                                            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Curso:</p>
                                                    <p className="font-bold text-slate-850 dark:text-slate-250">{previewCert.nombreCurso || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Institución:</p>
                                                    <p className="font-bold text-slate-850 dark:text-slate-250">{previewCert.institucion || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Horas:</p>
                                                    <p className="font-bold text-slate-850 dark:text-slate-250">{previewCert.horas || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Fecha Emisión:</p>
                                                    <p className="font-bold text-slate-850 dark:text-slate-250">
                                                        {previewCert.fechaEmision 
                                                            ? (() => {
                                                                const d = new Date(previewCert.fechaEmision);
                                                                return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
                                                            })() 
                                                            : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Description / Resumen view */}
                                            <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Descripción / Resumen:</p>
                                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">{previewCert.descripcion || 'Sin descripción'}</p>
                                            </div>

                                            {/* AI Data Skills */}
                                            {previewCert.aiData && (
                                                <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                                    <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest block">Extracción Gemini AI</p>
                                                    
                                                    {previewCert.aiData.habilidadesRelevantes?.length > 0 && (
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Habilidades Relevantes</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {previewCert.aiData.habilidadesRelevantes.map((hab: string, i: number) => (
                                                                    <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 text-[10px] font-bold rounded-lg">{hab}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {previewCert.aiData.otrasHabilidades?.length > 0 && (
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Otras Habilidades</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {previewCert.aiData.otrasHabilidades.map((hab: string, i: number) => (
                                                                    <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40 text-[10px] font-bold rounded-lg">{hab}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Actions */}
                                {!isEditingCert && (
                                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center gap-3">
                                        {previewCert.estado === 'pendiente' && isSupervisorOrAdmin ? (
                                            <div className="flex gap-2 w-full">
                                                <button
                                                    onClick={() => handleApproveCertificate(previewCert.id, true)}
                                                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-colors shadow-sm text-center"
                                                >
                                                    Aprobar
                                                </button>
                                                <button
                                                    onClick={() => handleApproveCertificate(previewCert.id, false)}
                                                    className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black rounded-xl transition-colors shadow-sm text-center"
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 font-bold uppercase italic">
                                                Certificado procesado
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleDeleteCertificate(previewCert.id)}
                                            className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-xl transition-colors shadow-sm self-end"
                                            title="Eliminar certificado"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SGC ISO9001 Audit Modal */}
            {showAuditModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 rounded-xl">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-850 dark:text-slate-100 text-lg">Cálculo del Score - Auditoría ISO 9001</h4>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                                        Procedimiento Registrado del SGC · HDB Servicios Eléctricos
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAuditModal(false)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700 dark:text-slate-300">

                            {/* Summary/Introduction */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                                <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-250 tracking-wider">Objetivo del Procedimiento</h5>
                                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                    Este módulo calcula automáticamente el desempeño global de los técnicos y operadores de campo de HDB Servicios Eléctricos. El sistema consolida datos operativos, capacitaciones homologadas e inasistencias en base mensual para asegurar el cumplimiento del estándar de calidad ISO 9001 y la trazabilidad del personal.
                                </p>
                            </div>

                            {/* Main Pillars */}
                            <div className="space-y-4">
                                <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-3 bg-violet-600 rounded-full" />
                                    Pilar Base: Score de Desempeño (100 Puntos Máximos)
                                </h5>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Competencies */}
                                    <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">1. Matriz Competencias (35%)</span>
                                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-[10px] font-black rounded-lg">Peso: 35%</span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                            Evalúa las habilidades técnicas validadas y vigentes en el mes. El sistema valora la especialización, midiendo el peso acumulado contra una meta base de 25 puntos (perfil especialista), permitiendo que técnicos enfocados alcancen el 100% sin ser penalizados por no poseer la totalidad de las 8 disciplinas posibles.
                                        </p>
                                        <div className="text-[10px] bg-white dark:bg-slate-900 p-2 rounded-xl border border-indigo-100/30 dark:border-slate-800 font-mono text-slate-500">
                                            Score = Min(100, Round((Sumatoria_Pesos_Activos / Meta_Especialista_25) * 100))
                                        </div>
                                    </div>

                                    {/* Client Surveys */}
                                    <div className="p-4 bg-amber-50/30 dark:bg-amber-950/10 rounded-2xl border border-amber-100/50 dark:border-amber-900/30 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">2. Encuestas Cliente (20%)</span>
                                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-black rounded-lg">Peso: 20%</span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                            Combina la satisfacción CSAT (promedio de atención, calidad y tiempo del cliente, escala 1-10) y el impacto NPS. Promotores (9-10) otorgan 100 pts, Pasivos (7-8) 70 pts y Detractores (0-6) 0 pts.
                                        </p>
                                        <div className="text-[10px] bg-white dark:bg-slate-900 p-2 rounded-xl border border-amber-100/30 dark:border-slate-800 font-mono text-slate-500">
                                            Score = (CSAT * 10 * 0.70) + (Avg_NPS_Impact * 0.30)
                                        </div>
                                    </div>

                                    {/* Attendance */}
                                    <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">3. Asistencia Neutra (20%)</span>
                                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-lg">Peso: 20%</span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                            Calcula la presencia efectiva sobre días hábiles. Las faltas justificadas (médicas, licencias) no penalizan y se restan de los días laborables del mes. Las faltas injustificadas reducen de forma matemáticamente proporcional la tasa de cumplimiento del pilar de asistencia.
                                        </p>
                                        <div className="text-[10px] bg-white dark:bg-slate-900 p-2 rounded-xl border border-emerald-100/30 dark:border-slate-800 font-mono text-slate-500">
                                            Asistencia = ((Hábiles - Justificadas - Injustificadas) / (Hábiles - Justificadas)) * 100
                                        </div>
                                    </div>

                                    {/* Time Compliance */}
                                    <div className="p-4 bg-sky-50/30 dark:bg-sky-950/10 rounded-2xl border border-sky-100/50 dark:border-sky-900/30 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-black text-sky-700 dark:text-sky-400 uppercase tracking-wider">4. Cumplimiento Horario (25%)</span>
                                            <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 text-[10px] font-black rounded-lg">Peso: 25%</span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                            Evalúa la precisión y consistencia del registro de jornada. Descuenta puntos si hay fichadas sospechosas y aplica una penalización (máx 20 pts) si la discrepancia entre horas declaradas manualmente y horas registradas por fichador automático supera el 15%.
                                        </p>
                                        <div className="text-[10px] bg-white dark:bg-slate-900 p-2 rounded-xl border border-sky-100/30 dark:border-slate-800 font-mono text-slate-500">
                                            Score = 100 - (% Suspicious * 100) - Penalidad_Discrepancia
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modifiers and Penalties */}
                            <div className="space-y-4">
                                <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-3 bg-violet-600 rounded-full" />
                                    Modificadores Directos (Bonos y Penalidades)
                                </h5>

                                <div className="space-y-2.5">
                                    {/* Bonus horas extras */}
                                    <div className="flex items-start gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                        <span className="mt-0.5 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-black rounded-md uppercase tracking-wider shrink-0">Bono +</span>
                                        <div>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">Productividad por Carga Horaria</span>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Se otorga +1 punto por cada 2 horas de trabajo confirmadas que excedan las 180 horas mensuales, hasta un máximo de +15 puntos globales.</p>
                                        </div>
                                    </div>

                                    {/* Penalidad Demoras */}
                                    <div className="flex items-start gap-3 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                                        <span className="mt-0.5 px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-350 text-[9px] font-black rounded-md uppercase tracking-wider shrink-0">Descuento -</span>
                                        <div>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">Desvíos y Demoras de Proyectos (Máx: -10 pts)</span>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Descuenta 0.2 puntos por cada hora de demora en los proyectos en los que el operador participó activamente durante el período.</p>
                                        </div>
                                    </div>

                                    {/* Penalidad Seguridad */}
                                    <div className="flex items-start gap-3 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                                        <span className="mt-0.5 px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-350 text-[9px] font-black rounded-md uppercase tracking-wider shrink-0">Descuento -</span>
                                        <div>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">Infracciones de Seguridad SST (Sin Límite)</span>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Cada desvío crítico de seguridad reportado (EPP incompleto, no aplicación de bloqueo LOTO o incumplimiento de normativas como NFPA 70E) penaliza directamente con -15 puntos globales.</p>
                                        </div>
                                    </div>

                                    {/* Penalidad Re-Trabajos */}
                                    <div className="flex items-start gap-3 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                                        <span className="mt-0.5 px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-350 text-[9px] font-black rounded-md uppercase tracking-wider shrink-0">Descuento -</span>
                                        <div>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">Tasa de Retrabajos (FTFR - First Time Fix Rate)</span>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Penalización progresiva según la cantidad de órdenes de servicio repetidas (retrabajo): 1 retrabajo = -5 pts, 2 retrabajos = -15 pts, 3 o más = -30 pts globales.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Consolidated score explanation */}
                            <div className="bg-slate-900 text-white rounded-[2rem] p-6 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-yellow-400" />
                                    <h5 className="text-xs font-black uppercase tracking-wider">Cálculo del Score Global Consolidado</h5>
                                </div>
                                <div className="text-center py-4 bg-black/30 rounded-2xl border border-white/5 font-mono text-xs text-yellow-300">
                                    Score Global = Max( 10, Min( 100, BaseScore + BonoHoras - PenalidadDemoras - PenalidadSeguridad - PenalidadRetrabajo ) )
                                </div>
                                <div className="text-xs leading-relaxed text-slate-350 space-y-1">
                                    <p>• El **BaseScore** es la suma ponderada: `Competencias*0.35 + Encuestas*0.20 + Asistencia*0.20 + Cumplimiento*0.25`.</p>
                                    <p>• El puntaje final resultante se redondea al entero más cercano y se encuentra acotado en el intervalo **[10, 100]**.</p>
                                    <p>• Los datos son auditales mediante el historial de auditorías de seguridad, partes de horas validados por supervisores, encuestas directas de clientes e historial de aprobaciones del LMS.</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50/50 dark:bg-slate-900/40">
                            <button
                                onClick={() => setShowAuditModal(false)}
                                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-black rounded-xl transition-colors shadow-sm"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCORE CONFIG MODAL */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl">
                                    <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">Configuración del Score</h2>
                                    <p className="text-[10px] text-slate-400">Activa o desactiva componentes del cálculo global</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Base Components */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Componentes Base del Score</p>
                                <p className="text-[10px] text-slate-400">Al desactivar un componente, se ignora su cálculo y se asume un valor neutro (100%)</p>
                                <div className="space-y-2">
                                    {SCORE_CONFIG_ITEMS.filter(i => i.category === 'base').map(item => (
                                        <div key={item.key} className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                                            scoreConfig[item.key]
                                                ? 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                                                : 'bg-slate-50 dark:bg-slate-900/80 border-slate-100 dark:border-slate-800 opacity-60'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{item.icon}</span>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.label}</p>
                                                    <p className="text-[10px] text-slate-400">{item.description}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleToggleConfig(item.key)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                                    scoreConfig[item.key] ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                                                }`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                                    scoreConfig[item.key] ? 'translate-x-5' : 'translate-x-0'
                                                }`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Modifiers */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Modificadores (Bonos y Penalidades)</p>
                                <p className="text-[10px] text-slate-400">Se aplican después del cálculo base</p>
                                <div className="space-y-2">
                                    {SCORE_CONFIG_ITEMS.filter(i => i.category === 'modifier').map(item => (
                                        <div key={item.key} className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                                            scoreConfig[item.key]
                                                ? 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                                                : 'bg-slate-50 dark:bg-slate-900/80 border-slate-100 dark:border-slate-800 opacity-60'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{item.icon}</span>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.label}</p>
                                                    <p className="text-[10px] text-slate-400">{item.description}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleToggleConfig(item.key)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                                    scoreConfig[item.key] ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                                                }`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                                    scoreConfig[item.key] ? 'translate-x-5' : 'translate-x-0'
                                                }`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Active summary */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Resumen Activo</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {SCORE_CONFIG_ITEMS.map(item => (
                                        <span key={item.key} className={`px-2 py-1 text-[10px] font-bold rounded-lg ${
                                            scoreConfig[item.key]
                                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-600 line-through'
                                        }`}>
                                            {item.icon} {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50/50 dark:bg-slate-900/40">
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-black rounded-xl transition-colors shadow-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
