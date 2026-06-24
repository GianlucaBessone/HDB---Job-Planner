"use client";

import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  FileText,
  Download,
  Award,
  ChevronRight,
  X,
  Loader2,
  ShieldAlert,
  UploadCloud,
  Plus,
  Calendar,
  Landmark,
  Eye,
  CheckCircle,
  HelpCircle,
  Trash2,
  GraduationCap,
} from "lucide-react";
import { safeApiRequest } from "@/lib/offline";
import { showToast } from "@/components/Toast";
import ModuleHeader from "@/components/ModuleHeader";
import SignatureButton from "@/components/SignatureButton";

export default function CapacitacionPage() {
  const [user, setUser] = useState<any>(null);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"internal" | "external">(
    "internal",
  );

  // Internal Training States
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [docDetail, setDocDetail] = useState<any>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail" | "quiz">("list");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  // External Certificate States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [certFileBase64, setCertFileBase64] = useState<string>("");
  const [certFileName, setCertFileName] = useState("");
  const [certFileType, setCertFileType] = useState("");
  const [manualNombreCurso, setManualNombreCurso] = useState("");
  const [manualInstitucion, setManualInstitucion] = useState("");
  const [manualDescripcion, setManualDescripcion] = useState("");
  const [analyzingCert, setAnalyzingCert] = useState(false);
  const [previewCert, setPreviewCert] = useState<any>(null);
  const [isEditingCert, setIsEditingCert] = useState(false);
  const [editCertData, setEditCertData] = useState<any>({});

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadTrainings();
      loadCertificates();
    }
  }, [user]);

  useEffect(() => {
    if (viewMode === "quiz" && selectedTraining && !quizResult) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewMode, selectedTraining, quizResult]);

  const loadTrainings = async () => {
    setLoading(true);
    try {
      const res = await safeApiRequest(
        `/api/qms/capacitaciones?operatorId=${user.id}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTrainings(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async () => {
    if (!user?.id) return;
    try {
      const res = await safeApiRequest(
        `/api/qms/certificados?operatorId=${user.id}`,
      );
      if (res.ok) {
        const data = await res.json();
        setCertificates(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openTraining = async (training: any) => {
    setSelectedTraining(training);
    setQuizAnswers({});
    setQuizResult(null);
    setSeconds(0);
    setLoadingDoc(true);
    setViewMode("detail");
    try {
      const res = await safeApiRequest(
        `/api/documentos/${training.documentId}`,
      );
      if (res.ok) setDocDetail(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDoc(false);
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([^#&?]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  };

  const handleSubmitQuiz = async (signatureId: string) => {
    if (!selectedTraining) return;
    setSubmitting(true);
    try {
      const res = await safeApiRequest("/api/qms/capacitaciones", {
        method: "POST",
        body: JSON.stringify({
          id: selectedTraining.id,
          respuestas: quizAnswers,
          tiempoInvertido: seconds,
          signatureId
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setQuizResult(result);
        showToast(
          result.approved
            ? "¡Capacitación aprobada!"
            : "No alcanzó el puntaje mínimo",
          result.approved ? "success" : "error",
        );
        loadTrainings();
      } else {
        const err = await res.json();
        showToast(err.error || "Error al enviar evaluación", "error");
      }
    } catch (e: any) {
      showToast("Error de red", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsRead = async (signatureId: string) => {
    if (!selectedTraining) return;
    setSubmitting(true);
    try {
      const res = await safeApiRequest("/api/qms/capacitaciones", {
        method: "POST",
        body: JSON.stringify({ id: selectedTraining.id, respuestas: {}, signatureId }),
      });
      if (res.ok) {
        showToast("Capacitación marcada como leída y completada", "success");
        setQuizResult({ approved: true, score: 100 });
        loadTrainings();
      }
    } catch (e: any) {
      showToast("Error de red", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size check (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast("El archivo no debe superar los 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCertFileBase64(reader.result as string);
      setCertFileName(file.name);
      setCertFileType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certFileBase64) {
      showToast("Seleccione un archivo de certificado", "error");
      return;
    }

    setAnalyzingCert(true);
    try {
      const res = await safeApiRequest("/api/qms/certificados", {
        method: "POST",
        body: JSON.stringify({
          operatorId: user.id,
          nombreCurso: manualNombreCurso,
          institucion: manualInstitucion,
          descripcion: manualDescripcion,
          archivoUrl: certFileBase64,
          fileType: certFileType,
          runAiAnalysis: true,
        }),
      });

      if (res.ok) {
        showToast("Certificado subido y analizado por IA con éxito", "success");
        setIsUploadModalOpen(false);
        setCertFileBase64("");
        setCertFileName("");
        setCertFileType("");
        setManualNombreCurso("");
        setManualInstitucion("");
        setManualDescripcion("");
        loadCertificates();
      } else {
        const err = await res.json();
        showToast(err.error || "Error al subir el certificado", "error");
      }
    } catch (error) {
      showToast("Error de conexión", "error");
    } finally {
      setAnalyzingCert(false);
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    if (
      !confirm(
        "¿Seguro que desea eliminar este certificado? Esta acción no se puede deshacer.",
      )
    )
      return;

    try {
      const res = await safeApiRequest(`/api/qms/certificados?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Certificado eliminado exitosamente", "success");
        loadCertificates();
        if (previewCert?.id === id) setPreviewCert(null);
      } else {
        const err = await res.json();
        showToast(err.error || "Error al eliminar certificado", "error");
      }
    } catch (error) {
      showToast("Error de red al intentar eliminar", "error");
    }
  };

  const handleSaveCertEdit = async () => {
    try {
      const res = await safeApiRequest("/api/qms/certificados", {
        method: "PUT",
        body: JSON.stringify({
          id: previewCert.id,
          estado: previewCert.estado,
          nombreCurso: editCertData.nombreCurso,
          institucion: editCertData.institucion,
          descripcion: editCertData.descripcion,
          horas: editCertData.horas ? Number(editCertData.horas) : null,
          fechaEmision: editCertData.fechaEmision || null,
          userId: user.id,
          userName: user.nombreCompleto,
        }),
      });
      if (res.ok) {
        showToast("Datos del certificado actualizados", "success");
        setIsEditingCert(false);
        setPreviewCert({ ...previewCert, ...editCertData });
        loadCertificates();
      } else {
        showToast("Error al actualizar datos", "error");
      }
    } catch (error) {
      showToast("Error de red", "error");
    }
  };

  const pendingCount = trainings.filter((t) => t.estado === "pendiente").length;
  const approvedCount = trainings.filter((t) => t.estado === "aprobado").length;
  const failedCount = trainings.filter((t) => t.estado === "reprobado").length;

  // Parse digital data from document description
  let digitalData: any = null;
  if (docDetail?.descripcion) {
    try {
      const parsed = JSON.parse(docDetail.descripcion);
      if (parsed.isDigital) digitalData = parsed;
    } catch (e) {}
  }

  const quiz = selectedTraining?.cuestionario
    ? Array.isArray(selectedTraining.cuestionario)
      ? selectedTraining.cuestionario
      : JSON.parse(selectedTraining.cuestionario)
    : [];
  const hasQuiz = quiz.length > 0;
  const youtubeUrl = digitalData?.videoUrl
    ? getYoutubeEmbedUrl(digitalData.videoUrl)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // DETAIL / QUIZ VIEW (for QMS / LMS trainings)
  if (viewMode !== "list" && selectedTraining) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setViewMode("list");
              setSelectedTraining(null);
              setDocDetail(null);
              setQuizResult(null);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">
              {selectedTraining.document?.titulo || "Capacitación"}
            </h1>
            <p className="text-xs text-slate-400">
              {selectedTraining.estado === "aprobado"
                ? "✅ Completada"
                : selectedTraining.estado === "reprobado"
                  ? "❌ No aprobada"
                  : "⏳ Pendiente"}
            </p>
          </div>
        </div>

        {loadingDoc ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : quizResult ? (
          /* RESULT VIEW */
          <div
            className={`p-8 rounded-3xl border-2 text-center space-y-4 ${quizResult.approved ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"}`}
          >
            <div
              className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${quizResult.approved ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-rose-100 dark:bg-rose-900/50"}`}
            >
              {quizResult.approved ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              ) : (
                <AlertCircle className="w-10 h-10 text-rose-600" />
              )}
            </div>
            <h2
              className={`text-2xl font-black ${quizResult.approved ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
            >
              {quizResult.approved ? "¡Aprobado!" : "No Aprobado"}
            </h2>
            <p className="text-4xl font-black text-slate-800 dark:text-slate-100">
              {Math.round(quizResult.score)}%
            </p>
            <p className="text-sm text-slate-500">
              {quizResult.approved
                ? "Su competencia ha sido acreditada exitosamente."
                : "Debe volver a intentarlo para acreditar esta competencia."}
            </p>
            <button
              onClick={() => {
                setViewMode("list");
                setSelectedTraining(null);
                setQuizResult(null);
              }}
              className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors"
            >
              Volver a Mis Capacitaciones
            </button>
          </div>
        ) : viewMode === "quiz" ? (
          /* QUIZ VIEW */
          <div className="space-y-6">
            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
              <p className="text-xs font-bold text-indigo-600">
                Responda todas las preguntas. Puntaje mínimo:{" "}
                {selectedTraining.puntajeMinimo || 70}%
              </p>
              <div className="flex items-center gap-2 text-xs font-black text-indigo-600 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>
                  {Math.floor(seconds / 60)}:
                  {(seconds % 60).toString().padStart(2, "0")}
                </span>
              </div>
            </div>
            {quiz.map((q: any, qIdx: number) => (
              <div
                key={qIdx}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs font-black flex items-center justify-center flex-shrink-0">
                    {qIdx + 1}
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 pt-1">
                    {q.question}
                  </p>
                </div>
                <div className="space-y-2 pl-10">
                  {q.options?.map((opt: string, oIdx: number) => (
                    <button
                      key={oIdx}
                      onClick={() =>
                        setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx })
                      }
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                        quizAnswers[qIdx] === oIdx
                          ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                          : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="font-bold mr-2">
                        {String.fromCharCode(65 + oIdx)})
                      </span>{" "}
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setViewMode("detail")}
                className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Volver
              </button>
              {submitting ? (
                <button
                  disabled
                  className="px-6 py-2.5 bg-emerald-600/50 text-white rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Evaluando...
                </button>
              ) : (
                <SignatureButton
                  documentId={docDetail.id}
                  documentVersion={docDetail.versions?.[0] ? `${docDetail.versions[0].versionMayor}.${docDetail.versions[0].versionMenor}` : '1.0'}
                  onSignComplete={(signature) => handleSubmitQuiz(signature.SignatureID)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                />
              )}
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
                  <span className="text-xs font-bold text-slate-300">
                    Video de Capacitación
                  </span>
                </div>
                <div
                  className="relative w-full"
                  style={{ paddingBottom: "56.25%" }}
                >
                  <iframe
                    src={youtubeUrl}
                    title="Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            )}

            {youtubeUrl && !isOnline && (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 text-center border border-slate-200 dark:border-slate-700">
                <Play className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">
                  Video no disponible sin conexión a internet
                </p>
              </div>
            )}

            {/* Digital sections */}
            {digitalData && (
              <>
                {[
                  { title: "Objetivo", content: digitalData.objetivo },
                  { title: "Alcance", content: digitalData.alcance },
                  { title: "Desarrollo", content: digitalData.desarrollo },
                  {
                    title: "Responsabilidades",
                    content: digitalData.responsabilidades,
                  },
                ]
                  .filter((s) => s.content)
                  .map((s, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700"
                    >
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">
                        {s.title}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {s.content}
                      </p>
                    </div>
                  ))}
                {digitalData.definiciones?.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">
                      Definiciones
                    </p>
                    <div className="space-y-1">
                      {digitalData.definiciones.map((d: any, i: number) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="font-black text-indigo-600 min-w-[50px]">
                            {d.term}
                          </span>
                          <span className="text-slate-500">{d.definition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Plain description fallback */}
            {!digitalData && docDetail?.descripcion && (
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Descripción
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {docDetail.descripcion}
                </p>
              </div>
            )}

            {/* Download file */}
            {docDetail?.versions?.[0]?.files?.some(
              (f: any) => f.esPrincipal,
            ) && (
              <a
                href={`/api/documentos/${docDetail.id}/download`}
                download
                className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {docDetail.versions[0].files.find((f: any) => f.esPrincipal)
                      ?.nombreArchivo || "Documento"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Toque para descargar
                  </p>
                </div>
                <Download className="w-4 h-4 text-indigo-500" />
              </a>
            )}

            {/* Actions */}
            {selectedTraining.estado === "pendiente" && (
              <div className="flex flex-col gap-3 pt-2">
                {hasQuiz ? (
                  <button
                    onClick={() => setViewMode("quiz")}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    <Award className="w-5 h-5" /> Comenzar Evaluación (
                    {quiz.length} preguntas)
                  </button>
                ) : submitting ? (
                  <button
                    disabled
                    className="w-full py-3.5 bg-emerald-600/50 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Procesando...
                  </button>
                ) : (
                  <SignatureButton
                    documentId={docDetail.id}
                    documentVersion={docDetail.versions?.[0] ? `${docDetail.versions[0].versionMayor}.${docDetail.versions[0].versionMenor}` : '1.0'}
                    onSignComplete={(signature) => handleMarkAsRead(signature.SignatureID)}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                  />
                )}
              </div>
            )}

            {selectedTraining.estado === "reprobado" && hasQuiz && (
              <button
                onClick={() => {
                  setQuizAnswers({});
                  setSeconds(0);
                  setViewMode("quiz");
                }}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Award className="w-5 h-5" /> Reintentar Evaluación
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-6">
      <ModuleHeader
        title="Centro de Formación Integral"
        description="HDB Servicios Eléctricos • HDB SGI Portal de Desarrollo Profesional"
        icon={<GraduationCap className="w-5 h-5" />}
        helpSlug="formacion-integral"
        tabs={[
          { id: "internal", label: "Mis Capacitaciones" },
          {
            id: "external",
            label: `Certificados Externos (${certificates.length})`,
          },
        ]}
        activeTabId={activeTab}
        onTabChange={(id) => setActiveTab(id as "internal" | "external")}
        actions={[
          {
            id: "upload",
            label: "Subir Certificado",
            icon: <Plus className="w-4 h-4" />,
            variant: "primary",
            onClick: () => setIsUploadModalOpen(true),
            hideLabelOnMobile: true,
          },
        ]}
      />

      {/* TAB CONTENT: INTERNAL TRAININGS */}
      {activeTab === "internal" && (
        <div className="space-y-6">
          {/* Stats Widget */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800 text-center">
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300">
                {pendingCount}
              </span>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-1">
                Pendientes
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {approvedCount}
              </span>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">
                Aprobadas
              </p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800 text-center">
              <span className="text-2xl font-black text-rose-700 dark:text-rose-300">
                {failedCount}
              </span>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">
                No Aprobadas
              </p>
            </div>
          </div>

          {/* Trainings list */}
          {trainings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">
                No tiene capacitaciones obligatorias asignadas actualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...trainings]
                .filter((t) => t.estado !== "obsoleto")
                .sort((a, b) => {
                  const order: Record<string, number> = {
                    pendiente: 0,
                    reprobado: 1,
                    aprobado: 2,
                  };
                  return (order[a.estado] ?? 3) - (order[b.estado] ?? 3);
                })
                .map((t) => {
                  const isExpired =
                    t.vencimiento && new Date(t.vencimiento) < new Date();
                  const isNewVersion =
                    t.estado === "pendiente" &&
                    t.document?.versions?.[0]?.versionMayor > 1;
                  return (
                    <button
                      key={t.id}
                      onClick={() => openTraining(t)}
                      className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all flex items-center gap-4 group"
                    >
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          t.estado === "aprobado"
                            ? "bg-emerald-100 dark:bg-emerald-900/40"
                            : t.estado === "reprobado"
                              ? "bg-rose-100 dark:bg-rose-900/40"
                              : "bg-amber-100 dark:bg-amber-900/40"
                        }`}
                      >
                        {t.estado === "aprobado" ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : t.estado === "reprobado" ? (
                          <AlertCircle className="w-5 h-5 text-rose-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                          {t.document?.titulo || "Documento"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider ${
                              t.estado === "aprobado"
                                ? "text-emerald-600"
                                : t.estado === "reprobado"
                                  ? "text-rose-600"
                                  : "text-amber-600"
                            }`}
                          >
                            {t.estado === "aprobado"
                              ? "Completada"
                              : t.estado === "reprobado"
                                ? "No aprobada"
                                : "Pendiente"}
                          </span>
                          {isNewVersion && (
                            <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                              Nueva Versión
                            </span>
                          )}
                          {typeof t.puntaje === "number" && (
                            <span className="text-[10px] text-slate-400">
                              • Evaluado: {Math.round(t.puntaje)}%
                            </span>
                          )}
                          {isExpired && (
                            <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                              <ShieldAlert className="w-3 h-3" /> Vencida
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: EXTERNAL CERTIFICATES */}
      {activeTab === "external" && (
        <div className="space-y-6">
          {/* Welcome Card to External Certificates */}
          <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-3">
              <Award className="w-8 h-8 text-indigo-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Certificaciones y Cursos Externos
                </p>
                <p className="text-xs text-slate-500">
                  Suba certificados de capacitaciones externas. El sistema HDB
                  SGI utilizará IA Gemini para analizar, validar y extraer los
                  detalles clave del certificado.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Cargar Certificado
            </button>
          </div>

          {certificates.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
              <UploadCloud className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">
                No ha subido certificados externos todavía.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Toque "Cargar Certificado" para empezar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                        {cert.nombreCurso}
                      </h3>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          cert.estado === "aprobado"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : cert.estado === "rechazado"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-900/60 dark:text-slate-400"
                        }`}
                      >
                        {cert.estado === "aprobado"
                          ? "Aprobado"
                          : cert.estado === "rechazado"
                            ? "Rechazado"
                            : "Pendiente"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Landmark className="w-3.5 h-3.5 text-slate-400" />
                      <span>{cert.institucion}</span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {cert.descripcion || "Sin descripción"}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      {cert.horas && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />{" "}
                          {cert.horas} horas
                        </span>
                      )}
                      {cert.fechaEmision && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {`${String(new Date(cert.fechaEmision).getUTCDate()).padStart(2, "0")}/${String(new Date(cert.fechaEmision).getUTCMonth() + 1).padStart(2, "0")}/${new Date(cert.fechaEmision).getUTCFullYear()}`}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteCertificate(cert.id)}
                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-rose-500 transition-colors"
                        title="Eliminar certificado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {cert.archivoUrl && (
                        <button
                          onClick={() => {
                            setPreviewCert(cert);
                            setEditCertData({
                              nombreCurso: cert.nombreCurso || "",
                              institucion: cert.institucion || "",
                              descripcion: cert.descripcion || "",
                              horas: cert.horas || "",
                              fechaEmision: cert.fechaEmision
                                ? new Date(cert.fechaEmision)
                                    .toISOString()
                                    .split("T")[0]
                                : "",
                            });
                            setIsEditingCert(false);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-indigo-500 transition-colors"
                          title="Ver documento"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PREVIEW CERTIFICATE MODAL */}
      {previewCert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {previewCert.nombreCurso}
                </h2>
                <p className="text-[10px] text-slate-400">
                  {previewCert.institucion}
                </p>
              </div>
              <button
                onClick={() => {
                  setPreviewCert(null);
                  setIsEditingCert(false);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {previewCert.archivoUrl &&
              previewCert.archivoUrl.startsWith("data:image/") ? (
                <img
                  src={previewCert.archivoUrl}
                  alt="Certificado"
                  className="max-w-full h-auto mx-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                />
              ) : previewCert.archivoUrl &&
                previewCert.archivoUrl.startsWith("data:application/pdf") ? (
                <iframe
                  src={previewCert.archivoUrl}
                  className="w-full h-96 rounded-xl border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 text-xs">
                  Vista previa no soportada para este formato de archivo.
                </div>
              )}

              {/* Editable Certificate Data */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/40 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Datos del Certificado
                  </p>
                  {previewCert.estado !== "aprobado" && !isEditingCert && (
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
                      <label className="text-[10px] font-bold text-slate-500">
                        Curso / Título
                      </label>
                      <input
                        type="text"
                        value={editCertData.nombreCurso}
                        onChange={(e) =>
                          setEditCertData({
                            ...editCertData,
                            nombreCurso: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">
                        Institución
                      </label>
                      <input
                        type="text"
                        value={editCertData.institucion}
                        onChange={(e) =>
                          setEditCertData({
                            ...editCertData,
                            institucion: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">
                          Horas
                        </label>
                        <input
                          type="number"
                          value={editCertData.horas}
                          onChange={(e) =>
                            setEditCertData({
                              ...editCertData,
                              horas: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">
                          Fecha Emisión
                        </label>
                        <input
                          type="date"
                          value={editCertData.fechaEmision}
                          onChange={(e) =>
                            setEditCertData({
                              ...editCertData,
                              fechaEmision: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">
                        Descripción / Resumen
                      </label>
                      <textarea
                        value={editCertData.descripcion}
                        onChange={(e) =>
                          setEditCertData({
                            ...editCertData,
                            descripcion: e.target.value,
                          })
                        }
                        className="w-full h-20 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={() => setIsEditingCert(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveCertEdit}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-slate-400">Curso:</p>
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          {previewCert.nombreCurso || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Institución:</p>
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          {previewCert.institucion || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Horas:</p>
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          {previewCert.horas || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Fecha Emisión:</p>
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          {previewCert.fechaEmision
                            ? `${String(new Date(previewCert.fechaEmision).getUTCDate()).padStart(2, "0")}/${String(new Date(previewCert.fechaEmision).getUTCMonth() + 1).padStart(2, "0")}/${new Date(previewCert.fechaEmision).getUTCFullYear()}`
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400">Descripción / Resumen:</p>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed mt-0.5">
                        {previewCert.descripcion || "Sin descripción"}
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Skills Render */}

                {(previewCert.aiData.habilidadesRelevantes?.length > 0 ||
                  previewCert.aiData.otrasHabilidades?.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-indigo-100/50 dark:border-indigo-800/30">
                    {previewCert.aiData.habilidadesRelevantes?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                          Habilidades Relevantes
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {previewCert.aiData.habilidadesRelevantes.map(
                            (hab: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-200 dark:border-emerald-800"
                              >
                                {hab}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                    {previewCert.aiData.otrasHabilidades?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                          Otras Habilidades
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {previewCert.aiData.otrasHabilidades.map(
                            (hab: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-lg border border-amber-200 dark:border-amber-800"
                              >
                                {hab}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD EXTERNAL CERTIFICATE MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-700">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                Cargar Certificado Externo
              </h2>
              <button
                onClick={() => {
                  if (!analyzingCert) setIsUploadModalOpen(false);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
                disabled={analyzingCert}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUploadCertificate} className="p-6 space-y-4">
              {/* File Upload Area */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  Archivo de Certificado (Imagen o PDF)
                </label>
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-600 rounded-2xl p-6 text-center cursor-pointer transition-all relative">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={analyzingCert}
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center">
                      <UploadCloud className="w-5 h-5 text-slate-400" />
                    </div>
                    {certFileName ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {certFileName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Toque para cambiar
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-600">
                          Haga clic o arrastre el archivo aquí
                        </p>
                        <p className="text-[10px] text-slate-400">
                          PDF, PNG, JPG hasta 5MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional details - Optional fields to guide Gemini */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    Nombre del Curso{" "}
                    <span title="Opcional. Si lo deja vacío, Gemini lo extraerá de manera automática.">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Curso de Seguridad Eléctrica en Alta Tensión"
                    value={manualNombreCurso}
                    onChange={(e) => setManualNombreCurso(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    disabled={analyzingCert}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    Institución Organizadora{" "}
                    <span title="Opcional. Si lo deja vacío, Gemini lo extraerá de manera automática.">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. UTN (Universidad Tecnológica Nacional)"
                    value={manualInstitucion}
                    onChange={(e) => setManualInstitucion(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    disabled={analyzingCert}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">
                    ¿De qué se trata el curso?
                  </label>
                  <textarea
                    placeholder="Breve descripción del contenido o temario cubierto..."
                    value={manualDescripcion}
                    onChange={(e) => setManualDescripcion(e.target.value)}
                    className="w-full h-20 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    disabled={analyzingCert}
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                  disabled={analyzingCert}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={analyzingCert || !certFileBase64}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {analyzingCert ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analizando con Gemini IA...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Subir y Analizar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
