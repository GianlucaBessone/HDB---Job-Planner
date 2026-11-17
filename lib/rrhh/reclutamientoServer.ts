// Reclutamiento: helpers de servidor para las API routes. No importar desde componentes cliente.
import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAcceso } from '@/lib/permisosServer';
import { jwtKey } from '@/lib/jwtSecret';
import { ErrorAnalisisCv, evaluarCompatibilidad, type VacanteParaIA } from '@/lib/rrhh/cvIA';
import { analisisCvSchema, ETAPAS_ACTIVAS, perfilComoTexto, type AnalisisCv, type EtapaId, type MatchIA } from '@/lib/rrhh/reclutamiento';

// ── Actor y respuestas ──────────────────────────────────────────────

export interface ActorRRHH {
    id: string;
    nombre: string;
    rol: string;
    puedeVer: boolean;
    puedeGestionar: boolean;
    puedeEliminar: boolean;
}

export async function getActorRRHH(req: Request): Promise<ActorRRHH> {
    const acceso = await getAcceso(req);
    let nombre = 'Usuario';
    if (acceso.userId) {
        const op = await prisma.operator.findUnique({ where: { id: acceso.userId }, select: { nombreCompleto: true } });
        if (op) nombre = op.nombreCompleto;
    }
    const gestionar = acceso.puede('rrhh.reclutamiento_gestionar');
    return {
        id: acceso.userId,
        nombre,
        rol: acceso.role,
        puedeVer: acceso.puede('rrhh.reclutamiento_ver') || gestionar,
        puedeGestionar: gestionar,
        puedeEliminar: acceso.puede('rrhh.reclutamiento_eliminar'),
    };
}

export const permisosDe = (a: ActorRRHH) => ({ gestionar: a.puedeGestionar, eliminar: a.puedeEliminar });

export const prohibido = (msg = 'No tenés permiso para esta acción.') => NextResponse.json({ error: msg }, { status: 403 });
export const noEncontrado = (msg = 'No encontrado.') => NextResponse.json({ error: msg }, { status: 404 });
export const conflicto = (msg: string) => NextResponse.json({ error: msg }, { status: 409 });

