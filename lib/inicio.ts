/** Tipos de Inicio "Mi día" (GET /api/inicio/pendientes). */

export interface PendienteInicio {
    id: string;
    titulo: string;
    detalle: string;
    cantidad: number;
    href: string;
    tono: 'warning' | 'danger' | 'info' | 'brand';
}

export interface BloqueAgenda {
    proyecto: string;
    proyectoId: string | null;
    inicio: string | null;
    fin: string | null;
    nota: string | null;
}

export interface MiDiaRespuesta {
    hoy: string;
    jornada: { fecha: string; horaIngreso: string | null; proyecto: string | null } | null;
    agenda: BloqueAgenda[];
    asignaciones: { proyectoId: string; proyecto: string }[];
    pendientes: PendienteInicio[];
}
