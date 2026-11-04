/**
 * Control horario: cruce por operador y día entre el registro de tiempos
 * (carga manual), la fichada GPS y el ajuste que valida un supervisor.
 * Lo usan la API (/api/control-horario), la vista y el informe impreso.
 */

// Los roles habilitados se declaran en lib/viewAccess.ts.
export { CONTROL_HORARIO_ROLES, canUseControlHorario } from '@/lib/viewAccess';

/** Diferencia de horas a partir de la cual se marca la fila (15 min). */
export const TOLERANCIA_HORAS = 0.25;
/** Diferencia de horario (ingreso o egreso) a partir de la cual se marca (15 min). */
export const TOLERANCIA_MINUTOS = 15;

export interface RegistroDia {
    ingreso: string | null;
    egreso: string | null;
    horas: number;
    horasExtra: number;
    registros: number;
    causas: string[];
}

export interface GpsDia {
    ingreso: string | null;
    egreso: string | null;
    horas: number;
    fichadas: number;
    /** Hay al menos una fichada sin egreso. */
    abierta: boolean;
}

export interface AjusteDia {
    horaIngreso: string;
    horaEgreso: string;
    horas: number;
    observacion: string | null;
    ajustadoPorNombre: string | null;
    updatedAt: string;
}

export interface ControlHorarioRow {
    key: string;
    operatorId: string;
    operatorName: string;
    fecha: string;
    proyectos: string[];
    registro: RegistroDia | null;
    gps: GpsDia | null;
    ajuste: AjusteDia | null;
}

export type EstadoControl = 'ok' | 'diferencia' | 'sin_gps' | 'sin_registro' | 'gps_abierta';

export const ESTADO_LABEL: Record<EstadoControl, string> = {
    ok: 'Coincide',
    diferencia: 'Diferencia',
    sin_gps: 'Sin fichada',
    sin_registro: 'Sin registro',
    gps_abierta: 'Fichada sin cierre',
};

// ── Horas ────────────────────────────────────────────────────────────

