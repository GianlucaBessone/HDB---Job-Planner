/**
 * Modelo del documento del presupuesto según el nivel de detalle elegido.
 * Puro: lo usa el PDF (@react-pdf) y se puede testear sin renderizar.
 *
 *   1 Detallado: materiales con cantidad, precio unitario y subtotal; mano de obra por tarea y categoría.
 *   2 Por tarea: una línea por tarea; materiales con cantidad e importe.
 *   3 Subtotales: subtotal de materiales y de mano de obra (+ listados sin precios opcionales).
 *   4 Total: alcance y total.
 */
import { calcularPresupuesto, contarDiasHabiles, diasHabilesEstimados, r2, type OpcionesDocumento } from './calculos';

export interface VersionDocumento {
    version: number;
    alcance: string | null;
    condiciones: string | null;
    fechaInicioTentativa: string | null;
    fechaFinTentativa: string | null;
    operariosSimultaneos: number;
    validezDias: number;
    listaPrecioNombre: string | null;
    ivaDiscriminado: boolean;
    descuentoPorcentaje: number;
    tareas: {
        descripcion: string;
        etiqueta: string | null;
        manoObra: { categoriaNombre: string; modo: string; horas: number; valorHora: number; importe: number; ivaPorcentaje: number }[];
    }[];
    materiales: { sku: string | null; descripcion: string; unidad: string | null; cantidad: number; precioUnitario: number; ivaPorcentaje: number }[];
}

export interface FilaDoc {
    descripcion: string;
    codigo?: string | null;
    cantidad?: number | null;
    unidad?: string | null;
    horas?: number | null;
    unitario?: number | null;
    importe?: number | null;
    nivel?: 0 | 1; // 1 = subfila (categoría dentro de una tarea)
}

export interface SeccionDoc {
    titulo: string;
    columnas: { horas: boolean; cantidad: boolean; unitario: boolean; importe: boolean; codigo: boolean };
    filas: FilaDoc[];
}

export interface DocumentoPresupuesto {
    listaTareas: { descripcion: string; horas: number | null }[];
    secciones: SeccionDoc[];
    resumen: { descripcion: string; importe: number }[];
    totales: { etiqueta: string; importe: number; destacado?: boolean }[];
    plazo: string | null;
    condiciones: string | null;
    validezDias: number;
    ivaDiscriminado: boolean;
}

