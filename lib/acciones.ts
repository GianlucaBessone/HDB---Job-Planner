import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Acción con origen (auditoría, P31 etapa 2 / FU9). `Tarea` es la única entidad de "algo que alguien tiene que
 * hacer para una fecha". Las acciones de mejora (CAPA) son tareas con `tipoAccion`; los planes de acción de KPI,
 * tareas con `kpiId`. Este módulo traduce entre `Tarea` y los formatos que ya usaban las pantallas de Calidad y de
 * OKR y KPI, para que sigan funcionando igual. El responsable es el involucrado con rol "responsable".
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** Una tarea es acción de mejora si tiene tipo de acción; plan de KPI si tiene KPI. */
export const WHERE_ACCION_MEJORA: Prisma.TareaWhereInput = { tipoAccion: { not: null } };
export const WHERE_PLAN_KPI: Prisma.TareaWhereInput = { kpiId: { not: null } };

/** Responsable (involucrado con rol "responsable"), para incluir en las consultas. */
export const INCLUIR_RESPONSABLE = {
    involucrados: {
        where: { rol: 'responsable' },
        take: 1,
        include: { operator: { select: { id: true, nombreCompleto: true } } },
    },
} satisfies Prisma.TareaInclude;

// ── Estados y prioridades ────────────────────────────────────────────────────────────────────────────────
const CAPA_A_TAREA: Record<string, string> = {
    Pendiente: 'pendiente',
    'En Progreso': 'en_progreso',
    Completada: 'completada',
    Cerrada: 'cerrada',
    Cancelada: 'cancelada',
    Anulada: 'anulada',
};
const TAREA_A_CAPA: Record<string, string> = Object.fromEntries(Object.entries(CAPA_A_TAREA).map(([k, v]) => [v, k]));
const KPI_A_TAREA: Record<string, string> = { Pendiente: 'pendiente', 'En Curso': 'en_progreso', Cerrado: 'cerrada' };
const TAREA_A_KPI: Record<string, string> = { pendiente: 'Pendiente', en_progreso: 'En Curso', completada: 'Cerrado', cerrada: 'Cerrado', cancelada: 'Cerrado', anulada: 'Cerrado' };

export const estadoTareaDesdeCapa = (e: string) => CAPA_A_TAREA[e] ?? 'pendiente';
export const estadoCapaDesdeTarea = (e: string) => TAREA_A_CAPA[e] ?? 'Pendiente';
export const estadoTareaDesdeKpi = (e: string) => KPI_A_TAREA[e] ?? 'pendiente';
export const estadoKpiDesdeTarea = (e: string) => TAREA_A_KPI[e] ?? 'Pendiente';
/** Estados CAPA abiertos, expresados como estados de Tarea. */
export const ESTADOS_ABIERTOS = ['pendiente', 'en_progreso'];

const prioridadCapa = (p: string | null | undefined) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Media');
const prioridadTarea = (p: string | null | undefined) => (p ? p.toLowerCase() : 'media');

/** Título de la tarea a partir de la descripción de una acción (las acciones no tienen título propio). */
const titulo = (descripcion: string) => {
    const linea = descripcion.trim().split('\n')[0];
    return linea.length > 140 ? `${linea.slice(0, 139)}…` : linea || 'Acción';
};

const fecha = (v: unknown): Date | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const d = new Date(v as string);
    return isNaN(d.getTime()) ? undefined : d;
};

type TareaConResponsable = Prisma.TareaGetPayload<{ include: typeof INCLUIR_RESPONSABLE }> & Record<string, any>;

function responsableDe(t: TareaConResponsable) {
    const inv = t.involucrados?.[0];
    return inv ? { id: inv.operator.id, nombreCompleto: inv.operator.nombreCompleto } : null;
}

/** Tarea → formato de acción de mejora (como lo devolvía `AccionMejora`). Conserva relaciones incluidas. */
export function comoAccionMejora(t: TareaConResponsable) {
    const { involucrados, codigo, origenDetalle, fechaVencimiento, fechaCompletada, notas, prioridad, estado, ...resto } = t;
    const responsable = responsableDe(t);
    return {
        ...resto,
        codigoAccion: codigo,
        origen: origenDetalle ?? 'Otro',
        descripcion: t.descripcion ?? t.titulo,
        responsableId: responsable?.id ?? null,
        responsable,
        prioridad: prioridadCapa(prioridad),
        fechaCreacion: t.createdAt,
        fechaCompromiso: fechaVencimiento,
        fechaCierre: fechaCompletada,
        estado: estadoCapaDesdeTarea(estado),
        observaciones: notas,
    };
}