export function errorValidacion(error: ZodError) {
    return NextResponse.json(
        {
            error: error.issues[0]?.message || 'Datos inválidos',
            detalle: error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
        { status: 400 },
    );
}

export function respuestaError(error: unknown, contexto: string, mensaje: string) {
    if (error instanceof ErrorAnalisisCv) return NextResponse.json({ error: error.message }, { status: 502 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return noEncontrado();
    }
    console.error(`[RRHH ${contexto}]`, error);
    return NextResponse.json({ error: mensaje }, { status: 500 });
}

// ── Firma del análisis ──────────────────────────────────────────────
// El análisis viaja al navegador para que el usuario revise los datos antes de
// guardar. La firma impide que vuelva con el puntaje o las señales cambiadas.

const VIGENCIA_FIRMA_MS = 2 * 60 * 60 * 1000;

function hmacAnalisis(payload: string) {
    return createHmac('sha256', Buffer.concat([Buffer.from(jwtKey('interno')), Buffer.from(':rrhh-cv')]))
        .update(payload, 'utf8')
        .digest('base64url');
}

export function firmarAnalisis(datos: AnalisisCv, vacancyId: string | null): string {
    const exp = Date.now() + VIGENCIA_FIRMA_MS;
    return `${exp}.${hmacAnalisis(`${exp}.${vacancyId || ''}.${JSON.stringify(datos)}`)}`;
}

/** Devuelve el análisis si la firma es válida y vigente; si no, null. */
export function verificarAnalisis(datos: unknown, firma: string, vacancyId: string | null): AnalisisCv | null {
    const [expStr, mac] = firma.split('.');
    const exp = Number(expStr);
    if (!mac || !Number.isFinite(exp) || exp < Date.now()) return null;
    const esperado = hmacAnalisis(`${exp}.${vacancyId || ''}.${JSON.stringify(datos)}`);
    const a = Buffer.from(mac);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = analisisCvSchema.safeParse(datos);
    return parsed.success ? (parsed.data as AnalisisCv) : null;
}

// ── Lectura del análisis guardado ───────────────────────────────────

/** Lo que guardamos en CandidateAIAnalysis.rawAiResponse. */
export interface RawAnalisis {
    origen: 'CV' | 'MATCH';
    titular?: string;
    resumen?: string;
    seniority?: string | null;
    aniosExperiencia?: number | null;
    idiomas?: AnalisisCv['idiomas'];
    certificaciones?: string[];
    veracidad?: AnalisisCv['veracidad'];
    match?: AnalisisCv['match'];
    archivo?: string | null;
}

export const raw = (v: Prisma.JsonValue | null | undefined): RawAnalisis => (v && typeof v === 'object' && !Array.isArray(v) ? (v as unknown as RawAnalisis) : { origen: 'CV' });

/** Análisis del CV más reciente (de él salen titular, resumen y veracidad). */
export function analisisCvVigente<T extends { rawAiResponse: Prisma.JsonValue | null; createdAt: Date }>(analisis: T[]) {
    return [...analisis].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).find(a => raw(a.rawAiResponse).origen === 'CV') ?? null;
}

/** Etapa actual por vacante (último movimiento de cada una). */
export function etapasActuales<T extends { vacancyId: string; stage: string; createdAt: Date }>(historial: T[]) {
    const porVacante = new Map<string, T>();
    for (const h of historial) {
        const actual = porVacante.get(h.vacancyId);
        if (!actual || h.createdAt > actual.createdAt) porVacante.set(h.vacancyId, h);
    }
    return porVacante;
}

export const esEtapaActiva = (stage: string) => ETAPAS_ACTIVAS.includes(stage as EtapaId) || stage === 'FINALISTA';

/** Mejor puntaje de compatibilidad entre los análisis con vacante. */
export function mejorMatch(analisis: { vacancyId: string | null; matchScore: number }[]) {
    const conVacante = analisis.filter(a => a.vacancyId);
    return conVacante.length ? Math.max(...conVacante.map(a => a.matchScore)) : null;
}

// ── Listado de postulantes ──────────────────────────────────────────

export const POSTULANTE_LISTA_SELECT = {
    id: true, firstName: true, lastName: true, email: true, phone: true, city: true, status: true, createdAt: true, updatedAt: true,
    tags: { select: { name: true } },
    skills: { select: { name: true, type: true }, orderBy: { id: 'asc' } },
    experience: { select: { position: true, company: true }, orderBy: { id: 'asc' }, take: 1 },
    aiAnalyses: { select: { vacancyId: true, matchScore: true, rawAiResponse: true, createdAt: true } },
    stageHistory: { select: { vacancyId: true, stage: true, createdAt: true } },
    cvs: { select: { id: true }, take: 1 },
} satisfies Prisma.CandidateSelect;

type PostulanteListaRow = Prisma.CandidateGetPayload<{ select: typeof POSTULANTE_LISTA_SELECT }>;

export function serializarPostulanteLista(c: PostulanteListaRow) {
    const cv = analisisCvVigente(c.aiAnalyses);
    const r = cv ? raw(cv.rawAiResponse) : null;
    const etapas = etapasActuales(c.stageHistory);
    const hard = c.skills.filter(s => s.type !== 'SOFT');
    return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        city: c.city,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        titular: r?.titular || (c.experience[0] ? c.experience[0].position : null),
        veracidad: r?.veracidad ? r.veracidad.puntaje : null,
        mejorMatch: mejorMatch(c.aiAnalyses),
        procesosActivos: Array.from(etapas.values()).filter(e => esEtapaActiva(e.stage)).length,
        habilidades: (hard.length ? hard : c.skills).map(s => s.name),
        tags: c.tags.map(t => t.name),
        tieneCv: c.cvs.length > 0,
    };
}
export type PostulanteFila = ReturnType<typeof serializarPostulanteLista>;

// ── Vacantes con su embudo ──────────────────────────────────────────