export function toMinutes(hhmm: string | null | undefined): number | null {
    if (!hhmm) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

/** Horas exactas entre dos horarios; si el egreso es menor, cruza la medianoche. */
export function horasEntre(ingreso: string | null | undefined, egreso: string | null | undefined): number {
    const a = toMinutes(ingreso);
    const b = toMinutes(egreso);
    if (a === null || b === null) return 0;
    let diff = b - a;
    if (diff < 0) diff += 24 * 60;
    return round2(diff / 60);
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Diferencia en minutos entre dos horarios (b − a), o null si falta alguno. */
export function minutosEntre(a: string | null | undefined, b: string | null | undefined): number | null {
    const ma = toMinutes(a);
    const mb = toMinutes(b);
    if (ma === null || mb === null) return null;
    return mb - ma;
}

// ── Evaluación de una fila ───────────────────────────────────────────

export interface EvaluacionFila {
    estado: EstadoControl;
    /** Horas GPS − horas registro (null si falta alguna de las dos fuentes). */
    diferencia: number | null;
    /** El ingreso GPS difiere del registro más que la tolerancia. */
    ingresoDifiere: boolean;
    /** El egreso GPS difiere del registro más que la tolerancia. */
    egresoDifiere: boolean;
    /** Horas que valen para el día: las del ajuste si existe, si no las del registro. */
    horasFinales: number;
    /** Ajuste − registro (null si no hay ajuste). */
    diferenciaAjuste: number | null;
    /** La fila tiene alguna diferencia a revisar. */
    conDiferencia: boolean;
}

export function evaluarFila(row: ControlHorarioRow): EvaluacionFila {
    const { registro, gps, ajuste } = row;
    let estado: EstadoControl = 'ok';
    let diferencia: number | null = null;
    let ingresoDifiere = false;
    let egresoDifiere = false;

    if (registro && !gps) estado = 'sin_gps';
    else if (!registro && gps) estado = gps.abierta ? 'gps_abierta' : 'sin_registro';
    else if (registro && gps) {
        if (gps.abierta) estado = 'gps_abierta';
        // Con una fichada sin cierre las horas GPS están incompletas: no se compara
        diferencia = gps.abierta ? null : round2(gps.horas - registro.horas);
        const dIn = minutosEntre(registro.ingreso, gps.ingreso);
        const dOut = minutosEntre(registro.egreso, gps.egreso);
        ingresoDifiere = dIn !== null && Math.abs(dIn) > TOLERANCIA_MINUTOS;
        egresoDifiere = !gps.abierta && dOut !== null && Math.abs(dOut) > TOLERANCIA_MINUTOS;
        if (estado === 'ok' && (ingresoDifiere || egresoDifiere || (diferencia !== null && Math.abs(diferencia) > TOLERANCIA_HORAS))) {
            estado = 'diferencia';
        }
    }

    const horasRegistro = registro?.horas ?? 0;
    const horasFinales = ajuste ? ajuste.horas : horasRegistro;
    const diferenciaAjuste = ajuste ? round2(ajuste.horas - horasRegistro) : null;

    return {
        estado,
        diferencia,
        ingresoDifiere,
        egresoDifiere,
        horasFinales,
        diferenciaAjuste,
        conDiferencia: estado !== 'ok',
    };
}

// ── Totales ──────────────────────────────────────────────────────────

export interface TotalesControl {
    dias: number;
    operadores: number;
    horasRegistro: number;
    horasExtra: number;
    horasGps: number;
    /** Σ (GPS − registro) en los días que tienen ambas fuentes. */
    diferenciaNeta: number;
    horasAjustadas: number;
    ajustes: number;
    horasFinales: number;
    filasConDiferencia: number;
    sinGps: number;
    sinRegistro: number;
    gpsAbiertas: number;
}

export function calcularTotales(rows: ControlHorarioRow[]): TotalesControl {
    const t: TotalesControl = {
        dias: rows.length,
        operadores: new Set(rows.map(r => r.operatorId)).size,
        horasRegistro: 0,
        horasExtra: 0,
        horasGps: 0,
        diferenciaNeta: 0,
        horasAjustadas: 0,
        ajustes: 0,
        horasFinales: 0,
        filasConDiferencia: 0,
        sinGps: 0,
        sinRegistro: 0,
        gpsAbiertas: 0,
    };
    for (const r of rows) {
        const ev = evaluarFila(r);
        t.horasRegistro += r.registro?.horas ?? 0;
        t.horasExtra += r.registro?.horasExtra ?? 0;
        t.horasGps += r.gps?.horas ?? 0;
        if (ev.diferencia !== null) t.diferenciaNeta += ev.diferencia;
        if (r.ajuste) { t.horasAjustadas += r.ajuste.horas; t.ajustes++; }
        t.horasFinales += ev.horasFinales;
        if (ev.conDiferencia) t.filasConDiferencia++;
        if (ev.estado === 'sin_gps') t.sinGps++;
        if (ev.estado === 'sin_registro') t.sinRegistro++;
        if (ev.estado === 'gps_abierta') t.gpsAbiertas++;
    }
    t.horasRegistro = round2(t.horasRegistro);
    t.horasExtra = round2(t.horasExtra);
    t.horasGps = round2(t.horasGps);
    t.diferenciaNeta = round2(t.diferenciaNeta);
    t.horasAjustadas = round2(t.horasAjustadas);
    t.horasFinales = round2(t.horasFinales);
    return t;
}

// ── Formato ──────────────────────────────────────────────────────────

const horasFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatHoras(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return horasFmt.format(n);
}

/** Diferencia con signo: +0,50 / −1,25 / 0,00. */
export function formatDiferencia(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    if (Math.abs(n) < 0.005) return horasFmt.format(0);
    return `${n > 0 ? '+' : '−'}${horasFmt.format(Math.abs(n))}`;
}

export function formatRango(ingreso: string | null | undefined, egreso: string | null | undefined, abierta = false): string {
    if (!ingreso && !egreso) return '—';
    return `${ingreso || '—'} – ${abierta && !egreso ? 'sin cierre' : egreso || '—'}`;
}
