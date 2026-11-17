// Reclutamiento (ATS): catálogos, validaciones y contrato del análisis de CV con IA.
// Se importa desde cliente y servidor (sin Prisma ni APIs de Node).
import { z } from 'zod';
import type { BadgeTone } from '@/components/ui/Badge';

// ── Catálogos ───────────────────────────────────────────────────────

/** Etapas del pipeline, en orden. Los ids son los que ya están guardados en la base. */
export const ETAPAS = [
    { id: 'POSTULADO', label: 'Postulados', singular: 'Postulado', tone: 'neutral' },
    { id: 'PRESELECCION', label: 'Preselección', singular: 'Preseleccionado', tone: 'info' },
    { id: 'CONTACTADO', label: 'Contactados', singular: 'Contactado', tone: 'info' },
    { id: 'ENTREVISTA_RRHH', label: 'Entrevista RRHH', singular: 'Entrevista RRHH', tone: 'info' },
    { id: 'ENTREVISTA_TEC', label: 'Entrevista técnica', singular: 'Entrevista técnica', tone: 'info' },
    { id: 'FINALISTAS', label: 'Finalistas', singular: 'Finalista', tone: 'brand' },
    { id: 'CONTRATADO', label: 'Contratados', singular: 'Contratado', tone: 'success' },
    { id: 'RECHAZADO', label: 'Descartados', singular: 'Descartado', tone: 'danger' },
] as const satisfies readonly { id: string; label: string; singular: string; tone: BadgeTone }[];

export type EtapaId = (typeof ETAPAS)[number]['id'];
export const ETAPA_IDS = ETAPAS.map(e => e.id) as [EtapaId, ...EtapaId[]];
/** Etapas en las que el proceso sigue abierto. */
export const ETAPAS_ACTIVAS: EtapaId[] = ['POSTULADO', 'PRESELECCION', 'CONTACTADO', 'ENTREVISTA_RRHH', 'ENTREVISTA_TEC', 'FINALISTAS'];

export function etapaInfo(id: string) {
    // Datos viejos: el esquema documentaba FINALISTA en singular.
    const norm = id === 'FINALISTA' ? 'FINALISTAS' : id;
    return ETAPAS.find(e => e.id === norm) ?? { id, label: id, singular: id, tone: 'neutral' as BadgeTone };
}

