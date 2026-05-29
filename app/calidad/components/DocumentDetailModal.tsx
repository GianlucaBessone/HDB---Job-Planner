'use client';

import { useState, useEffect, useRef } from 'react';
import { X, FileText, CheckCircle2, ShieldAlert, Plus, Trash2, Save, FileBox, AlertCircle, FileSignature, ThumbsUp, ThumbsDown, Download, Upload, BookOpen, Award, Clock, UserCheck, UserX, Sparkles, Search, PlusCircle, Play, Loader2, FileCheck } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { formatDateInline, formatDateTimeInline } from '@/lib/formatDate';
import { showToast } from '@/components/Toast';

// Module-level caches to speed up modal opens across the app session
let cachedOperators: any[] | null = null;
let cachedAllDocs: any[] | null = null;
let cachedActivityOptions: string[] | null = null;
let cachedProjectTags: string[] | null = null;
const cachedDocuments: Record<string, any> = {};

export default function DocumentDetailModal({ documentId, onClose, user }: { documentId: string, onClose: () => void, user?: any }) {
    const [doc, setDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'info' | 'lms' | 'versiones' | 'reglas' | 'checklist'>('info');

    // Checklist template state
    const [checklistItems, setChecklistItems] = useState<{ descripcion: string, esObligatorio: boolean }[]>([]);
    const [activityOptions, setActivityOptions] = useState<string[]>([]);
    const [projectTags, setProjectTags] = useState<string[]>([]);

    // LMS/Quiz state hooks
    const [uploading, setUploading] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState<{ question: string, options: string[], correctAnswerIndex: number }[]>([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '', '', '']);
    const [newCorrectIndex, setNewCorrectIndex] = useState(0);
    const [showQuestionBuilder, setShowQuestionBuilder] = useState(false);
    const [generatingQuizWithAi, setGeneratingQuizWithAi] = useState(false);

    // New rule modal state
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [newRule, setNewRule] = useState<{
        tipoActividad: string;
        bloqueanteDeInicio: boolean;
        generaChecklist: boolean;
        tagsRequeridos: string[];
    }>({
        tipoActividad: '',
        bloqueanteDeInicio: false,
        generaChecklist: false,
        tagsRequeridos: []
    });

    // Workflow state hooks
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [agreement, setAgreement] = useState<'ACUERDO' | 'DESACUERDO' | null>(null);
    const [comments, setComments] = useState('');
    const [submittingWorkflow, setSubmittingWorkflow] = useState(false);

    // Inline Requirements Editing State
    const [editReqLectura, setEditReqLectura] = useState(false);
    const [editReqCapacitacion, setEditReqCapacitacion] = useState(false);
    const [editValidezMeses, setEditValidezMeses] = useState('');
    const [savingReqs, setSavingReqs] = useState(false);

    // Version Control Modal State
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [versionAction, setVersionAction] = useState<'mayor' | 'menor' | 'none'>('menor');
    const [versionJustification, setVersionJustification] = useState('');
    const [pendingSaveType, setPendingSaveType] = useState<'digital' | 'requirements' | 'quiz' | 'checklist' | null>(null);
    const [pendingSaveData, setPendingSaveData] = useState<any>(null);
    const [executingSave, setExecutingSave] = useState(false);

    // Version Control Modal specific state
    const [operators, setOperators] = useState<any[]>([]);
    const [newRevisadorId, setNewRevisadorId] = useState('');
    const [newAprobadorId, setNewAprobadorId] = useState('');
    const versionCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isVersionDrawing, setIsVersionDrawing] = useState(false);
    const [hasVersionSigned, setHasVersionSigned] = useState(false);
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

    // Digital SOP edit/view states
    const [isEditingDigital, setIsEditingDigital] = useState(false);
    const [editedDigitalData, setEditedDigitalData] = useState<any>({
        objetivo: '',
        alcance: '',
        desarrollo: '',
        responsabilidades: '',
        videoUrl: '',
        definiciones: [],
        referencias: []
    });
    const [allDocs, setAllDocs] = useState<any[]>([]);
    const [customAbbrevs, setCustomAbbrevs] = useState<{ term: string; definition: string }[]>([]);
    const [newTerm, setNewTerm] = useState('');
    const [newDef, setNewDef] = useState('');
    const [saveToFrequents, setSaveToFrequents] = useState(true);
    const [refSearch, setRefSearch] = useState('');
    const [showRefResults, setShowRefResults] = useState(false);
    const [customRefText, setCustomRefText] = useState('');
    const [savingDigital, setSavingDigital] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('hdb_custom_definitions');
        if (saved) {
            try { setCustomAbbrevs(JSON.parse(saved)); } catch(e){}
        }
    }, []);

    const handleSaveDigitalData = () => {
        setPendingSaveType('digital');
        setPendingSaveData({ isDigital: true, ...editedDigitalData });
        setVersionAction('menor');
        setVersionJustification('');
        setShowVersionModal(true);
    };

    const getYoutubeEmbedUrl = (url: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2] && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
        // Fallback for simple watch URLs
        if (url.includes('youtube.com/watch?v=')) {
            const parts = url.split('v=');
            if (parts[1]) {
                const id = parts[1].split('&')[0];
                return `https://www.youtube.com/embed/${id}`;
            }
        }
        return null;
    };

    const handleExportPDF = () => {
        if (!doc) return;
        
        let digitalData = null;
        try {
            if (doc.descripcion && doc.descripcion.trim().startsWith('{')) {
                digitalData = JSON.parse(doc.descripcion);
            }
        } catch (e) {}

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita las ventanas emergentes para exportar el PDF.');
            return;
        }

        const dateStr = formatDateInline(new Date());
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>${doc.codigoDocumental} - ${doc.titulo}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
                        body {
                            font-family: 'Inter', sans-serif;
                            color: #0f172a;
                            margin: 0;
                            padding: 40px;
                            line-height: 1.6;
                            font-size: 13px;
                        }
                        .header-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 30px;
                        }
                        .header-table td {
                            border: 1px solid #cbd5e1;
                            padding: 10px;
                            vertical-align: middle;
                        }
                        .logo-cell {
                            width: 120px;
                            text-align: center;
                            font-weight: 900;
                            font-size: 20px;
                            color: #4f46e5;
                            letter-spacing: -0.05em;
                        }
                        .title-cell {
                            text-align: center;
                            font-weight: 800;
                            font-size: 14px;
                            text-transform: uppercase;
                        }
                        .meta-cell {
                            width: 180px;
                            font-size: 10px;
                            font-weight: 700;
                            color: #475569;
                            line-height: 1.4;
                        }
                        .section-title {
                            font-size: 14px;
                            font-weight: 900;
                            color: #1e3a8a;
                            border-bottom: 2px solid #e2e8f0;
                            padding-bottom: 5px;
                            margin-top: 25px;
                            margin-bottom: 10px;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        }
                        .section-content {
                            margin-bottom: 20px;
                            text-align: justify;
                            font-weight: 500;
                            color: #334155;
                            white-space: pre-wrap;
                        }
                        .glossary-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 10px;
                        }
                        .glossary-table th, .glossary-table td {
                            border: 1px solid #e2e8f0;
                            padding: 8px 12px;
                            text-align: left;
                        }
                        .glossary-table th {
                            background-color: #f8fafc;
                            font-weight: 800;
                            font-size: 11px;
                            color: #475569;
                            text-transform: uppercase;
                        }
                        .glossary-term {
                            font-weight: 900;
                            color: #4f46e5;
                        }
                        .references-list {
                            margin: 10px 0 0 0;
                            padding-left: 20px;
                        }
                        .references-list li {
                            margin-bottom: 5px;
                        }
                        .signature-section {
                            margin-top: 50px;
                            display: flex;
                            justify-content: space-between;
                            page-break-inside: avoid;
                        }
                        .signature-block {
                            width: 30%;
                            text-align: center;
                            font-size: 10px;
                            border-top: 1px solid #cbd5e1;
                            padding-top: 8px;
                        }
                        .signature-title {
                            font-weight: 800;
                            color: #475569;
                            text-transform: uppercase;
                            margin-bottom: 20px;
                        }
                        .signature-img {
                            height: 50px;
                            margin-bottom: 5px;
                            mix-blend-mode: multiply;
                        }
                        @media print {
                            body {
                                padding: 0;
                            }
                            @page {
                                size: A4;
                                margin: 20mm;
                            }
                        }
                    </style>
                </head>
                <body>
                    <table class="header-table">
                        <tr>
                            <td rowspan="2" class="logo-cell">HDB</td>
                            <td rowspan="2" class="title-cell">
                                SISTEMA DE GESTIÓN DE CALIDAD (QMS)<br>
                                <span style="font-size:11px; font-weight:600; color:#64748b;">PROCEDIMIENTO DE CONTROL DE DOCUMENTOS</span><br>
                                <span style="font-size:12px; font-weight:800; color:#1e293b;">${doc.titulo}</span>
                            </td>
                            <td class="meta-cell">
                                <strong>CÓDIGO:</strong> ${doc.codigoDocumental}<br>
                                <strong>VERSION:</strong> v${doc.versionMayor}.${doc.versionMenor}<br>
                                <strong>ÁREA:</strong> ${doc.area}
                            </td>
                        </tr>
                        <tr>
                            <td class="meta-cell">
                                <strong>CRITICIDAD:</strong> ${doc.nivelCriticidad.toUpperCase()}<br>
                                <strong>FECHA EMISIÓN:</strong> ${formatDateInline(doc.createdAt)}<br>
                                <strong>ESTADO:</strong> ${doc.estado.toUpperCase()}
                            </td>
                        </tr>
                    </table>

                    <div class="section-title">1. Introducción y Registro</div>
                    <div class="section-content">Este documento establece las directivas oficiales de calidad y seguridad de HDB. Todo el personal alcanzado debe leer, comprender y confirmar su conformidad según las exigencias del departamento de Calidad.</div>

                    <div class="section-title">2. Objetivo</div>
                    <div class="section-content">${(digitalData && digitalData.objetivo) || 'No especificado.'}</div>

                    <div class="section-title">3. Alcance</div>
                    <div class="section-content">${(digitalData && digitalData.alcance) || 'No especificado.'}</div>

                    <div class="section-title">4. Desarrollo de la Actividad</div>
                    <div class="section-content">${(digitalData && digitalData.desarrollo) || 'No especificado.'}</div>

                    <div class="section-title">5. Responsabilidades</div>
                    <div class="section-content">${(digitalData && digitalData.responsabilidades) || 'No especificado.'}</div>

                    <div class="section-title">6. Definiciones y Abreviaturas</div>
                    ${digitalData && digitalData.definiciones && digitalData.definiciones.length > 0 ? `
                        <table class="glossary-table">
                            <thead>
                                <tr>
                                    <th style="width: 25%;">Término</th>
                                    <th>Definición / Significado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${digitalData.definiciones.map((d: any) => `
                                    <tr>
                                        <td class="glossary-term">${d.term}</td>
                                        <td>${d.definition}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : `
                        <div class="section-content">No se han registrado términos específicos en el glosario.</div>
                    `}

                    <div class="section-title">7. Referencias y Documentación Anexa</div>
                    ${digitalData && digitalData.referencias && digitalData.referencias.length > 0 ? `
                        <ul class="references-list">
                            ${digitalData.referencias.map((r: any) => `
                                <li><strong>[${r.codigo}]</strong> ${r.titulo}</li>
                            `).join('')}
                        </ul>
                    ` : `
                        <div class="section-content">No se han registrado documentos o normas anexas de referencia.</div>
                    `}

                    <div class="signature-section">
                        <div class="signature-block">
                            <div class="signature-title">Editado Por</div>
                            ${doc.workflowState?.creatorSignature ? `<img class="signature-img" src="${doc.workflowState.creatorSignature}" />` : '<div style="height:50px;"></div>'}
                            <div style="font-weight:700;">${doc.workflowState?.editorName || doc.createdByName || 'N/A'}</div>
                            <div style="color:#64748b;">${doc.workflowState?.editorPosition || doc.workflowState?.creatorPosition || ''}</div>
                        </div>
                        <div class="signature-block">
                            <div class="signature-title">Revisado Por</div>
                            ${doc.workflowState?.revisadorSignature ? `<img class="signature-img" src="${doc.workflowState.revisadorSignature}" />` : '<div style="height:50px;"></div>'}
                            <div style="font-weight:700;">${doc.revisadorNombre || 'N/A'}</div>
                            <div style="color:#64748b;">${doc.workflowState?.revisadorPosition || ''}</div>
                        </div>
                        <div class="signature-block">
                            <div class="signature-title">Aprobado Por</div>
                            ${doc.workflowState?.aprobadorSignature ? `<img class="signature-img" src="${doc.workflowState.aprobadorSignature}" />` : '<div style="height:50px;"></div>'}
                            <div style="font-weight:700;">${doc.aprobadorNombre || 'N/A'}</div>
                            <div style="color:#64748b;">${doc.workflowState?.aprobadorPosition || ''}</div>
                        </div>
                    </div>

                    <div style="margin-top:60px; font-size:9px; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0; padding-top:10px;">
                        Documento oficial controlado de HDB. Copia no controlada si se imprime. Impreso el ${dateStr}.
                    </div>

                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 500);
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    useEffect(() => {
        if (doc) {
            setEditReqLectura(doc.requiereConfirmacionLectura || false);
            setEditReqCapacitacion(doc.requiereCapacitacion || false);
            setEditValidezMeses(doc.validezMeses?.toString() || '');
        }
    }, [doc]);

    const handleSaveRequirements = () => {
        setPendingSaveType('requirements');
        setPendingSaveData({
            requiereConfirmacionLectura: editReqLectura,
            requiereCapacitacion: editReqCapacitacion,
            validezMeses: editReqCapacitacion ? (editValidezMeses ? parseInt(editValidezMeses) : null) : null,
        });
        setVersionAction('menor');
        setVersionJustification('');
        setShowVersionModal(true);
    };

    const executeVersionedSave = async () => {
        if (versionAction === 'none' && !versionJustification.trim()) {
            showToast('Debe justificar por qué no incrementa la versión', 'error');
            return;
        }
        setExecutingSave(true);
        const uId = user?.id || 'admin';
        const uName = user?.nombreCompleto || user?.nombre || 'Usuario Administrador';
        try {
            const canvas = versionCanvasRef.current;
            const sigData = canvas ? canvas.toDataURL('image/png') : null;

            // Step 1: Apply the document update. If versionAction !== 'none', we force it into 'en_revision'
            let updateBody: any = { 
                userId: uId, 
                userName: uName,
                creatorSignature: sigData,
                revisadorId: newRevisadorId,
                aprobadorId: newAprobadorId
            };

            const revOp = operators.find(o => o.id === newRevisadorId);
            if (revOp) updateBody.revisadorNombre = revOp.nombreCompleto || revOp.nombre;
            
            const apOp = operators.find(o => o.id === newAprobadorId);
            if (apOp) updateBody.aprobadorNombre = apOp.nombreCompleto || apOp.nombre;

            if (versionAction !== 'none') {
                updateBody.estado = 'en_revision';
            }
            
            if (pendingSaveType !== 'checklist') {
                if (pendingSaveType === 'digital') {
                    updateBody.descripcion = JSON.stringify(pendingSaveData);
                } else if (pendingSaveType === 'requirements') {
                    Object.assign(updateBody, pendingSaveData);
                }
            }

            if (versionAction === 'none') {
                updateBody.motivoCambio = `[Sin incremento de versión] ${versionJustification}`;
            } else {
                let desc = 'Actualización de documento';
                if (pendingSaveType === 'digital') desc = 'Actualización de procedimiento digital';
                if (pendingSaveType === 'requirements') desc = 'Actualización de requerimientos LMS';
                if (pendingSaveType === 'quiz') desc = 'Actualización de evaluación LMS';
                if (pendingSaveType === 'checklist') desc = 'Actualización de checklist';
                updateBody.motivoCambio = versionJustification || desc;
            }

            const res = await safeApiRequest(`/api/documentos/${documentId}`, {
                method: 'PUT',
                body: JSON.stringify(updateBody)
            });
            if (!res.ok) {
                const err = await res.json();
                showToast(err.error || 'Error al guardar cambios en documento', 'error');
                setExecutingSave(false);
                return;
            }
            
            // If quiz, we also need to call the quiz API to set the workflowState.cuestionario
            if (pendingSaveType === 'quiz') {
                await safeApiRequest(`/api/documentos/${documentId}/quiz`, {
                    method: 'POST',
                    body: JSON.stringify({
                        cuestionario: pendingSaveData,
                        userId: uId,
                        userName: uName
                    })
                });
            }

            // Step 2: Handle Versioning
            if (versionAction !== 'none') {
                const payload: any = {
                    tipoVersion: versionAction,
                    motivoCambio: versionJustification || (pendingSaveType === 'checklist' ? 'Actualización de plantilla de checklist' : 'Actualización de documento'),
                    autorId: uId,
                    autorNombre: uName,
                    userId: uId,
                    userName: uName
                };
                // If we are creating a new version while saving a checklist, we can pass it here
                if (pendingSaveType === 'checklist') {
                    payload.checklistTemplate = pendingSaveData;
                }

                const vRes = await safeApiRequest(`/api/documentos/${documentId}/versions`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (vRes.ok) {
                    showToast(`Versión ${versionAction === 'mayor' ? 'mayor' : 'menor'} creada con éxito. Documento enviado a revisión.`, 'success');
                } else {
                    showToast('Cambios guardados pero error al crear versión', 'error');
                }
            } else {
                // No version increment
                // If it was a checklist, we just update the latest version
                if (pendingSaveType === 'checklist') {
                    if (!doc.versions || doc.versions.length === 0) {
                        showToast('No hay versiones para actualizar', 'error');
                    } else {
                        const latestVersion = doc.versions[0];
                        await safeApiRequest(`/api/documentos/${documentId}/versions/${latestVersion.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                checklistTemplate: pendingSaveData
                            })
                        });
                        showToast('Plantilla de checklist actualizada sin incrementar versión', 'success');
                    }
                } else {
                    showToast('Cambios guardados sin incremento de versión', 'success');
                }
            }

            if (pendingSaveType === 'digital') setIsEditingDigital(false);
            setShowVersionModal(false);
            setPendingSaveType(null);
            setPendingSaveData(null);
            cachedAllDocs = null;
            loadDocument(true);
        } catch (err: any) {
            console.error(err);
            showToast('Error de red al guardar', 'error');
        } finally {
            setExecutingSave(false);
            setSavingReqs(false);
            setSavingDigital(false);
        }
    };



    const getCoordinates = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
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

    const getVersionCoordinates = (e: any) => {
        const canvas = versionCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startVersionDrawing = (e: any) => {
        const coords = getVersionCoordinates(e);
        const canvas = versionCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        setIsVersionDrawing(true);
        setHasVersionSigned(true);
    };

    const drawVersion = (e: any) => {
        if (!isVersionDrawing) return;
        const coords = getVersionCoordinates(e);
        const canvas = versionCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopVersionDrawing = () => {
        setIsVersionDrawing(false);
    };

    const clearVersionCanvas = () => {
        const canvas = versionCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasVersionSigned(false);
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
            const isRevisadorPending = user && doc.revisadorId === user.id && doc.workflowState?.revisadorStatus === 'pending';
            const isAprobadorPending = user && doc.aprobadorId === user.id && doc.workflowState?.aprobadorStatus === 'pending';
            
            let role = 'revisador';
            if (isRevisadorPending) {
                role = 'revisador';
            } else if (isAprobadorPending) {
                role = 'aprobador';
            } else {
                role = doc.revisadorId === user.id ? 'revisador' : 'aprobador';
            }
            
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
                cachedAllDocs = null;
                loadDocument(true);
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

    const loadDocument = async (forceRefresh = false) => {
        if (forceRefresh) {
            delete cachedDocuments[documentId];
        }

        const cachedDoc = cachedDocuments[documentId];
        let showLoader = true;
        if (cachedDoc) {
            setDoc(cachedDoc);
            setNewRevisadorId(cachedDoc.revisadorId || '');
            setNewAprobadorId(cachedDoc.aprobadorId || '');

            if (cachedDoc.descripcion && cachedDoc.descripcion.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(cachedDoc.descripcion);
                    setEditedDigitalData({
                        objetivo: parsed.objetivo || '',
                        alcance: parsed.alcance || '',
                        desarrollo: parsed.desarrollo || '',
                        responsabilidades: parsed.responsabilidades || '',
                        videoUrl: parsed.videoUrl || '',
                        definiciones: parsed.definiciones || [],
                        referencias: parsed.referencias || []
                    });
                } catch (e) {}
            } else {
                setEditedDigitalData({
                    objetivo: '',
                    alcance: '',
                    desarrollo: '',
                    responsabilidades: '',
                    videoUrl: '',
                    definiciones: [],
                    referencias: []
                });
            }

            if (cachedDoc.versions && cachedDoc.versions.length > 0) {
                const latest = cachedDoc.versions[0];
                if (latest.checklistTemplate) {
                    setChecklistItems(latest.checklistTemplate);
                }
            } else {
                setChecklistItems([]);
            }

            if (cachedDoc.workflowState && typeof cachedDoc.workflowState === 'object' && Array.isArray(cachedDoc.workflowState.cuestionario)) {
                setQuizQuestions(cachedDoc.workflowState.cuestionario);
            } else {
                setQuizQuestions([]);
            }

            setLoading(false);
            showLoader = false;
        }

        if (showLoader) {
            setLoading(true);
        }

        try {
            const docPromise = safeApiRequest(`/api/documentos/${documentId}`);
            const optPromise = cachedActivityOptions ? Promise.resolve(null) : safeApiRequest('/api/config/options');
            const tagsPromise = cachedProjectTags ? Promise.resolve(null) : safeApiRequest('/api/config/tags');
            const allDocsPromise = cachedAllDocs ? Promise.resolve(null) : safeApiRequest('/api/documentos');
            const opsPromise = cachedOperators ? Promise.resolve(null) : safeApiRequest('/api/operators');

            const [docRes, optRes, tagsRes, allDocsRes, opsRes] = await Promise.all([
                docPromise,
                optPromise,
                tagsPromise,
                allDocsPromise,
                opsPromise
            ]);

            if (opsRes && opsRes.ok) {
                const opsData = await opsRes.json();
                if (Array.isArray(opsData)) cachedOperators = opsData;
            }
            if (cachedOperators) setOperators(cachedOperators);

            if (allDocsRes && allDocsRes.ok) {
                const docsData = await allDocsRes.json();
                if (Array.isArray(docsData)) cachedAllDocs = docsData;
            }
            if (cachedAllDocs) setAllDocs(cachedAllDocs);

            if (optRes && optRes.ok) {
                const optionsData = await optRes.json();
                if (Array.isArray(optionsData)) {
                    cachedActivityOptions = optionsData
                        .filter((o: any) => o.category === 'TIPO_ACTIVIDAD' && o.active)
                        .map((o: any) => o.value);
                }
            }
            if (cachedActivityOptions) setActivityOptions(cachedActivityOptions);

            if (tagsRes && tagsRes.ok) {
                const tagsData = await tagsRes.json();
                if (Array.isArray(tagsData)) {
                    cachedProjectTags = tagsData
                        .filter((t: any) => t.active)
                        .map((t: any) => t.name);
                }
            }
            if (cachedProjectTags) setProjectTags(cachedProjectTags);

            if (docRes.ok) {
                const data = await docRes.json();
                cachedDocuments[documentId] = data;
                setDoc(data);
                setNewRevisadorId(data.revisadorId || '');
                setNewAprobadorId(data.aprobadorId || '');

                if (data.descripcion && data.descripcion.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(data.descripcion);
                        setEditedDigitalData({
                            objetivo: parsed.objetivo || '',
                            alcance: parsed.alcance || '',
                            desarrollo: parsed.desarrollo || '',
                            responsabilidades: parsed.responsabilidades || '',
                            videoUrl: parsed.videoUrl || '',
                            definiciones: parsed.definiciones || [],
                            referencias: parsed.referencias || []
                        });
                    } catch (e) {}
                } else {
                    setEditedDigitalData({
                        objetivo: '',
                        alcance: '',
                        desarrollo: '',
                        responsabilidades: '',
                        videoUrl: '',
                        definiciones: [],
                        referencias: []
                    });
                }

                if (data.versions && data.versions.length > 0) {
                    const latest = data.versions[0];
                    if (latest.checklistTemplate) {
                        setChecklistItems(latest.checklistTemplate);
                    }
                } else {
                    setChecklistItems([]);
                }

                if (data.workflowState && typeof data.workflowState === 'object' && Array.isArray(data.workflowState.cuestionario)) {
                    setQuizQuestions(data.workflowState.cuestionario);
                } else {
                    setQuizQuestions([]);
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
                cachedAllDocs = null;
                loadDocument(true);
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
            cachedAllDocs = null;
            loadDocument(true);
        } catch (e) {
            console.error(e);
        }
    };

    const saveChecklistTemplate = () => {
        setPendingSaveType('checklist');
        setPendingSaveData(checklistItems);
        setVersionAction('menor');
        setVersionJustification('');
        setShowVersionModal(true);
    };


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Content = event.target?.result as string;
                const payload = {
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileContent: base64Content,
                    userId: user?.id || 'admin',
                    userName: user?.nombreCompleto || 'Usuario Administrador'
                };

                const res = await safeApiRequest(`/api/documentos/${documentId}/upload`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showToast('Archivo subido y asociado con éxito', 'success');
                    cachedAllDocs = null;
                    loadDocument(true);
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Error al subir el archivo', 'error');
                }
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            console.error(err);
            showToast('Error al procesar el archivo', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveQuiz = () => {
        setPendingSaveType('quiz');
        setPendingSaveData(quizQuestions);
        setVersionAction('menor');
        setVersionJustification('');
        setShowVersionModal(true);
    };

    const addQuizQuestion = () => {
        if (!newQuestion.trim()) {
            return showToast('La pregunta no puede estar vacía', 'error');
        }
        if (newOptions.some(opt => !opt.trim())) {
            return showToast('Todas las opciones de respuesta son obligatorias', 'error');
        }

        const newQ = {
            question: newQuestion.trim(),
            options: [...newOptions],
            correctAnswerIndex: newCorrectIndex
        };

        setQuizQuestions([...quizQuestions, newQ]);
        setNewQuestion('');
        setNewOptions(['', '', '', '']);
        setNewCorrectIndex(0);
        setShowQuestionBuilder(false);
        showToast('Pregunta agregada (recuerde Guardar los cambios)', 'success');
    };

    const removeQuizQuestion = (index: number) => {
        const updated = [...quizQuestions];
        updated.splice(index, 1);
        setQuizQuestions(updated);
        showToast('Pregunta eliminada (recuerde Guardar los cambios)', 'success');
    };

    const handleGenerateQuizWithAi = async () => {
        setGeneratingQuizWithAi(true);
        try {
            const uId = user?.id || 'admin';
            const uName = user?.nombreCompleto || user?.nombre || 'Usuario Administrador';
            const res = await fetch('/api/ai/training', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: documentId,
                    cantidadPreguntas: 5,
                    nivelDificultad: 'intermedio',
                    userId: uId,
                    userName: uName,
                    userRole: user?.role || 'ADMIN',
                    saveAsTraining: false
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al conectar con el servidor');
            }

            const data = await res.json();
            if (data.success && data.training && Array.isArray(data.training.cuestionario)) {
                const generatedQuiz = data.training.cuestionario.map((q: any) => ({
                    question: q.pregunta || q.question || 'Pregunta autogenerada',
                    options: q.opciones || q.options || [],
                    correctAnswerIndex: typeof q.correctaIdx === 'number' ? q.correctaIdx : (typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0)
                }));
                setQuizQuestions(generatedQuiz);
                showToast('Cuestionario generado con éxito mediante IA (edítelo y guárdelo)', 'success');
            } else {
                showToast('La IA no pudo formatear el cuestionario correctamente.', 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Error al generar cuestionario con IA', 'error');
        } finally {
            setGeneratingQuizWithAi(false);
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
        <>
            {showVersionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <FileCheck className="w-5 h-5 text-indigo-600" />
                                Control de Versiones
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Ha modificado el documento. Seleccione cómo proceder con el versionado.</p>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-3">
                                <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/50 border-slate-200 dark:border-slate-700">
                                    <input type="radio" name="versionAction" value="mayor" checked={versionAction === 'mayor'} onChange={() => setVersionAction('mayor')} className="mt-1" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Incrementar Versión MAYOR (+1.0)</p>
                                        <p className="text-xs text-slate-500">Cambios estructurales, nuevo alcance, o reescritura significativa.</p>
                                    </div>
                                </label>
                                <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/50 border-slate-200 dark:border-slate-700">
                                    <input type="radio" name="versionAction" value="menor" checked={versionAction === 'menor'} onChange={() => setVersionAction('menor')} className="mt-1" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Incrementar Versión MENOR (+0.1)</p>
                                        <p className="text-xs text-slate-500">Correcciones ortográficas, actualizaciones menores o adición de detalles sin afectar el procedimiento general.</p>
                                    </div>
                                </label>
                                <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/50 border-slate-200 dark:border-slate-700">
                                    <input type="radio" name="versionAction" value="none" checked={versionAction === 'none'} onChange={() => setVersionAction('none')} className="mt-1" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">No incrementar versión</p>
                                        <p className="text-xs text-slate-500">Solo aplicable para correcciones mínimas (typos) que NO alteran en absoluto el contenido normativo. Requiere justificación.</p>
                                    </div>
                                </label>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Justificación del cambio / Motivo {versionAction === 'none' && <span className="text-rose-500">* (Obligatorio)</span>}
                                </label>
                                <textarea
                                    value={versionJustification}
                                    onChange={e => setVersionJustification(e.target.value)}
                                    placeholder={versionAction === 'none' ? "Explique por qué no es necesario incrementar la versión..." : "Describa brevemente los cambios realizados..."}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                                />
                            </div>

                            {versionAction !== 'none' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Revisado Por</label>
                                            <select
                                                value={newRevisadorId}
                                                onChange={e => setNewRevisadorId(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold focus:border-indigo-500 outline-none"
                                            >
                                                <option value="">(Sin asignar)</option>
                                                {operators
                                                    .filter(op => ['supervisor', 'admin', 'qa'].includes((op.role || '').toLowerCase()))
                                                    .map(op => (
                                                        <option key={op.id} value={op.id}>{op.nombreCompleto || op.nombre}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Aprobado Por</label>
                                            <select
                                                value={newAprobadorId}
                                                onChange={e => setNewAprobadorId(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold focus:border-indigo-500 outline-none"
                                            >
                                                <option value="">(Sin asignar)</option>
                                                {operators
                                                    .filter(op => ['supervisor', 'admin', 'qa'].includes((op.role || '').toLowerCase()))
                                                    .map(op => (
                                                        <option key={op.id} value={op.id}>{op.nombreCompleto || op.nombre}</option>
                                                    ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Firma Digital del Creador (Modificador)</label>
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white relative h-32">
                                            <canvas
                                                ref={versionCanvasRef}
                                                width={400}
                                                height={128}
                                                onMouseDown={startVersionDrawing}
                                                onMouseMove={drawVersion}
                                                onMouseUp={stopVersionDrawing}
                                                onMouseLeave={stopVersionDrawing}
                                                onTouchStart={startVersionDrawing}
                                                onTouchMove={drawVersion}
                                                onTouchEnd={stopVersionDrawing}
                                                className="w-full h-full touch-none cursor-crosshair"
                                            />
                                            {hasVersionSigned && (
                                                <button
                                                    type="button"
                                                    onClick={clearVersionCanvas}
                                                    className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-colors"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                            {!hasVersionSigned && (
                                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                                    <span className="text-slate-300 dark:text-slate-600 font-medium text-sm">Firme aquí</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowVersionModal(false); setPendingSaveType(null); setPendingSaveData(null); }}
                                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={executeVersionedSave}
                                disabled={executingSave || (versionAction !== 'none' && !hasVersionSigned) || (versionAction === 'none' && !versionJustification.trim())}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {executingSave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {executingSave ? 'Guardando...' : 'Confirmar y Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        { id: 'lms', label: 'LMS & Capacitación' },
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
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Digital SOP Procedure Section */}
                            {(() => {
                                let isDigital = false;
                                let digitalData: any = null;
                                try {
                                    if (doc.descripcion && doc.descripcion.trim().startsWith('{')) {
                                        const parsed = JSON.parse(doc.descripcion);
                                        if (parsed.isDigital) { isDigital = true; digitalData = parsed; }
                                    }
                                } catch (e) {}
                                const canEdit = ['supervisor', 'admin', 'qa'].includes((user?.role || '').toLowerCase());
                                const youtubeUrl = isDigital && digitalData?.videoUrl ? getYoutubeEmbedUrl(digitalData.videoUrl) : null;
                                const DEFAULT_ABBREVIATIONS = [
                                    { term: 'EPP', definition: 'Equipos de Protección Personal' },
                                    { term: 'OS', definition: 'Orden de Servicio' },
                                    { term: 'QMS', definition: 'Quality Management System (Sistema de Gestión de Calidad)' },
                                    { term: 'ISO', definition: 'Organización Internacional de Normalización' },
                                    { term: 'QA', definition: 'Quality Assurance (Aseguramiento de la Calidad)' },
                                    { term: 'HSE', definition: 'Health, Safety and Environment (Higiene, Seguridad y Medio Ambiente)' },
                                    { term: 'SOP', definition: 'Standard Operating Procedure (Procedimiento Operativo Estándar)' },
                                    { term: 'SST', definition: 'Seguridad y Salud en el Trabajo' }
                                ];
                                const allAbbreviations = [...DEFAULT_ABBREVIATIONS, ...customAbbrevs];

                                // EDITING MODE
                                if (isDigital && isEditingDigital) {
                                    return (
                                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-indigo-300 dark:border-indigo-700 space-y-6 shadow-xl shadow-indigo-500/5">
                                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-5 h-5 text-indigo-500" />
                                                    <h3 className="font-black text-slate-800 dark:text-slate-100">Editor de Procedimiento Digital</h3>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setIsEditingDigital(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-slate-700 rounded-lg">Cancelar</button>
                                                    <button onClick={handleSaveDigitalData} disabled={savingDigital} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                                                        {savingDigital && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                                        {savingDigital ? 'Guardando...' : 'Guardar Procedimiento'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Objetivo */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">2. Objetivo</label>
                                                <textarea value={editedDigitalData.objetivo} onChange={e => setEditedDigitalData({...editedDigitalData, objetivo: e.target.value})} rows={3} placeholder="Describa el propósito y metas operativas..." className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none" />
                                            </div>

                                            {/* Alcance */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">3. Alcance</label>
                                                <textarea value={editedDigitalData.alcance} onChange={e => setEditedDigitalData({...editedDigitalData, alcance: e.target.value})} rows={3} placeholder="Defina el alcance del documento..." className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none" />
                                            </div>

                                            {/* Desarrollo */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">4. Desarrollo de la Actividad</label>
                                                <textarea value={editedDigitalData.desarrollo} onChange={e => setEditedDigitalData({...editedDigitalData, desarrollo: e.target.value})} rows={6} placeholder="Detalle paso a paso las actividades..." className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none" />
                                            </div>

                                            {/* Responsabilidades */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">5. Responsabilidades</label>
                                                <textarea value={editedDigitalData.responsabilidades} onChange={e => setEditedDigitalData({...editedDigitalData, responsabilidades: e.target.value})} rows={3} placeholder="Defina roles y responsabilidades..." className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none" />
                                            </div>

                                            {/* Video URL */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Link de Video / Capacitación (YouTube)</label>
                                                <input type="url" value={editedDigitalData.videoUrl} onChange={e => setEditedDigitalData({...editedDigitalData, videoUrl: e.target.value})} placeholder="https://www.youtube.com/watch?v=..." className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                                            </div>

                                            {/* Definiciones / Abreviaturas */}
                                            <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">6. Definiciones y Abreviaturas</label>
                                                {/* Existing definitions list */}
                                                {editedDigitalData.definiciones && editedDigitalData.definiciones.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        {editedDigitalData.definiciones.map((d: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/30 px-3 py-2 rounded-lg text-xs">
                                                                <span className="font-black text-indigo-600 min-w-[60px]">{d.term}</span>
                                                                <span className="text-slate-600 dark:text-slate-300 flex-1">{d.definition}</span>
                                                                <button onClick={() => { const updated = [...editedDigitalData.definiciones]; updated.splice(i, 1); setEditedDigitalData({...editedDigitalData, definiciones: updated}); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Quick-pick from known abbreviations */}
                                                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-xl space-y-2">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Seleccionar abreviatura conocida</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {allAbbreviations.filter(a => !(editedDigitalData.definiciones || []).some((d: any) => d.term === a.term)).map(a => (
                                                            <button key={a.term} onClick={() => setEditedDigitalData({...editedDigitalData, definiciones: [...(editedDigitalData.definiciones || []), { term: a.term, definition: a.definition }]})} className="px-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-md hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 transition-colors">{a.term}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* Add custom definition */}
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-shrink-0 w-24">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Término</label>
                                                        <input value={newTerm} onChange={e => setNewTerm(e.target.value.toUpperCase())} placeholder="EJ" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Definición</label>
                                                        <input value={newDef} onChange={e => setNewDef(e.target.value)} placeholder="Descripción del término..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500" />
                                                    </div>
                                                    <button onClick={() => {
                                                        if (!newTerm || !newDef) return;
                                                        setEditedDigitalData({...editedDigitalData, definiciones: [...(editedDigitalData.definiciones || []), { term: newTerm, definition: newDef }]});
                                                        if (saveToFrequents) {
                                                            const updated = [...customAbbrevs, { term: newTerm, definition: newDef }];
                                                            setCustomAbbrevs(updated);
                                                            localStorage.setItem('hdb_custom_definitions', JSON.stringify(updated));
                                                        }
                                                        setNewTerm(''); setNewDef('');
                                                    }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex-shrink-0">+ Agregar</button>
                                                </div>
                                                <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                    <input type="checkbox" checked={saveToFrequents} onChange={e => setSaveToFrequents(e.target.checked)} className="rounded border-slate-300 text-indigo-600 w-3 h-3" />
                                                    Guardar nuevo término en mis frecuentes
                                                </label>
                                            </div>

                                            {/* Referencias a documentos internos */}
                                            <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">7. Referencias a Documentos Internos</label>
                                                {editedDigitalData.referencias && editedDigitalData.referencias.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        {editedDigitalData.referencias.map((r: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/30 px-3 py-2 rounded-lg text-xs">
                                                                <span className="font-black text-emerald-600 min-w-[80px]">[{r.codigo}]</span>
                                                                <span className="text-slate-600 dark:text-slate-300 flex-1">{r.titulo}</span>
                                                                <button onClick={() => { const updated = [...editedDigitalData.referencias]; updated.splice(i, 1); setEditedDigitalData({...editedDigitalData, referencias: updated}); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Search existing docs */}
                                                <div className="relative">
                                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                                    <input value={refSearch} onChange={e => { setRefSearch(e.target.value); setShowRefResults(e.target.value.length > 1); }} placeholder="Buscar documento interno por código o título..." className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-indigo-500" />
                                                    {showRefResults && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto z-10">
                                                            {allDocs.filter((d: any) => d.id !== documentId && ((d.codigoDocumental || '').toLowerCase().includes(refSearch.toLowerCase()) || (d.titulo || '').toLowerCase().includes(refSearch.toLowerCase()))).slice(0, 8).map((d: any) => (
                                                                <button key={d.id} onClick={() => {
                                                                    const already = (editedDigitalData.referencias || []).some((r: any) => r.codigo === d.codigoDocumental);
                                                                    if (!already) setEditedDigitalData({...editedDigitalData, referencias: [...(editedDigitalData.referencias || []), { codigo: d.codigoDocumental, titulo: d.titulo }]});
                                                                    setRefSearch(''); setShowRefResults(false);
                                                                }} className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-xs flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                                                    <PlusCircle className="w-4 h-4 text-indigo-500" />
                                                                    <span className="font-bold text-indigo-600">{d.codigoDocumental}</span>
                                                                    <span className="text-slate-500 truncate">{d.titulo}</span>
                                                                </button>
                                                            ))}
                                                            {allDocs.filter((d: any) => d.id !== documentId && ((d.codigoDocumental || '').toLowerCase().includes(refSearch.toLowerCase()) || (d.titulo || '').toLowerCase().includes(refSearch.toLowerCase()))).length === 0 && (
                                                                <p className="px-3 py-2 text-xs text-slate-400">Sin resultados</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Manual reference */}
                                                <div className="flex gap-2">
                                                    <input value={customRefText} onChange={e => setCustomRefText(e.target.value)} placeholder="O agregar referencia manual (ej: ISO 9001:2015)..." className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500" />
                                                    <button onClick={() => { if (!customRefText) return; setEditedDigitalData({...editedDigitalData, referencias: [...(editedDigitalData.referencias || []), { codigo: 'EXT', titulo: customRefText }]}); setCustomRefText(''); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex-shrink-0">+ Ref</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // VIEW MODE (digital)
                                if (isDigital && digitalData) {
                                    return (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Procedimiento Digital</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {canEdit && (
                                                        <button onClick={() => { setEditedDigitalData({...digitalData}); setIsEditingDigital(true); }} className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">✏️ Editar</button>
                                                    )}
                                                    <button onClick={handleExportPDF} className="px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Exportar PDF</button>
                                                </div>
                                            </div>

                                            {/* Video embed */}
                                            {youtubeUrl && isOnline && (
                                                <div className="bg-black rounded-2xl overflow-hidden border border-slate-700">
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900">
                                                        <Play className="w-4 h-4 text-indigo-500" />
                                                        <span className="text-xs font-bold text-slate-300">Video de Capacitación</span>
                                                    </div>
                                                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                                        <iframe src={youtubeUrl} title="Video de capacitación" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full" />
                                                    </div>
                                                </div>
                                            )}

                                            {youtubeUrl && !isOnline && (
                                                <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-6 text-center border border-slate-200 dark:border-slate-700">
                                                    <Play className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-slate-500">Video no disponible sin conexión a internet</p>
                                                </div>
                                            )}

                                            {/* Read-only sections */}
                                            {[
                                                { title: '2. Objetivo', content: digitalData.objetivo },
                                                { title: '3. Alcance', content: digitalData.alcance },
                                                { title: '4. Desarrollo de la Actividad', content: digitalData.desarrollo },
                                                { title: '5. Responsabilidades', content: digitalData.responsabilidades },
                                            ].filter(s => s.content).map((section, idx) => (
                                                <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">{section.title}</p>
                                                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{section.content}</p>
                                                </div>
                                            ))}

                                            {/* Definiciones table */}
                                            {digitalData.definiciones && digitalData.definiciones.length > 0 && (
                                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">6. Definiciones y Abreviaturas</p>
                                                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <table className="w-full text-xs">
                                                            <thead><tr className="bg-slate-50 dark:bg-slate-900/50"><th className="text-left px-3 py-2 font-black text-slate-500 uppercase text-[10px]">Término</th><th className="text-left px-3 py-2 font-black text-slate-500 uppercase text-[10px]">Definición</th></tr></thead>
                                                            <tbody>{digitalData.definiciones.map((d: any, i: number) => (<tr key={i} className="border-t border-slate-100 dark:border-slate-700"><td className="px-3 py-2 font-black text-indigo-600">{d.term}</td><td className="px-3 py-2 text-slate-600 dark:text-slate-300">{d.definition}</td></tr>))}</tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Referencias */}
                                            {digitalData.referencias && digitalData.referencias.length > 0 && (
                                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">7. Referencias</p>
                                                    <div className="space-y-1.5">
                                                        {digitalData.referencias.map((r: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs"><span className="font-black text-emerald-600">[{r.codigo}]</span><span className="text-slate-600 dark:text-slate-300">{r.titulo}</span></div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // NON-DIGITAL (plain text description or empty)
                                return (
                                    <div className="space-y-3">
                                        {doc.descripcion ? (
                                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descripción General</p>
                                                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{doc.descripcion}</p>
                                            </div>
                                        ) : null}
                                        {canEdit && (
                                            <button onClick={() => { setEditedDigitalData({ objetivo: '', alcance: '', desarrollo: '', responsabilidades: '', videoUrl: '', definiciones: [], referencias: [] }); handleSaveDigitalData(); setTimeout(() => { setIsEditingDigital(true); loadDocument(true); }, 500); }} className="w-full py-3 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-2xl text-sm font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-2">
                                                <Sparkles className="w-4 h-4" /> Convertir a Procedimiento Digital (formulario interactivo)
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}

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

                            {/* Responsables: Creado Por (original), Editado Por, Revisado Por, Aprobado Por */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Responsables del Documento</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Creado Por</p>
                                        <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{doc.createdByName || 'N/A'}</p>
                                    </div>
                                    <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Editado Por</p>
                                        <p className="font-bold text-sm text-indigo-700 dark:text-indigo-300">{doc.workflowState?.editorName || doc.createdByName || 'N/A'}</p>
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

                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Requerimientos Operativos Obligatorios</p>
                                    {(user?.role?.toLowerCase() === 'supervisor' || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'qa') && (
                                        <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded">Editor</span>
                                    )}
                                </div>
                                
                                {(user?.role?.toLowerCase() === 'supervisor' || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'qa') ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <label className="flex items-center gap-2.5 cursor-pointer group flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={editReqLectura}
                                                    onChange={e => setEditReqLectura(e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Requiere Confirmación de Lectura</span>
                                            </label>

                                            <label className="flex items-center gap-2.5 cursor-pointer group flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={editReqCapacitacion}
                                                    onChange={e => setEditReqCapacitacion(e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Requiere Capacitación Obligatoria (LMS)</span>
                                            </label>
                                        </div>

                                        {editReqCapacitacion && (
                                            <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150 pl-4 border-l-2 border-indigo-500">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Periodo de Validez / Vencimiento (en meses)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Ej. 12"
                                                    value={editValidezMeses}
                                                    onChange={e => setEditValidezMeses(e.target.value)}
                                                    className="w-full max-w-[200px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                                                />
                                            </div>
                                        )}

                                        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                            <button
                                                type="button"
                                                onClick={handleSaveRequirements}
                                                disabled={savingReqs}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 disabled:opacity-50"
                                            >
                                                {savingReqs ? 'Guardando...' : 'Guardar Requerimientos'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-4 flex-wrap">
                                        {doc.requiereConfirmacionLectura && (
                                            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm font-bold">
                                                <CheckCircle2 className="w-4 h-4" /> Requiere Confirmación de Lectura
                                            </div>
                                        )}
                                        {doc.requiereCapacitacion && (
                                            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg text-sm font-bold">
                                                <ShieldAlert className="w-4 h-4" /> Requiere Capacitación {doc.validezMeses ? `(Vence c/ ${doc.validezMeses} meses)` : '(Sin vto. establecido)'}
                                            </div>
                                        )}
                                        {!doc.requiereConfirmacionLectura && !doc.requiereCapacitacion && (
                                            <p className="text-xs text-slate-400">Este documento no tiene requerimientos obligatorios asociados.</p>
                                        )}
                                    </div>
                                )}
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
                                        <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[140px] ${
                                            doc.workflowState.creatorStatus === 'approved' || doc.workflowState.creatorSignature
                                                ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/50'
                                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                                        }`}>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Editado Por</p>
                                                <p className="font-bold text-sm text-slate-700 dark:text-slate-200 mt-1">{doc.workflowState?.editorName || doc.createdByName || 'Editor'}</p>
                                                <p className="text-[10px] text-slate-500">{doc.workflowState?.editorPosition || doc.workflowState?.creatorPosition || ''}</p>
                                                {(doc.workflowState.creatorStatus === 'approved' || doc.workflowState.creatorSignature) && (
                                                    <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-2 bg-emerald-100 text-emerald-700">
                                                        De Acuerdo
                                                    </span>
                                                )}
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
                                                    {doc.workflowState.creatorSignatureDate ? formatDateTimeInline(doc.workflowState.creatorSignatureDate) : ''}
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
                                                    <p className="text-[10px] text-slate-500">{doc.workflowState?.revisadorPosition || ''}</p>
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
                                                            {formatDateTimeInline(doc.workflowState.revisadorSignatureDate)}
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
                                                    <p className="text-[10px] text-slate-500">{doc.workflowState?.aprobadorPosition || ''}</p>
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
                                                            {formatDateTimeInline(doc.workflowState.aprobadorSignatureDate)}
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

                                            // Enforce evaluation checklist/quiz checks
                                            const hasQuiz = !doc.requiereCapacitacion || (doc.workflowState?.cuestionario && Array.isArray(doc.workflowState.cuestionario) && doc.workflowState.cuestionario.length > 0);
                                            const isComplete = hasQuiz;

                                            if (!isComplete) {
                                                return (
                                                    <div className="mt-6 bg-amber-50/50 dark:bg-amber-950/10 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-3">
                                                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                                                            <AlertCircle className="w-5 h-5 text-amber-500" />
                                                            <span className="font-bold text-sm">Firma Bloqueada: Requisitos Pendientes</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                                            Este documento no se puede revisar ni aprobar todavía porque no se ha configurado su evaluación LMS:
                                                        </p>
                                                        <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                                            {!hasQuiz && <li>Falta configurar las preguntas de la evaluación (Multiple Choice).</li>}
                                                        </ul>
                                                        <p className="text-xs text-slate-500 font-bold italic pt-1">
                                                            Vaya a la pestaña "LMS & Capacitación" para completar el cuestionario y desbloquear las firmas.
                                                        </p>
                                                    </div>
                                                );
                                            }

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
                                                {rule.tagsRequeridos && Array.isArray(rule.tagsRequeridos) && rule.tagsRequeridos.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etiquetas de Proyecto Requeridas</p>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {rule.tagsRequeridos.map((t: string) => (
                                                                <span key={t} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100/50 dark:border-indigo-800/50">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
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
                        <div className="space-y-6 max-w-3xl mx-auto">
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

                    {tab === 'lms' && (
                        <div className="space-y-6">
                            {/* Material de Capacitación Block */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm animate-in fade-in duration-200">
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">1. Material Didáctico y Control Documental</h3>
                                    </div>
                                    <div>
                                        {doc.versions?.[0]?.files?.some((f: any) => f.esPrincipal) ? (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Archivo Subido
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1.5">
                                                Archivo Opcional
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Opcionalmente, puede subir un documento de respaldo en formato Word o PDF para acompañar el contenido digital de esta versión del procedimiento.
                                </p>

                                <div className="pt-2">
                                    {/* Upload Final File */}
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Subir Archivo de Respaldo (Opcional)</span>
                                            <span className="text-[11px] text-slate-500 leading-normal block">
                                                Soporta formatos Word (.doc, .docx) y PDF.
                                            </span>
                                        </div>
                                        <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0">
                                            <Upload className="w-4 h-4" />
                                            {uploading ? 'Subiendo...' : 'Seleccionar y Subir Archivo'}
                                            <input
                                                type="file"
                                                accept=".doc,.docx,.pdf"
                                                onChange={handleFileUpload}
                                                disabled={uploading}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {doc.versions?.[0]?.files?.some((f: any) => f.esPrincipal) && (
                                    <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                                    {doc.versions[0].files.find((f: any) => f.esPrincipal).nombreArchivo}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    Tamaño: {Math.round(doc.versions[0].files.find((f: any) => f.esPrincipal).tamanioBytes / 1024)} KB
                                                </span>
                                            </div>
                                        </div>
                                        <a
                                            href={`/api/documentos/${doc.id}/download`}
                                            download
                                            className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold text-indigo-600 flex items-center gap-1.5 transition-all shadow-sm"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Descargar Archivo
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Evaluación Multiple Choice Block */}
                            {doc.requiereCapacitacion && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-5 shadow-sm">
                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">2. Cuestionario de Evaluación (LMS Multiple Choice)</h3>
                                        </div>
                                        <div>
                                            {quizQuestions.length > 0 ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> {quizQuestions.length} Preguntas
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 flex items-center gap-1.5">
                                                    <AlertCircle className="w-3.5 h-3.5 animate-pulse" /> Sin Preguntas
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Dado que este documento requiere capacitación obligatoria, debe estructurar una evaluación de opción múltiple. Cada técnico asignado deberá aprobar esta evaluación antes de considerarse apto para la operación técnica.
                                    </p>

                                    {/* Generador de Cuestionario con IA */}
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-indigo-50/40 dark:bg-indigo-950/10 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 gap-3">
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1">
                                                <Sparkles className="w-4 h-4 text-indigo-500" /> Cuestionario Inteligente con IA
                                            </p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                Genere automáticamente un borrador del cuestionario a partir de la Información General, video insertado y documentos de respaldo.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGenerateQuizWithAi}
                                            disabled={generatingQuizWithAi}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 shrink-0 disabled:opacity-50"
                                        >
                                            {generatingQuizWithAi ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Generando Cuestionario...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    <span>Generar con IA</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Action bar for adding questions when questions exist */}
                                    {quizQuestions.length > 0 && !showQuestionBuilder && (
                                        <div className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/10 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30">
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">¿Desea agregar más preguntas?</p>
                                                <p className="text-[10px] text-slate-400">Puede agregar múltiples preguntas de opción múltiple a la evaluación.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewQuestion('');
                                                    setNewOptions(['', '', '', '']);
                                                    setNewCorrectIndex(0);
                                                    setShowQuestionBuilder(true);
                                                }}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Añadir Pregunta
                                            </button>
                                        </div>
                                    )}

                                    {/* Question Builder Form */}
                                    {(showQuestionBuilder || quizQuestions.length === 0) && (
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black uppercase tracking-widest text-indigo-600 block">Diseñador de Preguntas</span>
                                                {quizQuestions.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowQuestionBuilder(false)}
                                                        className="text-xs font-bold text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </div>
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Enunciado de la Pregunta</label>
                                            <input
                                                type="text"
                                                value={newQuestion}
                                                onChange={e => setNewQuestion(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                                                placeholder="Ej: ¿Qué EPP es obligatorio para la manipulación de alta tensión?"
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Opciones de Respuesta (Mínimo 2)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewOptions([...newOptions, ''])}
                                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-750 dark:hover:text-indigo-300 transition-colors flex items-center gap-1"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar Opción
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {newOptions.map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex items-center gap-2">
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                value={opt}
                                                                onChange={e => {
                                                                    const copy = [...newOptions];
                                                                    copy[oIdx] = e.target.value;
                                                                    setNewOptions(copy);
                                                                }}
                                                                className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                                                                placeholder={`Opción ${oIdx + 1}`}
                                                            />
                                                        </div>
                                                        {newOptions.length > 2 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const copy = [...newOptions];
                                                                    copy.splice(oIdx, 1);
                                                                    setNewOptions(copy);
                                                                    if (newCorrectIndex >= copy.length) {
                                                                        setNewCorrectIndex(copy.length - 1);
                                                                    }
                                                                }}
                                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors shrink-0"
                                                                title="Eliminar esta opción"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
                                            <div className="flex-1 max-w-xs">
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Respuesta Correcta</label>
                                                <select
                                                    value={newCorrectIndex}
                                                    onChange={e => setNewCorrectIndex(parseInt(e.target.value))}
                                                    className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                                                >
                                                    {newOptions.map((opt, oIdx) => (
                                                        <option key={oIdx} value={oIdx}>Opción {oIdx + 1} {opt ? `(${opt.substring(0, 20)}...)` : ''}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={addQuizQuestion}
                                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Agregar Pregunta
                                            </button>
                                        </div>
                                    </div>
                                )}

                                    {/* Questions List */}
                                    {quizQuestions.length > 0 ? (
                                        <div className="space-y-3">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Preguntas del Cuestionario ({quizQuestions.length})</span>
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/10">
                                                {quizQuestions.map((q, idx) => (
                                                    <div key={idx} className="p-4 flex justify-between gap-4 items-start hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                                        <div className="space-y-2 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[10px] font-black text-indigo-600 flex items-center justify-center shrink-0">
                                                                    {idx + 1}
                                                                </span>
                                                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{q.question}</h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                                                                {q.options?.map((opt, oIdx) => (
                                                                    <div
                                                                        key={oIdx}
                                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
                                                                            oIdx === q.correctAnswerIndex
                                                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-850 dark:bg-emerald-950/10 dark:border-emerald-900/30 dark:text-emerald-450'
                                                                                : 'bg-white border-slate-100 text-slate-505 dark:bg-slate-800 dark:border-slate-800'
                                                                        }`}
                                                                    >
                                                                        <span className="font-bold mr-1">{String.fromCharCode(65 + oIdx)})</span> {opt}
                                                                        {oIdx === q.correctAnswerIndex && <span className="ml-1 text-[9px] font-bold text-emerald-600 uppercase tracking-widest">(Correcta)</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeQuizQuestion(idx)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 border border-dashed border-slate-250 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-900/5">
                                            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs font-medium text-slate-400">No hay preguntas agregadas todavía. Complete el formulario anterior.</p>
                                        </div>
                                    )}

                                    {/* Save Cuestionario Action */}
                                    <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <button
                                            type="button"
                                            onClick={handleSaveQuiz}
                                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                        >
                                            <Save className="w-4 h-4" /> Guardar Cuestionario en Servidor
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Seguimiento de Operarios LMS (Real-time tracking) */}
                            {doc.estado === 'vigente' && doc.requiereCapacitacion && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-5 shadow-sm">
                                    <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">3. Estado de Avance de Técnicos Asignados (LMS Tracker)</h3>
                                        </div>
                                    </div>

                                    {(() => {
                                        const activeTrainings = doc.trainings?.filter((t: any) => t.operator?.activo) || [];
                                        const total = activeTrainings.length;
                                        const approved = activeTrainings.filter((t: any) => t.estado === 'aprobado').length;
                                        const failed = activeTrainings.filter((t: any) => t.estado === 'reprobado').length;
                                        const pending = total - approved - failed;

                                        const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
                                        const failedPct = total > 0 ? Math.round((failed / total) * 100) : 0;
                                        const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;

                                        if (total === 0) {
                                            return (
                                                <div className="text-center py-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                                                    <p className="text-xs text-slate-400">No hay técnicos activos afectados a la capacitación de este documento.</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-5">
                                                {/* Stats Cards */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center animate-in zoom-in-95 duration-200">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">Aprobados</span>
                                                        <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 block">{approved}</span>
                                                        <span className="text-[10px] text-slate-405 font-bold">{approvedPct}%</span>
                                                    </div>
                                                    <div className="bg-rose-50/50 dark:bg-rose-950/10 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/30 text-center animate-in zoom-in-95 duration-200">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400 block mb-1">Desaprobados</span>
                                                        <span className="text-lg font-black text-rose-700 dark:text-rose-300 block">{failed}</span>
                                                        <span className="text-[10px] text-slate-405 font-bold">{failedPct}%</span>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in-95 duration-200">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-505 block mb-1">Pendientes</span>
                                                        <span className="text-lg font-black text-slate-600 dark:text-slate-300 block">{pending}</span>
                                                        <span className="text-[10px] text-slate-405 font-bold">{pendingPct}%</span>
                                                    </div>
                                                </div>

                                                {/* Visual Bar Stacked */}
                                                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-inner">
                                                    {approved > 0 && <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${approvedPct}%` }} title={`Aprobados: ${approvedPct}%`} />}
                                                    {failed > 0 && <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${failedPct}%` }} title={`Desaprobados: ${failedPct}%`} />}
                                                    {pending > 0 && <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${pendingPct}%` }} title={`Pendientes: ${pendingPct}%`} />}
                                                </div>

                                                {/* Table list */}
                                                <div className="border border-slate-150 dark:border-slate-850 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-805">
                                                    <table className="w-full border-collapse text-left text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-150 dark:border-slate-800">
                                                                <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Técnico / Operario</th>
                                                                <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Estado LMS</th>
                                                                <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Puntaje</th>
                                                                <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Última Actividad</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {activeTrainings.map((t: any) => (
                                                                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                                                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                                                                        {t.operator?.nombreCompleto || 'Operario desconocido'}
                                                                    </td>
                                                                    <td className="p-3">
                                                                        {t.estado === 'aprobado' ? (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 inline-flex items-center gap-1">
                                                                                <UserCheck className="w-3 h-3" /> Aprobado
                                                                            </span>
                                                                        ) : t.estado === 'reprobado' ? (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 inline-flex items-center gap-1">
                                                                                <UserX className="w-3 h-3" /> No Aprobado
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 inline-flex items-center gap-1">
                                                                                <Clock className="w-3 h-3 animate-pulse" /> Pendiente
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 font-bold text-slate-650 dark:text-slate-350">
                                                                        {t.puntajeObtenido !== null ? `${t.puntajeObtenido}%` : 'N/A'}
                                                                    </td>
                                                                    <td className="p-3 text-[11px] text-slate-400">
                                                                        {t.completadoAt ? formatDateInline(t.completadoAt) : 'Pendiente de inicio'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
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
                                            {formatDateInline(v.createdAt)}
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
                            <button 
                                onClick={() => {
                                    setShowRuleModal(false);
                                    setNewRule({ tipoActividad: '', bloqueanteDeInicio: false, generaChecklist: false, tagsRequeridos: [] });
                                }} 
                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Actividad</label>
                                <select
                                    value={newRule.tipoActividad}
                                    onChange={e => setNewRule({...newRule, tipoActividad: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">Todas las actividades</option>
                                    {activityOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            {projectTags.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        Etiquetas de Proyecto Requeridas (Opcional)
                                    </label>
                                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto">
                                        {projectTags.map(tag => {
                                            const isSelected = newRule.tagsRequeridos?.includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = newRule.tagsRequeridos || [];
                                                        const updated = isSelected
                                                            ? current.filter(t => t !== tag)
                                                            : [...current, tag];
                                                        setNewRule({ ...newRule, tagsRequeridos: updated });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                        isSelected
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">La regla se aplicará si el proyecto tiene alguna de estas etiquetas.</p>
                                </div>
                            )}

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
                                onClick={() => {
                                    setShowRuleModal(false);
                                    setNewRule({ tipoActividad: '', bloqueanteDeInicio: false, generaChecklist: false, tagsRequeridos: [] });
                                }}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    addRule(newRule);
                                    setShowRuleModal(false);
                                    setNewRule({ tipoActividad: '', bloqueanteDeInicio: false, generaChecklist: false, tagsRequeridos: [] });
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
        </>
    );
}
