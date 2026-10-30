/**
 * Taxonomía, prioridad, SLA y máquina de estados de los tickets de soporte.
 *
 * Este archivo es client-safe: no importa Prisma ni APIs de Node.
 * Lo usan la UI y las rutas de API. El MCP mantiene su propia copia de las
 * transiciones en `mcp/sgi-tickets/policy.json`: si cambiás una, cambiá la otra.
 */

// ── Tipos ──────────────────────────────────────────────────────────

export type TicketTipo = 'error' | 'funcionalidad' | 'sugerencia' | 'consulta';
export type TicketUrgencia = 'critica' | 'alta' | 'media' | 'baja';
export type TicketImpacto = 'organizacion' | 'area' | 'varios_usuarios' | 'usuario_unico';
export type TicketPrioridad = 'P0' | 'P1' | 'P2' | 'P3';
export type TicketRiesgo = 'bajo' | 'medio' | 'alto' | 'critico' | 'desconocido';
export type TicketEstado =
    | 'nuevo'
    | 'triaje'
    | 'en_analisis'
    | 'pendiente_aprobacion'
    | 'listo_para_fix'
    | 'en_progreso'
    | 'en_revision'
    | 'resuelto'
    | 'cerrado'
    | 'rechazado'
    | 'duplicado';

export interface TicketAdjunto {
    id: string;
    nombre: string;
    url: string;
    size: number;
}

export interface TicketContexto {
    ruta?: string;
    url?: string;
    navegador?: string;
    plataforma?: string;
    pantalla?: string;
    zonaHoraria?: string;
    version?: string;
}

// ── Catálogos ──────────────────────────────────────────────────────

export const TICKET_TIPOS: Array<{ value: TicketTipo; label: string; short: string; description: string }> = [
    {
        value: 'error',
        label: 'Error / falla',
        short: 'Error',
        description: 'Algo no funciona como debería: pantalla en blanco, datos incorrectos, un botón que no responde.',
    },
    {
        value: 'funcionalidad',
        label: 'Nueva función',
        short: 'Nueva función',
        description: 'Necesitás una capacidad que hoy no existe en el sistema.',
    },
    {
        value: 'sugerencia',
        label: 'Sugerencia / mejora',
        short: 'Sugerencia',
        description: 'Algo funciona, pero podría ser más rápido, claro o simple.',
    },
    {
        value: 'consulta',
        label: 'Consulta',
        short: 'Consulta',
        description: 'Una duda sobre cómo usar una pantalla o un proceso.',
    },
];

export const TICKET_URGENCIAS: Array<{
    value: TicketUrgencia;
    label: string;
    description: string;
    color: string;
}> = [
    { value: 'critica', label: 'Crítica', description: 'Bloquea la operación. No hay forma de trabajar.', color: 'rose' },
    { value: 'alta', label: 'Alta', description: 'Impacta hoy. Hay una vuelta manual pero cuesta tiempo.', color: 'orange' },
    { value: 'media', label: 'Media', description: 'Molesta, pero se puede seguir trabajando.', color: 'amber' },
    { value: 'baja', label: 'Baja', description: 'Mejora deseable. No urge.', color: 'slate' },
];

export const TICKET_IMPACTOS: Array<{
    value: TicketImpacto;
    label: string;
    description: string;
}> = [
    { value: 'organizacion', label: 'Toda la organización', description: 'Afecta a todas las áreas o a clientes.' },
    { value: 'area', label: 'Un área completa', description: 'Afecta a un equipo o sector entero.' },
    { value: 'varios_usuarios', label: 'Varios usuarios', description: 'Le pasa a más de una persona.' },
    { value: 'usuario_unico', label: 'Solo a mí', description: 'Es un caso puntual.' },
];

