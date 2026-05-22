export interface AiRequestOptions {
    userId?: string;
    userName?: string;
    userRole?: string;
    entity?: string;
    entityId?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
    stream?: boolean;
    useDatabasePrompts?: boolean;
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number; // in USD
}

export interface AiServiceResponse<T = any> {
    success: boolean;
    data?: T;
    text?: string;
    error?: string;
    usage?: TokenUsage;
    latencyMs?: number;
}

// 1. ISO Document Generator Types
export interface IsoDocGenInput {
    proceso: string;
    sector: string;
    alcance: string;
    responsables: string;
    descripcion: string;
}

export interface IsoDocGenOutput {
    codigoDocumental: string;
    titulo: string;
    tipoDocumento?: string;
    area?: string;
    descripcion: string;
    secciones?: Array<{
        titulo: string;
        contenido: string;
        orden: number;
    }>;
    controlCambios?: string;
    objetivosCalidad?: string[];
    accionesCorrectivasAsociadas?: string[];
    objetivo?: string;
    alcance?: string;
    desarrollo?: string;
    responsabilidades?: string;
    definiciones?: Array<{ term: string; definition: string }>;
    referencias?: Array<{ docId?: string | null; codigo: string; titulo: string }>;
}

// 2. Technical Assistant Types
export interface TechAssistantInput {
    falla: string;
    sintomas: string;
    observaciones: string;
    equipoTipo?: string;
    equipoHistorial?: string;
    mantenimientoPrevio?: string;
    categoriaServicio?: string;
}

export interface TechAssistantOutput {
    causasPosibles: Array<{
        causa: string;
        probabilidad: 'alta' | 'media' | 'baja';
        justificacion: string;
    }>;
    pasosDiagnostico: string[];
    recomendacionesSeguridad: string[];
    verificacionesRequeridas: string[];
    prioridadProblema: 'critica' | 'alta' | 'media' | 'baja';
    tiempoEstimadoResolucion?: string;
}

// 3. OCR and Document Analysis Types
export interface OcrAnalysisInput {
    fileUrl?: string;
    base64Data?: string;
    mimeType: string;
}

export interface OcrAnalysisOutput {
    fechaDocumento?: string;
    clienteNombre?: string;
    numeroDocumento?: string;
    observacionesGenerales?: string;
    equiposMencionados: string[];
    tecnicosIdentificados: string[];
    vencimientosIdentificados?: Array<{
        item: string;
        fecha: string;
    }>;
    camposClaveExtraidos: Record<string, string>;
}

// 4. Checklist Generator Types
export interface ChecklistGenInput {
    tipoTrabajo: string;
    etiquetas: string[];
    categoria?: string;
    normativa?: string;
}

export interface ChecklistGenOutput {
    titulo: string;
    descripcion?: string;
    items: Array<{
        descripcion: string;
        esObligatorio: boolean;
        requiereEvidencia: boolean;
        tipoEvidencia?: 'foto' | 'video' | 'firma' | 'texto';
        categoria: 'seguridad' | 'tecnico' | 'calidad' | 'medioambiente';
    }>;
}

// 5. Training Quiz Types
export interface TrainingQuizInput {
    documentId: string;
    documentContent: string;
    cantidadPreguntas?: number;
    nivelDificultad?: 'basico' | 'intermedio' | 'avanzado';
}

export interface TrainingQuizOutput {
    resumenSimple: string;
    contenidoCapacitacion: string;
    cuestionario: Array<{
        pregunta: string;
        opciones: string[];
        correctaIdx: number; // 0-indexed
        explicacion: string;
    }>;
}

// 6. Semantic Search Types
export interface SemanticSearchInput {
    query: string;
    maxResults?: number;
    filterEntity?: 'documentos' | 'procedimientos' | 'mantenimientos' | 'incidencias';
}

export interface SemanticSearchOutput {
    results: Array<{
        entity: string;
        entityId: string;
        score: number;
        title: string;
        snippet: string;
        highlights: string[];
    }>;
}

// 7. Auto Observations Types
export interface AutoObservationsInput {
    checklistData: any;
    inspeccionDetalles: string;
    anomaliasConfirmadas?: string[];
    imagenDescripcion?: string;
}

export interface AutoObservationsOutput {
    observaciones: string[];
    hallazgosClave: Array<{
        hallazgo: string;
        criticidad: 'alta' | 'media' | 'baja';
        sugerenciaAccion: string;
    }>;
    recomendacionesTecnicas: string[];
    conclusionesGenerales: string;
}

// 8. Image Analysis Types
export interface ImageAnomalyInput {
    base64Image: string;
    mimeType: string;
    tipoInstalacion: 'tablero' | 'dispenser' | 'maquina' | 'camara' | 'otro';
    contexto?: string;
}

export interface ImageAnomalyOutput {
    anomaliasDetectadas: Array<{
        anomalia: string;
        gravedad: 'critica' | 'alta' | 'media' | 'baja';
        ubicacionEnImagen?: string;
        descripcion: string;
    }>;
    estadoGeneral: 'optimo' | 'aceptable' | 'requiere_atencion' | 'critico';
    observacionesSugeridas: string[];
    sugerenciaMantenimiento: string[];
}
