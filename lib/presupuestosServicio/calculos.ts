/**
 * Presupuestos de servicio: cálculos puros (sin base de datos ni React).
 *
 * Los usan el editor (en vivo), la API y los tests. Los totales e IVA siguen
 * exactamente el criterio de Ventas y Comercial (calcularTotalesVenta en
 * lib/ventas/pdvService.ts): si la lista de precios discrimina IVA, los precios
 * son netos y el IVA se suma; si no, los precios ya incluyen IVA.
 */

// ── Tipos ──────────────────────────────────────────────────────────

/** manual: horas e importe libres · costo: importe = horas × valor hora · tiempo: horas = importe ÷ valor hora. */
export type ModoManoObra = 'manual' | 'costo' | 'tiempo';
export const MODOS_MANO_OBRA: readonly ModoManoObra[] = ['manual', 'costo', 'tiempo'];

export const MODO_LABEL: Record<ModoManoObra, string> = {
    manual: 'Manual',
    costo: 'Calcular costo',
    tiempo: 'Calcular tiempo',
};

export type EstadoPresupuesto = 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'vencido';
export type EstadoVersion = 'borrador' | 'enviada' | 'reemplazada' | 'aceptada' | 'rechazada';

export const ESTADOS_PRESUPUESTO: Record<EstadoPresupuesto, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
    borrador: { label: 'Borrador', tone: 'neutral' },
    enviado: { label: 'Enviado', tone: 'info' },
    aceptado: { label: 'Aceptado', tone: 'success' },
    rechazado: { label: 'Rechazado', tone: 'danger' },
    vencido: { label: 'Vencido', tone: 'warning' },
};

export const ESTADOS_VERSION: Record<EstadoVersion, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
    borrador: { label: 'Borrador', tone: 'neutral' },
    enviada: { label: 'Enviada', tone: 'info' },
    reemplazada: { label: 'Reemplazada', tone: 'neutral' },
    aceptada: { label: 'Aceptada', tone: 'success' },
    rechazada: { label: 'Rechazada', tone: 'danger' },
};

export interface LineaManoObraInput {
    categoriaId?: string | null;
    categoriaNombre: string;
    modo: ModoManoObra;
    horas: number;
    valorHora: number;
    importe: number;
    ivaPorcentaje: number;
}

export interface TareaInput {
    descripcion: string;
    etiqueta?: string | null;
    manoObra: LineaManoObraInput[];
}

export interface MaterialInput {
    productoId?: string | null;
    sku?: string | null;
    descripcion: string;
    unidad?: string | null;
    cantidad: number;
    precioUnitario: number;
    precioModificado?: boolean;
    ivaPorcentaje: number;
}

export interface PresupuestoCalculoInput {
    tareas: TareaInput[];
    materiales: MaterialInput[];
    descuentoPorcentaje?: number;
    ivaDiscriminado: boolean;
}

// ── Redondeo ───────────────────────────────────────────────────────

export function r2(n: number): number {
    const v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
}

function noNegativo(n: unknown): number {
    const v = Number(n);
    return isFinite(v) && v > 0 ? v : 0;
}

// ── Mano de obra ───────────────────────────────────────────────────

/** Aplica el modo de cálculo de la línea y devuelve horas, valor hora e importe coherentes. */
export function resolverLineaManoObra<T extends { modo: ModoManoObra; horas: number; valorHora: number; importe: number }>(linea: T): T {
    const horas = noNegativo(linea.horas);
    const valorHora = noNegativo(linea.valorHora);
    const importe = noNegativo(linea.importe);
    if (linea.modo === 'costo') return { ...linea, horas, valorHora, importe: r2(horas * valorHora) };
    if (linea.modo === 'tiempo') return { ...linea, horas: valorHora > 0 ? r2(importe / valorHora) : horas, valorHora, importe };
    return { ...linea, horas, valorHora, importe };
}

/** Si se edita a mano el valor que el modo calcula, la línea pasa a Manual. */
export function modoTrasEditar(modo: ModoManoObra, campo: 'horas' | 'importe' | 'valorHora'): ModoManoObra {
    if (campo === 'importe' && modo === 'costo') return 'manual';
    if (campo === 'horas' && modo === 'tiempo') return 'manual';
    return modo;
}

/**
 * Valor hora a usar en una línea según la lista de precios. El catálogo guarda el valor neto;
 * si la lista trabaja con IVA incluido, la línea lleva el valor con IVA (como los materiales).
 */
