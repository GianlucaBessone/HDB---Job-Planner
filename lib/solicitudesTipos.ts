/**
 * Tipos y etiquetas de solicitudes y aprobaciones (sin dependencias de servidor; los usan las pantallas).
 */

export const TIPOS_SOLICITUD = ['horas_modificar', 'horas_eliminar', 'proyecto_finalizar'] as const;
export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number];

export const TIPO_SOLICITUD_INFO: Record<TipoSolicitud, { label: string; funcion: string; entidad: 'timeEntry' | 'project' }> = {
    horas_modificar: { label: 'Corregir registro de horas', funcion: 'timesheets.gestionar_horas', entidad: 'timeEntry' },
    horas_eliminar: { label: 'Eliminar registro de horas', funcion: 'timesheets.gestionar_horas', entidad: 'timeEntry' },
    proyecto_finalizar: { label: 'Finalizar proyecto', funcion: 'proyectos.finalizar', entidad: 'project' },
};

export const ESTADOS_SOLICITUD = ['pendiente', 'aprobada', 'rechazada', 'cancelada'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADO_SOLICITUD_INFO: Record<EstadoSolicitud, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
    pendiente: { label: 'Pendiente', tone: 'warning' },
    aprobada: { label: 'Aprobada', tone: 'success' },
    rechazada: { label: 'Rechazada', tone: 'danger' },
    cancelada: { label: 'Cancelada', tone: 'neutral' },
};

export interface SolicitudVista {
    id: string;
    tipo: TipoSolicitud;
    estado: EstadoSolicitud;
    resumen: string;
    motivo: string;
    datos: Record<string, unknown> | null;
    entidadTipo: string;
    entidadId: string;
    /** Adónde ir para ver el objeto (registro de horas, ficha del proyecto…). */
    url: string;
    solicitante: { id: string; nombre: string };
    resueltoPor: { id: string; nombre: string } | null;
    resueltoAt: string | null;
    comentario: string | null;
    createdAt: string;
    /** Quien mira puede aprobarla o rechazarla. */
    puedeResolver: boolean;
    /** Quien mira la hizo y sigue pendiente: puede cancelarla. */
    puedeCancelar: boolean;
}