export const ESTADOS_CANDIDATO = {
    ACTIVO: { label: 'Activo', tone: 'info' },
    BASE_TALENTOS: { label: 'Base de talentos', tone: 'neutral' },
    CONTRATADO: { label: 'Contratado', tone: 'success' },
    RECHAZADO: { label: 'No apto', tone: 'danger' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;
export type EstadoCandidato = keyof typeof ESTADOS_CANDIDATO;
export const ESTADO_CANDIDATO_IDS = Object.keys(ESTADOS_CANDIDATO) as [EstadoCandidato, ...EstadoCandidato[]];

export const ESTADOS_VACANTE = {
    ABIERTA: { label: 'Abierta', tone: 'success' },
    PAUSADA: { label: 'Pausada', tone: 'warning' },
    CERRADA: { label: 'Cerrada', tone: 'neutral' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;
export type EstadoVacante = keyof typeof ESTADOS_VACANTE;
export const ESTADO_VACANTE_IDS = Object.keys(ESTADOS_VACANTE) as [EstadoVacante, ...EstadoVacante[]];

export const PRIORIDADES = {
    BAJA: { label: 'Baja', tone: 'neutral' },
    MEDIA: { label: 'Media', tone: 'info' },
    ALTA: { label: 'Alta', tone: 'warning' },
    URGENTE: { label: 'Urgente', tone: 'danger' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;
export type Prioridad = keyof typeof PRIORIDADES;
export const PRIORIDAD_IDS = Object.keys(PRIORIDADES) as [Prioridad, ...Prioridad[]];

export const NIVELES_HABILIDAD = ['Básico', 'Intermedio', 'Avanzado'] as const;
export const TIPOS_HABILIDAD = { HARD: 'Técnica', SOFT: 'Blanda' } as const;

/** Tamaño máximo del PDF del CV (el cuerpo de una función serverless admite ~4,5 MB). */
export const CV_MAX_BYTES = 4 * 1024 * 1024;

// ── Utilidades de presentación ──────────────────────────────────────

export const nombreCompleto = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();

export function iniciales(c: { firstName: string; lastName: string }) {
    return `${c.firstName?.[0] || ''}${c.lastName?.[0] || ''}`.toUpperCase() || '?';
}

/** Link de WhatsApp. Si el número no trae código de país se asume Argentina (+54 9). */
export function linkWhatsapp(telefono: string | null | undefined, mensaje?: string) {
    let d = (telefono || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('00')) d = d.slice(2);
    if (!d.startsWith('54')) d = `549${d.replace(/^0/, '')}`;
    return `https://wa.me/${d}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}

export function linkLinkedin(url: string | null | undefined) {
    const u = (url || '').trim();
    if (!u) return null;
    return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/** Tono de un puntaje 0–100 (match o veracidad). */
export function tonoPuntaje(p: number | null | undefined): BadgeTone {
    if (p == null) return 'neutral';
    if (p >= 75) return 'success';
    if (p >= 50) return 'warning';
    return 'danger';
}

export function nivelVeracidad(p: number) {
    if (p >= 75) return 'Consistente';
    if (p >= 50) return 'Revisar';
    return 'Dudoso';
}

export function formatTamanio(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function diasDesde(fecha: string | Date) {
    return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000));
}

// ── Validaciones de entrada (API) ───────────────────────────────────

/**
 * Zod 4 infiere como opcionales las claves con `preprocess`, aunque el esquema
 * siempre las completa. Este tipo refleja lo que de verdad devuelve el parse.
 */
export type Completo<T> = T extends (infer U)[] ? Completo<U>[] : T extends Date ? T : T extends object ? { [K in keyof T]-?: Completo<T[K]> } : T;

const texto = (max: number) =>
    z.preprocess(v => (v == null ? null : String(v).trim().slice(0, max) || null), z.string().nullable()).optional().transform(v => v ?? null);

const lista = <T extends z.ZodTypeAny>(item: T, max: number) =>
    z.preprocess(v => (Array.isArray(v) ? v.slice(0, max) : []), z.array(item));

/** Campos de una vacante sin valores por defecto (base de la edición parcial). */
const vacanteCampos = z.object({
    title: z.string().trim().min(3, 'Indicá el puesto.').max(160),
    branch: texto(120),
    status: z.enum(ESTADO_VACANTE_IDS),
    priority: z.enum(PRIORIDAD_IDS),
    positionsCount: z.coerce.number().int('Indicá un número entero.').min(1, 'Al menos 1 puesto.').max(500),
    description: z.string().trim().max(10_000),
    requirements: z.string().trim().max(10_000),
    keywords: lista(z.string().trim().min(1).max(60), 30),
    endDate: z.preprocess(v => (v ? v : null), z.coerce.date().nullable()).optional(),
});

/** Alta de vacante. */
export const vacanteSchema = vacanteCampos.extend({
    status: vacanteCampos.shape.status.default('ABIERTA'),
    priority: vacanteCampos.shape.priority.default('MEDIA'),
    description: vacanteCampos.shape.description.default(''),
    requirements: vacanteCampos.shape.requirements.default(''),
});

/**
 * Edición parcial. Ojo: en Zod 4 `.partial()` conserva los `.default()`, así que
 * se parte de los campos sin defaults para no pisar lo que no se envía.
 */
export const vacanteEdicionSchema = vacanteCampos.partial();
export type VacanteInput = z.infer<typeof vacanteSchema>;

export const habilidadSchema = z.object({
    name: z.string().trim().min(1).max(80),
    level: z.preprocess(v => (NIVELES_HABILIDAD.includes(v as never) ? v : null), z.enum(NIVELES_HABILIDAD).nullable()),
    type: z.preprocess(v => (v === 'HARD' || v === 'SOFT' ? v : null), z.enum(['HARD', 'SOFT']).nullable()),
});
export type HabilidadInput = Completo<z.infer<typeof habilidadSchema>>;

export const experienciaSchema = z.object({
    company: z.string().trim().min(1, 'Indicá la empresa.').max(160),
    position: z.string().trim().min(1, 'Indicá el puesto.').max(160),
    startDate: texto(40),
    endDate: texto(40),
    description: texto(4000),
});
export type ExperienciaInput = Completo<z.infer<typeof experienciaSchema>>;

export const educacionSchema = z.object({
    institution: z.string().trim().min(1, 'Indicá la institución.').max(160),
    degree: z.string().trim().min(1, 'Indicá el título.').max(160),
    startDate: texto(40),
    endDate: texto(40),
});
export type EducacionInput = Completo<z.infer<typeof educacionSchema>>;

const email = z.preprocess(
    v => (v == null ? null : String(v).trim().toLowerCase() || null),
    z.string().email('El email no es válido.').max(160).nullable(),
).optional().transform(v => v ?? null);

/** Datos editables de un postulante (alta y edición). */
export const postulanteSchema = z.object({
    firstName: z.string().trim().min(1, 'Indicá el nombre.').max(80),
    lastName: z.string().trim().min(1, 'Indicá el apellido.').max(80),
    email,
    phone: texto(40),
    city: texto(120),
    linkedin: texto(300),
    observations: texto(10_000),
    // Sin .default(): `lista` ya convierte undefined en [] en el alta, y así la
    // edición parcial (.partial()) no vacía las listas que no se envían.
    skills: lista(habilidadSchema, 60),
    experience: lista(experienciaSchema, 30),
    education: lista(educacionSchema, 20),
    tags: lista(z.string().trim().min(1).max(40), 15),
});
export type PostulanteInput = Completo<z.infer<typeof postulanteSchema>>;

export const altaPostulanteSchema = postulanteSchema.extend({
    vacancyId: texto(60),
    stage: z.enum(ETAPA_IDS).default('POSTULADO'),
    /** Análisis de la IA firmado por el servidor (ver /api/rrhh/reclutamiento/cv/analizar). */
    analisis: z.object({ datos: z.unknown(), firma: z.string().min(10).max(200), vacancyId: texto(60) }).nullable().optional(),
});
export type AltaPostulanteInput = z.infer<typeof altaPostulanteSchema>;

export const edicionPostulanteSchema = postulanteSchema.partial().extend({
    status: z.enum(ESTADO_CANDIDATO_IDS).optional(),
});

export const moverEtapaSchema = z.object({
    stage: z.enum(ETAPA_IDS),
    notes: texto(2000),
});

export const vincularSchema = z.object({
    candidateId: z.string().trim().min(1).max(60),
    stage: z.enum(ETAPA_IDS).default('POSTULADO'),
    notes: texto(2000),
});

// ── Contrato del análisis de CV con IA ──────────────────────────────
// La IA puede devolver campos de más, nulos o con mayúsculas distintas: se
// normaliza todo acá para que la base y la UI reciban siempre la misma forma.

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const str = (max: number) => z.preprocess(v => (v == null ? '' : String(v)), z.string()).transform(s => s.trim().slice(0, max));
const strNull = (max: number) =>
    z.preprocess(v => (v == null ? null : String(v).trim().slice(0, max) || null), z.string().nullable()).optional().transform(v => v ?? null);
const arr = <T extends z.ZodTypeAny>(item: T, max = 50) => z.preprocess(v => (Array.isArray(v) ? v.slice(0, max) : []), z.array(item));
const puntaje = z.preprocess(v => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n <= 1 && n > 0 ? n * 100 : n))) : 0;
}, z.number());
const puntajeNull = z.preprocess(v => (v == null || v === '' ? null : v), puntaje.nullable());
const textos = (max = 15) => arr(z.preprocess(v => (v == null ? '' : String(v).trim().slice(0, 300)), z.string()), max).transform(a => a.filter(Boolean));

const nivelHab = z.preprocess(v => {
    const s = sinAcentos(String(v ?? ''));
    if (s.startsWith('avan') || s.startsWith('expe')) return 'Avanzado';
    if (s.startsWith('inter') || s.startsWith('medi')) return 'Intermedio';
    if (s.startsWith('basi') || s.startsWith('inic')) return 'Básico';
    return null;
}, z.enum(NIVELES_HABILIDAD).nullable());

const tipoHab = z.preprocess(v => {
    const s = sinAcentos(String(v ?? ''));
    if (s.startsWith('soft') || s.startsWith('bland')) return 'SOFT';
    if (s.startsWith('hard') || s.startsWith('tecn') || s.startsWith('dura')) return 'HARD';
    return null;
}, z.enum(['HARD', 'SOFT']).nullable());

const senalSchema = z.object({
    tipo: z.preprocess(v => (sinAcentos(String(v ?? '')).startsWith('pos') ? 'positiva' : 'alerta'), z.enum(['positiva', 'alerta'])),
    descripcion: str(400),
});

export const analisisCvSchema = z.object({
    esCv: z.preprocess(v => v !== false && v !== 'false', z.boolean()),
    legible: z.preprocess(v => v !== false && v !== 'false', z.boolean()),
    datosPersonales: z.preprocess(v => (v && typeof v === 'object' ? v : {}), z.object({
        nombre: str(80),
        apellido: str(80),
        email: strNull(160),
        telefono: strNull(40),
        ciudad: strNull(120),
        linkedin: strNull(300),
    })),
    titular: str(160),
    resumen: str(1200),
    seniority: z.preprocess(v => {
        const s = sinAcentos(String(v ?? ''));
        if (s.includes('semi')) return 'semi_senior';
        if (s.includes('trainee') || s.includes('pasant') || s.includes('sin exp')) return 'trainee';
        if (s.includes('junior') || s.includes('jr')) return 'junior';
        if (s.includes('senior') || s.includes('sr')) return 'senior';
        if (s.includes('exper') || s.includes('lider') || s.includes('jef')) return 'experto';
        return null;
    }, z.enum(['trainee', 'junior', 'semi_senior', 'senior', 'experto']).nullable()),
    aniosExperiencia: z.preprocess(v => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
    }, z.number().nullable()),
    habilidades: arr(z.object({ nombre: str(80), tipo: tipoHab, nivel: nivelHab }), 40)
        .transform(a => a.filter(h => h.nombre)),
    idiomas: arr(z.object({ idioma: str(40), nivel: strNull(40) }), 10).transform(a => a.filter(i => i.idioma)),
    certificaciones: textos(20),
    experiencia: arr(z.object({
        empresa: str(160), puesto: str(160), desde: strNull(40), hasta: strNull(40), descripcion: strNull(2000),
    }), 25).transform(a => a.filter(e => e.empresa || e.puesto)),
    educacion: arr(z.object({
        institucion: str(160), titulo: str(160), desde: strNull(40), hasta: strNull(40),
    }), 15).transform(a => a.filter(e => e.institucion || e.titulo)),
    veracidad: z.preprocess(v => (v && typeof v === 'object' ? v : {}), z.object({
        puntaje,
        resumen: str(800),
        senales: arr(senalSchema, 15).transform(a => a.filter(s => s.descripcion)),
    })),
    evaluacion: z.preprocess(v => (v && typeof v === 'object' ? v : {}), z.object({
        fortalezas: textos(),
        debilidades: textos(),
        riesgos: textos(),
    })),
    match: z.preprocess(v => (v && typeof v === 'object' ? v : null), z.object({
        puntaje,
        explicacion: str(3000),
        cumple: textos(),
        noCumple: textos(),
        recomendacion: z.preprocess(v => {
            const s = sinAcentos(String(v ?? ''));
            if (s.startsWith('avan') || s.startsWith('recom') || s === 'si') return 'avanzar';
            if (s.startsWith('desc') || s === 'no') return 'descartar';
            return 'evaluar';
        }, z.enum(['avanzar', 'evaluar', 'descartar'])),
    }).nullable()),
    etiquetas: textos(8).transform(a => a.map(t => t.slice(0, 40))),
});
export type AnalisisCv = Completo<z.infer<typeof analisisCvSchema>>;

export const matchSchema = z.object({
    puntaje,
    explicacion: str(3000),
    cumple: textos(),
    noCumple: textos(),
    fortalezas: textos(),
    debilidades: textos(),
    riesgos: textos(),
    recomendacion: z.preprocess(v => {
        const s = sinAcentos(String(v ?? ''));
        if (s.startsWith('avan') || s.startsWith('recom') || s === 'si') return 'avanzar';
        if (s.startsWith('desc') || s === 'no') return 'descartar';
        return 'evaluar';
    }, z.enum(['avanzar', 'evaluar', 'descartar'])),
});
export type MatchIA = Completo<z.infer<typeof matchSchema>>;

export const RECOMENDACION = {
    avanzar: { label: 'Avanzar', tone: 'success' },
    evaluar: { label: 'Evaluar', tone: 'warning' },
    descartar: { label: 'No avanzar', tone: 'danger' },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export const SENIORITY_LABEL: Record<string, string> = {
    trainee: 'Trainee / sin experiencia',
    junior: 'Junior',
    semi_senior: 'Semi senior',
    senior: 'Senior',
    experto: 'Experto / líder',
};

/** Datos de la IA → formulario de alta (el usuario los revisa antes de guardar). */
export function analisisAFormulario(a: AnalisisCv): PostulanteInput {
    return {
        firstName: a.datosPersonales.nombre,
        lastName: a.datosPersonales.apellido,
        email: a.datosPersonales.email,
        phone: a.datosPersonales.telefono,
        city: a.datosPersonales.ciudad,
        linkedin: a.datosPersonales.linkedin,
        observations: null,
        skills: a.habilidades.map(h => ({ name: h.nombre, level: h.nivel, type: h.tipo })),
        experience: a.experiencia.map(e => ({
            company: e.empresa || '—', position: e.puesto || '—', startDate: e.desde, endDate: e.hasta, description: e.descripcion,
        })),
        education: a.educacion.map(e => ({ institution: e.institucion || '—', degree: e.titulo || '—', startDate: e.desde, endDate: e.hasta })),
        tags: a.etiquetas,
    };
}

/**
 * Texto del perfil para evaluar compatibilidad con una vacante sin volver a
 * leer el PDF (se guarda en CandidateCV.parsedText).
 */
export function perfilComoTexto(p: {
    titular?: string | null;
    resumen?: string | null;
    city?: string | null;
    skills: { name: string; level?: string | null }[];
    experience: { company: string; position: string; startDate?: string | null; endDate?: string | null; description?: string | null }[];
    education: { institution: string; degree: string; endDate?: string | null }[];
    idiomas?: AnalisisCv['idiomas'];
    certificaciones?: string[];
    aniosExperiencia?: number | null;
}) {
    const l: string[] = [];
    if (p.titular) l.push(`Perfil: ${p.titular}`);
    if (p.aniosExperiencia != null) l.push(`Años de experiencia: ${p.aniosExperiencia}`);
    if (p.city) l.push(`Ubicación: ${p.city}`);
    if (p.resumen) l.push(`Resumen: ${p.resumen}`);
    if (p.experience.length) {
        l.push('Experiencia:');
        p.experience.forEach(e => l.push(`- ${e.position} en ${e.company} (${e.startDate || '?'} – ${e.endDate || 'actual'})${e.description ? `: ${e.description}` : ''}`));
    }
    if (p.education.length) {
        l.push('Educación:');
        p.education.forEach(e => l.push(`- ${e.degree}, ${e.institution}${e.endDate ? ` (${e.endDate})` : ''}`));
    }
    if (p.skills.length) l.push(`Habilidades: ${p.skills.map(s => (s.level ? `${s.name} (${s.level})` : s.name)).join(', ')}`);
    if (p.idiomas?.length) l.push(`Idiomas: ${p.idiomas.map(i => (i.nivel ? `${i.idioma} (${i.nivel})` : i.idioma)).join(', ')}`);
    if (p.certificaciones?.length) l.push(`Certificaciones y habilitaciones: ${p.certificaciones.join(', ')}`);
    return l.join('\n').slice(0, 20_000);
}
