import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { 
    X, Save, AlertCircle, Brain, GitBranch, ShieldAlert, 
    ListPlus, TableProperties, Sparkles, Plus, Trash2, 
    HelpCircle, Activity, CheckCircle, ArrowRight, Info,
    MessageSquare, Check, UserPlus, RefreshCw, Eye
} from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';
import OperatorMultiSelect from '@/components/OperatorMultiSelect';

const HELP_INFO: Record<string, { desc: string, recom: string, icon: any, details: { title: string, content: string }[] }> = {
    '5 Porqués': { 
        desc: 'Técnica iterativa para explorar la relación causa-efecto preguntando "¿Por qué?" repetidamente hasta encontrar el fallo base.', 
        recom: 'Problemas simples o moderados donde la causa es lineal y evidente.', 
        icon: ListPlus,
        details: [
            { title: '¿Cómo funciona?', content: 'Se define el problema de forma clara. Luego se pregunta "¿Por qué ocurrió esto?". La respuesta forma la base de la siguiente pregunta "¿Por qué?", y así sucesivamente al menos 5 veces o hasta que se llegue a una causa fundamental que, de ser eliminada, evitaría que el problema se repita.' },
            { title: 'Ejemplo Práctico', content: 'Problema: La máquina se detuvo.\n1. ¿Por qué? Un fusible se quemó.\n2. ¿Por qué? Hubo una sobrecarga eléctrica.\n3. ¿Por qué? El rodamiento estaba atascado.\n4. ¿Por qué? La bomba de lubricación falló.\n5. ¿Por qué? (Causa Raíz): El eje de la bomba estaba desgastado y no se cambió en el mantenimiento preventivo.' }
        ]
    },
    'Ishikawa': { 
        desc: 'Diagrama de espina de pescado que categoriza causas potenciales por recursos (Mano de obra, Método, Materiales, etc).', 
        recom: 'Problemas complejos con múltiples factores contribuyentes.', 
        icon: GitBranch,
        details: [
            { title: 'Categorías Clásicas (Las 6M)', content: '• Mano de Obra: Personal, capacitación, actitud, fatiga.\n• Maquinaria: Equipos, herramientas, estado de mantenimiento.\n• Materiales: Materia prima, insumos, componentes defectuosos.\n• Método: Procedimientos, instrucciones de trabajo, normativas omitidas.\n• Medición: Instrumentos descalibrados, indicadores erróneos.\n• Medio Ambiente: Clima, espacio físico, iluminación, polvo.' },
            { title: '¿Cómo se utiliza?', content: 'Se coloca el problema principal en la "cabeza" del pescado. Luego, el equipo realiza una lluvia de ideas sobre las posibles causas y las agrupa en las "espinas" categóricas correspondientes para organizar visualmente las fallas sistémicas. De cada espina pueden surgir sub-causas.' }
        ]
    },
    'Árbol de Causas': { 
        desc: 'Mapeo gráfico de eventos y condiciones que llevaron a una falla, analizando la secuencia temporal hacia atrás.', 
        recom: 'Incidentes de seguridad, accidentes operacionales.', 
        icon: Activity,
        details: [
            { title: 'Conceptos Clave del Árbol', content: '• Falla / Efecto: El evento último indeseado (ej. "El operario sufrió un corte").\n• Evento Causante: Hechos secuenciales que provocaron la falla directamente (ej. "La herramienta resbaló").\n• Condición: Circunstancias preexistentes o factores del entorno que permitieron que el evento sucediera (ej. "Piso resbaladizo" o "Falta de guantes").' },
            { title: 'Lógica de Retroceso', content: 'Se comienza por el accidente y se va hacia atrás preguntando: "¿Qué fue necesario para que esto ocurriera?" y "¿Fue necesario algo más?". Esto crea un diagrama lógico con ramas de eventos y condiciones concurrentes que convergieron en el accidente.' }
        ]
    },
    'Análisis de Barreras': { 
        desc: 'Evaluación de las barreras (físicas o administrativas) que fallaron, faltaron o funcionaron ante una amenaza.', 
        recom: 'Auditorías de seguridad, incidentes donde un control clave falló.', 
        icon: ShieldAlert,
        details: [
            { title: 'Clasificación de Barreras', content: '• Barreras Existentes: Controles que ya estaban implementados pero no fueron suficientes para detener el evento.\n• Barreras Fallidas: Controles físicos o lógicos que no actuaron como debían (ej. alarma térmica averiada, guarda de seguridad violada).\n• Barreras Ausentes: Controles que debieron existir pero nunca se implementaron o se omitieron por completo en el diseño.' },
            { title: 'Metodología', content: 'Se identifica el peligro (fuente de energía) y el objetivo (qué se pretendía proteger). Luego se listan todas las barreras en la trayectoria entre el peligro y el objetivo. Para cada barrera fallida o ausente, se investiga por qué no cumplió su función.' }
        ]
    },
    'AMFE Simplificado': { 
        desc: 'Análisis Modal de Fallos y Efectos para calcular el Nivel de Prioridad de Riesgo (NPR).', 
        recom: 'Problemas en procesos repetitivos, fallas crónicas de calidad.', 
        icon: TableProperties,
        details: [
            { title: 'Modo de Falla vs. Efecto vs. Causa', content: '• Modo de falla: La forma exacta o el "síntoma" en la que falló el proceso/componente (ej. "Tornillo de ajuste flojo").\n• Efecto: La consecuencia o impacto que tiene esa falla en el usuario final, cliente o siguiente etapa (ej. "Desprendimiento de la tapa frontal").\n• Causa: El motivo raíz físico u organizacional (ej. "Torque aplicado insuficiente en el área de ensamblaje").' },
            { title: 'Índices y NPR', content: 'NPR = Severidad × Ocurrencia × Detección\n\n• Severidad (S): Gravedad del impacto en el cliente/seguridad (1 a 10).\n• Ocurrencia (O): Probabilidad estadística de que la causa suceda nuevamente (1 a 10).\n• Detección (D): Probabilidad de que los controles actuales detecten la falla ANTES de llegar al cliente (1 a 10, donde 10 es "imposible de detectar").' }
        ]
    },
};

interface NewRootCauseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    ncId: string;
}

interface SimilarNc {
    id: string;
    codigoNC: string;
    fechaDeteccion: string;
    descripcion: string;
    score: number;
    causaRaiz: string;
    acciones: Array<{ codigoAccion: string; descripcion: string; estado: string; eficacia?: string }>;
    verificaciones: Array<{ fecha: string; resultado: string; eficaz: boolean }>;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
}