export function valorHoraSegunLista(valorHoraNeto: number, ivaPorcentaje: number, ivaDiscriminado: boolean): number {
    const neto = noNegativo(valorHoraNeto);
    return ivaDiscriminado ? r2(neto) : r2(neto * (1 + noNegativo(ivaPorcentaje) / 100));
}

// ── Totales (mismo criterio que Ventas y Comercial) ────────────────

export interface ItemTotales {
    cantidad: number;
    precioUnitario: number;
    descuentoPorcentaje?: number;
    descuentoMonto?: number;
    ivaPorcentaje: number;
}

/**
 * Réplica de calcularTotalesVenta (lib/ventas/pdvService.ts) sin dependencias de servidor.
 * scripts/tests/presupuestos-calculos.test.ts verifica que den lo mismo.
 */
export function calcularTotalesComerciales(
    items: ItemTotales[],
    descuentoGlobalPorcentaje: number = 0,
    recargoGlobalPorcentaje: number = 0,
    options?: { ivaDiscriminado?: boolean }
) {
    let subtotalBruto = 0;
    let descuentoLineasTotal = 0;

    const itemsCalculados = items.map((it) => {
        const cantidad = Number(it.cantidad) || 0;
        const precioUnitario = Number(it.precioUnitario) || 0;
        const descPorc = Math.max(0, Math.min(100, Number(it.descuentoPorcentaje) || 0));
        const ivaPorc = Math.max(0, Number(it.ivaPorcentaje) || 0);

        const brutoLinea = Math.round(cantidad * precioUnitario * 100) / 100;
        let descLineaMonto = Number(it.descuentoMonto) || 0;
        if (descPorc > 0) {
            descLineaMonto = Math.round(((brutoLinea * descPorc) / 100) * 100) / 100;
        }
        descLineaMonto = Math.min(brutoLinea, Math.max(0, descLineaMonto));
        const netoLinea = Math.round((brutoLinea - descLineaMonto) * 100) / 100;

        subtotalBruto += brutoLinea;
        descuentoLineasTotal += descLineaMonto;
        return { cantidad, precioUnitario, ivaPorcentaje: ivaPorc, subtotal: netoLinea };
    });

    const subtotalNetoLineas = Math.round((subtotalBruto - descuentoLineasTotal) * 100) / 100;
    const descGlobPorc = Math.max(0, Math.min(100, Number(descuentoGlobalPorcentaje) || 0));
    const descGlobMonto = Math.round(((subtotalNetoLineas * descGlobPorc) / 100) * 100) / 100;
    const recGlobPorc = Math.max(0, Number(recargoGlobalPorcentaje) || 0);
    const recGlobMonto = Math.round(((subtotalNetoLineas * recGlobPorc) / 100) * 100) / 100;

    let impuestosTotalAjustado = 0;
    for (const it of itemsCalculados) {
        if (it.ivaPorcentaje && it.ivaPorcentaje > 0) {
            const baseLinea = it.subtotal * (1 - descGlobPorc / 100);
            if (options?.ivaDiscriminado) {
                impuestosTotalAjustado += Math.round(((baseLinea * it.ivaPorcentaje) / 100) * 100) / 100;
            } else {
                const divisor = 1 + it.ivaPorcentaje / 100;
                const netoSinIva = divisor > 0 ? baseLinea / divisor : baseLinea;
                impuestosTotalAjustado += Math.round((baseLinea - netoSinIva) * 100) / 100;
            }
        }
    }
    const impuestosMonto = Math.round(impuestosTotalAjustado * 100) / 100;

    const total = options?.ivaDiscriminado
        ? Math.max(0, Math.round((subtotalNetoLineas - descGlobMonto + recGlobMonto + impuestosMonto) * 100) / 100)
        : Math.max(0, Math.round((subtotalNetoLineas - descGlobMonto + recGlobMonto) * 100) / 100);

    return {
        items: itemsCalculados,
        subtotal: subtotalNetoLineas,
        descuentoPorcentaje: descGlobPorc,
        descuentoMonto: descGlobMonto,
        recargoMonto: recGlobMonto,
        impuestosMonto,
        total,
    };
}

// ── Presupuesto completo ───────────────────────────────────────────

export interface ResultadoCalculo {
    tareas: (TareaInput & { horas: number; importe: number; manoObra: LineaManoObraInput[] })[];
    materiales: (MaterialInput & { subtotal: number })[];
    horasTotales: number;
    subtotalManoObra: number;
    subtotalMateriales: number;
    descuentoPorcentaje: number;
    descuentoMonto: number;
    /** Importe sin IVA, ya con descuento. */
    neto: number;
    netoManoObra: number;
    netoMateriales: number;
    impuestos: number;
    total: number;
    ivaDiscriminado: boolean;
}

