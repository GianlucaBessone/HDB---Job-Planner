// Análisis de Pliegos: constantes, etiquetas y contrato del análisis.
// Se importa desde cliente y servidor (sin Prisma ni APIs de Node).
import { z } from 'zod';
import type { BadgeTone } from '@/components/ui/Badge';

// ── Permisos ────────────────────────────────────────────────────────
/** Suben pliegos y piden el análisis (o un re-análisis). */
export const PLIEGO_ROLES_GESTION = ['admin'];
/** Ven los análisis y marcan tareas dentro / fuera del pliego. */
export const PLIEGO_ROLES_VER = ['operador', 'supervisor', 'admin', 'qa'];

export const puedeGestionarPliegos = (rol: string | null | undefined) => !!rol && PLIEGO_ROLES_GESTION.includes(rol.toLowerCase());
export const puedeVerPliegos = (rol: string | null | undefined) => !!rol && PLIEGO_ROLES_VER.includes(rol.toLowerCase());

// ── Archivo ─────────────────────────────────────────────────────────
/** Límite del PDF: Gemini acepta hasta ~20 MB por request con el archivo en base64. */
export const PLIEGO_MAX_BYTES = 14 * 1024 * 1024;

// ── Estados ─────────────────────────────────────────────────────────
export type PliegoEstado = 'borrador' | 'analizando' | 'analizado' | 'error';
export const PLIEGO_ESTADO_LABEL: Record<PliegoEstado, string> = {
    borrador: 'Sin analizar',
    analizando: 'Analizando',
    analizado: 'Analizado',
    error: 'Error de análisis',
};
export const PLIEGO_ESTADO_TONE: Record<PliegoEstado, BadgeTone> = {
    borrador: 'neutral',
    analizando: 'info',
    analizado: 'success',
    error: 'danger',
};

/** Un análisis que lleva más que esto "analizando" se considera colgado y se puede reintentar. */
export const PLIEGO_ANALISIS_TIMEOUT_MS = 6 * 60 * 1000;

// ── Contrato del análisis (lo que devuelve la IA) ───────────────────
// Tolerante con lo que no es esencial: si la IA no informa el origen se asume IA,
// los enums se normalizan y los textos largos se recortan en vez de fallar.

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const texto = (max: number) =>
    z.preprocess(v => (v == null ? '' : String(v)), z.string()).transform(s => s.trim().slice(0, max));

const textoReq = (max: number, campo: string) =>
    texto(max).refine(s => s.length > 0, { message: `Falta ${campo}.` });

const textoOpc = (max: number) =>
    z.preprocess(v => (v == null ? null : String(v).trim().slice(0, max) || null), z.string().nullable()).optional().transform(v => v ?? null);

const enumNormalizado = <T extends string>(valores: readonly T[], porDefecto: T, alias: Record<string, T> = {}) =>
    z.preprocess(v => {
        if (typeof v !== 'string') return porDefecto;
        const k = sinAcentos(v);
        if ((valores as readonly string[]).includes(k)) return k;
        return alias[k] ?? porDefecto;
    }, z.enum(valores as unknown as [T, ...T[]]));

export const ORIGENES = ['PLIEGO', 'IA'] as const;
export type Origen = (typeof ORIGENES)[number];
const origen = z.preprocess(v => (typeof v === 'string' && sinAcentos(v).startsWith('pliego') ? 'PLIEGO' : 'IA'), z.enum(ORIGENES));

const cantidad = z.preprocess(v => {
    if (v == null || v === '') return null;
    return String(v).trim().slice(0, 40) || null;
}, z.string().nullable()).optional().transform(v => v ?? null);

const conOrigen = { origen, referencia: textoOpc(200) };

export const tareaIASchema = z.object({
    titulo: textoReq(200, 'el título de una tarea'),
    descripcion: texto(4000),
    ...conOrigen,
});

export const EVALUACIONES = ['adecuado', 'revisar', 'error'] as const;
export type Evaluacion = (typeof EVALUACIONES)[number];

export const materialSchema = z.object({
    descripcion: textoReq(400, 'la descripción de un material'),
    cantidad,
    unidad: textoOpc(40),
    evaluacion: enumNormalizado(EVALUACIONES, 'adecuado', { ok: 'adecuado', correcto: 'adecuado', incompleto: 'revisar', ambiguo: 'revisar', incorrecto: 'error' }),
    observacion: textoOpc(1000),
    ...conOrigen,
});

export const herramientaSchema = z.object({
    descripcion: textoReq(300, 'la descripción de una herramienta'),
    cantidad,
    observacion: textoOpc(600),
    ...conOrigen,
});

export const personalSchema = z.object({
    rol: textoReq(200, 'el rol del personal'),
    cantidad,
    competencias: textoOpc(1000),
    ...conOrigen,
});

export const HYS_CATEGORIAS = ['epp', 'riesgo', 'procedimiento', 'permiso', 'documentacion', 'capacitacion', 'otro'] as const;
export type HysCategoria = (typeof HYS_CATEGORIAS)[number];

export const hysSchema = z.object({
    categoria: enumNormalizado(HYS_CATEGORIAS, 'otro', { 'permiso de trabajo': 'permiso', riesgos: 'riesgo', documentos: 'documentacion' }),
    descripcion: textoReq(1000, 'la descripción de un ítem de H&S'),
    ...conOrigen,
});

export const ALERTA_TIPOS = ['error', 'omision', 'ambiguedad', 'riesgo'] as const;
export type AlertaTipo = (typeof ALERTA_TIPOS)[number];
export const SEVERIDADES = ['alta', 'media', 'baja'] as const;
export type Severidad = (typeof SEVERIDADES)[number];