export const TICKET_ESTADOS: Array<{
    value: TicketEstado;
    label: string;
    description: string;
    color: string;
}> = [
    { value: 'nuevo', label: 'Nuevo', description: 'Recién reportado, sin revisar.', color: 'sky' },
    { value: 'triaje', label: 'En triaje', description: 'Se está clasificando y verificando.', color: 'indigo' },
    { value: 'en_analisis', label: 'En análisis', description: 'El agente o el equipo está evaluando el alcance.', color: 'violet' },
    { value: 'pendiente_aprobacion', label: 'Pendiente de aprobación', description: 'Requiere tu decisión por riesgo o alcance.', color: 'amber' },
    { value: 'listo_para_fix', label: 'Listo para corregir', description: 'Analizado y aprobado para implementación.', color: 'cyan' },
    { value: 'en_progreso', label: 'En progreso', description: 'Se está implementando el cambio.', color: 'blue' },
    { value: 'en_revision', label: 'En revisión', description: 'Cambio aplicado, pendiente de validación.', color: 'teal' },
    { value: 'resuelto', label: 'Resuelto', description: 'Validado y disponible para el usuario.', color: 'emerald' },
    { value: 'cerrado', label: 'Cerrado', description: 'Confirmado por quien lo reportó.', color: 'slate' },
    { value: 'rechazado', label: 'Rechazado', description: 'No se implementará.', color: 'rose' },
    { value: 'duplicado', label: 'Duplicado', description: 'Ya existe otro ticket para lo mismo.', color: 'zinc' },
];

export const TICKET_TIPO_LABEL: Record<TicketTipo, string> = {
    error: 'Error',
    funcionalidad: 'Nueva función',
    sugerencia: 'Sugerencia',
    consulta: 'Consulta',
};

export const TICKET_URGENCIA_LABEL: Record<TicketUrgencia, string> = {
    critica: 'Crítica',
    alta: 'Alta',
    media: 'Media',
    baja: 'Baja',
};

export const TICKET_IMPACTO_LABEL: Record<TicketImpacto, string> = {
    organizacion: 'Toda la organización',
    area: 'Un área',
    varios_usuarios: 'Varios usuarios',
    usuario_unico: 'Un usuario',
};

export const TICKET_ESTADO_LABEL: Record<TicketEstado, string> = {
    nuevo: 'Nuevo',
    triaje: 'En triaje',
    en_analisis: 'En análisis',
    pendiente_aprobacion: 'Pendiente de aprobación',
    listo_para_fix: 'Listo para corregir',
    en_progreso: 'En progreso',
    en_revision: 'En revisión',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
    rechazado: 'Rechazado',
    duplicado: 'Duplicado',
};

export const TICKET_RIESGO_LABEL: Record<TicketRiesgo, string> = {
    bajo: 'Bajo',
    medio: 'Medio',
    alto: 'Alto',
    critico: 'Crítico',
    desconocido: 'Sin evaluar',
};

// ── Prioridad ──────────────────────────────────────────────────────

const URGENCIA_SCORE: Record<TicketUrgencia, number> = {
    critica: 4,
    alta: 3,
    media: 2,
    baja: 1,
};

const IMPACTO_SCORE: Record<TicketImpacto, number> = {
    organizacion: 4,
    area: 3,
    varios_usuarios: 2,
    usuario_unico: 1,
};

const PRIORIDAD_RANK: Record<TicketPrioridad, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/**
 * Calcula la prioridad combinando urgencia (peso doble) e impacto.
 * Las ideas y pedidos de funcionalidad nuevos nunca suben de P2 salvo
 * que sean críticos para la operación.
 */
export function computePrioridad(
    tipo: TicketTipo,
    urgencia: TicketUrgencia,
    impacto: TicketImpacto
): TicketPrioridad {
    const score = URGENCIA_SCORE[urgencia] * 2 + IMPACTO_SCORE[impacto];
    let prioridad: TicketPrioridad = score >= 11 ? 'P0' : score >= 9 ? 'P1' : score >= 6 ? 'P2' : 'P3';

    const esIdea = tipo === 'funcionalidad' || tipo === 'sugerencia' || tipo === 'consulta';
    if (esIdea && PRIORIDAD_RANK[prioridad] < PRIORIDAD_RANK.P2) {
        prioridad = 'P2';
    }
    return prioridad;
}

export const TICKET_PRIORIDAD_LABEL: Record<TicketPrioridad, string> = {
    P0: 'P0 · Inmediata',
    P1: 'P1 · Alta',
    P2: 'P2 · Normal',
    P3: 'P3 · Baja',
};

// ── SLA ────────────────────────────────────────────────────────────

export const TICKET_SLA_HORAS: Record<TicketUrgencia, { respuesta: number; resolucion: number }> = {
    critica: { respuesta: 4, resolucion: 24 },
    alta: { respuesta: 24, resolucion: 72 },
    media: { respuesta: 72, resolucion: 240 },
    baja: { respuesta: 240, resolucion: 720 },
};

export type SlaEstado = 'sin_sla' | 'en_plazo' | 'por_vencer' | 'vencido';