export function armarDocumento(v: VersionDocumento, o: OpcionesDocumento): DocumentoPresupuesto {
    const calc = calcularPresupuesto({
        ivaDiscriminado: v.ivaDiscriminado,
        descuentoPorcentaje: v.descuentoPorcentaje,
        tareas: v.tareas.map((t) => ({
            descripcion: t.descripcion,
            etiqueta: t.etiqueta,
            manoObra: t.manoObra.map((l) => ({ ...l, modo: (['manual', 'costo', 'tiempo'].includes(l.modo) ? l.modo : 'manual') as any })),
        })),
        materiales: v.materiales,
    });

    const secciones: SeccionDoc[] = [];
    const resumen: { descripcion: string; importe: number }[] = [];
    const horas = o.horas;

    if (o.nivel === 1) {
        const filas: FilaDoc[] = [];
        for (const t of calc.tareas) {
            filas.push({ descripcion: t.descripcion, horas: horas ? t.horas : null, importe: t.importe, nivel: 0 });
            for (const l of t.manoObra) {
                // En una línea manual el valor hora mostrado es el efectivo, para que la cuenta cierre.
                const unitario = l.horas > 0 ? r2(l.importe / l.horas) : l.valorHora;
                filas.push({ descripcion: l.categoriaNombre, horas: horas ? l.horas : null, unitario: horas ? unitario : null, importe: l.importe, nivel: 1 });
            }
        }
        if (filas.length) secciones.push({ titulo: 'Mano de obra', columnas: { horas, cantidad: false, unitario: horas, importe: true, codigo: false }, filas });
        if (calc.materiales.length) {
            secciones.push({
                titulo: 'Materiales',
                columnas: { horas: false, cantidad: true, unitario: true, importe: true, codigo: true },
                filas: calc.materiales.map((m) => ({ descripcion: m.descripcion, codigo: m.sku, cantidad: m.cantidad, unidad: m.unidad, unitario: m.precioUnitario, importe: m.subtotal })),
            });
        }
    } else if (o.nivel === 2) {
        if (calc.tareas.length) {
            secciones.push({
                titulo: 'Mano de obra',
                columnas: { horas, cantidad: false, unitario: false, importe: true, codigo: false },
                filas: calc.tareas.map((t) => ({ descripcion: t.descripcion, horas: horas ? t.horas : null, importe: t.importe })),
            });
        }
        if (calc.materiales.length) {
            secciones.push({
                titulo: 'Materiales',
                columnas: { horas: false, cantidad: true, unitario: false, importe: true, codigo: false },
                filas: calc.materiales.map((m) => ({ descripcion: m.descripcion, cantidad: m.cantidad, unidad: m.unidad, importe: m.subtotal })),
            });
        }
    } else {
        if (o.cantidades && calc.materiales.length) {
            secciones.push({
                titulo: 'Materiales incluidos',
                columnas: { horas: false, cantidad: true, unitario: false, importe: false, codigo: false },
                filas: calc.materiales.map((m) => ({ descripcion: m.descripcion, cantidad: m.cantidad, unidad: m.unidad })),
            });
        }
        if (o.nivel === 3) {
            if (calc.materiales.length) resumen.push({ descripcion: 'Materiales', importe: calc.subtotalMateriales });
            if (calc.tareas.length) {
                resumen.push({ descripcion: horas ? `Mano de obra · ${fmtNum(calc.horasTotales)} h` : 'Mano de obra', importe: calc.subtotalManoObra });
            }
        }
    }

    const totales: { etiqueta: string; importe: number; destacado?: boolean }[] = [];
    if (calc.descuentoMonto > 0) {
        totales.push({ etiqueta: 'Subtotal', importe: r2(calc.subtotalManoObra + calc.subtotalMateriales) });
        totales.push({ etiqueta: `Descuento ${fmtNum(calc.descuentoPorcentaje)} %`, importe: -calc.descuentoMonto });
    }
    if (v.ivaDiscriminado) {
        totales.push({ etiqueta: 'Neto gravado', importe: calc.neto });
        totales.push({ etiqueta: 'IVA', importe: calc.impuestos });
        totales.push({ etiqueta: 'Total', importe: calc.total, destacado: true });
    } else {
        totales.push({ etiqueta: 'Total (IVA incluido)', importe: calc.total, destacado: true });
        totales.push({ etiqueta: 'IVA contenido', importe: calc.impuestos });
    }

    let plazo: string | null = null;
    if (o.plazo) {
        const dias = v.fechaInicioTentativa && v.fechaFinTentativa
            ? contarDiasHabiles(v.fechaInicioTentativa, v.fechaFinTentativa)
            : diasHabilesEstimados(calc.horasTotales, v.operariosSimultaneos);
        if (dias > 0) {
            plazo = `${dias} ${dias === 1 ? 'día hábil' : 'días hábiles'} desde el inicio de los trabajos.`;
            if (v.fechaInicioTentativa) plazo += ` Inicio estimado: ${fmtFecha(v.fechaInicioTentativa)}.`;
        }
    }

    return {
        listaTareas: o.nivel >= 3 && o.tareas ? calc.tareas.map((t) => ({ descripcion: t.descripcion, horas: horas ? t.horas : null })) : [],
        secciones,
        resumen,
        totales,
        plazo,
        condiciones: o.condiciones ? v.condiciones || null : null,
        validezDias: v.validezDias,
        ivaDiscriminado: v.ivaDiscriminado,
    };
}

export function fmtNum(n: number): string {
    return (Math.round(n * 100) / 100).toLocaleString('es-AR');
}

export function fmtFecha(f: string | null | undefined): string {
    if (!f) return '';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
}
