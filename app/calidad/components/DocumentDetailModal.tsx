'use client';

import { useState, useEffect, useRef } from 'react';
import { X, FileText, CheckCircle2, ShieldAlert, Plus, Trash2, Save, FileBox, AlertCircle, FileSignature, ThumbsUp, ThumbsDown } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';

export default function DocumentDetailModal({ documentId, onClose, user }: { documentId: string, onClose: () => void, user?: any }) {
    const [doc, setDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'info' | 'versiones' | 'reglas' | 'checklist'>('info');

    // Checklist template state
    const [checklistItems, setChecklistItems] = useState<{ descripcion: string, esObligatorio: boolean }[]>([]);

    // New rule modal state
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [newRule, setNewRule] = useState({ tipoActividad: '', bloqueanteDeInicio: false, generaChecklist: false });

    // Workflow state hooks
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [agreement, setAgreement] = useState<'ACUERDO' | 'DESACUERDO' | null>(null);
    const [comments, setComments] = useState('');
    const [submittingWorkflow, setSubmittingWorkflow] = useState(false);

    const getCoordinates = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: any) => {
        const coords = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const coords = getCoordinates(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleWorkflowSubmit = async () => {
        if (!agreement) return;
        
        let signatureData = null;
        if (agreement === 'ACUERDO') {
            const canvas = canvasRef.current;
            if (!canvas) return;
            signatureData = canvas.toDataURL('image/png');
            const isBlank = !isDrawing && canvas.toDataURL() === document.createElement('canvas').toDataURL();
            if (isBlank) {
                alert('Debe firmar el documento para manifestar su acuerdo');
                return;
            }
        } else {
            if (!comments.trim()) {
                alert('Debe proporcionar una recomendación de cambios o modificaciones cuando está en desacuerdo');
                return;
            }
        }

        setSubmittingWorkflow(true);
        try {
            const isRevisador = user && doc.revisadorId === user.id;
            const role = isRevisador ? 'revisador' : 'aprobador';
            const status = agreement === 'ACUERDO' ? 'approved' : 'rejected';

            const res = await safeApiRequest(`/api/documentos/${documentId}/firmar`, {
                method: 'POST',
                body: JSON.stringify({
                    userId: user.id,
                    userName: user.nombreCompleto || user.nombre || 'Firmante',
                    role,
                    status,
                    comment: comments,
                    signature: signatureData
                })
            });

            if (res.ok) {
                showToast(status === 'approved' ? 'Documento firmado con éxito' : 'Observaciones enviadas con éxito', 'success');
                // Reset local states
                setAgreement(null);
                setComments('');
                // Reload document
                loadDocument();
            } else {
                const err = await res.json();
                alert(err.error || 'Error al procesar firma');
            }
        } catch (err) {
            console.error(err);
            alert('Error de red');
        } finally {
            setSubmittingWorkflow(false);
        }
    };

    useEffect(() => {
        loadDocument();
    }, [documentId]);

    const loadDocument = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest(`/api/documentos/${documentId}`);
            if (res.ok) {
                const data = await res.json();
                setDoc(data);

                // Load checklist from the latest version if available
                if (data.versions && data.versions.length > 0) {
                    const latest = data.versions[0];
                    if (latest.checklistTemplate) {
                        setChecklistItems(latest.checklistTemplate);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addRule = async (ruleData: any) => {
        try {
            const res = await safeApiRequest(`/api/documentos/${documentId}/reglas`, {
                method: 'POST',
                body: JSON.stringify(ruleData)
            });
            if (res.ok) {
                loadDocument();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const deleteRule = async (ruleId: string) => {
        try {
            await safeApiRequest(`/api/documentos/${documentId}/reglas?ruleId=${ruleId}`, {
                method: 'DELETE'
            });
            loadDocument();
        } catch (e) {
            console.error(e);
        }
    };

    const saveChecklistTemplate = async () => {
        if (!doc.versions || doc.versions.length === 0) return showToast('No hay versiones para actualizar', 'error');
        const latestVersion = doc.versions[0];
        
        try {
            const res = await safeApiRequest(`/api/documentos/${documentId}/versions/${latestVersion.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    checklistTemplate: checklistItems
                })
            });
            if (res.ok) {
                showToast('Plantilla de checklist guardada con éxito', 'success');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al guardar checklist', 'error');
        }
    };

    if (loading) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-medium">Cargando documento...</p>
            </div>
        </div>
    );

    if (!doc) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex gap-4 items-start">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex gap-2 items-center mb-1">
                                <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono tracking-widest">
                                    {doc.codigoDocumental}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                    doc.estado === 'vigente' ? 'bg-emerald-100 text-emerald-700' :
                                    doc.estado === 'borrador' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-500'
                                }`}>
                                    {doc.estado}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{doc.titulo}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 gap-6 pt-2">
                    {[
                        { id: 'info', label: 'Información General' },
                        { id: 'versiones', label: 'Historial y Versiones' },
                        { id: 'reglas', label: 'Matriz de Aplicabilidad (Reglas)' },
                        { id: 'checklist', label: 'Plantilla de Checklist' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as any)}
                            className={`py-3 text-sm font-bold border-b-2 transition-colors ${
                                tab === t.id 
                                    ? 'border-indigo-600 text-indigo-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/20">
                    {tab === 'info' && (
                        <div className="space-y-6 max-w-3xl">
                            {/* Descripción larga */}
                            {doc.descripcion && (
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descripción</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{doc.descripcion}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Documento</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{doc.tipoDocumento}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Área / Sector</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{doc.area}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nivel de Criticidad</p>
                                    <p className={`font-bold text-sm ${
                                        doc.nivelCriticidad === 'critico' || doc.nivelCriticidad === 'critica' ? 'text-red-600' :
                                        doc.nivelCriticidad === 'alto' || doc.nivelCriticidad === 'alta' ? 'text-amber-600' :
                                        doc.nivelCriticidad === 'medio' || doc.nivelCriticidad === 'media' ? 'text-blue-600' :
                                        'text-slate-600'
                                    }`}>{doc.nivelCriticidad}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Versión Actual</p>
                                    <p className="font-bold text-lg text-indigo-600">v{doc.versionMayor}.{doc.versionMenor}</p>
                                </div>
                            </div>

                            {/* Responsables: Creador, Revisador, Aprobador */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Responsables del Documento</p>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Creado Por</p>
                                        <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{doc.createdByName || 'N/A'}</p>
                                    </div>
                                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Revisado Por</p>
                                        <p className="font-bold text-sm text-blue-700 dark:text-blue-300">{doc.revisadorNombre || 'Sin asignar'}</p>
                                    </div>
                                    <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Aprobado Por</p>
                                        <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">{doc.aprobadorNombre || 'Sin asignar'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Etiquetas */}
                            {doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0 && (
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Etiquetas (Tipo de Actividad)</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(doc.tags as string[]).map((tag: string) => (
                                            <span key={tag} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Requerimientos Operativos Obligatorios</p>
                                <div className="flex gap-4 flex-wrap">
                                    {doc.requiereConfirmacionLectura && (
                                        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> Requiere Confirmación de Lectura
                                        </div>
                                    )}
                                    {doc.requiereCapacitacion && (
                                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg text-sm font-bold">
                                            <ShieldAlert className="w-4 h-4" /> Requiere Capacitación
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Workflow de Firmas y Aprobaciones */}
                            {doc.workflowState && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-6">
                                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                                        <FileSignature className="w-5 h-5 text-indigo-500" />
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Estado de Firmas y Flujo de Aprobación</h3>
                                    </div>

                                    {/* Signers status list */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Creator Sign */}
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col justify-between min-h-[140px]">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Autor / Creador</p>
                                                <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mt-1">{doc.createdByName || 'Creador'}</p>
                                            </div>
                                            <div className="mt-3">
                                                {doc.workflowState.creatorSignature ? (
                                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-white inline-block">
                                                        <img src={doc.workflowState.creatorSignature} alt="Firma Creador" className="max-h-12 w-auto object-contain" />
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No firmado</span>
                                                )}
                                                <p className="text-[9px] text-slate-400 mt-1">
                                                    {doc.workflowState.creatorSignatureDate ? new Date(doc.workflowState.creatorSignatureDate).toLocaleString() : ''}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Reviewer Sign */}
                                        {doc.revisadorId && (
                                            <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[140px] ${
                                                doc.workflowState.revisadorStatus === 'approved' ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/50' :
                                                doc.workflowState.revisadorStatus === 'rejected' ? 'bg-red-50/30 dark:bg-red-950/10 border-red-200 dark:border-red-900/50' :
                                                'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                                            }`}>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verificador / Revisado Por</p>
                                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mt-1">{doc.revisadorNombre || 'Sin asignar'}</p>
                                                    <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-2 ${
                                                        doc.workflowState.revisadorStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                        doc.workflowState.revisadorStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                                        'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {doc.workflowState.revisadorStatus === 'approved' ? 'De Acuerdo' :
                                                         doc.workflowState.revisadorStatus === 'rejected' ? 'En Desacuerdo' :
                                                         'Pendiente de Firma'}
                                                    </span>
                                                </div>
                                                <div className="mt-3">
                                                    {doc.workflowState.revisadorSignature ? (
                                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-white inline-block">
                                                            <img src={doc.workflowState.revisadorSignature} alt="Firma Revisador" className="max-h-12 w-auto object-contain" />
                                                        </div>
                                                    ) : doc.workflowState.revisadorComment ? (
                                                        <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-xs text-red-700 dark:text-red-300 italic border border-red-100 dark:border-red-900/30">
                                                            Observación: {doc.workflowState.revisadorComment}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No firmado</span>
                                                    )}
                                                    {doc.workflowState.revisadorSignatureDate && (
                                                        <p className="text-[9px] text-slate-400 mt-1">
                                                            {new Date(doc.workflowState.revisadorSignatureDate).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Approver Sign */}
                                        {doc.aprobadorId && (
                                            <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[140px] ${
                                                doc.workflowState.aprobadorStatus === 'approved' ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/50' :
                                                doc.workflowState.aprobadorStatus === 'rejected' ? 'bg-red-50/30 dark:bg-red-950/10 border-red-200 dark:border-red-900/50' :
                                                'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                                            }`}>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Autorizante / Aprobado Por</p>
                                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mt-1">{doc.aprobadorNombre || 'Sin asignar'}</p>
                                                    <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-2 ${
                                                        doc.workflowState.aprobadorStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                        doc.workflowState.aprobadorStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                                        'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {doc.workflowState.aprobadorStatus === 'approved' ? 'De Acuerdo' :
                                                         doc.workflowState.aprobadorStatus === 'rejected' ? 'En Desacuerdo' :
                                                         'Pendiente de Firma'}
                                                    </span>
                                                </div>
                                                <div className="mt-3">
                                                    {doc.workflowState.aprobadorSignature ? (
                                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-white inline-block">
                                                            <img src={doc.workflowState.aprobadorSignature} alt="Firma Aprobador" className="max-h-12 w-auto object-contain" />
                                                        </div>
                                                    ) : doc.workflowState.aprobadorComment ? (
                                                        <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-xs text-red-700 dark:text-red-300 italic border border-red-100 dark:border-red-900/30">
                                                            Observación: {doc.workflowState.aprobadorComment}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No firmado</span>
                                                    )}
                                                    {doc.workflowState.aprobadorSignatureDate && (
                                                        <p className="text-[9px] text-slate-400 mt-1">
                                                            {new Date(doc.workflowState.aprobadorSignatureDate).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action panel for signers */}
                                    {user && (
                                        (() => {
                                            const isRevisador = doc.revisadorId === user.id && doc.workflowState.revisadorStatus === 'pending';
                                            const isAprobador = doc.aprobadorId === user.id && doc.workflowState.aprobadorStatus === 'pending';
                                            
                                            if (!isRevisador && !isAprobador) return null;

                                            return (
                                                <div className="mt-6 bg-indigo-50/50 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-4">
                                                    <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                                                        <FileSignature className="w-4 h-4" />
                                                        <span className="font-bold text-sm">Panel de Firmante: Requiere tu Acción</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        Has sido asignado como {isRevisador ? 'Verificador (Revisador)' : 'Autorizante (Aprobador)'} para este documento.
                                                        Por favor revisa el documento y manifiesta tu acuerdo o desacuerdo.
                                                    </p>

                                                    <div className="flex gap-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setAgreement('ACUERDO'); clearCanvas(); }}
                                                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                                                                agreement === 'ACUERDO' 
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                                                            }`}
                                                        >
                                                            <ThumbsUp className="w-4 h-4" /> DE ACUERDO
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAgreement('DESACUERDO')}
                                                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                                                                agreement === 'DESACUERDO' 
                                                                    ? 'bg-red-600 border-red-600 text-white shadow-sm' 
                                                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                                                            }`}
                                                        >
                                                            <ThumbsDown className="w-4 h-4" /> EN DESACUERDO
                                                        </button>
                                                    </div>

                                                    {agreement === 'DESACUERDO' && (
                                                        <div className="space-y-3 animate-in fade-in duration-200">
                                                            <label className="block text-xs font-bold text-slate-500 uppercase">
                                                                Recomendación de cambios o modificaciones <span className="text-red-500">*</span>
                                                            </label>
                                                            <textarea
                                                                required
                                                                value={comments}
                                                                onChange={e => setComments(e.target.value)}
                                                                placeholder="Describa brevemente qué cambios se deben realizar para estar de acuerdo..."
                                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-indigo-500 outline-none h-20 resize-none"
                                                            />
                                                            <div className="flex justify-end">
                                                                <button
                                                                    type="button"
                                                                    disabled={submittingWorkflow}
                                                                    onClick={handleWorkflowSubmit}
                                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors flex items-center gap-2"
                                                                >
                                                                    Enviar Observaciones
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {agreement === 'ACUERDO' && (
                                                        <div className="space-y-3 animate-in fade-in duration-200">
                                                            <label className="block text-xs font-bold text-slate-500 uppercase">
                                                                Firma Digital de Conformidad <span className="text-red-500">*</span>
                                                            </label>
                                                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
                                                                <canvas
                                                                    ref={canvasRef}
                                                                    width={416}
                                                                    height={150}
                                                                    onMouseDown={startDrawing}
                                                                    onMouseMove={draw}
                                                                    onMouseUp={stopDrawing}
                                                                    onMouseLeave={stopDrawing}
                                                                    onTouchStart={startDrawing}
                                                                    onTouchMove={draw}
                                                                    onTouchEnd={stopDrawing}
                                                                    className="w-full bg-white dark:bg-slate-950 cursor-crosshair touch-none h-[150px]"
                                                                />
                                                                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                                                                    <span className="text-[10px] font-bold text-slate-400">Dibuje su firma arriba</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={clearCanvas}
                                                                        className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                                                                    >
                                                                        Limpiar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end">
                                                                <button
                                                                    type="button"
                                                                    disabled={submittingWorkflow}
                                                                    onClick={handleWorkflowSubmit}
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors flex items-center gap-2"
                                                                >
                                                                    Firmar y Aprobar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'reglas' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Reglas de Asignación Automática a OS</h3>
                                    <p className="text-sm text-slate-500">Define en qué Órdenes de Servicio este documento aparecerá obligatoriamente.</p>
                                </div>
                                <button 
                                    onClick={() => setShowRuleModal(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-sm flex items-center gap-2 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nueva Regla Rápida
                                </button>
                            </div>

                            {doc.applicabilityRules?.length === 0 ? (
                                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
                                    <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="font-bold text-slate-500">No hay reglas definidas.</p>
                                    <p className="text-sm text-slate-400">Este documento no se asignará automáticamente a ninguna OS por ahora.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {doc.applicabilityRules?.map((rule: any) => (
                                        <div key={rule.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative group">
                                            <button 
                                                onClick={() => deleteRule(rule.id)}
                                                className="absolute top-4 right-4 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Condición</p>
                                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm mt-0.5">
                                                        {rule.tipoActividad ? `Solo para OS de tipo: ${rule.tipoActividad}` : 'Para cualquier tipo de OS'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                    {rule.bloqueanteDeInicio && (
                                                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> Bloqueante
                                                        </span>
                                                    )}
                                                    {rule.generaChecklist && (
                                                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Genera Checklist
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'checklist' && (
                        <div className="space-y-6 max-w-3xl">
                            <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                                        <FileBox className="w-4 h-4" /> Plantilla de Checklist
                                    </h3>
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                                        Estos pasos se exigirán a los técnicos si la Regla de Asignación tiene "Genera Checklist" activado.
                                    </p>
                                </div>
                                <button
                                    onClick={saveChecklistTemplate}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-indigo-700 transition-colors"
                                >
                                    <Save className="w-4 h-4" /> Guardar Plantilla
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {checklistItems.map((item, idx) => (
                                        <div key={idx} className="p-4 flex gap-4 items-center group">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <input
                                                type="text"
                                                value={item.descripcion}
                                                onChange={(e) => {
                                                    const n = [...checklistItems];
                                                    n[idx].descripcion = e.target.value;
                                                    setChecklistItems(n);
                                                }}
                                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium p-0"
                                                placeholder="Descripción de la tarea a verificar..."
                                            />
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={item.esObligatorio}
                                                    onChange={(e) => {
                                                        const n = [...checklistItems];
                                                        n[idx].esObligatorio = e.target.checked;
                                                        setChecklistItems(n);
                                                    }}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                                />
                                                Obligatorio
                                            </label>
                                            <button
                                                onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== idx))}
                                                className="p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-900/50">
                                    <button
                                        onClick={() => setChecklistItems([...checklistItems, { descripcion: '', esObligatorio: true }])}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Agregar Paso al Checklist
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {tab === 'versiones' && (
                        <div className="space-y-4">
                            {doc.versions?.map((v: any) => (
                                <div key={v.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between">
                                        <div>
                                            <span className="font-bold text-lg text-slate-800 dark:text-slate-100">v{v.versionLabel}</span>
                                            <span className={`ml-3 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                                v.estado === 'vigente' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {v.estado}
                                            </span>
                                        </div>
                                        <span className="text-xs font-medium text-slate-400">
                                            {new Date(v.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{v.motivoCambio}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* New Rule Modal */}
            {showRuleModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">Nueva Regla Rápida</h3>
                            <button onClick={() => setShowRuleModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Actividad</label>
                                <input
                                    type="text"
                                    value={newRule.tipoActividad}
                                    onChange={e => setNewRule({...newRule, tipoActividad: e.target.value})}
                                    placeholder="Ej. Mantenimiento, Instalación (deja vacío para todas)"
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-3 pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newRule.bloqueanteDeInicio}
                                        onChange={e => setNewRule({...newRule, bloqueanteDeInicio: e.target.checked})}
                                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 bg-slate-50 dark:bg-slate-900"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Es un documento bloqueante</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newRule.generaChecklist}
                                        onChange={e => setNewRule({...newRule, generaChecklist: e.target.checked})}
                                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 bg-slate-50 dark:bg-slate-900"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Genera checklist dinámico</span>
                                </label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowRuleModal(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    addRule(newRule);
                                    setShowRuleModal(false);
                                    setNewRule({ tipoActividad: '', bloqueanteDeInicio: false, generaChecklist: false });
                                }}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
                            >
                                Guardar Regla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
