import { z } from 'zod';

/**
 * Bitácora del proyecto (auditoría, FU10 y P28): las notas, consultas, reportes y
 * bloqueantes (`ProjectLog`) y las demoras del cliente (`ClientDelay`) se cargan y
 * se leen en un solo lugar. En la base siguen siendo dos tablas.
 */

/** Categorías de `ProjectLog.categoria`. */
export const CATEGORIAS_BITACORA = ['Nota', 'Reporte', 'Consulta', 'Bloqueante'] as const;
export type CategoriaBitacora = (typeof CATEGORIAS_BITACORA)[number];

/** Tipos que ofrece "Nueva entrada": las categorías más la demora del cliente. */
export type TipoEntrada = CategoriaBitacora | 'Demora';

export const TIPOS_ENTRADA: { id: TipoEntrada; label: string; ayuda: string }[] = [
    { id: 'Nota', label: 'Nota', ayuda: 'Avance, comentario o dato a recordar' },
    { id: 'Reporte', label: 'Reporte', ayuda: 'Algo que el supervisor tiene que ver' },
    { id: 'Consulta', label: 'Consulta', ayuda: 'Una pregunta para el equipo o el supervisor' },
    { id: 'Bloqueante', label: 'Bloqueante', ayuda: 'Algo impide seguir: avisa a los supervisores' },
    { id: 'Demora', label: 'Demora del cliente', ayuda: 'Tiempo perdido por causas del cliente: área, motivo y horas' },
];

/** Áreas de demora si no hay ninguna configurada en Ajustes (`AREA_DEMORA`). */
export const AREAS_DEMORA_POR_DEFECTO = [
    'Control Documentario', 'Calidad', 'Compras', 'IT', 'Producción', 'Logística', 'Seguridad',
    'MAPHI', 'Portería', 'Mantenimiento', 'Ingeniería', 'Gerencia', 'Otro',
];

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');
const HORA = z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida (HH:MM)');
const texto = (campo: string, max = 2000) =>
    z.string().trim().min(1, `Falta ${campo}`).max(max, `${campo[0].toUpperCase()}${campo.slice(1)} demasiado largo`);

/** Alta de una entrada de bitácora (`POST /api/projects/[id]/logs`). */
export const entradaBitacoraSchema = z.object({
    fecha: FECHA,
    observacion: texto('el texto', 5000),
    categoria: z.enum(CATEGORIAS_BITACORA).default('Nota'),
    responsable: z.string().trim().max(200).optional(),
});

/** Alta de una demora del cliente (`POST /api/delays`). */
export const demoraSchema = z.object({
    projectId: z.string().min(1, 'Falta el proyecto'),
    fecha: FECHA,
    hora: HORA,
    operador: z.string().trim().max(200).optional(),
    area: texto('el área', 200),
    responsableArea: z.string().trim().max(200).optional().nullable(),
    motivo: texto('el motivo', 2000),
    duracion: z.coerce.number().positive('La duración tiene que ser mayor a cero').max(1000, 'Duración demasiado grande'),
});

/** Edición de una demora (`PATCH /api/delays`). */
export const demoraParcialSchema = demoraSchema.partial();

/** Entrada de la bitácora tal como la muestra la ficha del proyecto. */
export interface EntradaBitacora {
    id: string;
    origen: 'log' | 'demora';
    tipo: TipoEntrada;
    fecha: string;
    autor: string;
    texto: string;
    /** Para ordenar: momento de carga. */
    orden: string;
    demora?: { area: string; responsableArea: string | null; duracion: number; hora: string };
}

interface LogApi { id: string; fecha: string; responsable: string; observacion: string; categoria?: string | null; createdAt: string }
interface DemoraApi { id: string; fecha: string; hora: string; operador: string; area: string; responsableArea?: string | null; motivo: string; duracion: number; createdAt: string }

/** Une entradas y demoras en una sola línea de tiempo, de la más nueva a la más vieja. */
export function unirBitacora(logs: LogApi[], demoras: DemoraApi[]): EntradaBitacora[] {
    const entradas: EntradaBitacora[] = [
        ...logs.map((l): EntradaBitacora => ({
            id: l.id,
            origen: 'log',
            tipo: (CATEGORIAS_BITACORA as readonly string[]).includes(l.categoria || '') ? (l.categoria as CategoriaBitacora) : 'Nota',
            fecha: l.fecha,
            autor: l.responsable,
            texto: l.observacion,
            orden: `${l.fecha}T${String(l.createdAt).slice(11)}`,
        })),
        ...demoras.map((d): EntradaBitacora => ({
            id: d.id,
            origen: 'demora',
            tipo: 'Demora',
            fecha: d.fecha,
            autor: d.operador,
            texto: d.motivo,
            orden: `${d.fecha}T${d.hora}`,
            demora: { area: d.area, responsableArea: d.responsableArea ?? null, duracion: d.duracion, hora: d.hora },
        })),
    ];
    return entradas.sort((a, b) => (a.orden < b.orden ? 1 : a.orden > b.orden ? -1 : 0));
}

/** Primer mensaje de error de Zod, para responder 400 con algo legible. */
export function primerError(error: z.ZodError): string {
    return error.issues[0]?.message || 'Datos inválidos';
}
