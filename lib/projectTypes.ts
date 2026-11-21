import {
    Clock,
    Calendar,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    MinusCircle,
    Archive,
} from 'lucide-react';
import type { TipoProyecto } from '@/lib/proyectos/tipos';
import { TIPO_PROYECTO_INFO } from '@/lib/proyectos/tipos';
import type { EstadoManual } from '@/lib/proyectos/salud';

// ── View Types ────────────────────────────────────────────────────────────────
export type ViewType = 'card' | 'spreadsheet' | 'gantt' | 'calendar';

// ── Project Status ────────────────────────────────────────────────────────────
export type ProjectStatus = 'por_hacer' | 'planificado' | 'activo' | 'en_riesgo' | 'atrasado' | 'finalizado' | 'archivado';

export interface Project {
    id: string;
    codigoProyecto?: string;
    nombre: string;
    activo: boolean;
    noEnMetricas: boolean;
    observaciones?: string;
    horasEstimadas: number;
    horasConsumidas: number;
    cliente?: string;
    clientId?: string;
    client?: { nombre: string };
    _count?: {
        clientDelays: number;
        checklistItems: number;
    };
    responsable?: string;
    responsableId?: string;
    responsableUser?: { nombreCompleto: string };
    categoria?: string;
    tipoActividad?: string;
    tags?: string[];
    checklistItems?: { id: string; completed: boolean; excluded: boolean; tag: string }[];
    finalizadoConPendientes?: boolean;
    geofenceLat?: number | null;
    geofenceLng?: number | null;
    geofenceRadius?: number | null;
    qrToken?: string | null;
    /** Estado calculado: "en riesgo" y "atrasado" salen de fechas, horas, checklist y bitácora (P27). */
    estado: ProjectStatus;
    /** Estado guardado (el que elige una persona). */
    estadoBase?: EstadoManual;
    /** Por qué está en riesgo o atrasado. */
    alertaMotivo?: string | null;
    tipo?: TipoProyecto;

    fechaInicio?: string;
    fechaFin?: string;
    publicToken?: string;
    generarOS?: boolean;
    aprovisionamiento?: boolean;
    listaPrecioId?: string | null;
    listaPrecio?: { id: string; codigo: string; nombre: string } | null;
    proyectoFijo?: boolean;
}

export interface FormData {
    nombre: string;
    activo: boolean;
    noEnMetricas: boolean;
    observaciones: string;
    horasEstimadas: number | string;
    cliente: string;
    clientId: string;
    responsable: string;
    responsableId: string;
    tags: string[];
    categoria: string;
    tipoActividad: string;
    tipo: TipoProyecto;
    estado: EstadoManual;
    fechaInicio: string;
    fechaFin: string;
    generarOS: boolean;
    aprovisionamiento: boolean;
    listaPrecioId?: string;
    geofenceLat: number | null;
    geofenceLng: number | null;
    geofenceRadius: number | null;
    qrToken: string | null;
    fichajeHabilitado: boolean;
    proyectoFijo: boolean;
}

export interface Filters {
    estados: ProjectStatus[];
    responsable: string;
    cliente: string;
    fechaInicio: string;
    fechaFin: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; ring: string; dot: string; Icon: React.ElementType }> = {
    por_hacer: { label: 'Por Hacer', color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200', dot: 'bg-blue-500', Icon: Clock },
    planificado: { label: 'Planificado', color: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-200', dot: 'bg-violet-500', Icon: Calendar },
    activo: { label: 'Activo', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-500', Icon: CheckCircle2 },
    en_riesgo: { label: 'En Riesgo', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', dot: 'bg-amber-400', Icon: AlertTriangle },
    atrasado: { label: 'Atrasado', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', dot: 'bg-red-500', Icon: XCircle },
    finalizado: { label: 'Finalizado', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/50', ring: 'ring-slate-200', dot: 'bg-slate-400', Icon: MinusCircle },
    // Reemplaza al interruptor "Activo = no" (E9): fuera de uso, se conserva por su historial
    archivado: { label: 'Archivado', color: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/50', ring: 'ring-slate-200', dot: 'bg-slate-300', Icon: Archive },
};

export const getProgressColor = (progress: number): string => {
    if (progress >= 85) return 'bg-red-500';
    if (progress >= 60) return 'bg-amber-400';
    return 'bg-emerald-500';
};

export const ALL_STATUSES: ProjectStatus[] = ['por_hacer', 'planificado', 'activo', 'en_riesgo', 'atrasado', 'finalizado', 'archivado'];
/** Estados que se eligen a mano (el resto se calcula). */
export const MANUAL_STATUSES: EstadoManual[] = ['por_hacer', 'planificado', 'activo', 'finalizado', 'archivado'];

export const EMPTY_FORM: FormData = {
    nombre: '',
    activo: true,
    noEnMetricas: false,
    observaciones: '',
    horasEstimadas: '',
    cliente: '',
    clientId: '',
    responsable: '',
    responsableId: '',
    tags: [],
    categoria: '',
    tipoActividad: '',
    tipo: 'obra',
    estado: 'activo',
    fechaInicio: '',
    fechaFin: '',
    generarOS: TIPO_PROYECTO_INFO.obra.valores.generarOS,
    aprovisionamiento: TIPO_PROYECTO_INFO.obra.valores.aprovisionamiento,
    listaPrecioId: '',
    geofenceLat: null,
    geofenceLng: null,
    geofenceRadius: null,
    qrToken: null,
    fichajeHabilitado: TIPO_PROYECTO_INFO.obra.valores.fichajeHabilitado,
    proyectoFijo: TIPO_PROYECTO_INFO.obra.valores.proyectoFijo,
};

export const EMPTY_FILTERS: Filters = {
    estados: [],
    responsable: '',
    cliente: '',
    fechaInicio: '',
    fechaFin: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ── localStorage key for view persistence ─────────────────────────────────────
export const VIEW_STORAGE_KEY = 'projects-view-type';
