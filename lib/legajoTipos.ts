/**
 * Tipos y etiquetas del legajo del personal, sin dependencias de servidor (los usan las pantallas).
 */

export const TIPOS_DOCUMENTO = ['apto_medico', 'licencia_conducir', 'art', 'habilitacion', 'seguro', 'otro'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const TIPO_DOCUMENTO_INFO: Record<TipoDocumento, { label: string; ejemplo: string }> = {
    apto_medico: { label: 'Apto médico', ejemplo: 'Apto preocupacional, examen periódico' },
    licencia_conducir: { label: 'Licencia de conducir', ejemplo: 'Licencia B1, carnet profesional' },
    art: { label: 'ART', ejemplo: 'Constancia de cobertura de ART' },
    habilitacion: { label: 'Habilitación', ejemplo: 'Trabajo en altura, autoelevador, matrícula' },
    seguro: { label: 'Seguro', ejemplo: 'Seguro de vida, accidentes personales' },
    otro: { label: 'Otro', ejemplo: 'Cualquier otro documento con vencimiento' },
};

/** Días antes del vencimiento en que un documento pasa a "por vencer". */
export const DIAS_AVISO = 30;

export type EstadoDocumento = 'vencido' | 'por_vencer' | 'vigente' | 'sin_vencimiento';

export const ESTADO_DOCUMENTO_INFO: Record<EstadoDocumento, { label: string; tone: 'danger' | 'warning' | 'success' | 'neutral' }> = {
    vencido: { label: 'Vencido', tone: 'danger' },
    por_vencer: { label: 'Por vencer', tone: 'warning' },
    vigente: { label: 'Vigente', tone: 'success' },
    sin_vencimiento: { label: 'Sin vencimiento', tone: 'neutral' },
};

/** Estado de un documento según su vencimiento (YYYY-MM-DD o ISO) y la fecha de hoy (YYYY-MM-DD). */
export function estadoDocumento(vencimiento: string | null | undefined, hoy: string): EstadoDocumento {
    if (!vencimiento) return 'sin_vencimiento';
    const v = vencimiento.slice(0, 10);
    if (v < hoy) return 'vencido';
    const limite = new Date(`${hoy}T12:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + DIAS_AVISO);
    return v <= limite.toISOString().slice(0, 10) ? 'por_vencer' : 'vigente';
}

export const ARCHIVO_LEGAJO_MAX_BYTES = 8 * 1024 * 1024;
export const ARCHIVO_LEGAJO_TIPOS: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export interface DatosLegajo {
    legajo: string | null;
    dni: string | null;
    cuil: string | null;
    fechaIngreso: string | null;
    fechaEgreso: string | null;
    fechaNacimiento: string | null;
    telefono: string | null;
    email: string | null;
    domicilio: string | null;
    localidad: string | null;
    obraSocial: string | null;
    grupoSanguineo: string | null;
    contactoEmergenciaNombre: string | null;
    contactoEmergenciaTelefono: string | null;
    contactoEmergenciaRelacion: string | null;
    observaciones: string | null;
}

export interface DocumentoLegajo {
    id: string;
    tipo: TipoDocumento;
    nombre: string;
    numero: string | null;
    fechaEmision: string | null;
    fechaVencimiento: string | null;
    archivoNombre: string | null;
    tieneArchivo: boolean;
    observaciones: string | null;
    creadoPorNombre: string | null;
    updatedAt: string;
}

export interface FichaLegajo {
    persona: { id: string; nombreCompleto: string; posicion: string | null; role: string; activo: boolean };
    datos: DatosLegajo;
    documentos: DocumentoLegajo[];
    actualizadoPorNombre: string | null;
    actualizado: string | null;
    /** El almacenamiento de archivos está configurado (si no, no se pueden adjuntar). */
    adjuntos: boolean;
}

export interface ResumenLegajo {
    id: string;
    nombreCompleto: string;
    posicion: string | null;
    activo: boolean;
    legajo: string | null;
    fechaIngreso: string | null;
    contactoEmergencia: boolean;
    documentos: number;
    vencidos: number;
    porVencer: number;
    proximoVencimiento: string | null;
}

/** Antigüedad legible desde la fecha de ingreso (YYYY-MM-DD). */
export function antiguedad(ingreso: string | null, hasta = new Date()): string | null {
    if (!ingreso) return null;
    const [a, m, d] = ingreso.slice(0, 10).split('-').map(Number);
    let meses = (hasta.getFullYear() - a) * 12 + (hasta.getMonth() + 1 - m);
    if (hasta.getDate() < d) meses--;
    if (meses < 0) return null;
    const anios = Math.floor(meses / 12);
    const resto = meses % 12;
    if (anios === 0) return resto === 0 ? 'Menos de un mes' : `${resto} ${resto === 1 ? 'mes' : 'meses'}`;
    return `${anios} ${anios === 1 ? 'año' : 'años'}${resto ? ` y ${resto} ${resto === 1 ? 'mes' : 'meses'}` : ''}`;
}