/** Cantidad de postulantes por etapa actual, para cada vacante pedida. */
export async function embudoPorVacante(vacancyIds: string[]) {
    const historial = vacancyIds.length
        ? await prisma.candidateStageHistory.findMany({
            where: { vacancyId: { in: vacancyIds } },
            select: { candidateId: true, vacancyId: true, stage: true, createdAt: true },
        })
        : [];
    const ultimo = new Map<string, { vacancyId: string; stage: string; createdAt: Date }>();
    for (const h of historial) {
        const k = `${h.vacancyId}:${h.candidateId}`;
        const prev = ultimo.get(k);
        if (!prev || h.createdAt > prev.createdAt) ultimo.set(k, h);
    }
    const porVacante = new Map<string, Record<string, number>>();
    for (const h of Array.from(ultimo.values())) {
        const stage = h.stage === 'FINALISTA' ? 'FINALISTAS' : h.stage;
        const conteo = porVacante.get(h.vacancyId) ?? {};
        conteo[stage] = (conteo[stage] || 0) + 1;
        porVacante.set(h.vacancyId, conteo);
    }
    return porVacante;
}

export function totalesEmbudo(conteo: Record<string, number> = {}) {
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);
    const activos = Object.entries(conteo).filter(([s]) => esEtapaActiva(s)).reduce((a, [, n]) => a + n, 0);
    return { total, activos, finalistas: conteo.FINALISTAS || 0, contratados: conteo.CONTRATADO || 0 };
}

// ── Etapas y estado del postulante ──────────────────────────────────

/**
 * El estado general se deriva de sus procesos: contratado en alguna vacante →
 * CONTRATADO; con algún proceso abierto → ACTIVO; sin procesos abiertos → queda
 * en la base de talentos. "No apto" (RECHAZADO) solo se asigna a mano y se
 * mantiene hasta que se lo vuelva a sumar a una búsqueda.
 */
export async function recalcularEstado(candidateId: string, tx: Prisma.TransactionClient = prisma, reactivar = false) {
    const c = await tx.candidate.findUnique({
        where: { id: candidateId },
        select: { status: true, stageHistory: { select: { vacancyId: true, stage: true, createdAt: true } } },
    });
    if (!c) return null;
    const etapas = Array.from(etapasActuales(c.stageHistory).values()).map(e => e.stage);
    let status: string;
    if (etapas.includes('CONTRATADO')) status = 'CONTRATADO';
    else if (etapas.some(esEtapaActiva) && (c.status !== 'RECHAZADO' || reactivar)) status = 'ACTIVO';
    else if (c.status === 'RECHAZADO' && !reactivar) status = 'RECHAZADO';
    else status = 'BASE_TALENTOS';
    if (status !== c.status) await tx.candidate.update({ where: { id: candidateId }, data: { status } });
    return status;
}

export async function moverEtapa(candidateId: string, vacancyId: string, stage: EtapaId, notes: string | null, actor: ActorRRHH) {
    return prisma.$transaction(async tx => {
        const actual = await tx.candidateStageHistory.findFirst({
            where: { candidateId, vacancyId },
            orderBy: { createdAt: 'desc' },
            select: { stage: true },
        });
        if (!actual) return { error: 'El postulante no está en esta vacante.' as const };
        if (actual.stage === stage && !notes) return { sinCambios: true as const };
        const registro = await tx.candidateStageHistory.create({
            data: { candidateId, vacancyId, stage, notes: notes || null, movedById: actor.id || null },
        });
        const status = await recalcularEstado(candidateId, tx, esEtapaActiva(stage));
        return { registro, status, anterior: actual.stage };
    });
}

// ── Nombres de quien movió cada etapa ───────────────────────────────

export async function nombresOperadores(ids: (string | null)[]) {
    const unicos = Array.from(new Set(ids.filter((x): x is string => !!x)));
    if (!unicos.length) return new Map<string, string>();
    const ops = await prisma.operator.findMany({ where: { id: { in: unicos } }, select: { id: true, nombreCompleto: true } });
    return new Map(ops.map(o => [o.id, o.nombreCompleto]));
}

// ── Compatibilidad con IA ───────────────────────────────────────────

export class PerfilIncompleto extends Error {}

/**
 * Evalúa con IA la compatibilidad del perfil actual de un postulante con una
 * vacante y la guarda (CandidateAIAnalysis con vacancyId). No lo suma a la vacante.
 */