/** Netea un importe expresado en la convención de la lista (con o sin IVA). */
function netear(importe: number, ivaPorcentaje: number, ivaDiscriminado: boolean, descGlobPorc: number): number {
    const base = importe * (1 - descGlobPorc / 100);
    return ivaDiscriminado ? base : base / (1 + Math.max(0, ivaPorcentaje) / 100);
}

export function calcularPresupuesto(input: PresupuestoCalculoInput): ResultadoCalculo {
    const ivaDiscriminado = Boolean(input.ivaDiscriminado);

    const tareas = input.tareas.map((t) => {
        const manoObra = t.manoObra.map((l) => resolverLineaManoObra({ ...l, ivaPorcentaje: Math.max(0, Number(l.ivaPorcentaje) || 0) }));
        return {
            ...t,
            manoObra,
            horas: r2(manoObra.reduce((a, l) => a + l.horas, 0)),
            importe: r2(manoObra.reduce((a, l) => a + l.importe, 0)),
        };
    });

    const materiales = input.materiales.map((m) => {
        const cantidad = noNegativo(m.cantidad);
        const precioUnitario = noNegativo(m.precioUnitario);
        return { ...m, cantidad, precioUnitario, ivaPorcentaje: Math.max(0, Number(m.ivaPorcentaje) || 0), subtotal: r2(cantidad * precioUnitario) };
    });

    // Cada línea de mano de obra entra como un ítem de cantidad 1 por su importe.
    const items: ItemTotales[] = [
        ...tareas.flatMap((t) => t.manoObra.map((l) => ({ cantidad: 1, precioUnitario: l.importe, ivaPorcentaje: l.ivaPorcentaje }))),
        ...materiales.map((m) => ({ cantidad: m.cantidad, precioUnitario: m.precioUnitario, ivaPorcentaje: m.ivaPorcentaje })),
    ];
    const totales = calcularTotalesComerciales(items, input.descuentoPorcentaje || 0, 0, { ivaDiscriminado });

    const subtotalManoObra = r2(tareas.reduce((a, t) => a + t.importe, 0));
    const subtotalMateriales = r2(materiales.reduce((a, m) => a + m.subtotal, 0));
    const netoManoObra = r2(tareas.reduce((a, t) => a + t.manoObra.reduce((b, l) => b + netear(l.importe, l.ivaPorcentaje, ivaDiscriminado, totales.descuentoPorcentaje), 0), 0));
    const netoMateriales = r2(materiales.reduce((a, m) => a + netear(m.subtotal, m.ivaPorcentaje, ivaDiscriminado, totales.descuentoPorcentaje), 0));
    const neto = ivaDiscriminado ? r2(totales.subtotal - totales.descuentoMonto) : r2(totales.total - totales.impuestosMonto);

    return {
        tareas,
        materiales,
        horasTotales: r2(tareas.reduce((a, t) => a + t.horas, 0)),
        subtotalManoObra,
        subtotalMateriales,
        descuentoPorcentaje: totales.descuentoPorcentaje,
        descuentoMonto: totales.descuentoMonto,
        neto,
        netoManoObra,
        netoMateriales,
        impuestos: totales.impuestosMonto,
        total: totales.total,
        ivaDiscriminado,
    };
}