/** Tarea → formato de plan de acción de KPI (como lo devolvía `PlanAccionKpi`). */
export function comoPlanKpi(t: TareaConResponsable) {
    const responsable = responsableDe(t);
    return {
        id: t.id,
        kpiId: t.kpiId,
        ...(t.kpi ? { kpi: t.kpi } : {}),
        descripcion: t.descripcion ?? t.titulo,
        causa: t.causa,
        accionCorrectiva: t.accionCorrectiva,
        responsableId: responsable?.id ?? null,
        responsable,
        fechaCompromiso: t.fechaVencimiento,
        fechaCierre: t.fechaCompletada,
        estado: estadoKpiDesdeTarea(t.estado),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
    };
}

/** Campos de una acción de mejora (body de la API de CAPA) → datos de Tarea. Solo los que vienen. */
export function datosTareaDesdeAccion(b: Record<string, any>): Prisma.TareaUncheckedUpdateInput {
    const d: Prisma.TareaUncheckedUpdateInput = {};
    if (b.descripcion !== undefined) {
        d.descripcion = b.descripcion;
        d.titulo = titulo(String(b.descripcion || ''));
    }
    if (b.codigoAccion !== undefined) d.codigo = b.codigoAccion;
    if (b.tipoAccion !== undefined) d.tipoAccion = b.tipoAccion;
    if (b.origen !== undefined) d.origenDetalle = b.origen;
    if (b.justificacion !== undefined) d.justificacion = b.justificacion;
    if (b.beneficioEsperado !== undefined) d.beneficioEsperado = b.beneficioEsperado;
    if (b.prioridad !== undefined) d.prioridad = prioridadTarea(b.prioridad);
    if (fecha(b.fechaInicio) !== undefined) d.fechaInicio = fecha(b.fechaInicio);
    if (fecha(b.fechaCompromiso) !== undefined) d.fechaVencimiento = fecha(b.fechaCompromiso);
    if (fecha(b.fechaCierre) !== undefined) d.fechaCompletada = fecha(b.fechaCierre);
    if (b.porcentajeAvance !== undefined) d.porcentajeAvance = Number(b.porcentajeAvance) || 0;
    if (b.estado !== undefined) d.estado = estadoTareaDesdeCapa(b.estado);
    if (b.eficacia !== undefined) d.eficacia = b.eficacia;
    if (b.evidencia !== undefined) d.evidencia = b.evidencia;
    if (b.observaciones !== undefined) d.notas = b.observaciones;
    for (const k of ['ncId', 'sugerenciaId', 'riesgoId', 'oportunidadId'] as const) {
        if (b[k] !== undefined) (d as any)[k] = b[k] || null;
    }
    return d;
}

/** Origen de una acción de mejora según su vínculo. */
export function origenDeAccion(b: { ncId?: string | null; sugerenciaId?: string | null; riesgoId?: string | null; oportunidadId?: string | null }) {
    if (b.ncId) return 'nc';
    if (b.sugerenciaId) return 'sugerencia';
    if (b.riesgoId) return 'riesgo';
    if (b.oportunidadId) return 'oportunidad';
    return 'calidad';
}

/** Deja a `operatorId` como único responsable de la tarea (o ninguno con null). */
export async function asignarResponsable(db: Db, tareaId: string, operatorId: string | null | undefined) {
    if (operatorId === undefined) return;
    await db.tareaInvolucrado.deleteMany({ where: { tareaId, rol: 'responsable' } });
    if (!operatorId) return;
    await db.tareaInvolucrado.upsert({
        where: { tareaId_operatorId: { tareaId, operatorId } },
        create: { tareaId, operatorId, rol: 'responsable' },
        update: { rol: 'responsable' },
    });
}

/** Próximo código de acción de mejora: CAPA-AAAA-0001. */
export async function proximoCodigoCapa(db: Db) {
    const year = new Date().getFullYear();
    const prefijo = `CAPA-${year}-`;
    const ultima = await db.tarea.findFirst({
        where: { codigo: { startsWith: prefijo } },
        orderBy: { codigo: 'desc' },
        select: { codigo: true },
    });
    const n = parseInt(ultima?.codigo?.split('-').pop() || '0', 10) || 0;
    return `${prefijo}${String(n + 1).padStart(4, '0')}`;
}