export function getSlaEstado(
    urgencia: TicketUrgencia,
    createdAt: string | Date,
    fechaResolucion?: string | Date | null
): { estado: SlaEstado; venceEl: Date; horasRestantes: number } {
    const sla = TICKET_SLA_HORAS[urgencia] || TICKET_SLA_HORAS.media;
    const inicio = new Date(createdAt).getTime();
    const venceEl = new Date(inicio + sla.resolucion * 60 * 60 * 1000);
    const referencia = fechaResolucion ? new Date(fechaResolucion).getTime() : Date.now();
    const horasRestantes = (venceEl.getTime() - referencia) / (60 * 60 * 1000);

    let estado: SlaEstado = 'en_plazo';
    if (fechaResolucion) {
        estado = referencia <= venceEl.getTime() ? 'en_plazo' : 'vencido';
    } else if (horasRestantes < 0) {
        estado = 'vencido';
    } else if (horasRestantes <= Math.max(4, sla.resolucion * 0.2)) {
        estado = 'por_vencer';
    }

    return { estado, venceEl, horasRestantes };
}

// ── Máquina de estados ─────────────────────────────────────────────

export const TICKET_TRANSICIONES: Record<TicketEstado, TicketEstado[]> = {
    nuevo: ['triaje', 'rechazado', 'duplicado'],
    triaje: ['en_analisis', 'pendiente_aprobacion', 'listo_para_fix', 'rechazado', 'duplicado'],
    en_analisis: ['listo_para_fix', 'pendiente_aprobacion', 'rechazado', 'duplicado'],
    pendiente_aprobacion: ['listo_para_fix', 'rechazado', 'duplicado'],
    listo_para_fix: ['en_progreso', 'pendiente_aprobacion', 'rechazado'],
    en_progreso: ['en_revision', 'pendiente_aprobacion'],
    en_revision: ['resuelto', 'en_progreso'],
    resuelto: ['cerrado', 'en_revision'],
    cerrado: ['en_revision'],
    rechazado: ['triaje'],
    duplicado: ['triaje'],
};

export function canTransition(from: string, to: string): boolean {
    const allowed = TICKET_TRANSICIONES[from as TicketEstado];
    return Array.isArray(allowed) && allowed.includes(to as TicketEstado);
}

export function getTransiciones(from: string): TicketEstado[] {
    return TICKET_TRANSICIONES[from as TicketEstado] || [];
}

export const TICKET_ESTADOS_ABIERTOS: TicketEstado[] = [
    'nuevo',
    'triaje',
    'en_analisis',
    'pendiente_aprobacion',
    'listo_para_fix',
    'en_progreso',
    'en_revision',
    'resuelto',
];

export function esTicketAbierto(estado: string): boolean {
    return TICKET_ESTADOS_ABIERTOS.includes(estado as TicketEstado);
}

// ── Etiquetas y colores ────────────────────────────────────────────

export const TICKET_TIPO_STYLE: Record<TicketTipo, string> = {
    error: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
    funcionalidad: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
    sugerencia: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    consulta: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
};

export const TICKET_URGENCIA_STYLE: Record<TicketUrgencia, string> = {
    critica: 'bg-rose-600 text-white border-rose-600',
    alta: 'bg-orange-500 text-white border-orange-500',
    media: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    baja: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export const TICKET_ESTADO_STYLE: Record<TicketEstado, string> = {
    nuevo: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
    triaje: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
    en_analisis: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
    pendiente_aprobacion: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    listo_para_fix: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
    en_progreso: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    en_revision: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800',
    resuelto: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    cerrado: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    rechazado: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
    duplicado: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
};

// ── Helpers de formato ─────────────────────────────────────────────

export function generarCodigoTicket(year: number, numero: number): string {
    return `TCK-${year}-${String(numero).padStart(4, '0')}`;
}

export function resumenContexto(contexto?: TicketContexto | null): string {
    if (!contexto) return 'Sin contexto';
    const partes = [contexto.ruta, contexto.pantalla].filter(Boolean);
    return partes.length > 0 ? partes.join(' · ') : 'Sin contexto';
}

export const TICKET_TITULO_MAX = 140;
export const TICKET_DESCRIPCION_MIN = 20;
export const TICKET_ADJUNTOS_MAX = 3;
// Se suben de a uno: Vercel corta cuerpos de más de 4,5 MB.
export const TICKET_ADJUNTO_MAX_BYTES = 3 * 1024 * 1024;