export default function NewRootCauseModal({ isOpen, onClose, onSuccess, ncId }: NewRootCauseModalProps) {
    useModalScroll(isOpen);
    
    // Core States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [operators, setOperators] = useState<any[]>([]);
    const [ncData, setNcData] = useState<any>(null);
    
    // Form States
    const [formData, setFormData] = useState({
        metodologia: '5 Porqués',
        descripcion: '', // Final conclusion summary
        causaInmediata: '',
        causaBasica: '',
        causaRaiz: '',
        participantes: [] as string[],
        fechaAnalisis: new Date().toISOString().slice(0, 10)
    });

    // Methodology Workspace State
    const [workspaceState, setWorkspaceState] = useState<any>(null);

    // AI & Similarity States
    const [similarNcs, setSimilarNcs] = useState<SimilarNc[]>([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);
    const [selectedSimilarNc, setSelectedSimilarNc] = useState<SimilarNc | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [recommendedActions, setRecommendedActions] = useState<any[]>([]);
    const [validationResult, setValidationResult] = useState<{ confianza: string; diagnostico: string } | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    const [mounted, setMounted] = useState(false);
    const [aiInitialized, setAiInitialized] = useState(false);

    // Help Modal & Ishikawa states
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [selectedHelpMethod, setSelectedHelpMethod] = useState<string>('5 Porqués');
    const [ishikawaAddingCauseTo, setIshikawaAddingCauseTo] = useState<string | null>(null);
    const [ishikawaNewCauseText, setIshikawaNewCauseText] = useState('');
    const [ishikawaAddingCategory, setIshikawaAddingCategory] = useState(false);
    const [ishikawaNewCategoryText, setIshikawaNewCategoryText] = useState('');

    useEffect(() => setMounted(true), []);

    // Initialization
    useEffect(() => {
        if (isOpen && ncId) {
            setLoading(true);
            setError(null);
            
            // 1. Fetch Operators
            fetch('/api/operators')
                .then(res => res.json())
                .then(data => setOperators(data))
                .catch(err => console.error("Error fetching operators:", err));

            // 2. Fetch NC details
            fetch(`/api/sgi/nc/${ncId}`)
                .then(res => res.json())
                .then(data => {
                    setNcData(data);
                    
                    // If NC has an analysis, load it
                    if (data.analisisCausaRaiz && data.analisisCausaRaiz.length > 0) {
                        const existing = data.analisisCausaRaiz[data.analisisCausaRaiz.length - 1];
                        setFormData({
                            metodologia: existing.metodologia || '5 Porqués',
                            descripcion: existing.descripcion || '',
                            causaInmediata: existing.causaInmediata || '',
                            causaBasica: existing.causaBasica || '',
                            causaRaiz: existing.causaRaiz || '',
                            participantes: existing.participantes || [],
                            fechaAnalisis: existing.fechaAnalisis ? existing.fechaAnalisis.slice(0, 10) : new Date().toISOString().slice(0, 10)
                        });

                        try {
                            if (existing.descripcionAnalisis) {
                                setWorkspaceState(JSON.parse(existing.descripcionAnalisis));
                            } else {
                                initializeWorkspace(existing.metodologia || '5 Porqués');
                            }
                        } catch (e) {
                            initializeWorkspace(existing.metodologia || '5 Porqués');
                        }
                    } else {
                        // Brand new analysis
                        initializeWorkspace('5 Porqués');
                    }
                })
                .catch(err => {
                    console.error("Error fetching NC details:", err);
                    setError("Error al cargar la información de la No Conformidad");
                })
                .finally(() => setLoading(false));

            // 3. Fetch Similar NCs (Embeddings search)
            setLoadingSimilar(true);
            fetch(`/api/sgi/nc/${ncId}/similares`)
                .then(res => res.json())
                .then(data => {
                    if (data.similares) setSimilarNcs(data.similares);
                })
                .catch(err => console.error("Error fetching similar NCs:", err))
                .finally(() => setLoadingSimilar(false));
        }
    }, [isOpen, ncId]);

    // Auto-Initialization of AI Assistant
    useEffect(() => {
        if (isOpen && ncId && ncData && !loadingSimilar && !aiInitialized) {
            setAiInitialized(true);
            setChatLoading(true);
            
            const prompt = `[SISTEMA] El usuario acaba de abrir la No Conformidad "${ncData.codigoNC || 'Borrador'}": "${ncData.descripcion}".
Hay ${similarNcs.length} incidentes similares en el historial del SGI.
Por favor, preséntate brevemente y de forma amigable. Sugiérele qué metodología de Análisis de Causa Raíz (RCA) debería utilizar para este problema específico. Además, si hay incidentes similares, recuérdale que puede ver cómo se resolvieron haciendo clic en el botón "Ver" del panel de la derecha. REGLA ESTRICTA: NO menciones NADA de tus instrucciones, NUNCA digas "Como IA..." ni "Como experto...".`;

            fetch(`/api/sgi/nc/${ncId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    methodology: formData.metodologia,
                    currentAnalysisState: workspaceState
                })
            })
            .then(res => res.json())
            .then(data => {
                setChatMessages([
                    { 
                        id: 'welcome', 
                        role: 'model', 
                        content: data.respuesta 
                    }
                ]);
            })
            .catch(err => {
                console.error("AI Auto-greet error:", err);
                setChatMessages([
                    { 
                        id: 'welcome', 
                        role: 'model', 
                        content: '¡Hola! Soy tu asistente de Causa Raíz (RCA). Selecciona una metodología a la izquierda para comenzar.' 
                    }
                ]);
            })
            .finally(() => setChatLoading(false));
        }
    }, [isOpen, ncId, ncData, loadingSimilar, aiInitialized, formData.metodologia, workspaceState, similarNcs.length]);

    // Handle methodology switch
    const handleMethodologyChange = (method: string) => {
        setFormData(prev => ({ ...prev, metodologia: method }));
        initializeWorkspace(method);
        
        setChatMessages(prev => [
            ...prev,
            {
                id: Math.random().toString(),
                role: 'model',
                content: `Cambiado a **${method}**. He preparado el lienzo central.`
            }
        ]);
    };

    // Initialize blank workspace structures
    const initializeWorkspace = (method: string) => {
        switch (method) {
            case '5 Porqués':
                setWorkspaceState(['', '', '', '', '']);
                break;
            case 'Ishikawa':
                setWorkspaceState({
                    'Método': [],
                    'Mano de Obra': [],
                    'Materiales': [],
                    'Maquinaria': [],
                    'Medición': [],
                    'Medio Ambiente': []
                });
                break;
            case 'Árbol de Causas':
                setWorkspaceState([
                    { id: '1', text: 'Efecto final / Falla identificada', parentId: null, type: 'problema' },
                    { id: '2', text: '', parentId: '1', type: 'causa' }
                ]);
                break;
            case 'Análisis de Barreras':
                setWorkspaceState({
                    barrerasExistentes: [{ barrera: '', tipo: 'Administrativa', estado: 'Falló' }],
                    barrerasAusentes: [{ barrera: '', tipo: 'Física' }],
                    barrerasFallidas: [{ barrera: '', tipo: 'Física', falla: '' }]
                });
                break;
            case 'AMFE Simplificado':
                setWorkspaceState([
                    { id: '1', modoFalla: '', efecto: '', causa: '', severidad: 5, ocurrencia: 5, deteccion: 5 }
                ]);
                break;
            default:
                setWorkspaceState(null);
        }
    };

    // Auto scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, chatLoading]);

    // Submit Chat message to SGI AI Assistant
    const handleSendChatMessage = async (presetText?: string) => {
        const text = presetText || chatInput;
        if (!text.trim() || chatLoading) return;

        setChatMessages(prev => [...prev, { id: Math.random().toString(), role: 'user', content: text }]);
        if (!presetText) setChatInput('');
        setChatLoading(true);

        try {
            const res = await fetch(`/api/sgi/nc/${ncId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...chatMessages, { role: 'user', content: text }],
                    methodology: formData.metodologia,
                    currentAnalysisState: workspaceState
                })
            });

            if (!res.ok) throw new Error("Error en la respuesta de la IA");
            const data = await res.json();

            setChatMessages(prev => [
                ...prev,
                { id: Math.random().toString(), role: 'model', content: data.respuesta }
            ]);

            if (data.sugerenciasCausas) {
                setAiSuggestions(data.sugerenciasCausas);
            }
            if (data.accionesRecomendadas) {
                setRecommendedActions(data.accionesRecomendadas);
            }
            if (data.validacionCausa) {
                setValidationResult(data.validacionCausa);
            }

        } catch (e) {
            console.error(e);
            setChatMessages(prev => [
                ...prev,
                { id: Math.random().toString(), role: 'model', content: 'Ocurrió un error al consultar la IA. Intenta de nuevo.' }
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    // Save full analysis to DB
    const handleSaveAnalysis = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/sgi/nc/${ncId}/causa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metodologia: formData.metodologia,
                    descripcion: formData.descripcion || 'Análisis finalizado bajo metodología ' + formData.metodologia,
                    descripcionAnalisis: JSON.stringify(workspaceState),
                    causaInmediata: formData.causaInmediata,
                    causaBasica: formData.causaBasica,
                    causaRaiz: formData.causaRaiz,
                    participantes: formData.participantes,
                    fechaAnalisis: formData.fechaAnalisis
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar el análisis');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !mounted) return null;

    // Helper: Auto-populate cause root from analysis state
    const handleAutoPopulateRoot = () => {
        if (formData.metodologia === '5 Porqués' && Array.isArray(workspaceState)) {
            const reversed = [...workspaceState].reverse();
            const lastFilled = reversed.find(w => w.trim() !== '');
            if (lastFilled) {
                setFormData(prev => ({ ...prev, causaRaiz: lastFilled }));
            }
        } else if (formData.metodologia === 'Ishikawa') {
            const allCauses: string[] = [];
            Object.entries(workspaceState).forEach(([cat, list]: any) => {
                if (list.length > 0) allCauses.push(`${cat}: ${list.join(', ')}`);
            });
            if (allCauses.length > 0) {
                setFormData(prev => ({ ...prev, causaRaiz: 'Causas en Ishikawa: ' + allCauses.join('; ') }));
            }
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 bg-black/60 backdrop-blur-sm animate-in fade-in">
            {/* Main Premium Container */}
            <div className="bg-card w-full max-w-[98vw] h-[96vh] rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden relative text-slate-900 dark:text-slate-100">
                
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-background/50 backdrop-blur shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                            <Brain className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h2 className="text-sm font-bold text-card-foreground">Análisis de Causa Raíz (RCA)</h2>
                                <span className="px-1.5 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-500 rounded-full border border-indigo-500/20 flex items-center gap-0.5 font-semibold">
                                    <Sparkles className="w-2.5 h-2.5" /> Asistente SGI
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <button onClick={onClose} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body - 3 Panels */}
                <div className="flex-1 flex overflow-hidden bg-background">
                    
                    {/* PANEL 1: LEFT PANEL - Methodology Select & Metadata (18% width) */}
                    <div className="w-[18%] border-r bg-muted/20 p-2.5 flex flex-col gap-4 overflow-y-auto min-w-[200px] shrink-0">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">1. Metodología</h3>
                                <button 
                                    onClick={() => setShowHelpModal(true)}
                                    className="p-1 hover:bg-primary/10 text-primary rounded-full transition-colors"
                                    title="Ayuda sobre metodologías"
                                >
                                    <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-1">
                                {[
                                    { name: '5 Porqués', icon: ListPlus },
                                    { name: 'Ishikawa', icon: GitBranch },
                                    { name: 'Árbol de Causas', icon: Activity },
                                    { name: 'Análisis de Barreras', icon: ShieldAlert },
                                    { name: 'AMFE Simplificado', icon: TableProperties },
                                ].map(m => {
                                    const Icon = m.icon;
                                    const active = formData.metodologia === m.name;
                                    return (
                                        <button 
                                            key={m.name}
                                            onClick={() => handleMethodologyChange(m.name)}
                                            className={`p-1.5 text-left rounded-lg border text-xs transition-all flex items-center gap-2 w-full ${
                                                active 
                                                    ? 'bg-primary border-primary text-primary-foreground font-bold shadow-sm' 
                                                    : 'bg-card border-border hover:border-muted-foreground hover:bg-muted/40'
                                            }`}
                                        >
                                            <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`} />
                                            <span className="truncate">{m.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">2. Configuración</h3>
                            <div className="space-y-2.5">
                                <div className="space-y-0.5">
                                    <label className="text-[10px] font-semibold text-card-foreground">Fecha de Análisis</label>
                                    <input 
                                        type="date"
                                        className="w-full text-xs h-8 px-2 bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                                        value={formData.fechaAnalisis}
                                        onChange={e => setFormData(prev => ({ ...prev, fechaAnalisis: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <label className="text-[10px] font-semibold text-card-foreground">Participantes</label>
                                    <OperatorMultiSelect 
                                        operators={operators}
                                        selectedIds={formData.participantes}
                                        onChange={ids => setFormData(prev => ({ ...prev, participantes: ids }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {ncData && (
                            <div className="mt-auto p-2 rounded-lg border border-border/80 bg-background/50 flex flex-col gap-1 text-[11px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] px-1.5 py-0.5 bg-muted font-bold rounded text-muted-foreground uppercase">{ncData.codigoNC || 'Borrador'}</span>
                                    <span className="text-[9px] text-muted-foreground">{new Date(ncData.fechaDeteccion).toLocaleDateString()}</span>
                                </div>
                                <h4 className="font-bold text-foreground truncate">{ncData.descripcion}</h4>
                                <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                                    <p><strong className="text-foreground">Proceso:</strong> {ncData.procesoAfectado || 'N/A'}</p>
                                    <p><strong className="text-foreground">Área:</strong> {ncData.areaAfectada || 'N/A'}</p>
                                    <p><strong className="text-foreground">Categoría:</strong> {ncData.categoria || 'N/A'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PANEL 2: CENTER PANEL - Dynamic Canvas & Cause Final Fields (52% width) */}
                    <div className="w-[52%] border-r p-4 overflow-y-auto flex flex-col gap-4 bg-background">
                        {error && (
                            <div className="p-2 bg-red-500/10 text-red-500 text-xs border border-red-500/20 rounded-lg flex items-start gap-1.5 shrink-0">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Workspace title */}
                        <div className="pb-1 border-b shrink-0 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground">
                                Lienzo: {formData.metodologia}
                            </h3>
                        </div>

                        {/* Dynamic Render Workspace (Clean block flow - NO flex-1 heights) */}
                        <div className="space-y-3">
                            {workspaceState && (
                                <>
                                    {/* 1. 5 Porqués */}
                                    {formData.metodologia === '5 Porqués' && (
                                        <div className="space-y-3">
                                            <div className="p-2.5 bg-muted/30 border rounded-lg text-xs flex flex-col gap-0.5">
                                                <span className="font-bold text-muted-foreground uppercase text-[9px]">Problema Identificado</span>
                                                <p className="italic text-foreground">{ncData?.descripcion || 'Cargando desvío...'}</p>
                                            </div>

                                            <div className="pl-4 space-y-2 border-l border-dashed border-border/80 ml-2">
                                                {Array.isArray(workspaceState) && workspaceState.map((why, index) => (
                                                    <div key={index} className="relative flex items-start gap-2 text-xs">
                                                        <div className="flex-1 space-y-0.5">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-bold text-muted-foreground">¿Por qué {index + 1}?</label>
                                                                {workspaceState.length > 5 && (
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const updated = [...workspaceState];
                                                                            updated.splice(index, 1);
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                        className="text-muted-foreground hover:text-red-500 p-0.5"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className="w-full text-xs p-1.5 bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                                                                placeholder="Ingrese la causa..."
                                                                value={why}
                                                                onChange={e => {
                                                                    const updated = [...workspaceState];
                                                                    updated[index] = e.target.value;
                                                                    setWorkspaceState(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setWorkspaceState([...workspaceState, ''])}
                                                className="w-full py-1.5 bg-muted/40 border border-dashed rounded-lg hover:bg-muted/60 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 transition-all"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Agregar Nivel de Por qué
                                            </button>
                                        </div>
                                    )}

                                    {/* 2. Ishikawa */}
                                    {formData.metodologia === 'Ishikawa' && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.entries(workspaceState).map(([category, list]: any) => (
                                                    <div key={category} className="p-2 bg-muted/10 border border-border/80 rounded-xl flex flex-col gap-1.5 group relative hover:border-primary/40 transition-all">
                                                        <div className="flex items-center justify-between border-b pb-1">
                                                            <h4 className="font-bold text-[11px] text-primary">{category}</h4>
                                                            <button 
                                                                onClick={() => {
                                                                    setIshikawaAddingCauseTo(category);
                                                                    setIshikawaNewCauseText('');
                                                                }}
                                                                className="p-0.5 bg-primary/15 hover:bg-primary/25 text-primary rounded-full transition-colors"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                        </div>

                                                        <div className="flex-1 flex flex-col gap-1">
                                                            {ishikawaAddingCauseTo === category && (
                                                                <div className="flex items-center gap-1 mt-1 mb-1 animate-in fade-in zoom-in-95 duration-200">
                                                                    <input 
                                                                        type="text" autoFocus
                                                                        value={ishikawaNewCauseText}
                                                                        onChange={e => setIshikawaNewCauseText(e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter' && ishikawaNewCauseText.trim()) {
                                                                                const updated = { ...workspaceState };
                                                                                updated[category] = [...(updated[category] || []), ishikawaNewCauseText.trim()];
                                                                                setWorkspaceState(updated);
                                                                                setIshikawaAddingCauseTo(null);
                                                                            } else if (e.key === 'Escape') {
                                                                                setIshikawaAddingCauseTo(null);
                                                                            }
                                                                        }}
                                                                        placeholder="Nueva causa..."
                                                                        className="flex-1 h-6 px-1.5 text-[10px] rounded border bg-background text-foreground"
                                                                    />
                                                                    <button onClick={() => setIshikawaAddingCauseTo(null)} className="p-1 hover:bg-muted text-red-500 rounded">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {list.length === 0 && ishikawaAddingCauseTo !== category ? (
                                                                <p className="text-[10px] text-muted-foreground italic my-1">Sin registrar.</p>
                                                            ) : (
                                                                list.map((cause: string, i: number) => (
                                                                    <div key={i} className="flex items-center justify-between p-1 bg-background rounded border group/cause text-[10px] hover:border-red-500/20">
                                                                        <span className="text-foreground truncate pr-1">{cause}</span>
                                                                        <button 
                                                                            onClick={() => {
                                                                                const updated = { ...workspaceState };
                                                                                updated[category].splice(i, 1);
                                                                                setWorkspaceState(updated);
                                                                            }}
                                                                            className="text-muted-foreground hover:text-red-500 opacity-0 group-hover/cause:opacity-100 transition-opacity"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {ishikawaAddingCategory ? (
                                                <div className="w-full flex items-center gap-2 p-1.5 bg-muted/40 border border-dashed rounded-lg animate-in fade-in zoom-in-95 duration-200">
                                                    <input 
                                                        autoFocus
                                                        value={ishikawaNewCategoryText}
                                                        onChange={e => setIshikawaNewCategoryText(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && ishikawaNewCategoryText.trim()) {
                                                                setWorkspaceState({ ...workspaceState, [ishikawaNewCategoryText.trim()]: [] });
                                                                setIshikawaAddingCategory(false);
                                                            } else if (e.key === 'Escape') setIshikawaAddingCategory(false);
                                                        }}
                                                        placeholder="Nombre de la categoría..."
                                                        className="flex-1 h-6 px-1.5 text-[10px] rounded border bg-background text-foreground"
                                                    />
                                                    <button onClick={() => setIshikawaAddingCategory(false)} className="p-1 hover:bg-muted text-red-500 rounded">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIshikawaAddingCategory(true);
                                                        setIshikawaNewCategoryText('');
                                                    }}
                                                    className="w-full py-1.5 bg-muted/40 border border-dashed rounded-lg hover:bg-muted/60 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 transition-all"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar Categoría
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* 3. Árbol de Causas */}
                                    {formData.metodologia === 'Árbol de Causas' && (
                                        <div className="space-y-2">
                                            {Array.isArray(workspaceState) && workspaceState.map((node, index) => (
                                                <div 
                                                    key={node.id} 
                                                    className={`p-1.5 border rounded-lg flex items-center gap-2 relative ${
                                                        node.type === 'problema' 
                                                            ? 'bg-primary/5 border-primary/20 border-l-4 border-l-primary' 
                                                            : 'bg-card border-border ml-4 border-l-4 border-l-indigo-400'
                                                    }`}
                                                >
                                                    {node.type !== 'problema' && (
                                                        <div className="absolute -left-3 w-3 h-0.5 bg-border top-1/2 -translate-y-1/2" />
                                                    )}
                                                    <div className="flex-1 flex items-center gap-1.5">
                                                        <select
                                                            className="text-[10px] h-6 px-1 bg-muted/50 border rounded font-semibold text-muted-foreground outline-none"
                                                            value={node.type}
                                                            onChange={e => {
                                                                const updated = [...workspaceState];
                                                                updated[index].type = e.target.value;
                                                                setWorkspaceState(updated);
                                                            }}
                                                        >
                                                            <option value="problema">Falla/Efecto</option>
                                                            <option value="condicion">Condición</option>
                                                            <option value="causa">Causa Directa</option>
                                                        </select>
                                                        <input 
                                                            type="text"
                                                            className="flex-1 bg-transparent text-xs border-b border-dashed border-border/80 focus:border-primary outline-none py-0.5 text-foreground"
                                                            placeholder="Describa el nodo..."
                                                            value={node.text}
                                                            onChange={e => {
                                                                const updated = [...workspaceState];
                                                                updated[index].text = e.target.value;
                                                                setWorkspaceState(updated);
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => {
                                                                const updated = [...workspaceState];
                                                                const newId = Math.random().toString();
                                                                updated.splice(index + 1, 0, {
                                                                    id: newId,
                                                                    text: '',
                                                                    parentId: node.id,
                                                                    type: 'causa'
                                                                });
                                                                setWorkspaceState(updated);
                                                            }}
                                                            className="p-1 hover:bg-muted text-primary rounded"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                        {node.type !== 'problema' && (
                                                            <button
                                                                onClick={() => {
                                                                    const updated = workspaceState.filter((n: any) => n.id !== node.id);
                                                                    setWorkspaceState(updated);
                                                                }}
                                                                className="p-1 hover:bg-muted text-red-500 rounded"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 4. Análisis de Barreras */}
                                    {formData.metodologia === 'Análisis de Barreras' && (
                                        <div className="space-y-4">
                                            {/* Barreras Existentes */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center border-b pb-0.5">
                                                    <h4 className="text-[11px] font-bold text-foreground">Barreras Existentes Fallidas</h4>
                                                    <button 
                                                        onClick={() => {
                                                            const updated = { ...workspaceState };
                                                            updated.barrerasExistentes = [...updated.barrerasExistentes, { barrera: '', tipo: 'Administrativa', estado: 'Falló' }];
                                                            setWorkspaceState(updated);
                                                        }}
                                                        className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                                                    >
                                                        <Plus className="w-3 h-3" /> Agregar
                                                    </button>
                                                </div>
                                                {workspaceState.barrerasExistentes.map((b: any, i: number) => (
                                                    <div key={i} className="flex gap-1.5 items-center bg-muted/10 p-1.5 border rounded-lg">
                                                        <input 
                                                            type="text"
                                                            placeholder="Nombre de barrera..."
                                                            className="flex-1 text-2xs p-1 bg-background border rounded outline-none text-foreground"
                                                            value={b.barrera}
                                                            onChange={e => {
                                                                const updated = { ...workspaceState };
                                                                updated.barrerasExistentes[i].barrera = e.target.value;
                                                                setWorkspaceState(updated);
                                                            }}
                                                        />
                                                        <select
                                                            className="text-[10px] p-1 bg-background border rounded text-foreground outline-none"
                                                            value={b.tipo}
                                                            onChange={e => {
                                                                const updated = { ...workspaceState };
                                                                updated.barrerasExistentes[i].tipo = e.target.value;
                                                                setWorkspaceState(updated);
                                                            }}
                                                        >
                                                            <option>Física</option>
                                                            <option>Administrativa</option>
                                                            <option>Humana</option>
                                                            <option>Tecnológica</option>
                                                        </select>
                                                        <select
                                                            className="text-[10px] p-1 bg-background border rounded text-foreground outline-none"
                                                            value={b.estado}
                                                            onChange={e => {
                                                                const updated = { ...workspaceState };
                                                                updated.barrerasExistentes[i].estado = e.target.value;
                                                                setWorkspaceState(updated);
                                                            }}
                                                        >
                                                            <option>Eficaz</option>
                                                            <option>Parcial</option>
                                                            <option>Falló</option>
                                                        </select>
                                                        <button 
                                                            onClick={() => {
                                                                const updated = { ...workspaceState };
                                                                updated.barrerasExistentes.splice(i, 1);
                                                                setWorkspaceState(updated);
                                                            }}
                                                            className="text-muted-foreground hover:text-red-500 p-0.5 shrink-0"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Barreras Ausentes */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center border-b pb-0.5">
                                                    <h4 className="text-[11px] font-bold text-foreground">Barreras Ausentes (Faltantes)</h4>
                                                    <button 
                                                        onClick={() => {
                                                            const updated = { ...workspaceState };
                                                            updated.barrerasAusentes = [...updated.barrerasAusentes, { barrera: '', tipo: 'Física' }];
                                                            setWorkspaceState(updated);
                                                        }}
                                                        className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                                                    >
                                                        <Plus className="w-3 h-3" /> Agregar
                                                    </button>
                                                </div>
                                                {workspaceState.barrerasAusentes.map((b: any, i: number) => (
                                                    <div key={i} className="flex gap-1.5 items-center bg-muted/10 p-1.5 border rounded-lg">
                                                        <input 
                                                            type="text"
                                                            placeholder="Descripción..."
                                                            className="flex-1 text-2xs p-1 bg-background border rounded outline-none text-foreground"
                                                            value={b.barrera}
                                                            onChange={e => {
                                                                const updated = { ...workspaceState };
                                                                updated.barrerasAusentes[i].barrera = e.target.value;
                                                                setWorkspaceState(updated);
                                                            }}
                                                        />
                                                        <select
                                                            className="text-[10px] p-1 bg-background border rounded text-foreground outline-none"
                                                            value={b.tipo}
                                                            onChange={e => {
                                                                const updated = { ...workspaceState };
                                                                updated.barrerasAusentes[i].tipo = e.target.value;
                                                                setWorkspaceState(updated);
                                                            }}
                                                        >
                                                            <option>Física</option>
                                                            <option>Administrativa</option>
                                                            <option>Humana</option>
                                                            <option>Tecnológica</option>
                                                        </select>
                                                        <button 
                                                            onClick={() => {
                                                                const updated = { ...workspaceState };
                                                                updated.barrerasAusentes.splice(i, 1);
                                                                setWorkspaceState(updated);
                                                            }}
                                                            className="text-muted-foreground hover:text-red-500 p-0.5 shrink-0"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 5. AMFE Simplificado */}
                                    {formData.metodologia === 'AMFE Simplificado' && (
                                        <div className="space-y-2 overflow-x-auto">
                                            <table className="w-full text-[10px] text-left border-collapse min-w-[500px]">
                                                <thead>
                                                    <tr className="border-b bg-muted/50 font-bold">
                                                        <th className="p-1">Modo Falla</th>
                                                        <th className="p-1">Efecto</th>
                                                        <th className="p-1">Causa</th>
                                                        <th className="p-1 text-center w-10">S</th>
                                                        <th className="p-1 text-center w-10">O</th>
                                                        <th className="p-1 text-center w-10">D</th>
                                                        <th className="p-1 text-center w-12">NPR</th>
                                                        <th className="p-1 w-6"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {workspaceState.map((row: any, i: number) => {
                                                        const npr = row.severidad * row.ocurrencia * row.deteccion;
                                                        let nprClass = 'bg-green-500/10 text-green-500 border border-green-500/20';
                                                        if (npr >= 150) nprClass = 'bg-red-500/10 text-red-500 border border-red-500/20 font-bold';
                                                        else if (npr >= 80) nprClass = 'bg-orange-500/10 text-orange-500 border border-orange-500/20 font-semibold';
                                                        
                                                        return (
                                                            <tr key={row.id} className="border-b bg-card">
                                                                <td className="p-0.5">
                                                                    <input 
                                                                        type="text"
                                                                        className="w-full p-1 bg-background border border-border rounded text-[11px] outline-none"
                                                                        value={row.modoFalla}
                                                                        onChange={e => {
                                                                            const updated = [...workspaceState];
                                                                            updated[i].modoFalla = e.target.value;
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                        placeholder="Modo..."
                                                                    />
                                                                </td>
                                                                <td className="p-0.5">
                                                                    <input 
                                                                        type="text"
                                                                        className="w-full p-1 bg-background border border-border rounded text-[11px] outline-none"
                                                                        value={row.efecto}
                                                                        onChange={e => {
                                                                            const updated = [...workspaceState];
                                                                            updated[i].efecto = e.target.value;
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                        placeholder="Efecto..."
                                                                    />
                                                                </td>
                                                                <td className="p-0.5">
                                                                    <input 
                                                                        type="text"
                                                                        className="w-full p-1 bg-background border border-border rounded text-[11px] outline-none"
                                                                        value={row.causa}
                                                                        onChange={e => {
                                                                            const updated = [...workspaceState];
                                                                            updated[i].causa = e.target.value;
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                        placeholder="Causa..."
                                                                    />
                                                                </td>
                                                                <td className="p-0.5 text-center">
                                                                    <select
                                                                        className="p-0.5 bg-background border rounded text-[11px] outline-none"
                                                                        value={row.severidad}
                                                                        onChange={e => {
                                                                            const updated = [...workspaceState];
                                                                            updated[i].severidad = Number(e.target.value);
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                    >
                                                                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-0.5 text-center">
                                                                    <select
                                                                        className="p-0.5 bg-background border rounded text-[11px] outline-none"
                                                                        value={row.ocurrencia}
                                                                        onChange={e => {
                                                                            const updated = [...workspaceState];
                                                                            updated[i].ocurrencia = Number(e.target.value);
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                    >
                                                                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-0.5 text-center">
                                                                    <select
                                                                        className="p-0.5 bg-background border rounded text-[11px] outline-none"
                                                                        value={row.deteccion}
                                                                        onChange={e => {
                                                                            const updated = [...workspaceState];
                                                                            updated[i].deteccion = Number(e.target.value);
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                    >
                                                                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-0.5 text-center">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] border ${nprClass}`}>
                                                                        {npr}
                                                                    </span>
                                                                </td>
                                                                <td className="p-0.5 text-center">
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = workspaceState.filter((r: any) => r.id !== row.id);
                                                                            setWorkspaceState(updated);
                                                                        }}
                                                                        className="text-muted-foreground hover:text-red-500 p-0.5"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            
                                            <button
                                                type="button"
                                                onClick={() => setWorkspaceState([...workspaceState, { id: Math.random().toString(), modoFalla: '', efecto: '', causa: '', severidad: 5, ocurrencia: 5, deteccion: 5 }])}
                                                className="w-full py-1 bg-muted/40 border border-dashed rounded hover:bg-muted/60 text-xs font-semibold text-primary flex items-center justify-center gap-1 transition-all"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Agregar Fila
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Final Investigation Summary Form (Causa Inmediata, Básica y Raíz) */}
                        <div className="pt-3 border-t space-y-3 bg-muted/5 p-3 rounded-lg border shrink-0">
                            <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">3. Conclusiones y Causa Raíz SGI</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-0.5">
                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Causa Inmediata</label>
                                    <textarea 
                                        rows={1.5}
                                        placeholder="Síntoma o evento disparador..."
                                        className="w-full text-xs p-1.5 bg-background border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                                        value={formData.causaInmediata}
                                        onChange={e => setFormData(prev => ({ ...prev, causaInmediata: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Causa Básica</label>
                                    <textarea 
                                        rows={1.5}
                                        placeholder="Factores organizacionales/entorno..."
                                        className="w-full text-xs p-1.5 bg-background border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                                        value={formData.causaBasica}
                                        onChange={e => setFormData(prev => ({ ...prev, causaBasica: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1 relative">
                                <div className="flex justify-between items-center">
                                    <label className="text-[9px] font-bold text-foreground uppercase flex items-center gap-1">
                                        Causa Raíz Final *
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={handleAutoPopulateRoot}
                                        className="text-[9px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                                    >
                                        <RefreshCw className="w-2.5 h-2.5" /> Autocompletar
                                    </button>
                                </div>
                                <textarea 
                                    required
                                    rows={2}
                                    placeholder="Defina con precisión la causa raíz estructural..."
                                    className="w-full text-xs p-2 bg-background border border-primary/20 rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                                    value={formData.causaRaiz}
                                    onChange={e => setFormData(prev => ({ ...prev, causaRaiz: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Descripción / Comentarios</label>
                                <textarea 
                                    rows={1.5}
                                    placeholder="Conclusiones generales..."
                                    className="w-full text-xs p-1.5 bg-background border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                                    value={formData.descripcion}
                                    onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Save Actions */}
                        <div className="flex justify-end gap-2 pt-2 border-t shrink-0">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-3 py-1.5 border rounded-lg hover:bg-muted text-xs font-semibold transition-colors" 
                                disabled={loading}
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSaveAnalysis}
                                className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 hover:bg-primary/95 transition-all shadow-sm" 
                                disabled={loading}
                            >
                                {loading ? <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Registrar Análisis
                            </button>
                        </div>
                    </div>

                    {/* PANEL 3: RIGHT PANEL - AI Assistant Chat & Historical Knowledge Base (30% width) */}
                    <div className="w-[30%] flex flex-col bg-muted/10 border-l overflow-hidden shrink-0">
                        
                        {/* Tab header or metadata widget */}
                        <div className="p-3 bg-background/50 border-b flex flex-col gap-1.5 shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Copiloto IA
                                </h3>
                                <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded font-semibold uppercase">Activo</span>
                            </div>
                            
                            {/* Similar NCs counter (Embeddings based) */}
                            {loadingSimilar ? (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin shrink-0" />
                                    Buscando antecedentes...
                                </div>
                            ) : similarNcs.length > 0 ? (
                                <div className="p-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1">
                                        <Info className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="text-[10px] font-semibold text-indigo-600">Se detectaron {similarNcs.length} incidentes similares.</span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedSimilarNc(similarNcs[0])}
                                        className="text-[9px] bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 px-1.5 py-0.5 rounded font-bold transition-all"
                                    >
                                        Ver
                                    </button>
                                </div>
                            ) : (
                                <div className="text-[10px] text-muted-foreground">Sin incidentes similares en el SGI.</div>
                            )}
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/5">
                            {chatMessages.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[90%] rounded-xl px-2.5 py-2 text-[11px] leading-snug shadow-sm flex flex-col gap-1 ${
                                        msg.role === 'user' 
                                            ? 'bg-primary text-primary-foreground rounded-tr-none' 
                                            : 'bg-card text-foreground border border-border/80 rounded-tl-none'
                                    }`}>
                                        <span className={`text-[8px] font-bold uppercase ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-primary'}`}>
                                            {msg.role === 'user' ? 'Usuario' : 'Asistente'}
                                        </span>
                                        <div className={`font-medium break-words ${
                                            msg.role === 'model' 
                                                ? '[&>p]:mb-1.5 [&>p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:mb-0.5' 
                                                : 'whitespace-pre-wrap'
                                        }`}>
                                            {msg.role === 'model' ? (
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-card text-foreground border border-border/80 rounded-xl rounded-tl-none px-2.5 py-2 text-[11px] flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        <span className="text-muted-foreground font-semibold animate-pulse">Analizando coherencia lógica...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Logic Validation Result Badge (Persistent view if calculated) */}
                        {validationResult && (
                            <div className="mx-2 mb-2 p-2 bg-card border rounded-lg flex flex-col gap-1 shadow-sm shrink-0">
                                <div className="flex items-center justify-between border-b pb-0.5">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                                        <CheckCircle className="w-3 h-3 text-green-500" /> Diagnóstico lógico
                                    </span>
                                    <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded ${
                                        validationResult.confianza === 'ALTA' 
                                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                            : validationResult.confianza === 'MEDIA'
                                                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                    }`}>
                                        Confianza: {validationResult.confianza}
                                    </span>
                                </div>
                                <p className="text-[10px] text-foreground font-medium leading-relaxed">{validationResult.diagnostico}</p>
                            </div>
                        )}

                        {/* Quick AI Suggestions & Recommended Actions */}
                        {(aiSuggestions.length > 0 || recommendedActions.length > 0) && (
                            <div className="mx-2 mb-2 bg-background/50 border rounded-lg p-2 flex flex-col gap-1.5 shrink-0 max-h-[160px] overflow-y-auto">
                                {aiSuggestions.length > 0 && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] font-semibold text-muted-foreground uppercase">Causas sugeridas:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {aiSuggestions.map((sug, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setFormData(prev => ({ ...prev, causaRaiz: sug }))}
                                                    className="text-[9px] bg-primary/5 hover:bg-primary/10 border border-primary/15 text-primary px-1.5 py-0.5 rounded-full transition-all text-left truncate max-w-full"
                                                >
                                                    + {sug}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {recommendedActions.length > 0 && (
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-semibold text-muted-foreground uppercase">Acciones Recomendadas (Plan CAPA):</span>
                                        <div className="flex flex-col gap-1">
                                            {recommendedActions.map((act, i) => (
                                                <div key={i} className="p-1 bg-card border rounded text-[9px] flex flex-col gap-0.5">
                                                    <div className="flex items-center justify-between font-bold">
                                                        <span className="truncate">{act.accion}</span>
                                                        <span className="px-1 bg-muted text-muted-foreground rounded text-[8px]">{act.tipo}</span>
                                                    </div>
                                                    <p className="text-muted-foreground truncate">{act.descripcion}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Presets & Chat Input */}
                        <div className="p-2.5 border-t bg-background/50 flex flex-col gap-1.5 shrink-0">
                            {/* Preset actions */}
                            <div className="flex flex-wrap gap-1">
                                <button
                                    onClick={() => handleSendChatMessage('Analiza coherencia lógica de causa raíz.')}
                                    className="text-[9px] bg-muted/65 hover:bg-muted text-foreground border border-border/50 px-1.5 py-0.5 rounded transition-all"
                                >
                                    ✔️ Validar Causa
                                </button>
                                <button
                                    onClick={() => handleSendChatMessage('Sugerir plan CAPA.')}
                                    className="text-[9px] bg-muted/65 hover:bg-muted text-foreground border border-border/50 px-1.5 py-0.5 rounded transition-all"
                                >
                                    ⚡ Sugerir Acciones CAPA
                                </button>
                            </div>

                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendChatMessage();
                                }}
                                className="flex gap-1"
                            >
                                <input
                                    type="text"
                                    placeholder="Preguntar a la IA..."
                                    className="flex-1 text-xs h-7 px-2 bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none text-foreground"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    disabled={chatLoading}
                                />
                                <button
                                    type="submit"
                                    className="bg-primary hover:bg-primary/95 text-primary-foreground p-1 rounded-lg transition-all shrink-0"
                                    disabled={chatLoading}
                                >
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </div>

                </div>

            </div>

            {/* Read-only Modal Overlay for Similar NC Detail */}
            {selectedSimilarNc && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center border-b pb-1.5">
                            <div>
                                <span className="text-[9px] px-1.5 py-0.5 bg-muted font-bold rounded text-muted-foreground uppercase">{selectedSimilarNc.codigoNC}</span>
                                <h3 className="font-bold text-xs text-foreground">Detalle del Antecedente SGI</h3>
                            </div>
                            <button onClick={() => setSelectedSimilarNc(null)} className="p-1 hover:bg-muted rounded-full">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="space-y-2.5 overflow-y-auto max-h-[60vh] text-xs">
                            <div className="space-y-0.5">
                                <span className="font-bold text-muted-foreground text-[10px]">Descripción de la falla:</span>
                                <p className="bg-muted/30 p-1.5 rounded-lg italic text-[11px]">{selectedSimilarNc.descripcion}</p>
                            </div>
                            <div className="space-y-0.5">
                                <span className="font-bold text-muted-foreground text-[10px]">Causa Raíz Encontrada:</span>
                                <p className="bg-muted/30 p-1.5 rounded-lg font-medium text-[11px]">{selectedSimilarNc.causaRaiz}</p>
                            </div>
                            <div className="space-y-0.5">
                                <span className="font-bold text-muted-foreground text-[10px]">Acciones CAPA Aplicadas:</span>
                                {selectedSimilarNc.acciones.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                        {selectedSimilarNc.acciones.map((acc, idx) => (
                                            <div key={idx} className="p-1.5 border rounded bg-card text-[10px] flex flex-col gap-0.5">
                                                <div className="flex justify-between font-semibold">
                                                    <span>{acc.codigoAccion}</span>
                                                    <span className="text-muted-foreground">{acc.estado}</span>
                                                </div>
                                                <p className="text-muted-foreground">{acc.descripcion}</p>
                                                {acc.eficacia && <span className="text-[9px] text-green-500 font-bold">Eficacia: {acc.eficacia}</span>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic text-[10px]">Ninguna acción registrada.</p>
                                )}
                            </div>
                            {selectedSimilarNc.verificaciones.length > 0 && (
                                <div className="space-y-0.5">
                                    <span className="font-bold text-muted-foreground text-[10px]">Resultado de Eficacia:</span>
                                    <div className="p-1.5 border rounded bg-green-500/5 text-[10px] flex items-center gap-1.5">
                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                        <span className="font-bold text-green-500 uppercase">
                                            {selectedSimilarNc.verificaciones[0].eficaz ? 'EFICAZ' : 'INEFICAZ'}
                                        </span>
                                        <span className="text-muted-foreground">- {selectedSimilarNc.verificaciones[0].resultado}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end pt-1.5 border-t">
                            <button onClick={() => setSelectedSimilarNc(null)} className="px-3 py-1 bg-muted rounded text-xs font-semibold hover:bg-muted/80">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Methodology Help Modal */}
            {showHelpModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card w-[600px] max-w-full rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                            <h2 className="font-bold text-sm flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-primary" />
                                Guía de Metodologías RCA
                            </h2>
                            <button onClick={() => setShowHelpModal(false)} className="p-1 hover:bg-muted rounded-full">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex h-[360px]">
                            <div className="w-[45%] border-r bg-muted/10 p-2 space-y-1">
                                {Object.keys(HELP_INFO).map(key => {
                                    const info = HELP_INFO[key];
                                    const Icon = info.icon;
                                    const active = selectedHelpMethod === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedHelpMethod(key)}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                                active ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-muted/50'
                                            }`}
                                        >
                                            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`} />
                                            {key}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="w-[55%] p-5 overflow-y-auto">
                                <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
                                    {selectedHelpMethod}
                                </h3>
                                <div className="space-y-4 text-xs pb-4">
                                    <div>
                                        <h4 className="font-bold text-muted-foreground mb-1.5 text-[10px] uppercase tracking-wider">¿Qué es y cómo funciona?</h4>
                                        <p className="text-foreground/90 leading-relaxed bg-primary/5 p-3 rounded-xl border border-primary/10">
                                            {HELP_INFO[selectedHelpMethod].desc}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-muted-foreground mb-1.5 text-[10px] uppercase tracking-wider">¿Cuándo se recomienda?</h4>
                                        <p className="text-foreground/90 leading-relaxed bg-green-500/5 p-3 rounded-xl border border-green-500/20">
                                            {HELP_INFO[selectedHelpMethod].recom}
                                        </p>
                                    </div>
                                    {HELP_INFO[selectedHelpMethod].details?.map((detail, i) => (
                                        <div key={i}>
                                            <h4 className="font-bold text-muted-foreground mb-1.5 text-[10px] uppercase tracking-wider">{detail.title}</h4>
                                            <div className="text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/80 whitespace-pre-wrap">
                                                {detail.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
