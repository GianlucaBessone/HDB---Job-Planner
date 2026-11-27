import { differenceInHours, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BadgeTone } from '@/components/ui';
import { estaAbierta, estaVencida } from '@/lib/tareas/vencimiento';

export interface TareaInvolucrado {
    id: string;
    operatorId: string;
    operator: { id: string; nombreCompleto: string; role: string };
    rol: string;
}

export interface TareaRecordatorio {
    id: string;
    tipo: string;
    fechaDisparo: string;
    mensaje?: string;
    cronJobId?: number;
    cronJobActivo: boolean;
    disparado: boolean;
    fechaDisparado?: string;
}

export interface Tarea {
    id: string;
    titulo: string;
    descripcion?: string;
    estado: string;
    prioridad: string;
    categoria?: string;
    fechaInicio?: string;
    fechaVencimiento?: string;
    fechaCompletada?: string;
    projectId?: string;
    project?: { id: string; nombre: string; codigoProyecto?: string };
    creadorId: string;
    creadorNombre: string;
    involucrados: TareaInvolucrado[];
    recordatorios: TareaRecordatorio[];
    notas?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface OperadorOpcion {
    id: string;
    nombreCompleto: string;
}

export interface ProyectoOpcion {
    id: string;
    nombre: string;
    codigoProyecto?: string;
}

export const ESTADOS = [
    { value: 'pendiente', label: 'Pendiente', tone: 'neutral' as BadgeTone, dot: 'bg-slate-400' },
    { value: 'en_progreso', label: 'En progreso', tone: 'info' as BadgeTone, dot: 'bg-info-500' },
    { value: 'completada', label: 'Completada', tone: 'success' as BadgeTone, dot: 'bg-success-500' },
    { value: 'cancelada', label: 'Cancelada', tone: 'danger' as BadgeTone, dot: 'bg-danger-400' },
];

/** Orden = posición en el deslizante (0 = baja … 3 = urgente). */
export const PRIORIDADES = [
    { value: 'baja', label: 'Baja', tone: 'neutral' as BadgeTone, bar: 'bg-slate-400', accent: 'accent-slate-500', text: 'text-slate-600 dark:text-slate-300' },
    { value: 'media', label: 'Media', tone: 'info' as BadgeTone, bar: 'bg-info-500', accent: 'accent-info-600', text: 'text-info-700 dark:text-info-300' },
    { value: 'alta', label: 'Alta', tone: 'warning' as BadgeTone, bar: 'bg-warning-500', accent: 'accent-warning-500', text: 'text-warning-700 dark:text-warning-300' },
    { value: 'urgente', label: 'Urgente', tone: 'danger' as BadgeTone, bar: 'bg-danger-500', accent: 'accent-danger-600', text: 'text-danger-700 dark:text-danger-300' },
];

export const ROLES_INVOLUCRADO = [
    { value: 'responsable', label: 'Responsable' },
    { value: 'colaborador', label: 'Colaborador' },
    { value: 'observador', label: 'Observador' },
];

export const TIPOS_RECORDATORIO = [
    { value: 'unico', label: 'Una sola vez' },
    { value: 'diario', label: 'Diario' },
    { value: 'semanal', label: 'Semanal' },
];

/** Las acciones de calidad (P31) suman "cerrada" y "anulada": se muestran con completadas y canceladas. */
export function columnaDeEstado(estado: string): string {
    if (estado === 'cerrada') return 'completada';
    if (estado === 'anulada') return 'cancelada';
    return estado;
}

export const getEstadoConfig = (estado: string) => ESTADOS.find(e => e.value === columnaDeEstado(estado)) || ESTADOS[0];
export const getPrioridadConfig = (prioridad: string) => PRIORIDADES.find(p => p.value === prioridad) || PRIORIDADES[1];
export const pesoPrioridad = (prioridad: string) => Math.max(0, PRIORIDADES.findIndex(p => p.value === prioridad));

export interface InfoVencimiento {
    text: string;
    className: string;
    vencida: boolean;
}

/**
 * Texto de fecha de una tarjeta. Solo las tareas abiertas (pendiente / en progreso)
 * muestran "Vencida"; las cerradas muestran cuándo se completaron.
 */
export function getVencimientoInfo(tarea: Pick<Tarea, 'estado' | 'fechaVencimiento' | 'fechaCompletada'>): InfoVencimiento | null {
    const columna = columnaDeEstado(tarea.estado);
    if (columna === 'completada') {
        if (!tarea.fechaCompletada) return null;
        return {
            text: `Completada ${formatDistanceToNow(new Date(tarea.fechaCompletada), { locale: es, addSuffix: true })}`,
            className: 'text-success-700 dark:text-success-300',
            vencida: false,
        };
    }
    if (!estaAbierta(tarea.estado) || !tarea.fechaVencimiento) return null;

    const d = new Date(tarea.fechaVencimiento);
    const dist = formatDistanceToNow(d, { locale: es, addSuffix: true });
    if (estaVencida(tarea)) return { text: `Vencida ${dist}`, className: 'text-danger-600 dark:text-danger-400 font-semibold', vencida: true };
    const horas = differenceInHours(d, new Date());
    if (horas <= 24) return { text: `Vence ${dist}`, className: 'text-warning-700 dark:text-warning-400 font-semibold', vencida: false };
    if (horas <= 72) return { text: `Vence ${dist}`, className: 'text-warning-600 dark:text-warning-400', vencida: false };
    return { text: `Vence ${dist}`, className: 'text-muted-foreground', vencida: false };
}

/** Orden de trabajo: vencidas primero, después prioridad y fecha de vencimiento. */
export function compararAbiertas(a: Tarea, b: Tarea): number {
    const va = estaVencida(a) ? 1 : 0;
    const vb = estaVencida(b) ? 1 : 0;
    if (va !== vb) return vb - va;
    const pa = pesoPrioridad(a.prioridad);
    const pb = pesoPrioridad(b.prioridad);
    if (pa !== pb) return pb - pa;
    const fa = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Infinity;
    const fb = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Infinity;
    if (fa !== fb) return fa - fb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/** Cerradas: la más reciente primero. */
export function compararCerradas(a: Tarea, b: Tarea): number {
    const fa = new Date(a.fechaCompletada || a.updatedAt || a.createdAt).getTime();
    const fb = new Date(b.fechaCompletada || b.updatedAt || b.createdAt).getTime();
    return fb - fa;
}

export function iniciales(nombre: string): string {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}
