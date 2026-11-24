/** Tipos y etiquetas de "Mis tareas" (P31), sin Prisma: los usa también la pantalla. */

export type OrigenTarea = 'tarea' | 'accion_mejora' | 'plan_kpi';
export type EstadoComun = 'pendiente' | 'en_curso';

export interface MiTarea {
    id: string;
    origen: OrigenTarea;
    /** De dónde sale: "Tarea", "NC-0003", "Sugerencia", "KPI Horas facturadas"… */
    origenDetalle: string;
    titulo: string;
    estado: EstadoComun;
    /** Fecha límite (YYYY-MM-DD) o null. */
    vence: string | null;
    vencida: boolean;
    href: string;
}

export const ETIQUETA_ORIGEN: Record<OrigenTarea, string> = {
    tarea: 'Tarea',
    accion_mejora: 'Acción de mejora',
    plan_kpi: 'Plan de acción de KPI',
};

/** Vista que hace falta poder abrir para ver cada origen (se filtra en la pantalla con `puedeVer`). */
export const VISTA_ORIGEN: Record<OrigenTarea, string> = {
    tarea: '/tareas',
    accion_mejora: '/calidad',
    plan_kpi: '/okr-kpi',
};

