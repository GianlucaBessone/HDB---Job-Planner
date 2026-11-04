// Viajes y viáticos: catálogos y cálculos compartidos por la API y la UI.
// Ver docs/viajes/INFORME-IMPLEMENTACION.md

import type { BadgeTone } from '@/components/ui/Badge';

export const VIAJE_GESTORES = ['admin', 'qa', 'supervisor'];

export function esGestorViajes(role: string | null | undefined): boolean {
    return VIAJE_GESTORES.includes((role || '').toLowerCase());
}

// ── Estados ────────────────────────────────────────────────────────

export const VIAJE_ESTADOS = ['planificado', 'en_curso', 'finalizado', 'cerrado', 'cancelado'] as const;
export type ViajeEstado = (typeof VIAJE_ESTADOS)[number];

export const VIAJE_ESTADO_LABEL: Record<ViajeEstado, string> = {
    planificado: 'Planificado',
    en_curso: 'En curso',
    finalizado: 'Por rendir',
    cerrado: 'Cerrado',
    cancelado: 'Cancelado',
};

export const VIAJE_ESTADO_TONE: Record<ViajeEstado, BadgeTone> = {
    planificado: 'neutral',
    en_curso: 'info',
    finalizado: 'warning',
    cerrado: 'success',
    cancelado: 'danger',
};

/** El responsable puede cargar, editar y borrar gastos, y extender la estadía. */
export function viajeEditablePorResponsable(estado: string): boolean {
    return estado === 'planificado' || estado === 'en_curso';
}

/** Administración puede cambiar la configuración (fechas, costos, anticipo, personas). */
export function viajeConfigurable(estado: string): boolean {
    return estado === 'planificado' || estado === 'en_curso' || estado === 'finalizado';
}

// ── Modalidad de fondos ────────────────────────────────────────────

export const MODALIDADES_FONDOS = ['anticipo', 'rendicion'] as const;
export type ModalidadFondos = (typeof MODALIDADES_FONDOS)[number];

export const MODALIDAD_LABEL: Record<ModalidadFondos, string> = {
    anticipo: 'Anticipo (pre-viaje)',
    rendicion: 'Contra rendición',
};

export const MODALIDAD_CORTA: Record<ModalidadFondos, string> = {
    anticipo: 'Anticipo',
    rendicion: 'Contra rendición',
};

// ── Categorías de gasto ────────────────────────────────────────────

export const CATEGORIAS_GASTO = [
    { value: 'combustible', label: 'Combustible' },
    { value: 'peajes', label: 'Peajes' },
    { value: 'alojamiento', label: 'Alojamiento' },
    { value: 'comidas', label: 'Comidas' },
    { value: 'transporte', label: 'Pasajes' },
    { value: 'movilidad', label: 'Movilidad local' },
    { value: 'estacionamiento', label: 'Estacionamiento' },
    { value: 'materiales', label: 'Materiales' },
    { value: 'otros', label: 'Otros' },
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]['value'];
export const CATEGORIA_VALUES = CATEGORIAS_GASTO.map(c => c.value) as [CategoriaGasto, ...CategoriaGasto[]];

export function categoriaLabel(value: string): string {
    return CATEGORIAS_GASTO.find(c => c.value === value)?.label || value;
}

// ── Bases de cálculo del estimado ──────────────────────────────────

export const BASES_COSTO = [
    { value: 'total', label: 'Monto total' },
    { value: 'por_dia', label: 'Por día' },
    { value: 'por_noche', label: 'Por noche' },
    { value: 'por_persona', label: 'Por persona' },
    { value: 'por_persona_dia', label: 'Por persona y día' },
    { value: 'por_persona_noche', label: 'Por persona y noche' },
] as const;

export type BaseCosto = (typeof BASES_COSTO)[number]['value'];
export const BASE_VALUES = BASES_COSTO.map(b => b.value) as [BaseCosto, ...BaseCosto[]];

export function baseLabel(value: string): string {
    return BASES_COSTO.find(b => b.value === value)?.label || value;
}

// ── Gastos ─────────────────────────────────────────────────────────

export const ALCANCE_LABEL: Record<string, string> = { global: 'Global', individual: 'Individual' };
export const MEDIO_PAGO_LABEL: Record<string, string> = { fondos: 'Fondos del viaje', propio: 'Medios propios' };

