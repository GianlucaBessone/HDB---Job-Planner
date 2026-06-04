import { useState, useEffect, useRef } from "react";
import { safeApiRequest } from "@/lib/offline";
import { formatDateInline } from "@/lib/formatDate";
import {
  BookOpen,
  Award,
  CheckCircle2,
  XCircle,
  Play,
  ArrowLeft,
  HelpCircle,
  GraduationCap,
  Clock,
  Check,
  Sparkles,
  Loader2,
  X,
  Calendar,
  Landmark,
  Eye,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  Edit,
  FileText,
  Timer,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { showToast } from "@/components/Toast";

let cachedLmsTrainings: any[] | null = null;
let cachedLmsCerts: any[] | null = null;

export default function LmsTab({ user }: { user: any }) {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const timerRef = useRef<any>(null);

  // AI Training quiz generator states
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiData, setAiData] = useState({
    documentId: "",
    operatorId: "",
    cantidadPreguntas: 5,
    nivelDificultad: "intermedio",
  });
  const [docs, setDocs] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [generatingTraining, setGeneratingTraining] = useState(false);

  // Supervisor External Certificates states
  const [supervisorTab, setSupervisorTab] = useState<"internal" | "external">(
    "internal",
  );
  const [externalCerts, setExternalCerts] = useState<any[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [certFilter, setCertFilter] = useState<
    "all" | "pendiente" | "aprobado" | "rechazado"
  >("all");

  // Verification Form States
  const [certNombreCurso, setCertNombreCurso] = useState("");
  const [certInstitucion, setCertInstitucion] = useState("");
  const [certHoras, setCertHoras] = useState<string | number>("");
  const [certFechaEmision, setCertFechaEmision] = useState("");
  const [validatingCert, setValidatingCert] = useState(false);

  const isTech = !(
    user?.role?.toLowerCase() === "admin" ||
    user?.role?.toLowerCase() === "supervisor" ||
    user?.role?.toLowerCase() === "qa"
  );

  useEffect(() => {
    loadTrainings();
    if (!isTech) {
      loadExternalCerts();
    }
  }, [isTech]);

  useEffect(() => {
    if (
      activeCourse &&
      activeCourse.estado !== "aprobado" &&
      !quizResult &&
      quizStarted
    ) {
      setSeconds((prev) => prev + 0); // Keep timer running from current point
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCourse, quizResult, quizStarted]);

  const loadTrainings = async () => {
    let showLoader = true;
    if (cachedLmsTrainings) {
      setTrainings(cachedLmsTrainings);
      showLoader = false;
    }
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const url = isTech
        ? `/api/qms/capacitaciones?operatorId=${user.id}`
        : "/api/qms/capacitaciones";
      const res = await safeApiRequest(url);
      if (res.ok) {
        const data = await res.json();
        cachedLmsTrainings = data;
        setTrainings(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExternalCerts = async () => {
    let showLoader = true;
    if (cachedLmsCerts) {
      setExternalCerts(cachedLmsCerts);
      showLoader = false;
    }
    if (showLoader) {
      setLoadingCerts(true);
    }
    try {
      const res = await safeApiRequest("/api/qms/certificados");
      if (res.ok) {
        const data = await res.json();
        cachedLmsCerts = data;
        setExternalCerts(data);
      }
    } catch (e) {
      console.error("Error loading external certs:", e);
    } finally {
      setLoadingCerts(false);
    }
  };

  const openAiModal = async () => {
    setIsAiModalOpen(true);
    try {
      const [docRes, opRes] = await Promise.all([
        safeApiRequest("/api/documentos"),
        safeApiRequest("/api/operators"),
      ]);
      if (docRes.ok) {
        const docData = await docRes.json();
        setDocs(docData.filter((d: any) => d.estado === "vigente"));
      }
      if (opRes.ok) setOperators(await opRes.json());
    } catch (e) {
      console.error("Error fetching data for AI modal:", e);
    }
  };

  const handleGenerateTraining = async () => {
    if (!aiData.documentId) {
      return showToast("Debe seleccionar un documento controlado", "error");
    }
    if (!aiData.operatorId) {
      return showToast("Debe seleccionar un técnico u operador", "error");
    }

    setGeneratingTraining(true);
    try {
      const res = await fetch("/api/ai/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: aiData.documentId,
          operatorId: aiData.operatorId,
          cantidadPreguntas: Number(aiData.cantidadPreguntas),
          nivelDificultad: aiData.nivelDificultad,
          userId: user.id,
          userName: user.nombreCompleto,
          userRole: user.role || "ADMIN",
          saveAsTraining: true,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success && result.trainingDb) {
        showToast(
          "Capacitación y Cuestionario IA asignados con éxito",
          "success",
        );
        setIsAiModalOpen(false);
        loadTrainings();
      } else {
        showToast(
          result.error || "Error al generar material de capacitación",
          "error",
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Error de conexión al generar capacitación", "error");
    } finally {
      setGeneratingTraining(false);
    }
  };

  const handleSelectCourse = (course: any) => {
    setActiveCourse(course);
    setAnswers({});
    setQuizResult(null);
    setQuizStarted(false);
    setSeconds(0);
  };

  const handleAnswerSelect = (qIndex: number, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qIndex]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    const quiz = activeCourse.cuestionario
      ? Array.isArray(activeCourse.cuestionario)
        ? activeCourse.cuestionario
        : JSON.parse(activeCourse.cuestionario as string)
      : [];
    if (quiz.length > 0 && Object.keys(answers).length < quiz.length) {
      alert("Por favor, responde todas las preguntas del cuestionario.");
      return;
    }

    try {
      const res = await safeApiRequest("/api/qms/capacitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeCourse.id,
          respuestas: answers,
          tiempoInvertido: seconds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuizResult(data);
        loadTrainings();
      } else {
        alert("Error al enviar la evaluación.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openValidationModal = (cert: any) => {
    setSelectedCert(cert);
    setCertNombreCurso(cert.nombreCurso || "");
    setCertInstitucion(cert.institucion || "");
    setCertHoras(cert.horas || "");
    setCertFechaEmision(
      cert.fechaEmision ? cert.fechaEmision.split("T")[0] : "",
    );
  };

  const handleValidateCertificate = async (
    estado: "aprobado" | "rechazado",
  ) => {
    if (!selectedCert) return;
    setValidatingCert(true);
    try {
      const res = await safeApiRequest("/api/qms/certificados", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCert.id,
          estado,
          nombreCurso: certNombreCurso,
          institucion: certInstitucion,
          horas: certHoras ? Number(certHoras) : null,
          fechaEmision: certFechaEmision || null,
          userId: user.id,
          userName: user.nombreCompleto,
        }),
      });

      if (res.ok) {
        showToast(
          `Certificado ${estado === "aprobado" ? "aprobado" : "rechazado"} con éxito`,
          "success",
        );
        setSelectedCert(null);
        loadExternalCerts();
      } else {
        const err = await res.json();
        showToast(err.error || "Error al validar el certificado", "error");
      }
    } catch (e) {
      showToast("Error de conexión", "error");
    } finally {
      setValidatingCert(false);
    }
  };

  const filteredCerts = externalCerts.filter((c) => {
    if (certFilter === "all") return true;
    return c.estado === certFilter;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (activeCourse) {
    const quiz = activeCourse.cuestionario
      ? Array.isArray(activeCourse.cuestionario)
        ? activeCourse.cuestionario
        : JSON.parse(activeCourse.cuestionario as string)
      : [];
    const isApproved = activeCourse.estado === "aprobado";
    const isReproved = activeCourse.estado === "reprobado";
    const isObsolete = activeCourse.estado === "obsoleto";
    const isCompleted = isApproved || isReproved || isObsolete;

    // Parse answers
    const userAnswers = activeCourse.respuestas
      ? typeof activeCourse.respuestas === "string"
        ? (() => {
            try {
              return JSON.parse(activeCourse.respuestas);
            } catch (e) {
              return {};
            }
          })()
        : activeCourse.respuestas
      : {};

    // Expiration calculations
    const validezMeses = activeCourse.document?.validezMeses || null;
    const fechaFinObj = activeCourse.fechaFin
      ? new Date(activeCourse.fechaFin)
      : null;
    const fechaVencimiento =
      fechaFinObj && validezMeses
        ? new Date(
            fechaFinObj.getFullYear(),
            fechaFinObj.getMonth() + validezMeses,
            fechaFinObj.getDate(),
          )
        : null;

    // Skills / tags
    const docTags = activeCourse.document?.tags
      ? Array.isArray(activeCourse.document.tags)
        ? activeCourse.document.tags
        : (() => {
            try {
              return JSON.parse(activeCourse.document.tags as string);
            } catch (e) {
              return [];
            }
          })()
      : [];

    // PDF file mapping
    const pdfFile =
      activeCourse.document?.versions?.[0]?.files?.find(
        (f: any) => f.esPrincipal,
      ) || activeCourse.document?.versions?.[0]?.files?.[0];
    const documentUrl = pdfFile?.url || activeCourse.urlContenido;
    const hasDocumentFile =
      !!pdfFile ||
      (!!activeCourse.urlContenido &&
        !activeCourse.urlContenido.includes("/download"));

    const getYoutubeEmbedUrl = (url: string) => {
      if (!url) return "";
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2] && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
      if (url.includes("youtube.com/watch?v=")) {
        const parts = url.split("v=");
        if (parts[1]) {
          const id = parts[1].split("&")[0];
          return `https://www.youtube.com/embed/${id}`;
        }
      }
      return url;
    };

    // Duration string helper
    const formatDuration = (secs: number | null) => {
      if (secs === null || secs === undefined) return "N/D";
      if (secs < 60) return `${secs} segundos`;
      const mins = Math.floor(secs / 60);
      const remainder = secs % 60;
      return `${mins} min ${remainder} seg`;
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button
          onClick={() => {
            setActiveCourse(null);
            setQuizResult(null);
            setAnswers({});
          }}
          className="flex items-center gap-2 text-sm font-black text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a capacitaciones
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Material / Study or General Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary dark:text-primary-light px-2.5 py-1 rounded-full">
                    {isCompleted
                      ? "Detalle de la Capacitación"
                      : "Material de Estudio"}
                  </span>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {activeCourse.titulo}
                  </h3>
                  {activeCourse.document?.codigoDocumental && (
                    <p className="text-xs font-bold text-slate-400">
                      Código de Documento:{" "}
                      {activeCourse.document.codigoDocumental}
                    </p>
                  )}
                </div>
                {!isCompleted && quizStarted && (
                  <div className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-800">
                    <Clock className="w-4 h-4 text-primary animate-pulse" />
                    <span>
                      {Math.floor(seconds / 60)}:
                      {(seconds % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                )}
              </div>

              {!isCompleted && (
                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                  Por favor, estudia detenidamente el siguiente procedimiento
                  controlado antes de responder el cuestionario de suficiencia
                  teórica obligatorio.
                </p>
              )}

              {/* Study Material Viewer */}
              {(() => {
                const doc = activeCourse.document;
                const digitalData =
                  typeof doc?.descripcion === "string"
                    ? (() => {
                        try {
                          return JSON.parse(doc.descripcion);
                        } catch (e) {
                          return null;
                        }
                      })()
                    : doc?.descripcion;
                const isDigital = digitalData?.isDigital === true;

                if (isDigital && digitalData) {
                  const ytUrl = digitalData.videoUrl
                    ? getYoutubeEmbedUrl(digitalData.videoUrl)
                    : "";

                  return (
                    <div className="space-y-4">
                      {ytUrl && (
                        <div className="bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
                          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
                            <Play className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-slate-300">
                              Video de Capacitación
                            </span>
                          </div>
                          <div
                            className="relative w-full"
                            style={{ paddingBottom: "56.25%" }}
                          >
                            <iframe
                              src={ytUrl}
                              allow="autoplay; encrypted-media"
                              allowFullScreen
                              className="absolute inset-0 w-full h-full border-0"
                            />
                          </div>
                        </div>
                      )}

                      {[
                        { title: "Objetivo", content: digitalData.objetivo },
                        { title: "Alcance", content: digitalData.alcance },
                        {
                          title: "Desarrollo",
                          content: digitalData.desarrollo,
                        },
                        {
                          title: "Responsabilidades",
                          content: digitalData.responsabilidades,
                        },
                      ]
                        .filter((s) => s.content)
                        .map((section, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800"
                          >
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
                              {section.title}
                            </p>
                            <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {section.content}
                            </p>
                          </div>
                        ))}
                    </div>
                  );
                } else if (pdfFile) {
                  return (
                    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-900">
                      <iframe
                        src={pdfFile.url}
                        className="absolute inset-0 w-full h-full border-0"
                        title="Visor PDF"
                      />
                    </div>
                  );
                }

                return (
                  <div className="aspect-video bg-slate-950 rounded-2xl flex flex-col items-center justify-center border border-slate-800 p-6 text-center space-y-4">
                    <BookOpen className="w-16 h-16 text-primary animate-pulse" />
                    <div>
                      <h4 className="text-base font-black text-white">
                        {activeCourse.document?.titulo || activeCourse.titulo}
                      </h4>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        Procedimiento de Calidad QMS • PDF Oficial Autorizado
                      </p>
                      {documentUrl &&
                        (hasDocumentFile ? (
                          <a
                            href={documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-primary hover:bg-primary-dark text-white font-black text-xs px-6 py-3 rounded-full transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" /> Abrir Documento
                            Controlado
                          </a>
                        ) : (
                          <button
                            disabled
                            className="bg-slate-800 text-slate-500 border border-slate-700 font-black text-xs px-6 py-3 rounded-full cursor-not-allowed flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" /> Sin Documento
                            Adjunto
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Column 3: Quiz/Evaluation Form or Results */}
          <div className="space-y-6">
            {isCompleted ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Resultado de Evaluación
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                        isApproved
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                          : isReproved
                            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isReproved ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {isApproved
                        ? "Aprobado"
                        : isReproved
                          ? "Reprobado"
                          : "Obsoleto"}
                    </span>
                  </div>
                </div>

                {typeof activeCourse.puntaje === "number" && (
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-slate-100 dark:text-slate-800"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={251.2}
                          strokeDashoffset={
                            251.2 - (251.2 * (activeCourse.puntaje || 0)) / 100
                          }
                          className={
                            isApproved ? "text-emerald-500" : "text-red-500"
                          }
                        />
                      </svg>
                      <span className="absolute text-xl font-black text-slate-800 dark:text-slate-100">
                        {Math.round(activeCourse.puntaje)}%
                      </span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">
                      Porcentaje obtenido
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                      Mínimo aprobado: {activeCourse.puntajeMinimo}%
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                  {fechaFinObj && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400">
                        Fecha Completado:
                      </span>
                      <span className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateInline(fechaFinObj)}
                      </span>
                    </div>
                  )}
                  {validezMeses && (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-400">
                          Periodo Validez:
                        </span>
                        <span className="font-black text-slate-700 dark:text-slate-200">
                          {validezMeses} meses
                        </span>
                      </div>
                      {fechaVencimiento && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400">
                            Vencimiento:
                          </span>
                          <span
                            className={`font-black flex items-center gap-1 ${
                              new Date() > fechaVencimiento
                                ? "text-red-500 font-bold"
                                : "text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateInline(fechaVencimiento)}
                            {new Date() > fechaVencimiento && " (Vencido)"}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400">
                      Tiempo de Evaluación:
                    </span>
                    <span className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-slate-400" />
                      {formatDuration(activeCourse.tiempoInvertido)}
                    </span>
                  </div>
                </div>

                {documentUrl && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Documento Relacionado
                    </span>
                    {hasDocumentFile ? (
                      <a
                        href={documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black rounded-xl transition-all border border-slate-200/50 dark:border-slate-600"
                      >
                        <FileText className="w-4 h-4" />
                        Ver Documento de Calidad
                      </a>
                    ) : (
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-xs font-black rounded-xl cursor-not-allowed border border-slate-100 dark:border-slate-700/50"
                      >
                        <FileText className="w-4 h-4" />
                        Sin Documento Adjunto
                      </button>
                    )}
                  </div>
                )}

                {docTags.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Habilidades Validadas
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {docTags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30 flex items-center gap-1"
                        >
                          <ShieldAlert className="w-3 h-3 text-indigo-500" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {quiz.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Revisión de Evaluación
                    </span>
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                      {quiz.map((q: any, qIndex: number) => {
                        const selectedOptIdx = userAnswers[qIndex];
                        const correctOptIdx = q.correctAnswerIndex;
                        const isCorrect =
                          Number(selectedOptIdx) === Number(correctOptIdx);

                        return (
                          <div
                            key={qIndex}
                            className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5"
                          >
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {qIndex + 1}. {q.question}
                            </p>
                            <div className="space-y-1.5">
                              {q.options.map(
                                (opt: string, optIndex: number) => {
                                  const isSelected =
                                    Number(selectedOptIdx) === optIndex;
                                  const isCorrectOption =
                                    Number(correctOptIdx) === optIndex;

                                  return (
                                    <div
                                      key={optIndex}
                                      className={`p-2 rounded-xl text-[11px] font-medium flex items-center justify-between border ${
                                        isSelected
                                          ? isCorrect
                                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                                            : "bg-red-50 dark:bg-red-950/20 border-red-500 text-red-700 dark:text-red-400"
                                          : isCorrectOption
                                            ? "bg-emerald-50/55 dark:bg-emerald-950/15 border-emerald-300 text-emerald-700 dark:text-emerald-450 border-dashed"
                                            : "bg-transparent border-slate-100 dark:border-slate-850 text-slate-500 dark:text-slate-400"
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {isSelected &&
                                        (isCorrect ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        ) : (
                                          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                        ))}
                                      {!isSelected && isCorrectOption && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-450/80 shrink-0" />
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                <div className="space-y-1">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      quiz.length > 0
                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                        : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {quiz.length > 0
                      ? "Examen de Suficiencia"
                      : "Confirmación de Lectura"}
                  </span>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {quiz.length > 0
                      ? "Cuestionario QMS"
                      : "Conformidad de Documento"}
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
                          <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                            ¡Completado!
                          </h4>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                            Has completado la capacitación con éxito. Tu
                            competencia técnica ha sido actualizada a "Vigente".
                          </p>
                        </div>
                        {quiz.length > 0 && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl">
                            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
                              {Math.round(quizResult.score)}%
                            </p>
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">
                              Score Obtenido
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                          <XCircle className="w-10 h-10" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-red-600 dark:text-red-400">
                            Desaprobado
                          </h4>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                            Tu puntaje no alcanzó el mínimo requerido (
                            {activeCourse.puntajeMinimo}%). Por favor repasa el
                            documento e inténtalo nuevamente.
                          </p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl">
                          <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
                            {Math.round(quizResult.score)}%
                          </p>
                          <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mt-1">
                            Score Obtenido
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setQuizResult(null);
                            setQuizStarted(false);
                            setSeconds(0);
                          }}
                          className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 font-black text-xs py-3 rounded-xl transition-all"
                        >
                          Intentar de Nuevo
                        </button>
                      </div>
                    )}
                  </div>
                ) : quiz.length > 0 ? (
                  !quizStarted ? (
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center space-y-6">
                      <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                        <Award className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                          Evaluación Obligatoria
                        </h3>
                        <p className="text-xs text-slate-500 mt-2">
                          Lea atentamente el documento en el panel izquierdo
                          antes de iniciar. Una vez iniciada la evaluación, el
                          tiempo comenzará a correr y deberá completar todas las
                          preguntas.
                        </p>
                      </div>
                      <button
                        onClick={() => setQuizStarted(true)}
                        className="w-full bg-primary hover:bg-primary-dark text-white py-3.5 rounded-xl font-black text-xs transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" /> Comenzar Evaluación (
                        {quiz.length} preguntas)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in zoom-in-95 duration-300">
                      {quiz.map((q: any, qIndex: number) => (
                        <div key={qIndex} className="space-y-3">
                          <p className="text-xs font-black text-slate-700 dark:text-slate-200 flex gap-2">
                            <span className="text-primary font-black">
                              {qIndex + 1}.
                            </span>{" "}
                            {q.question}
                          </p>
                          <div className="space-y-2">
                            {q.options.map((opt: string, optIndex: number) => {
                              const isSelected = answers[qIndex] === optIndex;
                              return (
                                <button
                                  key={optIndex}
                                  onClick={() =>
                                    handleAnswerSelect(qIndex, optIndex)
                                  }
                                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                                    isSelected
                                      ? "border-primary bg-primary/5 text-primary"
                                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-primary shrink-0" />
                                  )}
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
                        <GraduationCap className="w-4 h-4" /> Enviar
                        Cuestionario
                      </button>
                    </div>
                  )
                ) : (
                  <div className="space-y-6 text-center py-4">
                    <div className="mx-auto w-12 h-12 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                      <BookOpen className="w-6 h-6 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Lectura Obligatoria
                      </h4>
                      <p className="text-xs text-slate-500 max-w-[240px] mx-auto">
                        Este documento no tiene evaluación. Por favor ábrelo y
                        léelo con atención. Una vez hecho, confírmalo a
                        continuación.
                      </p>
                    </div>
                    <button
                      onClick={handleSubmitQuiz}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Marcar como Leída y
                      Completar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Box */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary dark:text-primary-light rounded-2xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
              {!isTech
                ? "Formación y Certificaciones"
                : "Centro de Formación Integral"}
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isTech
                ? "Completa tus capacitaciones y evalúa tus competencias"
                : "Gestión y validación de planes de formación y certificados de operadores"}
            </p>
          </div>
        </div>
        {!isTech && (
          <button
            onClick={openAiModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:opacity-95 transition-all active:scale-95 shadow-md shadow-indigo-500/20"
          >
            <Sparkles className="w-4 h-4" /> Asignar con IA
          </button>
        )}
      </div>

      {/* Tabs for Supervisor Mode */}
      {!isTech && (
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setSupervisorTab("internal")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
              supervisorTab === "internal"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Capacitaciones Obligatorias
          </button>
          <button
            onClick={() => setSupervisorTab("external")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
              supervisorTab === "external"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Award className="w-4 h-4" />
            Validar Certificados Externos (
            {externalCerts.filter((c) => c.estado === "pendiente").length}{" "}
            pendientes)
          </button>
        </div>
      )}

      {/* TAB 1: INTERNAL REQUIRED TRAININGS */}
      {(isTech || supervisorTab === "internal") && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainings.map((t) => {
            const isPending =
              t.estado === "pendiente" || t.estado === "en_progreso";
            const isApproved = t.estado === "aprobado";
            const isReproved = t.estado === "reprobado";

            return (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2 items-center">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          isApproved
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                            : isReproved
                              ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                              : t.estado === "obsoleto"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {t.estado === "pendiente"
                          ? "Pendiente"
                          : t.estado === "aprobado"
                            ? "Aprobado"
                            : t.estado === "reprobado"
                              ? "Reprobado"
                              : "Historial Obsoleto"}
                      </span>
                      {t.estado === "pendiente" &&
                        t.document?.versions?.[0]?.versionMayor > 1 && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            Nueva Versión
                          </span>
                        )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      v{t.document?.versions?.[0]?.versionLabel || "1.0"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-2">
                      {t.titulo}
                    </h4>
                    {!isTech && (
                      <p className="text-xs font-bold text-slate-500">
                        Técnico: {t.operator?.nombreCompleto}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Tipo:</span>
                    <span className="text-slate-800 dark:text-slate-100">
                      {t.cuestionario &&
                      (Array.isArray(t.cuestionario)
                        ? t.cuestionario
                        : JSON.parse(t.cuestionario as string)
                      ).length > 0
                        ? "Examen Teórico"
                        : "Lectura Obligatoria"}
                    </span>
                  </div>
                  {t.document?.validezMeses && (
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Periodo Validez:</span>
                      <span className="text-slate-800 dark:text-slate-100">
                        {t.document.validezMeses} meses
                      </span>
                    </div>
                  )}
                  {t.fechaFin && (
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Completado el:</span>
                      <span className="text-slate-800 dark:text-slate-100">
                        {formatDateInline(t.fechaFin)}
                      </span>
                    </div>
                  )}
                  {typeof t.puntaje === "number" && (
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Puntaje obtenido:</span>
                      <span
                        className={`font-black ${isApproved ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {Math.round(t.puntaje)}%
                      </span>
                    </div>
                  )}

                  {(isTech || t.operatorId === user?.id) && (
                    <button
                      onClick={() => handleSelectCourse(t)}
                      className={`w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 mt-2 ${
                        isApproved
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                          : "bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/10"
                      }`}
                    >
                      {isApproved ? "Ver Detalles" : "Iniciar Capacitación"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {trainings.length === 0 && (
            <div className="col-span-full bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
              <GraduationCap className="w-12 h-12 mx-auto text-slate-400 mb-3 animate-bounce" />
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">
                Sin Capacitaciones
              </h4>
              <p className="text-xs font-medium text-slate-500 mt-1">
                No hay cursos ni capacitaciones obligatorias asignadas
                actualmente.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXTERNAL CERTIFICATE VALIDATION */}
      {!isTech && supervisorTab === "external" && (
        <div className="space-y-6">
          {/* Filters Toolbar */}
          <div className="flex flex-wrap gap-2">
            {["all", "pendiente", "aprobado", "rechazado"].map((filterVal) => (
              <button
                key={filterVal}
                onClick={() => setCertFilter(filterVal as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  certFilter === filterVal
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {filterVal === "all" && "Todos"}
                {filterVal === "pendiente" && "Pendientes"}
                {filterVal === "aprobado" && "Aprobados"}
                {filterVal === "rechazado" && "Rechazados"}
              </button>
            ))}
          </div>

          {/* Certs Grid */}
          {loadingCerts ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : filteredCerts.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
              <Award className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">
                Sin Certificados
              </h4>
              <p className="text-xs font-medium text-slate-500 mt-1">
                No se encontraron certificados externos en esta categoría.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCerts.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          cert.estado === "aprobado"
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                            : cert.estado === "rechazado"
                              ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                              : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {cert.estado === "pendiente"
                          ? "Pendiente"
                          : cert.estado === "aprobado"
                            ? "Aprobado"
                            : "Rechazado"}
                      </span>
                      {cert.aiData && (
                        <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" /> IA
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-2">
                        {cert.nombreCurso}
                      </h4>
                      <p className="text-xs font-bold text-slate-500">
                        Presentado por: {cert.operator?.nombreCompleto}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Landmark className="w-3 h-3" />
                        <span>{cert.institucion}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Horas:</span>
                      <span className="text-slate-800 dark:text-slate-100">
                        {cert.horas ? `${cert.horas} hs` : "N/D"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Fecha de Emisión:</span>
                      <span className="text-slate-800 dark:text-slate-100">
                        {cert.fechaEmision
                          ? new Date(cert.fechaEmision).toLocaleDateString()
                          : "N/D"}
                      </span>
                    </div>

                    <button
                      onClick={() => openValidationModal(cert)}
                      className="w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 mt-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/10"
                    >
                      <Eye className="w-4 h-4" /> Examinar y Validar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUPERVISOR VALIDATION DETAIL MODAL */}
      {selectedCert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-700">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                  Examinar y Validar Certificado
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Operador: {selectedCert.operator?.nombreCompleto}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!validatingCert) setSelectedCert(null);
                }}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                disabled={validatingCert}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Body Layout */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2">
              {/* Left Column: Document File Preview */}
              <div className="p-6 border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col justify-center min-h-[300px]">
                {selectedCert.archivoUrl &&
                selectedCert.archivoUrl.startsWith("data:image/") ? (
                  <img
                    src={selectedCert.archivoUrl}
                    alt="Certificado"
                    className="max-w-full max-h-[50vh] object-contain mx-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                  />
                ) : selectedCert.archivoUrl &&
                  selectedCert.archivoUrl.startsWith("data:application/pdf") ? (
                  <iframe
                    src={selectedCert.archivoUrl}
                    className="w-full h-[50vh] rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="p-8 text-center bg-slate-100 dark:bg-slate-900 rounded-2xl text-slate-400 text-xs">
                    No hay vista previa disponible o el formato no es
                    compatible.
                  </div>
                )}
              </div>

              {/* Right Column: Editable Metadata Fields */}
              <div className="p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  {selectedCert.aiData && (
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/50">
                      <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5" /> Metadatos del
                        Análisis de IA Gemini
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Gemini ha escaneado la imagen/PDF y extrajo la siguiente
                        información del certificado. Puede corregir cualquier
                        campo a continuación.
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">
                      Nombre del Curso
                    </label>
                    <input
                      type="text"
                      value={certNombreCurso}
                      onChange={(e) => setCertNombreCurso(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      disabled={validatingCert}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">
                      Institución
                    </label>
                    <input
                      type="text"
                      value={certInstitucion}
                      onChange={(e) => setCertInstitucion(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      disabled={validatingCert}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">
                        Duración (Horas)
                      </label>
                      <input
                        type="number"
                        value={certHoras}
                        onChange={(e) => setCertHoras(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        disabled={validatingCert}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">
                        Fecha de Emisión
                      </label>
                      <input
                        type="date"
                        value={certFechaEmision}
                        onChange={(e) => setCertFechaEmision(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        disabled={validatingCert}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Descripción Original:
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      {selectedCert.descripcion ||
                        "Sin descripción provista por el operador."}
                    </p>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedCert(null)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                    disabled={validatingCert}
                  >
                    Cerrar
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleValidateCertificate("rechazado")}
                      disabled={validatingCert}
                      className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleValidateCertificate("aprobado")}
                      disabled={validatingCert}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Aprobar y Guardar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Training Quiz Builder Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col my-8 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-indigo-500" />
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">
                  Diseñar Cuestionario con Gemini
                </h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Documento Controlado (Vigente) *
                </label>
                <select
                  value={aiData.documentId}
                  onChange={(e) =>
                    setAiData({ ...aiData, documentId: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[44px] text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Seleccione un documento...</option>
                  {docs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      [{doc.codigoDocumental}] {doc.titulo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Asignar al Técnico / Operador *
                </label>
                <select
                  value={aiData.operatorId}
                  onChange={(e) =>
                    setAiData({ ...aiData, operatorId: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[44px] text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Seleccione un técnico...</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nombreCompleto}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Número de Preguntas
                  </label>
                  <select
                    value={aiData.cantidadPreguntas}
                    onChange={(e) =>
                      setAiData({
                        ...aiData,
                        cantidadPreguntas: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[44px] text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="3">3 Preguntas</option>
                    <option value="5">5 Preguntas</option>
                    <option value="8">8 Preguntas</option>
                    <option value="10">10 Preguntas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Nivel de Dificultad
                  </label>
                  <select
                    value={aiData.nivelDificultad}
                    onChange={(e) =>
                      setAiData({ ...aiData, nivelDificultad: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[44px] text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="facil">Fácil</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerateTraining}
                disabled={generatingTraining}
                className="px-5 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-95 transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                {generatingTraining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando Cuestionario...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generar y Asignar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