export const alertaSchema = z.object({
    tipo: enumNormalizado(ALERTA_TIPOS, 'ambiguedad', { errores: 'error', omisiones: 'omision', ambiguo: 'ambiguedad', riesgos: 'riesgo' }),
    severidad: enumNormalizado(SEVERIDADES, 'media', { critica: 'alta', alto: 'alta', medio: 'media', bajo: 'baja' }),
    titulo: textoReq(200, 'el título de una alerta'),
    descripcion: texto(2000),
    recomendacion: textoOpc(1000),
    referencia: textoOpc(200),
});

const lista = <T extends z.ZodTypeAny>(item: T) =>
    z.preprocess(v => (Array.isArray(v) ? v : []), z.array(item));

export const analisisIASchema = z.object({
    resumen: textoReq(4000, 'el resumen'),
    razonamiento: textoReq(8000, 'el razonamiento'),
    tareas: z.array(tareaIASchema).min(1, 'El análisis no trae tareas.').max(200),
    materiales: z.preprocess(v => (v && typeof v === 'object' ? v : {}), z.object({
        delPliego: lista(materialSchema),
        sugeridos: lista(materialSchema),
    })),
    herramientas: lista(herramientaSchema),
    personal: lista(personalSchema),
    higieneSeguridad: lista(hysSchema),
    alertas: lista(alertaSchema),
});

export type AnalisisIA = z.infer<typeof analisisIASchema>;
export type MaterialPliego = z.infer<typeof materialSchema>;
export type HerramientaPliego = z.infer<typeof herramientaSchema>;
export type PersonalPliego = z.infer<typeof personalSchema>;
export type HysPliego = z.infer<typeof hysSchema>;
export type AlertaPliego = z.infer<typeof alertaSchema>;

/** Lo que se guarda en PliegoAnalisis.contenido (las tareas van a su tabla). */
export type ContenidoAnalisis = Omit<AnalisisIA, 'resumen' | 'razonamiento' | 'tareas'>;

// ── Marca dentro / fuera del pliego ─────────────────────────────────
export const ALCANCES = ['dentro', 'fuera'] as const;
export type Alcance = (typeof ALCANCES)[number];
export const ALCANCE_LABEL: Record<Alcance, string> = { dentro: 'Dentro del pliego', fuera: 'Fuera del pliego' };

/** "Fuera" exige qué se modificó y por qué; "Dentro" admite un motivo opcional. */
export const marcaSchema = z
    .object({
        alcance: z.enum(ALCANCES, { message: 'Indicá si la tarea está dentro o fuera del pliego.' }),
        modificacion: z.string().trim().max(2000, 'Máximo 2000 caracteres.').optional().nullable().transform(v => v || null),
        motivo: z.string().trim().max(2000, 'Máximo 2000 caracteres.').optional().nullable().transform(v => v || null),
    })
    .superRefine((d, ctx) => {
        if (d.alcance !== 'fuera') return;
        if (!d.modificacion || d.modificacion.length < 3) ctx.addIssue({ code: 'custom', path: ['modificacion'], message: 'Indicá qué se modificó respecto del pliego.' });
        if (!d.motivo || d.motivo.length < 3) ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Indicá por qué se modificó.' });
    });
export type MarcaInput = z.infer<typeof marcaSchema>;

/** Alta de un pliego (el PDF lo sube el navegador directo al almacenamiento). */
export const pliegoAltaSchema = z.object({
    titulo: z.string().trim().min(3, 'Indicá un título.').max(200),
    descripcion: z.string().trim().max(4000).optional().nullable().transform(v => v || null),
    projectId: z.string().trim().max(60).optional().nullable().transform(v => v || null),
    clientId: z.string().trim().max(60).optional().nullable().transform(v => v || null),
    archivo: z.object({
        nombre: z.string().trim().min(1).max(200),
        size: z.number().int().positive('El archivo está vacío.').max(PLIEGO_MAX_BYTES, `El PDF supera los ${PLIEGO_MAX_BYTES / (1024 * 1024)} MB.`),
    }),
});
export type PliegoAlta = z.infer<typeof pliegoAltaSchema>;

/** Clave para arrastrar marcas entre versiones: mismo título, sin importar mayúsculas, acentos ni espacios. */
export const claveTarea = (titulo: string) => sinAcentos(titulo).replace(/[^a-z0-9]+/g, ' ').trim();

// ── Etiquetas de UI ─────────────────────────────────────────────────
export const EVALUACION_LABEL: Record<Evaluacion, string> = { adecuado: 'Adecuado', revisar: 'Revisar', error: 'Con error' };
export const EVALUACION_TONE: Record<Evaluacion, BadgeTone> = { adecuado: 'success', revisar: 'warning', error: 'danger' };

export const ALERTA_TIPO_LABEL: Record<AlertaTipo, string> = { error: 'Error', omision: 'Omisión', ambiguedad: 'Ambigüedad', riesgo: 'Riesgo' };
export const SEVERIDAD_LABEL: Record<Severidad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
export const SEVERIDAD_TONE: Record<Severidad, BadgeTone> = { alta: 'danger', media: 'warning', baja: 'info' };

export const HYS_LABEL: Record<HysCategoria, string> = {
    epp: 'EPP',
    riesgo: 'Riesgos',
    procedimiento: 'Procedimientos',
    permiso: 'Permisos de trabajo',
    documentacion: 'Documentación',
    capacitacion: 'Capacitación',
    otro: 'Otros',
};

export const formatTamanio = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