export const VERIFICACION_ESTADOS = ['pendiente', 'aprobado', 'observado', 'rechazado'] as const;
export type VerificacionEstado = (typeof VERIFICACION_ESTADOS)[number];

export const VERIFICACION_LABEL: Record<VerificacionEstado, string> = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    observado: 'Observado',
    rechazado: 'Rechazado',
};

export const VERIFICACION_TONE: Record<VerificacionEstado, BadgeTone> = {
    pendiente: 'neutral',
    aprobado: 'success',
    observado: 'warning',
    rechazado: 'danger',
};

export const VIAJE_COMPROBANTES_MAX = 6;
// Se suben de a uno y ya comprimidos: Vercel corta cuerpos de más de 4,5 MB.
export const VIAJE_COMPROBANTE_MAX_BYTES = 4 * 1024 * 1024;

// ── Fechas (DATE sin hora: siempre en UTC) ─────────────────────────

/** Date o ISO → 'YYYY-MM-DD'. */
export function toISODate(value: Date | string | null | undefined): string {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → Date a medianoche UTC (lo que espera una columna @db.Date). */
export function fromISODate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

/** Hoy en Argentina como 'YYYY-MM-DD'. */
export function hoyISO(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-11-04' → '4 nov 2026' (o '4 nov' sin año). */
export function formatFechaCorta(value: Date | string | null | undefined, conAnio = true): string {
    const iso = toISODate(value);
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES[m - 1]}${conAnio ? ` ${y}` : ''}`;
}

export function formatRangoFechas(inicio: Date | string, fin: Date | string): string {
    const a = toISODate(inicio);
    const b = toISODate(fin);
    if (!a || !b) return '—';
    if (a === b) return formatFechaCorta(a);
    const mismoAnio = a.slice(0, 4) === b.slice(0, 4);
    return `${formatFechaCorta(a, !mismoAnio)} – ${formatFechaCorta(b)}`;
}

/** Días de viaje, inclusive (mismo día = 1). */
export function diasViaje(inicio: Date | string, fin: Date | string): number {
    const a = fromISODate(toISODate(inicio)).getTime();
    const b = fromISODate(toISODate(fin)).getTime();
    if (isNaN(a) || isNaN(b) || b < a) return 1;
    return Math.round((b - a) / 86_400_000) + 1;
}

export function nochesViaje(inicio: Date | string, fin: Date | string): number {
    return Math.max(0, diasViaje(inicio, fin) - 1);
}

// ── Cálculos ───────────────────────────────────────────────────────

export const redondear = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function multiplicadorBase(base: string, dias: number, noches: number, personas: number): number {
    switch (base) {
        case 'por_dia': return dias;
        case 'por_noche': return noches;
        case 'por_persona': return personas;
        case 'por_persona_dia': return personas * dias;
        case 'por_persona_noche': return personas * noches;
        default: return 1;
    }
}

export interface CostoLinea { categoria: string; base: string; monto: number; descripcion?: string | null }
export interface GastoCalculo {
    id?: string;
    monto: number;
    medioPago: string;
    alcance: string;
    categoria: string;
    estadoVerificacion?: string;
    montoAprobado?: number | null;
    afectados?: { participanteId: string }[];
}
export interface ParticipanteCalculo { id: string; nombre: string }

export interface ViajeCalculo {
    fechaInicio: Date | string;
    fechaFin: Date | string;
    modalidadFondos: string;
    montoAnticipo: number;
    participantes: ParticipanteCalculo[];
    costos: CostoLinea[];
    gastos: GastoCalculo[];
}

export function subtotalCosto(c: CostoLinea, dias: number, noches: number, personas: number): number {
    return redondear((Number(c.monto) || 0) * multiplicadorBase(c.base, dias, noches, personas));
}

/** Monto que se toma como válido en la rendición. */
export function montoAprobadoGasto(g: GastoCalculo): number {
    if (g.estadoVerificacion === 'rechazado') return 0;
    if (g.estadoVerificacion === 'observado' && g.montoAprobado != null) return redondear(g.montoAprobado);
    if (g.estadoVerificacion === 'aprobado') return redondear(g.montoAprobado ?? g.monto);
    return redondear(g.monto);
}

export interface ResumenViaje {
    dias: number;
    noches: number;
    personas: number;
    estimado: number;
    gastado: number;
    gastadoFondos: number;
    gastadoPropio: number;
    anticipo: number;
    saldoFondos: number; // anticipo − gastado con fondos
    disponible: number; // estimado − gastado
    porcentajeConsumo: number; // gastado / estimado (0-100+, 0 si no hay estimado)
    estimadoPorCategoria: Record<string, number>;
    gastadoPorCategoria: Record<string, number>;
    // Rendición
    pendientes: number;
    verificados: number;
    aprobado: number;
    rechazado: number;
    resultado: number; // anticipo − aprobado: >0 devuelve el responsable, <0 reintegra la empresa
    // Costo por persona (individuales + globales prorrateados, sobre el monto aprobado/vigente)
    porPersona: { participanteId: string; nombre: string; individual: number; global: number; total: number }[];
}

export function calcularResumen(v: ViajeCalculo): ResumenViaje {
    const dias = diasViaje(v.fechaInicio, v.fechaFin);
    const noches = nochesViaje(v.fechaInicio, v.fechaFin);
    const personas = Math.max(1, v.participantes.length);

    const estimadoPorCategoria: Record<string, number> = {};
    let estimado = 0;
    for (const c of v.costos) {
        const sub = subtotalCosto(c, dias, noches, personas);
        estimado += sub;
        estimadoPorCategoria[c.categoria] = redondear((estimadoPorCategoria[c.categoria] || 0) + sub);
    }

    const gastadoPorCategoria: Record<string, number> = {};
    let gastado = 0, gastadoFondos = 0, gastadoPropio = 0;
    let pendientes = 0, aprobado = 0, rechazado = 0;

    const porPersonaMap = new Map(v.participantes.map(p => [p.id, { participanteId: p.id, nombre: p.nombre, individual: 0, global: 0, total: 0 }]));

    for (const g of v.gastos) {
        const monto = redondear(g.monto);
        gastado += monto;
        if (g.medioPago === 'propio') gastadoPropio += monto; else gastadoFondos += monto;
        gastadoPorCategoria[g.categoria] = redondear((gastadoPorCategoria[g.categoria] || 0) + monto);

        if (!g.estadoVerificacion || g.estadoVerificacion === 'pendiente') pendientes++;
        const valido = montoAprobadoGasto(g);
        aprobado += valido;
        if (g.estadoVerificacion === 'rechazado') rechazado += monto;
        else if (g.estadoVerificacion === 'observado') rechazado += Math.max(0, monto - valido);

        // Reparto por persona
        const afectados = (g.alcance === 'individual' ? (g.afectados || []).map(a => a.participanteId) : [])
            .filter(id => porPersonaMap.has(id));
        if (afectados.length > 0) {
            const parte = valido / afectados.length;
            for (const id of afectados) porPersonaMap.get(id)!.individual += parte;
        } else if (porPersonaMap.size > 0) {
            const parte = valido / porPersonaMap.size;
            porPersonaMap.forEach(p => { p.global += parte; });
        }
    }

    const anticipo = v.modalidadFondos === 'anticipo' ? redondear(v.montoAnticipo) : 0;
    estimado = redondear(estimado);
    gastado = redondear(gastado);
    aprobado = redondear(aprobado);

    return {
        dias,
        noches,
        personas,
        estimado,
        gastado,
        gastadoFondos: redondear(gastadoFondos),
        gastadoPropio: redondear(gastadoPropio),
        anticipo,
        saldoFondos: redondear(anticipo - gastadoFondos),
        disponible: redondear(estimado - gastado),
        porcentajeConsumo: estimado > 0 ? Math.round((gastado / estimado) * 100) : 0,
        estimadoPorCategoria,
        gastadoPorCategoria,
        pendientes,
        verificados: v.gastos.length - pendientes,
        aprobado,
        rechazado: redondear(rechazado),
        resultado: redondear(anticipo - aprobado),
        porPersona: Array.from(porPersonaMap.values()).map(p => ({
            ...p,
            individual: redondear(p.individual),
            global: redondear(p.global),
            total: redondear(p.individual + p.global),
        })),
    };
}

/** Tono del avance de gasto contra lo estimado. */
export function toneConsumo(porcentaje: number): 'success' | 'warning' | 'danger' {
    if (porcentaje > 100) return 'danger';
    if (porcentaje >= 85) return 'warning';
    return 'success';
}

export function generarCodigoViaje(year: number, numero: number): string {
    return `VJE-${year}-${String(numero).padStart(4, '0')}`;
}
