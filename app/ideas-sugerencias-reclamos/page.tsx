'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    Lightbulb, 
    MessageSquare, 
    AlertTriangle, 
    ShieldAlert, 
    Coins, 
    HelpCircle, 
    FileText, 
    Paperclip, 
    Trash2, 
    CheckCircle2, 
    Loader2, 
    ChevronRight, 
    User, 
    Eye, 
    EyeOff,
    Info,
    AlertCircle,
    Check,
    Search,
    Filter,
    Calendar,
    Download
} from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';

// Types
interface OperatorOption {
    id: string;
    label: string;
    activo: boolean;
}

const TIPO_OPCIONES = [
    { id: 'Idea de mejora', label: 'Idea de mejora', description: 'Una propuesta innovadora para optimizar procesos.', icon: <Lightbulb className="w-5 h-5" />, color: 'text-amber-500 bg-amber-500/10' },
    { id: 'Sugerencia', label: 'Sugerencia', description: 'Una recomendación de cambio o mejora práctica.', icon: <MessageSquare className="w-5 h-5" />, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'Reclamo', label: 'Reclamo / Queja', description: 'Manifestación de disconformidad o problema a corregir.', icon: <AlertTriangle className="w-5 h-5" />, color: 'text-rose-500 bg-rose-500/10' },
    { id: 'Observación de seguridad', label: 'Seguridad / Higiene', description: 'Identificación de riesgos laborales o de higiene.', icon: <ShieldAlert className="w-5 h-5" />, color: 'text-orange-500 bg-orange-500/10' },
    { id: 'Oportunidad de ahorro', label: 'Oportunidad de ahorro', description: 'Propuestas para reducir costos o desperdicios.', icon: <Coins className="w-5 h-5" />, color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'Otro', label: 'Otro / General', description: 'Temas diversos que no encajen en otras categorías.', icon: <HelpCircle className="w-5 h-5" />, color: 'text-indigo-500 bg-indigo-500/10' }
];

const AREAS_OPCIONES = [
    'Producción',
    'Mantenimiento',
    'Calidad',
    'Seguridad e Higiene',
    'Logística',
    'Compras',
    'Administración',
    'Sistemas',
    'Recursos Humanos',
    'Dirección',
    'Otra'
];

const IMPACTO_OPCIONES = [
    { id: 'Bajo', label: 'Bajo', desc: 'Impacto local/puntual' },
    { id: 'Medio', label: 'Medio', desc: 'Impacto departamental' },
    { id: 'Alto', label: 'Alto', desc: 'Impacto global/general' }
];

const FRECUENCIA_OPCIONES = [
    'Ocurrió una sola vez',
    'Semanalmente',
    'Varias veces por semana',
    'Diariamente',
    'Varias veces por día'
];

const BENEFICIOS_OPCIONES = [
    'Mayor seguridad laboral',
    'Mejor calidad de producto/servicio',
    'Reducción de costos / Ahorro',
    'Menor tiempo de ejecución',
    'Mayor productividad / Eficiencia',
    'Mejor ambiente laboral',
    'Mayor satisfacción del cliente',
    'Cumplimiento normativo / ISO',
    'Menor impacto ambiental'
];

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function decodeEntities(str: string | null | undefined): string {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');
}

