'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    X, FileText, Loader2, FileSignature, Check, ChevronRight, ChevronLeft, 
    Plus, Trash2, Search, Link2, BookOpen, Play, AlertCircle, Sparkles, PlusCircle 
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import TechAssistantChat from '@/components/TechAssistantChat';
import { useModalScroll } from '@/lib/useModalScroll';

export default function NewDocumentModal({ onClose, onSuccess, user }: { onClose: () => void, onSuccess: (newDocId: string) => void, user: any }) {
    useModalScroll(true);
    const [loading, setLoading] = useState(false);
    const [operators, setOperators] = useState<any[]>([]);
    const [tagsList, setTagsList] = useState<any[]>([]);
    const [allDocs, setAllDocs] = useState<any[]>([]);

    // AI Assistant Drawer state
    const [showAiDrawer, setShowAiDrawer] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiParams, setAiParams] = useState({
        proceso: '',
        alcance: '',
        sector: '',
        detallesAdicionales: ''
    });
    const [aiResult, setAiResult] = useState<any>(null);

    const handleGenerateAiDoc = async () => {
        if (!aiParams.proceso || !aiParams.alcance || !aiParams.sector) {
            setAiError('Por favor complete Proceso, Alcance y Sector.');
            return;
        }
        setAiError('');
        setAiLoading(true);
        try {
            const res = await fetch('/api/ai/generate-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipoDocumento: formData.tipoDocumento,
                    proceso: aiParams.proceso,
                    alcance: aiParams.alcance,
                    sector: aiParams.sector,
                    detallesAdicionales: aiParams.detallesAdicionales,
                    userId: user?.id,
                    userName: user?.nombreCompleto || user?.nombre,
                    userRole: user?.role
                })
            });
            const data = await res.json();
            if (res.ok && data.success && data.document) {
                setAiResult(data.document);
            } else {
                setAiError(data.error || 'Error al generar el borrador con IA.');
            }
        } catch (e: any) {
            setAiError('Error de red al conectar con el servicio de IA.');
        } finally {
            setAiLoading(false);
        }
    };
    
    // Toggle for digital vs traditional
    const [isDigital, setIsDigital] = useState(true);

    // Steps: general, content_1 (Objetivo/Alcance), content_2 (Desarrollo/Resp), content_3 (Glosario/Refs), signature
    const [activeStep, setActiveStep] = useState('general');

    const [formData, setFormData] = useState({
        titulo: '',
        tipoDocumento: 'PG',
        area: 'GLB',
        nivelCriticidad: 'medio',
        requiereConfirmacionLectura: true,
        requiereCapacitacion: false,
        validezMeses: '12',
        revisadorId: '',
        aprobadorId: '',
        tags: [] as string[]
    });

    const [previewCode, setPreviewCode] = useState<string>('Calculando...');
    const [previewError, setPreviewError] = useState<string>('');

    useEffect(() => {
        if (formData.tipoDocumento && formData.area) {
            setPreviewCode('Calculando...');
            setPreviewError('');
            safeApiRequest(`/api/documentos/next-code?tipo=${formData.tipoDocumento}&area=${formData.area}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        setPreviewError(data.error);
                        setPreviewCode('');
                    } else if (data.nextCode) {
                        setPreviewCode(data.nextCode);
                    }
                })
                .catch(err => {
                    setPreviewError('Error al calcular identificador');
                    setPreviewCode('');
                });
        }
    }, [formData.tipoDocumento, formData.area]);

    // Digital Structured Content
    const [digitalData, setDigitalData] = useState({
        objetivo: '',
        alcance: '',
        desarrollo: '',
        responsabilidades: '',
        videoUrl: '',
        definiciones: [] as { term: string; definition: string }[],
        referencias: [] as { docId?: string; codigo: string; titulo: string }[]
    });

    // Abbreviations Helpers
    const [customAbbrevs, setCustomAbbrevs] = useState<{ term: string; definition: string }[]>([]);
    const [newTerm, setNewTerm] = useState('');
    const [newDef, setNewDef] = useState('');
    const [saveToFrequents, setSaveToFrequents] = useState(true);

    // Reference search helper state
    const [refSearch, setRefSearch] = useState('');
    const [showRefResults, setShowRefResults] = useState(false);
    const [customRefText, setCustomRefText] = useState('');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);

    // Predefined baseline definitions
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

    useEffect(() => {
        Promise.all([
            safeApiRequest('/api/operators').then(res => res.json()),
            safeApiRequest('/api/config/tags').then(res => res.json()),
            safeApiRequest('/api/documentos').then(res => res.json())
        ]).then(([opsData, tagsData, docsData]) => {
            if (Array.isArray(opsData)) setOperators(opsData);
            if (Array.isArray(tagsData)) setTagsList(tagsData);
            if (Array.isArray(docsData)) setAllDocs(docsData);
        }).catch(console.error);

        // Load custom abbreviations
        const saved = localStorage.getItem('hdb_custom_definitions');
        if (saved) {
            try { setCustomAbbrevs(JSON.parse(saved)); } catch(e){}
        }
    }, []);

    const mergedAbbreviations = [...DEFAULT_ABBREVIATIONS, ...customAbbrevs];

    const getCoordinates = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        // Handle touch events
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
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.shadowBlur = 1;
        ctx.shadowColor = '#0f172a';
        setIsDrawing(true);
        setHasSigned(true);
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
        setHasSigned(false);
    };

    // Abbreviations Helpers
    const handleSelectAbbreviation = (item: { term: string; definition: string }) => {
        setNewTerm(item.term);
        setNewDef(item.definition);
    };

    const handleAddAbbreviation = () => {
        if (!newTerm.trim() || !newDef.trim()) return;

        // Add to digitalDatadefiniciones
        setDigitalData(prev => ({
            ...prev,
            definiciones: [...prev.definiciones, { term: newTerm.trim(), definition: newDef.trim() }]
        }));

        // If checkbox checked, save to localStorage
        if (saveToFrequents) {
            const exists = customAbbrevs.some(a => a.term.toLowerCase() === newTerm.trim().toLowerCase());
            if (!exists) {
                const updated = [...customAbbrevs, { term: newTerm.trim(), definition: newDef.trim() }];
                setCustomAbbrevs(updated);
                localStorage.setItem('hdb_custom_definitions', JSON.stringify(updated));
            }
        }

        setNewTerm('');
        setNewDef('');
    };

    const handleRemoveDefinition = (idx: number) => {
        setDigitalData(prev => ({
            ...prev,
            definiciones: prev.definiciones.filter((_, i) => i !== idx)
        }));
    };

    // References Helpers
    const handleAddRefDoc = (doc: any) => {
        const alreadyAdded = digitalData.referencias.some(r => r.docId === doc.id);
        if (alreadyAdded) return;

        setDigitalData(prev => ({
            ...prev,
            referencias: [...prev.referencias, { docId: doc.id, codigo: doc.codigoDocumental, titulo: doc.titulo }]
        }));
        setRefSearch('');
        setShowRefResults(false);
    };

    const handleAddCustomRef = () => {
        if (!customRefText.trim()) return;
        setDigitalData(prev => ({
            ...prev,
            referencias: [...prev.referencias, { codigo: 'EXTERNO', titulo: customRefText.trim() }]
        }));
        setCustomRefText('');
    };

    const handleRemoveReference = (idx: number) => {
        setDigitalData(prev => ({
            ...prev,
            referencias: prev.referencias.filter((_, i) => i !== idx)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const signatureData = canvas.toDataURL('image/png');
        
        if (!hasSigned) {
            alert('Debe firmar el documento para crearlo (Firma Digital del Creador)');
            return;
        }

        setLoading(true);
        try {
            const revisador = operators.find(o => o.id === formData.revisadorId);
            const aprobador = operators.find(o => o.id === formData.aprobadorId);

            // Serialize structured content if digital, or save empty
            const finalDescription = isDigital 
                ? JSON.stringify({ isDigital: true, ...digitalData })
                : JSON.stringify({ isDigital: false, objetivo: 'Documento cargado de forma tradicional', desarrollo: '' });

            const res = await safeApiRequest('/api/documentos', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    descripcion: finalDescription,
                    validezMeses: formData.requiereCapacitacion ? parseInt(formData.validezMeses) : null,
                    autorId: user?.id,
                    autorNombre: user?.nombreCompleto || user?.nombre,
                    userId: user?.id,
                    userName: user?.nombreCompleto || user?.nombre,
                    revisadorNombre: revisador?.nombreCompleto || revisador?.nombre,
                    aprobadorNombre: aprobador?.nombreCompleto || aprobador?.nombre,
                    creatorSignature: signatureData
                })
            });
            if (res.ok) {
                const data = await res.json();
                onSuccess(data.id);
            } else {
                const err = await res.json();
                alert(err.error || 'Error al crear documento');
            }
        } catch (e) {
            console.error(e);
            alert('Error de red');
        } finally {
            setLoading(false);
        }
    };

    // Filter documents for reference helper search
    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filteredDocs = refSearch.trim() === '' ? [] : allDocs.filter(d => 
        normalize(d.codigoDocumental).includes(normalize(refSearch)) ||
        normalize(d.titulo).includes(normalize(refSearch))
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pt-20 sm:pt-24 overflow-y-auto">
            <div className={`relative bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-h-[calc(100vh-8rem)] overflow-hidden my-4 animate-in zoom-in-95 duration-200 flex flex-col transition-all duration-300 ${showAiDrawer ? 'max-w-[95vw] sm:pr-[420px]' : 'max-w-6xl'}`}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center dark:bg-indigo-900/30 dark:text-indigo-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nuevo Documento Controlado</h2>
                            <p className="text-xs text-slate-400 font-bold">QMS Sistema de Gestión de Calidad ISO 9001</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAiDrawer(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-750 hover:to-indigo-750 text-white rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95 transition-all"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Redactar con IA</span>
                        </button>
                        <button onClick={onClose} type="button" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Main Form Area */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col md:flex-row">
                    {/* Left Sidebar Steps Selector */}
                    <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-slate-800 p-4 space-y-2 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible">
                        <button
                            type="button"
                            onClick={() => setActiveStep('general')}
                            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 shrink-0 ${activeStep === 'general' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <FileText className="w-4 h-4" />
                            <span>Datos Generales</span>
                        </button>

                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-2 hidden md:block" />

                        {/* Format Switcher */}
                        <div className="p-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl hidden md:block space-y-1">
                            <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest px-2">Formato</span>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setIsDigital(true)}
                                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all ${isDigital ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    Digital SOP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDigital(false)}
                                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all ${!isDigital ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    Básico
                                </button>
                            </div>
                        </div>

                        {isDigital && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setActiveStep('content_1')}
                                    className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 shrink-0 ${activeStep === 'content_1' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    <BookOpen className="w-4 h-4" />
                                    <span>1. Objetivo y Alcance</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveStep('content_2')}
                                    className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 shrink-0 ${activeStep === 'content_2' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>2. Desarrollo y Responsabilidad</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveStep('content_3')}
                                    className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 shrink-0 ${activeStep === 'content_3' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    <Link2 className="w-4 h-4" />
                                    <span>3. Glosario y Referencias</span>
                                </button>
                            </>
                        )}

                        <div className="h-px bg-slate-200 dark:bg-slate-800 my-2 hidden md:block" />

                        <button
                            type="button"
                            onClick={() => setActiveStep('signature')}
                            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 shrink-0 ${activeStep === 'signature' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <FileSignature className="w-4 h-4" />
                            <span>Video y Firma Digital</span>
                        </button>
                    </div>

                    {/* Right Step Content Container */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        
                        {/* STEP: GENERAL */}
                        {activeStep === 'general' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-850 pb-2">Información del Documento</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Código Documental</label>
                                        <div className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] flex items-center justify-between">
                                            {previewCode ? (
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{previewCode}</span>
                                            ) : (
                                                <span className="text-xs font-bold text-red-500">{previewError}</span>
                                            )}
                                            {previewCode === 'Calculando...' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Documento</label>
                                        <select
                                            value={formData.tipoDocumento} onChange={e => setFormData({ ...formData, tipoDocumento: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                                        >
                                            <option value="MQ">MQ - Manual de Calidad</option>
                                            <option value="PG">PG - Procedimientos Generales</option>
                                            <option value="FR">FR - Formularios y Registros (Evidencia)</option>
                                            <option value="IT">IT - Instructivos Técnicos</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título del Documento</label>
                                    <input
                                        required type="text" placeholder="Ej. Procedimiento Operativo para Pruebas Hidrostáticas..."
                                        value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Área / Sector</label>
                                        <select
                                            value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                                        >
                                            <option value="GLB">GLB - Globales</option>
                                            <option value="MNG">MNG - Gerencia</option>
                                            <option value="OPR">OPR - Operaciones</option>
                                            <option value="ADM">ADM - Administración</option>
                                            <option value="QAC">QAC - Aseguramiento y Control de Calidad</option>
                                            <option value="HRM">HRM - Gestión de Recursos Humanos</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Criticidad</label>
                                        <select
                                            value={formData.nivelCriticidad} onChange={e => setFormData({ ...formData, nivelCriticidad: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                                        >
                                            <option value="bajo">Bajo</option>
                                            <option value="medio">Medio</option>
                                            <option value="alto">Alto</option>
                                            <option value="critico">Crítico</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Revisado Por (Supervisor/QA)</label>
                                        <select
                                            value={formData.revisadorId} onChange={e => setFormData({ ...formData, revisadorId: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
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
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Aprobado Por (QA/Gerente)</label>
                                        <select
                                            value={formData.aprobadorId} onChange={e => setFormData({ ...formData, aprobadorId: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
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
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Etiquetas (Aplica a)</label>
                                    <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[44px]">
                                        {tagsList.map(tag => (
                                            <label key={tag.id} className={`cursor-pointer px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${formData.tags.includes(tag.name) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={formData.tags.includes(tag.name)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, tags: [...formData.tags, tag.name] });
                                                        } else {
                                                            setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag.name) });
                                                        }
                                                    }}
                                                />
                                                {tag.name}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.requiereConfirmacionLectura}
                                            onChange={e => setFormData({ ...formData, requiereConfirmacionLectura: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Requiere Confirmación de Lectura Obligatoria</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.requiereCapacitacion}
                                            onChange={e => setFormData({ ...formData, requiereCapacitacion: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Requiere Capacitación de Suficiencia Teórica (LMS)</span>
                                    </label>

                                    {formData.requiereCapacitacion && (
                                        <div className="pl-7 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Vencimiento de la Capacitación (en meses)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                required
                                                placeholder="Ej. 12"
                                                value={formData.validezMeses}
                                                onChange={e => setFormData({ ...formData, validezMeses: e.target.value })}
                                                className="w-full max-w-[150px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                {!isDigital && (
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Descripción / Nota</label>
                                        <textarea
                                            placeholder="Detalles sobre el alcance, manual de fabricante..."
                                            value={digitalData.desarrollo}
                                            onChange={e => setDigitalData({ ...digitalData, desarrollo: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:border-indigo-500 outline-none h-28 resize-none"
                                        />
                                    </div>
                                )}

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep(isDigital ? 'content_1' : 'signature')}
                                        disabled={!!previewError || previewCode === 'Calculando...'}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span>Siguiente</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP: DIGITAL SOP 1 (Objetivo y Alcance) */}
                        {activeStep === 'content_1' && (
                            <div className="space-y-5">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">2. Objetivo</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mb-2">Describa con precisión cuál es el propósito final de este procedimiento y qué metas operativas busca estandarizar para HDB.</p>
                                    <textarea
                                        required={isDigital}
                                        placeholder="Objetivo principal del procedimiento..."
                                        value={digitalData.objetivo}
                                        onChange={e => setDigitalData({ ...digitalData, objetivo: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:border-indigo-500 outline-none h-32"
                                    />
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">3. Alcance</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mb-2">Indique a qué sucursales, puestos de trabajo, personal técnico, herramientas o tipos de órdenes de servicio aplica directamente este procedimiento.</p>
                                    <textarea
                                        required={isDigital}
                                        placeholder="Alcance y límites de aplicación..."
                                        value={digitalData.alcance}
                                        onChange={e => setDigitalData({ ...digitalData, alcance: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:border-indigo-500 outline-none h-32"
                                    />
                                </div>

                                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('general')}
                                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <span>Atrás</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('content_2')}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                                    >
                                        <span>Siguiente</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP: DIGITAL SOP 2 (Desarrollo y Responsabilidad) */}
                        {activeStep === 'content_2' && (
                            <div className="space-y-5">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">4. Desarrollo de la Actividad</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mb-2">Describa detalladamente el desarrollo operativo paso a paso, tareas técnicas, métodos seguros, mejores prácticas.</p>
                                    <textarea
                                        required={isDigital}
                                        placeholder="Escriba los pasos secuenciales..."
                                        value={digitalData.desarrollo}
                                        onChange={e => setDigitalData({ ...digitalData, desarrollo: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:border-indigo-500 outline-none h-48"
                                    />
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">5. Responsabilidades</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mb-2">Detalle las responsabilidades de cada rol en la ejecución (ej: qué corresponde a Técnicos, Supervisores, QA).</p>
                                    <textarea
                                        required={isDigital}
                                        placeholder="Roles y responsabilidades de ejecución..."
                                        value={digitalData.responsabilidades}
                                        onChange={e => setDigitalData({ ...digitalData, responsabilidades: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:border-indigo-500 outline-none h-36"
                                    />
                                </div>

                                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('content_1')}
                                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <span>Atrás</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('content_3')}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                                    >
                                        <span>Siguiente</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP: DIGITAL SOP 3 (Glosario y Referencias con Asistentes Inteligentes) */}
                        {activeStep === 'content_3' && (
                            <div className="space-y-6">
                                {/* Definiciones y Abreviaturas */}
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                                            <Sparkles className="w-4 h-4 text-indigo-500" />
                                            <span>6. Definiciones y Abreviaturas</span>
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-bold">Use el asistente para agregar abreviaciones de forma rápida. Escriba o seleccione una y se autocompletará.</p>
                                    </div>

                                    {/* Added definition list pills */}
                                    {digitalData.definiciones.length > 0 && (
                                        <div className="flex flex-wrap gap-2 p-3 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl border border-indigo-50/50 dark:border-indigo-950/20">
                                            {digitalData.definiciones.map((def, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    <span className="text-indigo-600 dark:text-indigo-400">{def.term}:</span>
                                                    <span className="font-bold text-[11px] text-slate-500">{def.definition}</span>
                                                    <button type="button" onClick={() => handleRemoveDefinition(idx)} className="text-red-500 hover:text-red-700 transition-colors ml-1">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Predefined Helper Quickbox */}
                                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl space-y-2">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Sugeridas y Frecuentes:</span>
                                        <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-2">
                                            {mergedAbbreviations.map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleSelectAbbreviation(item)}
                                                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[10px] font-bold border border-slate-150 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all hover:border-indigo-300"
                                                >
                                                    {item.term}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {/* Creator Inputs */}
                                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                                            <input
                                                type="text" placeholder="Term (e.g. EPP)"
                                                value={newTerm} onChange={e => setNewTerm(e.target.value)}
                                                className="w-full sm:w-1/4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                                            />
                                            <input
                                                type="text" placeholder="Definición..."
                                                value={newDef} onChange={e => setNewDef(e.target.value)}
                                                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddAbbreviation}
                                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shrink-0"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Añadir</span>
                                            </button>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                                            <input
                                                type="checkbox"
                                                checked={saveToFrequents}
                                                onChange={e => setSaveToFrequents(e.target.checked)}
                                                className="w-3.5 h-3.5 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Guardar en mis abreviaciones frecuentes</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Referencias y Documentación Anexa */}
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                                            <Link2 className="w-4 h-4 text-indigo-500" />
                                            <span>7. Referencias y Documentación Anexa</span>
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-bold">Busque y agregue instructivos o procedimientos QMS internos, o añada manuales/normativas externas.</p>
                                    </div>

                                    {/* Added references list */}
                                    {digitalData.referencias.length > 0 && (
                                        <div className="space-y-1.5">
                                            {digitalData.referencias.map((ref, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-2.5 rounded-xl">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                                                            {ref.codigo}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{ref.titulo}</span>
                                                    </div>
                                                    <button type="button" onClick={() => handleRemoveReference(idx)} className="text-red-500 hover:text-red-700 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* References helpers */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        
                                        {/* QMS Search helper */}
                                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl relative space-y-2">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Buscar en QMS Interno:</span>
                                            <div className="relative">
                                                <input
                                                    type="text" placeholder="Escriba título o código..."
                                                    value={refSearch}
                                                    onChange={e => {
                                                        setRefSearch(e.target.value);
                                                        setShowRefResults(true);
                                                    }}
                                                    onFocus={() => setShowRefResults(true)}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                                                />
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                            </div>

                                            {showRefResults && refSearch.trim().length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-10 max-h-[160px] overflow-y-auto p-1.5 space-y-1">
                                                    {filteredDocs.map(doc => (
                                                        <button
                                                            key={doc.id}
                                                            type="button"
                                                            onClick={() => handleAddRefDoc(doc)}
                                                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-colors flex items-center justify-between"
                                                        >
                                                            <div className="truncate pr-2">
                                                                <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded mr-1.5">{doc.codigoDocumental}</span>
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{doc.titulo}</span>
                                                            </div>
                                                            <PlusCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                                                        </button>
                                                    ))}
                                                    {filteredDocs.length === 0 && (
                                                        <div className="p-3 text-center text-xs text-slate-400">Ningún documento coincidente.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* External Reference helper */}
                                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl space-y-2">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Norma o Instructivo Externo:</span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text" placeholder="Ej. Norma ISO 9001:2015..."
                                                    value={customRefText} onChange={e => setCustomRefText(e.target.value)}
                                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomRef}
                                                    className="px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
                                                >
                                                    Agregar
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('content_2')}
                                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <span>Atrás</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('signature')}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                                    >
                                        <span>Siguiente</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP: VIDEO AND SIGNATURE */}
                        {activeStep === 'signature' && (
                            <div className="space-y-5">
                                {/* Multimedia link */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                                        <Play className="w-4 h-4 text-indigo-500" />
                                        <span>Enlace Multimedia / Capacitación</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold mb-2">Pegue un enlace de YouTube o video de capacitación para que el operador lo estudie en su portal.</p>
                                    <input
                                        type="url" placeholder="https://www.youtube.com/watch?v=..."
                                        value={digitalData.videoUrl} onChange={e => setDigitalData({ ...digitalData, videoUrl: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 h-[46px] text-sm font-bold focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                {/* Firma digital del creador */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                                        <FileSignature className="w-4 h-4 text-indigo-500" />
                                        <span>Firma Digital del Creador <span className="text-red-500">*</span></span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold">Dibuje su firma autorizante para registrar la validez formal del documento en el flujo QMS.</p>

                                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                                        <canvas
                                            ref={canvasRef}
                                            width={800}
                                            height={300}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDrawing}
                                            className="w-full bg-transparent dark:invert cursor-crosshair touch-none h-[150px]"
                                        />
                                        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                                            <span className="text-[10px] font-bold text-slate-400">Escriba su firma arriba</span>
                                            <button
                                                type="button"
                                                onClick={clearCanvas}
                                                className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                                            >
                                                Limpiar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep(isDigital ? 'content_3' : 'general')}
                                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <span>Atrás</span>
                                    </button>

                                    <div className="flex gap-2">
                                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                            Cancelar
                                        </button>
                                        <button disabled={loading || !!previewError || previewCode === 'Calculando...'} type="submit" className="px-6 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/10">
                                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            Crear e ir al detalle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </form>

                {/* AI Assistant Drawer */}
                {showAiDrawer && (
                    <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-300 ease-out">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider block">Redactor Inteligente IA</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Google Gemini</span>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowAiDrawer(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        {aiResult ? (
                            /* Step 2: Show preview and let user apply the draft */
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
                                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/30 rounded-2xl text-emerald-800 dark:text-emerald-350 font-bold text-[11px] leading-relaxed">
                                        ¡Borrador generado con éxito! Verifique los campos sugeridos a continuación antes de aplicarlos.
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="font-bold text-slate-400 uppercase text-[9px] mb-1">Título del Procedimiento</h4>
                                            <div className="bg-white dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-850 rounded-xl font-bold text-slate-805 dark:text-slate-200 leading-snug">{aiResult.titulo}</div>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-slate-400 uppercase text-[9px] mb-1">Objetivo del Procedimiento</h4>
                                            <div className="bg-white dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-600 dark:text-slate-350 max-h-[120px] overflow-y-auto whitespace-pre-wrap">{aiResult.objetivo}</div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-400 uppercase text-[9px] mb-1">Alcance y Límites</h4>
                                            <div className="bg-white dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-600 dark:text-slate-350 max-h-[120px] overflow-y-auto whitespace-pre-wrap">{aiResult.alcance}</div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-400 uppercase text-[9px] mb-1">Desarrollo de Pasos Operativos</h4>
                                            <div className="bg-white dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-600 dark:text-slate-350 max-h-[180px] overflow-y-auto whitespace-pre-wrap">{aiResult.desarrollo}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                titulo: aiResult.titulo
                                            }));
                                            setDigitalData(prev => ({
                                                ...prev,
                                                objetivo: aiResult.objetivo,
                                                alcance: aiResult.alcance,
                                                desarrollo: aiResult.desarrollo,
                                                responsabilidades: aiResult.responsabilidades || '',
                                                definiciones: aiResult.definiciones || [],
                                                referencias: aiResult.referencias || []
                                            }));
                                            setIsDigital(true);
                                            setShowAiDrawer(false);
                                            setAiResult(null);
                                        }}
                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Aplicar Borrador</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setAiResult(null)}
                                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        Atrás
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Step 1: Request parameters */
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 p-5 overflow-y-auto space-y-4">
                                    <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                                        Escriba las directrices operativas básicas. La IA redactará el contenido estructurado bajo lineamientos ISO 9001.
                                    </p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Proceso / Tarea principal</label>
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="Ej. Prueba hidráulica de mangueras"
                                                value={aiParams.proceso}
                                                onChange={e => setAiParams({...aiParams, proceso: e.target.value})}
                                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 h-[46px] text-xs font-bold focus:border-indigo-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Alcance / Instalación</label>
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="Ej. Surtidores de combustible HDB"
                                                value={aiParams.alcance}
                                                onChange={e => setAiParams({...aiParams, alcance: e.target.value})}
                                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 h-[46px] text-xs font-bold focus:border-indigo-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Sector Responsable</label>
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="Ej. Técnicos de Operaciones Especiales"
                                                value={aiParams.sector}
                                                onChange={e => setAiParams({...aiParams, sector: e.target.value})}
                                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 h-[46px] text-xs font-bold focus:border-indigo-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Notas / Detalles Adicionales</label>
                                            <textarea 
                                                placeholder="Ej. Indicar uso obligatorio de calzado aislante y despresurización previa de tuberías..."
                                                value={aiParams.detallesAdicionales}
                                                onChange={e => setAiParams({...aiParams, detallesAdicionales: e.target.value})}
                                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold focus:border-indigo-500 outline-none h-28 resize-none"
                                            />
                                        </div>
                                    </div>

                                    {aiError && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-bold">
                                            {aiError}
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                                    <button 
                                        type="button" 
                                        disabled={aiLoading} 
                                        onClick={handleGenerateAiDoc}
                                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-750 hover:to-indigo-750 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                    >
                                        {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                        <span>{aiLoading ? "Redactando borrador..." : "Redactar Borrador con Gemini"}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* QMS floating virtual assistant chat */}
            <TechAssistantChat user={user} />
        </div>
    );
}