// ── Fechas y duración (texto YYYY-MM-DD, como Project.fechaInicio) ──

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function esFecha(s: unknown): s is string {
    if (typeof s !== 'string' || !FECHA_RE.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function aDate(s: string): Date {
    return new Date(s + 'T00:00:00Z');
}

function aTexto(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Fecha de hoy en Argentina (YYYY-MM-DD). */
export function hoyArgentina(ahora: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
    const d = aDate(fecha);
    d.setUTCDate(d.getUTCDate() + dias);
    return aTexto(d);
}

export function esDiaHabil(fecha: string): boolean {
    const dow = aDate(fecha).getUTCDay();
    return dow !== 0 && dow !== 6;
}

/** La misma fecha si es hábil; si no, el próximo lunes. */
export function siguienteDiaHabil(fecha: string): string {
    let f = fecha;
    while (!esDiaHabil(f)) f = sumarDias(f, 1);
    return f;
}

/** Fecha de fin para una duración en días hábiles, contando el inicio como el día 1. */
export function finSegunDiasHabiles(inicio: string, diasHabiles: number): string {
    let f = siguienteDiaHabil(inicio);
    let restantes = Math.max(1, Math.round(diasHabiles)) - 1;
    while (restantes > 0) {
        f = sumarDias(f, 1);
        if (esDiaHabil(f)) restantes--;
    }
    return f;
}

/** Días hábiles entre dos fechas, ambas incluidas. */
export function contarDiasHabiles(inicio: string, fin: string): number {
    if (!esFecha(inicio) || !esFecha(fin) || fin < inicio) return 0;
    let n = 0;
    for (let f = inicio; f <= fin; f = sumarDias(f, 1)) if (esDiaHabil(f)) n++;
    return n;
}

/** Duración estimada: horas ÷ (operarios × horas por día), redondeado hacia arriba. */
export function diasHabilesEstimados(horas: number, operarios: number, horasDia: number = 8): number {
    const h = noNegativo(horas);
    if (h === 0) return 0;
    const capacidad = Math.max(1, Math.round(noNegativo(operarios) || 1)) * (noNegativo(horasDia) || 8);
    return Math.max(1, Math.ceil(r2(h / capacidad)));
}

/**
 * Fechas sugeridas para el proyecto a partir de las tentativas del presupuesto.
 * Si el inicio tentativo ya pasó (o falta), arranca el próximo día hábil y conserva la duración.
 */
export function sugerirFechas(params: {
    fechaInicioTentativa?: string | null;
    fechaFinTentativa?: string | null;
    horas: number;
    operarios: number;
    horasDia?: number;
    hoy?: string;
}): { fechaInicio: string; fechaFin: string; diasHabiles: number; ajustado: boolean } {
    const hoy = params.hoy || hoyArgentina();
    const estimados = diasHabilesEstimados(params.horas, params.operarios, params.horasDia);
    const ini = params.fechaInicioTentativa;
    const fin = params.fechaFinTentativa;

    if (esFecha(ini) && ini >= hoy) {
        const inicio = siguienteDiaHabil(ini);
        if (esFecha(fin) && fin >= inicio) {
            return { fechaInicio: inicio, fechaFin: fin, diasHabiles: contarDiasHabiles(inicio, fin), ajustado: inicio !== ini };
        }
        const dias = Math.max(1, estimados);
        return { fechaInicio: inicio, fechaFin: finSegunDiasHabiles(inicio, dias), diasHabiles: dias, ajustado: inicio !== ini };
    }

    const inicio = siguienteDiaHabil(hoy);
    const dias = esFecha(ini) && esFecha(fin) && fin >= ini ? Math.max(1, contarDiasHabiles(ini, fin)) : Math.max(1, estimados);
    return { fechaInicio: inicio, fechaFin: finSegunDiasHabiles(inicio, dias), diasHabiles: dias, ajustado: Boolean(ini) };
}

// ── Documento ──────────────────────────────────────────────────────

/** 1 Detallado · 2 Por tarea · 3 Subtotales · 4 Total */
export type NivelDocumento = 1 | 2 | 3 | 4;

export interface OpcionesDocumento {
    nivel: NivelDocumento;
    cantidades: boolean;
    horas: boolean;
    tareas: boolean;
    plazo: boolean;
    condiciones: boolean;
}

export const OPCIONES_DOCUMENTO_DEFECTO: OpcionesDocumento = {
    nivel: 1,
    cantidades: true,
    horas: true,
    tareas: true,
    plazo: true,
    condiciones: true,
};

export const NIVELES_DOCUMENTO: { nivel: NivelDocumento; nombre: string; descripcion: string }[] = [
    { nivel: 1, nombre: 'Detallado', descripcion: 'Cada material con cantidad, precio unitario y subtotal. Mano de obra por tarea y por categoría con horas, valor hora e importe.' },
    { nivel: 2, nombre: 'Por tarea', descripcion: 'Una línea por tarea con su importe. Materiales con cantidad e importe, sin precio unitario.' },
    { nivel: 3, nombre: 'Subtotales', descripcion: 'Subtotal de materiales y subtotal de mano de obra. Tareas y materiales se pueden listar sin precios.' },
    { nivel: 4, nombre: 'Total', descripcion: 'Alcance y total. Es el nivel más agrupado.' },
];

export function normalizarOpcionesDocumento(raw: unknown): OpcionesDocumento {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<OpcionesDocumento>;
    const nivel = [1, 2, 3, 4].includes(Number(o.nivel)) ? (Number(o.nivel) as NivelDocumento) : OPCIONES_DOCUMENTO_DEFECTO.nivel;
    const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
    return {
        nivel,
        cantidades: b(o.cantidades, true),
        horas: b(o.horas, true),
        tareas: b(o.tareas, true),
        plazo: b(o.plazo, true),
        condiciones: b(o.condiciones, true),
    };
}