export default function IdeasSugerenciasReclamosPage() {
    // Stage navigation
    const [currentStep, setCurrentStep] = useState(1);
    
    // Operators list
    const [operators, setOperators] = useState<OperatorOption[]>([]);
    const [isLoadingOperators, setIsLoadingOperators] = useState(false);

    // Form states
    const [presentacion, setPresentacion] = useState<'anonima' | 'identificada'>('anonima');
    const [usuarioId, setUsuarioId] = useState('');
    const [pin, setPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    
    const [tipoRegistro, setTipoRegistro] = useState('');
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [areaInvolucrada, setAreaInvolucrada] = useState('');
    const [beneficios, setBeneficios] = useState<string[]>([]);
    const [impactoEstimado, setImpactoEstimado] = useState('Bajo');
    const [propuestaSolucion, setPropuestaSolucion] = useState('');
    const [frecuenciaProblema, setFrecuenciaProblema] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    
    // Submission status
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [submissionResult, setSubmissionResult] = useState<any>(null);

    // Navigation and Pizarra States
    const [activeTab, setActiveTab] = useState<'registrar' | 'pizarra'>('registrar');
    const [sugerencias, setSugerencias] = useState<any[]>([]);
    const [isLoadingSugerencias, setIsLoadingSugerencias] = useState(false);
    const [errorSugerencias, setErrorSugerencias] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [areaFilter, setAreaFilter] = useState('Todos');
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const errorBannerRef = useRef<HTMLDivElement>(null);

    // Fetch operators on mount
    useEffect(() => {
        setIsLoadingOperators(true);
        fetch('/api/operators')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Filter out deactivated operators
                    const opts = data
                        .filter(op => op.activo !== false)
                        .map(op => ({
                            id: op.id,
                            label: op.nombreCompleto,
                            activo: op.activo ?? true
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    setOperators(opts);
                }
            })
            .catch(err => console.error('Error fetching operators:', err))
            .finally(() => setIsLoadingOperators(false));
    }, []);

    // Scroll to error banner if error occurs
    useEffect(() => {
        if (errorMessage && errorBannerRef.current) {
            errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [errorMessage]);

    // Fetch suggestions when activeTab changes to 'pizarra'
    useEffect(() => {
        if (activeTab === 'pizarra') {
            setIsLoadingSugerencias(true);
            setErrorSugerencias('');
            fetch('/api/sugerencias')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setSugerencias(data);
                    } else {
                        setErrorSugerencias('No se pudieron cargar las propuestas.');
                    }
                })
                .catch(err => {
                    console.error('Error fetching suggestions:', err);
                    setErrorSugerencias('Error al cargar datos desde el servidor.');
                })
                .finally(() => setIsLoadingSugerencias(false));
        }
    }, [activeTab]);

    // Handle benefits multiple selection toggle
    const handleToggleBeneficio = (beneficio: string) => {
        if (beneficios.includes(beneficio)) {
            setBeneficios(beneficios.filter(b => b !== beneficio));
        } else {
            setBeneficios([...beneficios, beneficio]);
        }
    };

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            
            // Check total files limit
            if (selectedFiles.length + filesArray.length > MAX_FILES) {
                setErrorMessage(`Puedes subir un máximo de ${MAX_FILES} archivos adjuntos.`);
                return;
            }

            // Validate sizes
            for (const file of filesArray) {
                if (file.size > FILE_SIZE_LIMIT) {
                    setErrorMessage(`El archivo "${file.name}" supera el límite de 10MB.`);
                    return;
                }
            }

            setErrorMessage('');
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Next step validation
    const handleGoToStep = async (step: number) => {
        setErrorMessage('');
        
        if (step === 2 && currentStep === 1) {
            if (presentacion === 'identificada') {
                if (!usuarioId) {
                    setErrorMessage('Debes seleccionar tu usuario.');
                    return;
                }
                if (!pin) {
                    setErrorMessage('Debes ingresar tu PIN de seguridad.');
                    return;
                }

                try {
                    setIsSubmitting(true);
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ operatorId: usuarioId, pin })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        const msg = data.error === 'PIN incorrecto.' 
                            ? 'Clave de acceso (PIN) incorrecta.' 
                            : (data.error || 'Clave de acceso (PIN) incorrecta.');
                        setErrorMessage(msg);
                        setIsSubmitting(false);
                        return;
                    }
                } catch (err) {
                    setErrorMessage('Error de red al verificar PIN.');
                    setIsSubmitting(false);
                    return;
                } finally {
                    setIsSubmitting(false);
                }
            }
        }
        
        if (step === 3) {
            if (!tipoRegistro) {
                setErrorMessage('Debes seleccionar el tipo de registro.');
                return;
            }
            if (!titulo.trim()) {
                setErrorMessage('El título es requerido.');
                return;
            }
            if (titulo.length > 150) {
                setErrorMessage('El título no puede superar los 150 caracteres.');
                return;
            }
            if (!descripcion.trim()) {
                setErrorMessage('La descripción detallada es requerida.');
                return;
            }
            if (!areaInvolucrada) {
                setErrorMessage('Debes seleccionar el área involucrada.');
                return;
            }
        }

        setCurrentStep(step);
    };

    // Submit form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setIsSubmitting(true);

        // Final validations
        if (!tipoRegistro || !titulo.trim() || !descripcion.trim() || !areaInvolucrada) {
            setErrorMessage('Por favor complete todos los campos obligatorios.');
            setIsSubmitting(false);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('presentacion', presentacion);
            if (presentacion === 'identificada') {
                formData.append('usuario_id', usuarioId);
                formData.append('pin', pin);
            }
            
            formData.append('tipo_registro', tipoRegistro);
            formData.append('titulo', titulo.trim());
            formData.append('descripcion', descripcion.trim());
            formData.append('area_involucrada', areaInvolucrada);
            formData.append('beneficios', JSON.stringify(beneficios));
            formData.append('impacto_estimado', impactoEstimado);
            formData.append('propuesta_solucion', propuestaSolucion.trim());
            formData.append('frecuencia_problema', frecuenciaProblema);

            selectedFiles.forEach(file => {
                formData.append('files', file);
            });

            const res = await fetch('/api/sugerencias', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMessage(data.error || 'Error al enviar la propuesta.');
                setSubmitStatus('error');
            } else {
                setSubmitStatus('success');
                setSubmissionResult(data);
                // Clear state
                handleResetForm();
            }
        } catch (err: any) {
            console.error('Submit error:', err);
            setErrorMessage('Ocurrió un error inesperado al enviar la solicitud.');
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetForm = () => {
        setTipoRegistro('');
        setTitulo('');
        setDescripcion('');
        setAreaInvolucrada('');
        setBeneficios([]);
        setImpactoEstimado('Bajo');
        setPropuestaSolucion('');
        setFrecuenciaProblema('');
        setSelectedFiles([]);
        setPin('');
    };

    const handleStartNew = () => {
        setSubmitStatus('idle');
        setSubmissionResult(null);
        setCurrentStep(1);
    };

    // Format file size
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Success Screen Render
    if (activeTab === 'registrar' && submitStatus === 'success' && submissionResult) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-16">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl text-center border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-2">
                        ¡Propuesta Registrada!
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
                        Hemos recibido tu presentación correctamente. Agradecemos tu participación para seguir mejorando nuestro entorno operativo.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 mb-8 border border-slate-100 dark:border-slate-800 text-left space-y-4 max-w-md mx-auto">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Código de Propuesta</span>
                            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 font-mono select-all">
                                {submissionResult.id}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Tipo</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{submissionResult.tipo_registro}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Presentación</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{submissionResult.presentacion}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleStartNew}
                        className="px-8 py-4 bg-primary text-white font-extrabold text-sm uppercase tracking-widest rounded-2xl hover:bg-primary-dark transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                        Registrar Otra Propuesta
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-6 md:py-10">
            {/* Header section */}
            <div className="text-center mb-8 md:mb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                    <Lightbulb className="w-3.5 h-3.5" /> Portal de Ideas y Sugerencias
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight mb-3">
                    Ideas, Sugerencias y Reclamos
                </h1>
                <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                    Tu opinión y creatividad impulsan la excelencia operativa. Envía propuestas de mejora de forma anónima o identificada.
                </p>
            </div>

            {/* Tabs Navigation */}
            <div className="flex justify-center mb-8 border-b border-slate-200 dark:border-slate-800">
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-2">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('registrar');
                            setErrorMessage('');
                        }}
                        className={`px-6 py-3 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all ${
                            activeTab === 'registrar'
                                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        Registrar Propuesta
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('pizarra');
                            setErrorMessage('');
                        }}
                        className={`px-6 py-3 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all ${
                            activeTab === 'pizarra'
                                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        Pizarra de Propuestas
                    </button>
                </div>
            </div>

            {/* Registrar Propuesta Tab */}
            {activeTab === 'registrar' && (
                <div className="space-y-6">
                    {/* Error banner */}
                    {errorMessage && (
                        <div 
                            ref={errorBannerRef}
                            className="mb-8 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-sm font-semibold animate-in slide-in-from-top-4 duration-300"
                        >
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p>{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    {/* Step indicator */}
                    <div className="flex items-center justify-between max-w-md mx-auto mb-8 px-4">
                        <button
                            type="button"
                            onClick={() => handleGoToStep(1)}
                            className={`flex flex-col items-center gap-2 group focus:outline-none`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                                currentStep === 1 
                                    ? 'bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20' 
                                    : currentStep > 1 
                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                            }`}>
                                {currentStep > 1 ? <Check className="w-4 h-4" /> : 1}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${
                                currentStep === 1 ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                            }`}>Identidad</span>
                        </button>
                        <div className={`flex-1 h-0.5 mx-2 rounded ${currentStep > 1 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                        <button
                            type="button"
                            disabled={currentStep < 2}
                            onClick={() => handleGoToStep(2)}
                            className={`flex flex-col items-center gap-2 group focus:outline-none disabled:cursor-not-allowed`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                                currentStep === 2 
                                    ? 'bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20' 
                                    : currentStep > 2 
                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                            }`}>
                                {currentStep > 2 ? <Check className="w-4 h-4" /> : 2}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${
                                currentStep === 2 ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                            }`}>Propuesta</span>
                        </button>
                        <div className={`flex-1 h-0.5 mx-2 rounded ${currentStep > 2 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                        <button
                            type="button"
                            disabled={currentStep < 3}
                            onClick={() => handleGoToStep(3)}
                            className={`flex flex-col items-center gap-2 group focus:outline-none disabled:cursor-not-allowed`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                                currentStep === 3 
                                    ? 'bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20' 
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                            }`}>
                                3
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${
                                currentStep === 3 ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                            }`}>Impacto</span>
                        </button>
                    </div>

                    {/* Form Box */}
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 border border-slate-100 dark:border-slate-800 shadow-xl transition-all duration-300">
                        
                        {/* STEP 1: PRESENTACION / IDENTIFICACION */}
                        {currentStep === 1 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-2">
                                        Tipo de Presentación
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Selecciona cómo deseas enviar tu propuesta. Si te identificas, podrás realizar el seguimiento en tu cuenta.
                                    </p>
                                </div>

                                {/* Cards selection */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Anonima Card */}
                                    <button
                                        type="button"
                                        onClick={() => setPresentacion('anonima')}
                                        className={`p-6 rounded-2xl text-left border-2 transition-all relative flex flex-col justify-between min-h-[140px] focus:outline-none ${
                                            presentacion === 'anonima'
                                                ? 'border-primary bg-primary/[0.02] ring-4 ring-primary/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <div>
                                            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 mb-1">
                                                Presentación Anónima
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                No guardamos información de quién envía el registro. El anonimato está 100% garantizado por el sistema.
                                            </p>
                                        </div>
                                        {presentacion === 'anonima' && (
                                            <span className="absolute top-4 right-4 bg-primary text-white p-1 rounded-full text-xs">
                                                <Check className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                    </button>

                                    {/* Identificada Card */}
                                    <button
                                        type="button"
                                        onClick={() => setPresentacion('identificada')}
                                        className={`p-6 rounded-2xl text-left border-2 transition-all relative flex flex-col justify-between min-h-[140px] focus:outline-none ${
                                            presentacion === 'identificada'
                                                ? 'border-primary bg-primary/[0.02] ring-4 ring-primary/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <div>
                                            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 mb-1">
                                                Presentación Identificada
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                Podrás recibir actualizaciones por notificaciones, obtener visibilidad en tus propuestas y sumarlas a tu historial.
                                            </p>
                                        </div>
                                        {presentacion === 'identificada' && (
                                            <span className="absolute top-4 right-4 bg-primary text-white p-1 rounded-full text-xs">
                                                <Check className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* Identified Credentials inputs */}
                                {presentacion === 'identificada' && (
                                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-1">
                                            {isLoadingOperators ? (
                                                <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando técnicos...
                                                </div>
                                            ) : (
                                                <SearchableSelect
                                                    options={operators}
                                                    value={usuarioId}
                                                    onChange={setUsuarioId}
                                                    placeholder="Buscar y seleccionar tu usuario..."
                                                    label="Usuario (Técnico / Operador)"
                                                    icon={<User className="w-3.5 h-3.5" />}
                                                />
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                                PIN de Acceso
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPin ? "text" : "password"}
                                                    inputMode="numeric"
                                                    maxLength={6}
                                                    value={pin}
                                                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                                    placeholder="Ingresa tu PIN"
                                                    className="w-full h-[44px] md:h-[50px] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-bold tracking-widest outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPin(!showPin)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                                >
                                                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 leading-relaxed">
                                                Para resguardar tu identidad, ingresa tu clave personal. No permitimos asociar usuarios ajenos.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => handleGoToStep(2)}
                                        className="px-6 py-3.5 bg-primary text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-primary-dark transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        Continuar <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: CONTENIDO DE LA SUGERENCIA */}
                        {currentStep === 2 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-2">
                                        Detalles de la Propuesta
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Clasifica y detalla los detalles primordiales de tu idea, sugerencia u observación.
                                    </p>
                                </div>

                                {/* Tipo Registro selection */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                        Tipo de Registro <span className="text-rose-500 font-black">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {TIPO_OPCIONES.map(option => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setTipoRegistro(option.id)}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col focus:outline-none ${
                                                    tipoRegistro === option.id
                                                        ? 'border-primary bg-primary/[0.02] ring-4 ring-primary/10'
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-lg ${option.color} inline-block mb-3 w-fit`}>
                                                    {option.icon}
                                                </div>
                                                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1">
                                                    {option.label}
                                                </h3>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                                                    {option.description}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Titulo */}
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Título Breve <span className="text-rose-500 font-black">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={150}
                                            value={titulo}
                                            onChange={(e) => setTitulo(e.target.value)}
                                            placeholder="Ej: Automatizar orden de herramientas en carro de taller"
                                            className="w-full h-[44px] md:h-[50px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-bold outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 text-slate-700 dark:text-slate-200"
                                            required
                                        />
                                        <div className="flex justify-between px-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                                            <span>Sé descriptivo y concreto.</span>
                                            <span>{titulo.length}/150</span>
                                        </div>
                                    </div>

                                    {/* Descripcion */}
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Descripción Detallada <span className="text-rose-500 font-black">*</span>
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={descripcion}
                                            onChange={(e) => setDescripcion(e.target.value)}
                                            placeholder="Describe la problemática actual y cómo el cambio propuesto solucionaría la situación..."
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-bold outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 text-slate-700 dark:text-slate-200"
                                            required
                                        />
                                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-1">
                                            Explica el problema, su causa raíz y tu análisis de la situación.
                                        </p>
                                    </div>

                                    {/* Area Involucrada */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Área Involucrada / Afectada <span className="text-rose-500 font-black">*</span>
                                        </label>
                                        <select
                                            value={areaInvolucrada}
                                            onChange={(e) => setAreaInvolucrada(e.target.value)}
                                            className="w-full h-[44px] md:h-[50px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl py-2 px-4 text-sm font-bold outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 text-slate-700 dark:text-slate-200"
                                            required
                                        >
                                            <option value="" disabled>Selecciona el área...</option>
                                            {AREAS_OPCIONES.map(area => (
                                                <option key={area} value={area}>{area}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Frecuencia del problema */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Frecuencia del Problema (Opcional)
                                        </label>
                                        <select
                                            value={frecuenciaProblema}
                                            onChange={(e) => setFrecuenciaProblema(e.target.value)}
                                            className="w-full h-[44px] md:h-[50px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl py-2 px-4 text-sm font-bold outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 text-slate-700 dark:text-slate-200"
                                        >
                                            <option value="">No aplica / Desconocido</option>
                                            {FRECUENCIA_OPCIONES.map(freq => (
                                                <option key={freq} value={freq}>{freq}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => handleGoToStep(1)}
                                        className="px-6 py-3.5 bg-slate-100 text-slate-600 dark:bg-slate-750 dark:text-slate-300 font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-250 transition-all active:scale-95"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleGoToStep(3)}
                                        className="px-6 py-3.5 bg-primary text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-primary-dark transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        Siguiente <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: IMPACTO, BENEFICIOS Y ADJUNTOS */}
                        {currentStep === 3 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-2">
                                        Impacto, Beneficios y Adjuntos
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Evalúa los beneficios y el impacto esperado de la propuesta, y adjunta evidencias si dispones de ellas.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Impacto Estimado */}
                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Impacto Estimado del Cambio <span className="text-rose-500 font-black">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {IMPACTO_OPCIONES.map(option => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => setImpactoEstimado(option.id)}
                                                    className={`p-4 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center focus:outline-none ${
                                                        impactoEstimado === option.id
                                                            ? 'border-primary bg-primary/[0.02] ring-4 ring-primary/10'
                                                            : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                                    }`}
                                                >
                                                    <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 block mb-0.5">
                                                        {option.label}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                                        {option.desc}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Propuesta de Solucion */}
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Propuesta de Solución Sugerida (Opcional)
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={propuestaSolucion}
                                            onChange={(e) => setPropuestaSolucion(e.target.value)}
                                            placeholder="Si tienes en mente un plan de acción para solucionarlo, detallalo aquí..."
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl py-3 px-4 text-sm font-bold outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 text-slate-700 dark:text-slate-200"
                                        />
                                    </div>

                                    {/* Beneficios Esperados */}
                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Beneficios Esperados (Selección Múltiple)
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {BENEFICIOS_OPCIONES.map(option => {
                                                const isSelected = beneficios.includes(option);
                                                return (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() => handleToggleBeneficio(option)}
                                                        className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all border ${
                                                            isSelected
                                                                ? 'bg-primary text-white border-primary shadow-md shadow-primary/10'
                                                                : 'bg-slate-55 border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300 hover:border-slate-350 hover:bg-slate-100 dark:bg-slate-800'
                                                        }`}
                                                    >
                                                        {option}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Adjuntar Archivos */}
                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                            Archivos Adjuntos (Imágenes, PDF, Documentos - Max 5)
                                        </label>
                                        
                                        {/* Drag area */}
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 rounded-2xl p-6 text-center cursor-pointer transition-colors"
                                        >
                                            <input 
                                                type="file" 
                                                ref={fileInputRef}
                                                onChange={handleFileChange}
                                                multiple 
                                                className="hidden"
                                                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                                            />
                                            <Paperclip className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block">
                                                Haz clic para seleccionar o arrastra archivos aquí
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1 block">
                                                Tamaño máximo por archivo: 10MB.
                                            </span>
                                        </div>

                                        {/* Files list */}
                                        {selectedFiles.length > 0 && (
                                            <div className="space-y-2">
                                                {selectedFiles.map((file, idx) => (
                                                    <div 
                                                        key={`${file.name}-${idx}`}
                                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 animate-in fade-in duration-300"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate pr-4">
                                                                    {file.name}
                                                                </p>
                                                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                                                    {formatBytes(file.size)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveFile(idx)}
                                                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-rose-500 hover:text-rose-700 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => handleGoToStep(2)}
                                        className="px-6 py-3.5 bg-slate-100 text-slate-600 dark:bg-slate-750 dark:text-slate-300 font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-250 transition-all active:scale-95"
                                        disabled={isSubmitting}
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-8 py-3.5 bg-primary text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-primary-dark transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Enviando...
                                            </>
                                        ) : (
                                            'Enviar Propuesta'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {/* Pizarra de Propuestas Tab */}
            {activeTab === 'pizarra' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Total Propuestas</span>
                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{sugerencias.length}</span>
                        </div>
                        <div className="bg-amber-500/5 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-500/10 shadow-sm">
                            <span className="text-[10px] font-black text-amber-500/70 dark:text-amber-500/80 uppercase tracking-widest block">Pendientes</span>
                            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                {sugerencias.filter(s => s.estado === 'Pendiente').length}
                            </span>
                        </div>
                        <div className="bg-blue-500/5 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-500/10 shadow-sm">
                            <span className="text-[10px] font-black text-blue-500/70 dark:text-blue-500/80 uppercase tracking-widest block">En Evaluación</span>
                            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                {sugerencias.filter(s => s.estado === 'En evaluación' || s.estado === 'En Revisión').length}
                            </span>
                        </div>
                        <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/10 shadow-sm">
                            <span className="text-[10px] font-black text-emerald-500/70 dark:text-emerald-500/80 uppercase tracking-widest block">Aprobadas / Impl.</span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {sugerencias.filter(s => s.estado === 'Aprobada' || s.estado === 'Implementada').length}
                            </span>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-md flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por título, descripción o ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 h-[44px] bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold transition-all focus:border-primary text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap md:flex-nowrap">
                            <div className="relative flex-1 md:w-[180px]">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full h-[44px] pl-3 pr-8 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
                                >
                                    <option value="Todos">Todos los Estados</option>
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="En evaluación">En evaluación</option>
                                    <option value="Aprobada">Aprobada</option>
                                    <option value="Implementada">Implementada</option>
                                    <option value="Rechazada">Rechazada</option>
                                    <option value="Cerrada">Cerrada</option>
                                </select>
                                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            </div>
                            <div className="relative flex-1 md:w-[180px]">
                                <select
                                    value={areaFilter}
                                    onChange={(e) => setAreaFilter(e.target.value)}
                                    className="w-full h-[44px] pl-3 pr-8 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
                                >
                                    <option value="Todos">Todas las Áreas</option>
                                    {AREAS_OPCIONES.map(area => (
                                        <option key={area} value={area}>{area}</option>
                                    ))}
                                </select>
                                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Loader & Errors */}
                    {isLoadingSugerencias && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                            <p className="text-sm font-bold">Cargando pizarra de propuestas...</p>
                        </div>
                    )}

                    {errorSugerencias && (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm font-semibold">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{errorSugerencias}</p>
                        </div>
                    )}

                    {/* Cards Grid */}
                    {!isLoadingSugerencias && !errorSugerencias && (
                        <>
                            {(() => {
                                const filtered = sugerencias.filter(sug => {
                                    const matchesSearch = 
                                        sug.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        sug.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        sug.id.toLowerCase().includes(searchTerm.toLowerCase());
                                    
                                    const matchesStatus = 
                                        statusFilter === 'Todos' || 
                                        sug.estado === statusFilter ||
                                        (statusFilter === 'En evaluación' && sug.estado === 'En Revisión');
                                    
                                    const matchesArea = 
                                        areaFilter === 'Todos' || 
                                        sug.area_involucrada === areaFilter;

                                    return matchesSearch && matchesStatus && matchesArea;
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in fade-in duration-300">
                                            <p className="text-slate-400 dark:text-slate-500 font-extrabold text-sm mb-2">No se encontraron propuestas</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Prueba cambiando los criterios de filtrado o registra una nueva propuesta.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {filtered.map(sug => {
                                            const categoryObj = TIPO_OPCIONES.find(t => t.id === sug.tipo_registro) || {
                                                icon: <HelpCircle className="w-4 h-4" />,
                                                color: 'text-slate-500 bg-slate-500/10'
                                            };
                                            
                                            let statusColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                                            if (sug.estado === 'En evaluación' || sug.estado === 'En Revisión') {
                                                statusColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                                            } else if (sug.estado === 'Aprobada' || sug.estado === 'Implementada') {
                                                statusColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                                            } else if (sug.estado === 'Rechazada') {
                                                statusColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
                                            } else if (sug.estado === 'Cerrada') {
                                                statusColor = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
                                            }

                                            const isExpanded = expandedCard === sug.id;

                                            return (
                                                <div 
                                                    key={sug.id} 
                                                    className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/80 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                                                >
                                                    <div className="space-y-4">
                                                        {/* Top Metadata */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`p-1.5 rounded-lg ${categoryObj.color}`}>
                                                                    {categoryObj.icon}
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                                    {sug.tipo_registro}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusColor}`}>
                                                                {sug.estado}
                                                            </span>
                                                        </div>

                                                        {/* Code & Title */}
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono block mb-0.5 select-all">
                                                                #{sug.id.substring(0, 8)}...
                                                            </span>
                                                            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 leading-tight">
                                                                {decodeEntities(sug.titulo)}
                                                            </h3>
                                                        </div>

                                                        {/* Description */}
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                                            {isExpanded 
                                                                ? decodeEntities(sug.descripcion) 
                                                                : decodeEntities(sug.descripcion).length > 180 
                                                                    ? `${decodeEntities(sug.descripcion).substring(0, 180)}...` 
                                                                    : decodeEntities(sug.descripcion)
                                                            }
                                                        </p>

                                                        {/* Extended Info */}
                                                        {isExpanded && (
                                                            <div className="space-y-4 pt-4 border-t border-slate-150 dark:border-slate-750 animate-in fade-in duration-300">
                                                                {sug.propuesta_solucion && (
                                                                    <div>
                                                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Propuesta de Solución</span>
                                                                        <p className="text-xs text-slate-650 dark:text-slate-300 font-semibold bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                            {decodeEntities(sug.propuesta_solucion)}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {sug.frecuencia_problema && (
                                                                    <div>
                                                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Frecuencia del problema</span>
                                                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">{decodeEntities(sug.frecuencia_problema)}</span>
                                                                    </div>
                                                                )}
                                                                {sug.beneficios && Array.isArray(sug.beneficios) && sug.beneficios.length > 0 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Beneficios esperados</span>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {sug.beneficios.map((b: string) => (
                                                                                <span key={b} className="text-[10px] font-bold bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                                    {decodeEntities(b)}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Attachments */}
                                                                {sug.archivos_adjuntos && Array.isArray(sug.archivos_adjuntos) && sug.archivos_adjuntos.length > 0 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Adjuntos</span>
                                                                        <div className="space-y-1.5">
                                                                            {sug.archivos_adjuntos.map((file: any, index: number) => (
                                                                                <a
                                                                                    key={index}
                                                                                    href={file.url}
                                                                                    download={file.nombre}
                                                                                    className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs text-slate-650 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all font-bold group"
                                                                                >
                                                                                    <div className="flex items-center gap-2 truncate">
                                                                                        <Paperclip className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary shrink-0" />
                                                                                        <span className="truncate">{decodeEntities(file.nombre)}</span>
                                                                                    </div>
                                                                                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary shrink-0" />
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Historial / Auditoria */}
                                                                {sug.historial && Array.isArray(sug.historial) && sug.historial.length > 0 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Historial de Estados</span>
                                                                        <div className="space-y-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                                                                            {sug.historial.map((hist: any, index: number) => (
                                                                                <div key={index} className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 font-semibold relative">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 absolute -left-[11px] top-1.5" />
                                                                                    <span>{new Date(hist.fecha).toLocaleDateString()} {new Date(hist.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                                    <span className="mx-1.5">|</span>
                                                                                    <span>{hist.estadoAnterior} → <strong className="text-slate-750 dark:text-slate-300">{hist.estadoNuevo}</strong></span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Comentarios de Gestión */}
                                                                {sug.comentarios && Array.isArray(sug.comentarios) && sug.comentarios.length > 0 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Comentarios Administrativos</span>
                                                                        <div className="space-y-2">
                                                                            {sug.comentarios.map((c: any, index: number) => (
                                                                                <div key={index} className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                                    <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-bold mb-1">
                                                                                        <span>{c.autor}</span>
                                                                                        <span>{new Date(c.fecha).toLocaleDateString()}</span>
                                                                                    </div>
                                                                                    <p className="text-xs text-slate-655 dark:text-slate-350 font-semibold leading-relaxed">
                                                                                        {decodeEntities(c.texto)}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Card Bottom Meta */}
                                                    <div className="mt-5 space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center justify-between text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                <span>{new Date(sug.fecha_creacion).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                                                                <span>Área:</span>
                                                                <span className="text-slate-600 dark:text-slate-400 font-extrabold">{decodeEntities(sug.area_involucrada)}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold shrink-0">
                                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                                <span className="truncate max-w-[150px]">
                                                                    {sug.presentacion === 'anonima' 
                                                                        ? 'Anónimo' 
                                                                        : (sug.usuario?.nombreCompleto || 'Identificado')
                                                                    }
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedCard(isExpanded ? null : sug.id)}
                                                                className="text-xs font-black text-primary hover:text-primary-dark transition-colors uppercase tracking-wider flex items-center gap-1.5"
                                                            >
                                                                {isExpanded ? 'Ver Menos' : 'Ver Detalles'}
                                                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