export async function evaluarYGuardarCompatibilidad(
    candidateId: string,
    vacante: VacanteParaIA & { id: string },
    actor: ActorRRHH,
): Promise<MatchIA> {
    const c = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: {
            city: true,
            skills: { select: { name: true, level: true }, orderBy: { id: 'asc' } },
            experience: { orderBy: { id: 'asc' } },
            education: { orderBy: { id: 'asc' } },
            aiAnalyses: { select: { vacancyId: true, matchScore: true, rawAiResponse: true, createdAt: true } },
        },
    });
    if (!c) throw new Prisma.PrismaClientKnownRequestError('El postulante no existe.', { code: 'P2025', clientVersion: Prisma.prismaVersion.client });

    const cv = analisisCvVigente(c.aiAnalyses);
    const r = cv ? raw(cv.rawAiResponse) : null;
    if (!c.skills.length && !c.experience.length && !c.education.length && !r?.resumen) {
        throw new PerfilIncompleto('El perfil no tiene experiencia, formación ni habilidades cargadas para comparar.');
    }
    const perfil = perfilComoTexto({
        titular: r?.titular, resumen: r?.resumen, city: c.city, skills: c.skills, experience: c.experience, education: c.education,
        idiomas: r?.idiomas, certificaciones: r?.certificaciones, aniosExperiencia: r?.aniosExperiencia,
    });

    const m = await evaluarCompatibilidad(perfil, vacante, { userId: actor.id, userName: actor.nombre, userRole: actor.rol, entityId: candidateId });

    const crudo: RawAnalisis = {
        origen: 'MATCH',
        match: { puntaje: m.puntaje, explicacion: m.explicacion, cumple: m.cumple, noCumple: m.noCumple, recomendacion: m.recomendacion },
    };
    await prisma.$transaction([
        prisma.candidateAIAnalysis.create({
            data: {
                candidateId, vacancyId: vacante.id, matchScore: m.puntaje, explanation: m.explicacion,
                strengths: m.fortalezas, weaknesses: m.debilidades, risks: m.riesgos, rawAiResponse: crudo as object,
            },
        }),
        prisma.candidate.update({
            where: { id: candidateId },
            data: { aiScore: Math.max(m.puntaje, mejorMatch(c.aiAnalyses.filter(a => a.vacancyId !== vacante.id)) ?? 0) },
        }),
    ]);
    return m;
}

// ── Afinidad por palabras clave (sin IA) ────────────────────────────
// Orden previo de la base de talentos para decidir a quién evaluar con IA.
// Es una coincidencia de términos, no un juicio: no reemplaza al match.

const STOPWORDS = new Set((
    'para con sin por los las del una uno unos unas que como mas más sus entre sobre desde hasta este esta estos estas ' +
    'experiencia excluyente excluyentes deseable deseables requisito requisitos conocimiento conocimientos manejo ' +
    'buscamos busca puesto empresa trabajo tareas años año minimo mínimo nivel tener contar ser estar zona disponibilidad'
).split(' '));

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const raiz = (w: string) => (w.length > 6 ? w.slice(0, 6) : w);

export function terminos(texto: string): string[] {
    return normalizar(texto).split(/[^a-z0-9ñ+#]+/).filter(w => w.length >= 3 && !STOPWORDS.has(w)).map(raiz);
}

/** Términos ponderados de la vacante: palabras clave 3, puesto 2, requisitos y descripción 1. */
export function terminosVacante(v: { title: string; requirements?: string | null; description?: string | null; keywords?: unknown }) {
    const pesos = new Map<string, number>();
    const sumar = (texto: string, peso: number) => {
        for (const t of terminos(texto)) pesos.set(t, Math.max(pesos.get(t) ?? 0, peso));
    };
    sumar(v.description || '', 1);
    sumar(v.requirements || '', 1);
    sumar(v.title, 2);
    if (Array.isArray(v.keywords)) v.keywords.forEach(k => sumar(String(k), 3));
    return pesos;
}

/** 0–100: peso de los términos de la vacante presentes en el perfil, más las palabras clave encontradas. */
export function afinidad(pesos: Map<string, number>, textoPerfil: string) {
    const total = Array.from(pesos.values()).reduce((a, b) => a + b, 0);
    if (!total) return { puntaje: 0, coincidencias: [] as string[] };
    const perfil = new Set(terminos(textoPerfil));
    let suma = 0;
    const coincidencias: string[] = [];
    pesos.forEach((peso, t) => {
        if (perfil.has(t)) {
            suma += peso;
            if (peso >= 2) coincidencias.push(t);
        }
    });
    return { puntaje: Math.round((suma / total) * 100), coincidencias };
}
