/**
 * Estados "en riesgo" y "atrasado" calculados (auditoría, P27 / E8). Antes "atrasado" lo escribía un proceso en
 * la base y nunca se volvía atrás (aunque se corriera la fecha de fin), y "en riesgo" se marcaba a mano.
 * Ahora en la base queda solo el estado que elige una persona (por hacer, planificado, activo, finalizado) y
 * la alerta se calcula cada vez que se lee el proyecto.
 */

export const ESTADOS_MANUALES = ['por_hacer', 'planificado', 'activo', 'finalizado'] as const;
export type EstadoManual = (typeof ESTADOS_MANUALES)[number];
export type EstadoEfectivo = EstadoManual | 'en_riesgo' | 'atrasado';

/** Porcentaje de horas consumidas sobre las estimadas a partir del cual el proyecto está en riesgo. */
export const UMBRAL_HORAS_RIESGO = 0.9;
/** Días antes de la fecha de fin en que un checklist incompleto pone el proyecto en riesgo. */
export const DIAS_AVISO_FIN = 7;
/** Avance mínimo del checklist esperado cuando faltan menos de DIAS_AVISO_FIN días. */
export const AVANCE_MINIMO_AL_FIN = 0.8;
/** Días durante los que una entrada "Bloqueante" de la bitácora pone el proyecto en riesgo. */
export const DIAS_BLOQUEANTE = 7;

export interface DatosSalud {
    estado: string;
    fechaFin?: string | null;
    horasEstimadas?: number | null;
    horasConsumidas?: number | null;
    /** Ítems del checklist (los excluidos no cuentan). */
    checklistItems?: { completed: boolean; excluded?: boolean }[];
    /** Fecha (YYYY-MM-DD) de la última entrada "Bloqueante" de la bitácora. */
    ultimoBloqueante?: string | null;
}

export interface Salud {
    estado: EstadoEfectivo;
    /** Estado guardado (el que elige una persona). */
    estadoBase: EstadoManual;
    /** Por qué está en riesgo o atrasado; null si no hay alerta. */
    motivo: string | null;
}

/** Estado guardado válido: los viejos "en_riesgo" y "atrasado" cuentan como "activo". */
export function estadoManual(estado: string | null | undefined): EstadoManual {
    return (ESTADOS_MANUALES as readonly string[]).includes(estado || '') ? (estado as EstadoManual) : 'activo';
}

function hoyISO(): string {
    // Fecha local de Argentina (UTC-3), igual que las fechas YYYY-MM-DD que se cargan en los proyectos
    return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

export function saludProyecto(p: DatosSalud, hoy: string = hoyISO()): Salud {
    const estadoBase = estadoManual(p.estado);
    const sin = { estado: estadoBase, estadoBase, motivo: null } as Salud;
    // Solo los proyectos en curso tienen alerta
    if (estadoBase !== 'activo' && estadoBase !== 'planificado') return sin;

    const fechaFin = (p.fechaFin || '').slice(0, 10);
    if (fechaFin && fechaFin < hoy) {
        return { estado: 'atrasado', estadoBase, motivo: `La fecha de fin (${fechaFin.split('-').reverse().join('/')}) ya pasó` };
    }

    const estimadas = Number(p.horasEstimadas) || 0;
    const consumidas = Number(p.horasConsumidas) || 0;
    if (estimadas > 0 && consumidas >= estimadas * UMBRAL_HORAS_RIESGO) {
        const pct = Math.round((consumidas / estimadas) * 100);
        return { estado: 'en_riesgo', estadoBase, motivo: `Consumió el ${pct}% de las horas estimadas (${consumidas} de ${estimadas} h)` };
    }

    const items = (p.checklistItems || []).filter((i) => !i.excluded);
    if (fechaFin && items.length > 0 && fechaFin <= sumarDias(hoy, DIAS_AVISO_FIN)) {
        const avance = items.filter((i) => i.completed).length / items.length;
        if (avance < AVANCE_MINIMO_AL_FIN) {
            return { estado: 'en_riesgo', estadoBase, motivo: `Vence en menos de ${DIAS_AVISO_FIN} días con el checklist al ${Math.round(avance * 100)}%` };
        }
    }

    if (p.ultimoBloqueante && p.ultimoBloqueante >= sumarDias(hoy, -DIAS_BLOQUEANTE)) {
        return { estado: 'en_riesgo', estadoBase, motivo: `Bloqueante registrado en la bitácora el ${p.ultimoBloqueante.split('-').reverse().join('/')}` };
    }

    return sin;
}

/**
 * Devuelve el proyecto con `estado` calculado, más `estadoBase` y `alertaMotivo`, para que las pantallas
 * existentes (que leen `estado`) muestren la alerta sin cambios.
 */
export function conSalud<T extends DatosSalud>(p: T, hoy?: string): T & { estado: EstadoEfectivo; estadoBase: EstadoManual; alertaMotivo: string | null } {
    const s = saludProyecto(p, hoy);
    return { ...p, estado: s.estado, estadoBase: s.estadoBase, alertaMotivo: s.motivo };
}

/** `include` de Prisma para traer la fecha del último "Bloqueante" de la bitácora. */
export const ULTIMO_BLOQUEANTE = {
    where: { categoria: 'Bloqueante' },
    select: { fecha: true },
    orderBy: { fecha: 'desc' as const },
    take: 1,
};

/** Proyecto leído con `logs: ULTIMO_BLOQUEANTE` → proyecto con la alerta calculada (sin `logs`). */
export function proyectoConSalud<T extends DatosSalud & { logs?: { fecha: string }[] }>(p: T, hoy?: string) {
    const { logs, ...resto } = p;
    return conSalud({ ...resto, ultimoBloqueante: logs?.[0]?.fecha ?? null }, hoy);
}

/** Campos calculados que no se guardan: se quitan del cuerpo de un alta o edición. */
export const CAMPOS_CALCULADOS = ['estadoBase', 'alertaMotivo', 'ultimoBloqueante'] as const;
