import { prisma } from './prisma';

// ── Tipos ─────────────────────────────────────────────────────────────

export type EstadoCumplimientoKpi = 'Cumple' | 'En Riesgo' | 'No Cumple';
export type EstadoCumplimientoOkr = 'Verde' | 'Amarillo' | 'Rojo' | 'Sin datos';

interface ResultadoKpi {
    estado: EstadoCumplimientoKpi;
    porcentaje: number;
}

interface ResultadoOkr {
    porcentajeAvance: number;
    estadoCumplimiento: EstadoCumplimientoOkr;
}

// ── Cálculo de cumplimiento KPI ───────────────────────────────────────

/**
 * Calcula el estado de cumplimiento de un KPI dado un valor obtenido y su objetivo.
 * 
 * Reglas:
 *  - valorObtenido >= valorObjetivo      → Cumple
 *  - valorObtenido >= valorObjetivo * 0.9 → En Riesgo
 *  - valorObtenido <  valorObjetivo * 0.9 → No Cumple
 */
export function calcularCumplimientoKpi(valorObtenido: number, valorObjetivo: number): ResultadoKpi {
    if (valorObjetivo === 0) {
        return { estado: 'Cumple', porcentaje: 100 };
    }

    const porcentaje = Math.min((valorObtenido / valorObjetivo) * 100, 200); // cap at 200%

    if (valorObtenido >= valorObjetivo) {
        return { estado: 'Cumple', porcentaje };
    }

    if (valorObtenido >= valorObjetivo * 0.9) {
        return { estado: 'En Riesgo', porcentaje };
    }

    return { estado: 'No Cumple', porcentaje };
}

// ── Cálculo de avance OKR ─────────────────────────────────────────────

/**
 * Calcula el avance global del OKR basado en el promedio porcentual
 * de cumplimiento de todos los KPI activos asociados.
 */
export function calcularAvanceOkr(kpis: { valorObjetivo: number; ultimoValor: number | null; estado: string }[]): ResultadoOkr {
    const kpisActivos = kpis.filter(k => k.estado === 'Activo');

    if (kpisActivos.length === 0) {
        return { porcentajeAvance: 0, estadoCumplimiento: 'Sin datos' };
    }

    const kpisConMedicion = kpisActivos.filter(k => k.ultimoValor !== null);

    if (kpisConMedicion.length === 0) {
        return { porcentajeAvance: 0, estadoCumplimiento: 'Sin datos' };
    }

    const sumaPercentajes = kpisConMedicion.reduce((acc, kpi) => {
        const { porcentaje } = calcularCumplimientoKpi(kpi.ultimoValor!, kpi.valorObjetivo);
        return acc + Math.min(porcentaje, 100); // Cap at 100% for averaging
    }, 0);

    const porcentajeAvance = Math.round((sumaPercentajes / kpisActivos.length) * 100) / 100;

    let estadoCumplimiento: EstadoCumplimientoOkr;
    if (porcentajeAvance >= 100) {
        estadoCumplimiento = 'Verde';
    } else if (porcentajeAvance >= 70) {
        estadoCumplimiento = 'Amarillo';
    } else {
        estadoCumplimiento = 'Rojo';
    }

    return { porcentajeAvance, estadoCumplimiento };
}

// ── Recalcular tras nueva medición ────────────────────────────────────

/**
 * Recalcula el estado de cumplimiento de un KPI y actualiza el avance del OKR padre.
 * Se invoca después de registrar una nueva medición.
 */
export async function recalcularTrasNuevaMedicion(kpiId: string): Promise<void> {
    // 1. Obtener KPI con su último valor y objetivo
    const kpi = await prisma.kpi.findUnique({
        where: { id: kpiId },
        select: {
            id: true,
            valorObjetivo: true,
            ultimoValor: true,
            okrId: true,
        },
    });

    if (!kpi) return;

    // 2. Obtener la medición más reciente
    const ultimaMedicion = await prisma.kpiHistorico.findFirst({
        where: { kpiId },
        orderBy: { fechaMedicion: 'desc' },
        select: { valorObtenido: true },
    });

    const ultimoValor = ultimaMedicion?.valorObtenido ?? null;

    // 3. Calcular cumplimiento KPI
    let estadoCumplimiento: string | null = null;
    if (ultimoValor !== null) {
        const resultado = calcularCumplimientoKpi(ultimoValor, kpi.valorObjetivo);
        estadoCumplimiento = resultado.estado;
    }

    // 4. Actualizar KPI
    await prisma.kpi.update({
        where: { id: kpiId },
        data: {
            ultimoValor,
            estadoCumplimiento,
        },
    });

    // 5. Recalcular OKR padre
    await recalcularAvanceOkr(kpi.okrId);
}

/**
 * Recalcula el avance global de un OKR basado en todos sus KPIs.
 */
export async function recalcularAvanceOkr(okrId: string): Promise<void> {
    const kpis = await prisma.kpi.findMany({
        where: { okrId },
        select: {
            valorObjetivo: true,
            ultimoValor: true,
            estado: true,
        },
    });

    const resultado = calcularAvanceOkr(kpis);

    await prisma.okr.update({
        where: { id: okrId },
        data: {
            porcentajeAvance: resultado.porcentajeAvance,
            estadoCumplimiento: resultado.estadoCumplimiento,
        },
    });
}
