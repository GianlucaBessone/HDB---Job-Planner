/**
 * Tests unitarios de los cálculos de presupuestos de servicio (sin base de datos).
 *
 *   npx tsx --test scripts/tests/presupuestos-calculos.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    calcularPresupuesto,
    calcularTotalesComerciales,
    resolverLineaManoObra,
    modoTrasEditar,
    valorHoraSegunLista,
    diasHabilesEstimados,
    finSegunDiasHabiles,
    contarDiasHabiles,
    siguienteDiaHabil,
    sugerirFechas,
    normalizarOpcionesDocumento,
    esFecha,
} from '../../lib/presupuestosServicio/calculos';
import { calcularTotalesVenta } from '../../lib/ventas/pdvService';
import { armarDocumento } from '../../lib/presupuestosServicio/documento';

test('mano de obra: calcular costo = horas × valor hora', () => {
    const l = resolverLineaManoObra({ modo: 'costo', horas: 24, valorHora: 18000, importe: 1 });
    assert.equal(l.importe, 432000);
    assert.equal(l.horas, 24);
});

test('mano de obra: calcular tiempo = importe ÷ valor hora', () => {
    const l = resolverLineaManoObra({ modo: 'tiempo', horas: 0, valorHora: 22000, importe: 264000 });
    assert.equal(l.horas, 12);
    assert.equal(l.importe, 264000);
});

test('mano de obra: calcular tiempo sin valor hora conserva las horas', () => {
    const l = resolverLineaManoObra({ modo: 'tiempo', horas: 5, valorHora: 0, importe: 1000 });
    assert.equal(l.horas, 5);
});

test('mano de obra: manual respeta horas e importe', () => {
    const l = resolverLineaManoObra({ modo: 'manual', horas: 6, valorHora: 22000, importe: 150000 });
    assert.deepEqual([l.horas, l.importe], [6, 150000]);
});

test('mano de obra: negativos se llevan a 0', () => {
    const l = resolverLineaManoObra({ modo: 'costo', horas: -3, valorHora: 1000, importe: 0 });
    assert.equal(l.horas, 0);
    assert.equal(l.importe, 0);
});

test('editar el valor calculado pasa la línea a manual', () => {
    assert.equal(modoTrasEditar('costo', 'importe'), 'manual');
    assert.equal(modoTrasEditar('tiempo', 'horas'), 'manual');
    assert.equal(modoTrasEditar('costo', 'horas'), 'costo');
    assert.equal(modoTrasEditar('tiempo', 'importe'), 'tiempo');
    assert.equal(modoTrasEditar('costo', 'valorHora'), 'costo');
});

test('valor hora según lista: neto con IVA discriminado, con IVA si la lista lo incluye', () => {
    assert.equal(valorHoraSegunLista(18000, 21, true), 18000);
    assert.equal(valorHoraSegunLista(18000, 21, false), 21780);
});

const ejemplo = {
    ivaDiscriminado: true,
    descuentoPorcentaje: 0,
    tareas: [
        { descripcion: 'Tendido de bandeja', etiqueta: 'Tendido', manoObra: [
            { categoriaNombre: 'Oficial', modo: 'costo' as const, horas: 24, valorHora: 18000, importe: 0, ivaPorcentaje: 21 },
            { categoriaNombre: 'Ayudante', modo: 'costo' as const, horas: 24, valorHora: 12000, importe: 0, ivaPorcentaje: 21 },
        ] },
        { descripcion: 'Cable subterráneo', etiqueta: 'Tendido', manoObra: [
            { categoriaNombre: 'Oficial', modo: 'costo' as const, horas: 16, valorHora: 18000, importe: 0, ivaPorcentaje: 21 },
            { categoriaNombre: 'Medio oficial', modo: 'costo' as const, horas: 16, valorHora: 15000, importe: 0, ivaPorcentaje: 21 },
        ] },
        { descripcion: 'Conexionado TS-3', etiqueta: 'Montaje', manoObra: [
            { categoriaNombre: 'Oficial especializado', modo: 'tiempo' as const, horas: 0, valorHora: 22000, importe: 264000, ivaPorcentaje: 21 },
        ] },
        { descripcion: 'Pruebas y puesta en servicio', etiqueta: null, manoObra: [
            { categoriaNombre: 'Oficial especializado', modo: 'manual' as const, horas: 6, valorHora: 22000, importe: 150000, ivaPorcentaje: 21 },
        ] },
    ],
    materiales: [
        { descripcion: 'Bandeja 300 mm', cantidad: 18, precioUnitario: 38500, ivaPorcentaje: 21 },
        { descripcion: 'Cable 4x35', cantidad: 120, precioUnitario: 9850, ivaPorcentaje: 21 },
        { descripcion: 'Curva 90°', cantidad: 6, precioUnitario: 21300, ivaPorcentaje: 21 },
        { descripcion: 'Termomagnética 4x63', cantidad: 2, precioUnitario: 96400, ivaPorcentaje: 21 },
        { descripcion: 'Terminal 35', cantidad: 16, precioUnitario: 1450, ivaPorcentaje: 21 },
        { descripcion: 'Grampa', cantidad: 36, precioUnitario: 2150, ivaPorcentaje: 21 },
    ],
};

test('presupuesto del boceto: horas, subtotales, IVA discriminado y total', () => {
    const r = calcularPresupuesto(ejemplo);
    assert.equal(r.horasTotales, 98);
    assert.equal(r.subtotalManoObra, 1662000);
    assert.equal(r.subtotalMateriales, 2296200);
    assert.equal(r.neto, 3958200);
    assert.equal(r.impuestos, 831222);
    assert.equal(r.total, 4789422);
    assert.equal(r.netoManoObra + r.netoMateriales, r.neto);
    assert.deepEqual(r.tareas.map((t) => t.horas), [48, 32, 12, 6]);
});

test('presupuesto con IVA incluido: el total es la suma y el IVA va contenido', () => {
    const r = calcularPresupuesto({ ...ejemplo, ivaDiscriminado: false });
    assert.equal(r.total, 3958200);
    // IVA contenido = total × 21/121, redondeado línea por línea (criterio de Ventas)
    assert.ok(Math.abs(r.impuestos - (3958200 * 21) / 121) < 0.1, `IVA contenido ${r.impuestos}`);
    assert.equal(r.neto, Math.round((r.total - r.impuestos) * 100) / 100);
});

test('descuento global reduce neto e IVA', () => {
    const r = calcularPresupuesto({ ...ejemplo, descuentoPorcentaje: 10 });
    assert.equal(r.descuentoMonto, 395820);
    assert.equal(r.neto, 3562380);
    assert.ok(Math.abs(r.impuestos - 3562380 * 0.21) < 0.05);
});

test('paridad con Ventas: mismos totales que calcularTotalesVenta', () => {
    let semilla = 7;
    const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    for (let caso = 0; caso < 300; caso++) {
        const n = 1 + Math.floor(rnd() * 8);
        const items = Array.from({ length: n }, () => ({
            cantidad: Math.round(rnd() * 5000) / 100,
            precioUnitario: Math.round(rnd() * 1e7) / 100,
            ivaPorcentaje: [0, 10.5, 21, 27][Math.floor(rnd() * 4)],
        }));
        const desc = Math.round(rnd() * 30);
        const ivaDiscriminado = rnd() > 0.5;
        const a = calcularTotalesComerciales(items, desc, 0, { ivaDiscriminado });
        const b = calcularTotalesVenta(
            items.map((it) => ({ ...it, sku: 'X', descripcion: 'X', precioOriginal: it.precioUnitario })),
            desc,
            0,
            { ivaDiscriminado }
        );
        assert.equal(a.subtotal, b.subtotal, `subtotal caso ${caso}`);
        assert.equal(a.descuentoMonto, b.descuentoMonto, `descuento caso ${caso}`);
        assert.equal(a.impuestosMonto, b.impuestosMonto, `IVA caso ${caso}`);
        assert.equal(a.total, b.total, `total caso ${caso}`);
    }
});

test('fechas: validación de AAAA-MM-DD', () => {
    assert.ok(esFecha('2026-11-30'));
    assert.ok(!esFecha('2026-02-30'));
    assert.ok(!esFecha('30/11/2026'));
    assert.ok(!esFecha(null));
});

test('días hábiles: 98 h con 3 operarios a 8 h son 5 días', () => {
    assert.equal(diasHabilesEstimados(98, 3, 8), 5);
    assert.equal(diasHabilesEstimados(24, 3, 8), 1);
    assert.equal(diasHabilesEstimados(0, 3, 8), 0);
});

test('días hábiles: la jornada cambia el plazo (98 h, 3 operarios)', () => {
    assert.equal(diasHabilesEstimados(98, 3, 10), 4, 'jornada de 10 h');
    assert.equal(diasHabilesEstimados(98, 3, 6), 6, 'jornada de 6 h');
    assert.equal(diasHabilesEstimados(98, 3, 0), 5, 'sin jornada se toma 8 h');
});

test('fechas sugeridas: sin fechas tentativas usa la jornada del presupuesto', () => {
    const s = sugerirFechas({ horas: 40, operarios: 1, horasDia: 10, hoy: '2026-11-18' });
    assert.equal(s.diasHabiles, 4);
    assert.equal(s.fechaFin, '2026-11-23');
});

test('documento: el plazo usa las horas por día; sin ellas (copias viejas) usa 8', () => {
    const v: any = {
        version: 1, alcance: null, condiciones: null, fechaInicioTentativa: null, fechaFinTentativa: null,
        operariosSimultaneos: 2, validezDias: 15, listaPrecioNombre: null, ivaDiscriminado: true, descuentoPorcentaje: 0,
        tareas: [{ descripcion: 'T', etiqueta: null, manoObra: [{ categoriaNombre: 'Oficial', modo: 'manual', horas: 48, valorHora: 1, importe: 48, ivaPorcentaje: 21 }] }],
        materiales: [],
    };
    const o = normalizarOpcionesDocumento({ nivel: 1 });
    assert.match(armarDocumento({ ...v, horasDia: 12 }, o).plazo || '', /^2 días hábiles/);
    assert.match(armarDocumento(v, o).plazo || '', /^3 días hábiles/);
});

test('días hábiles: saltea fines de semana', () => {
    // 2026-11-30 es lunes
    assert.equal(finSegunDiasHabiles('2026-11-30', 5), '2026-12-04');
    assert.equal(finSegunDiasHabiles('2026-12-03', 3), '2026-12-07');
    assert.equal(siguienteDiaHabil('2026-11-28'), '2026-11-30');
    assert.equal(contarDiasHabiles('2026-11-30', '2026-12-11'), 10);
});

test('fechas sugeridas: usa las tentativas si son futuras', () => {
    const s = sugerirFechas({ fechaInicioTentativa: '2026-11-30', fechaFinTentativa: '2026-12-04', horas: 98, operarios: 3, hoy: '2026-11-18' });
    assert.deepEqual(s, { fechaInicio: '2026-11-30', fechaFin: '2026-12-04', diasHabiles: 5, ajustado: false });
});

test('fechas sugeridas: si el inicio tentativo pasó, arranca el próximo día hábil y conserva la duración', () => {
    const s = sugerirFechas({ fechaInicioTentativa: '2026-11-02', fechaFinTentativa: '2026-11-06', horas: 98, operarios: 3, hoy: '2026-11-21' });
    assert.equal(s.fechaInicio, '2026-11-23');
    assert.equal(s.fechaFin, '2026-11-27');
    assert.equal(s.diasHabiles, 5);
    assert.equal(s.ajustado, true);
});

test('fechas sugeridas: sin fechas tentativas calcula por horas', () => {
    const s = sugerirFechas({ horas: 40, operarios: 1, hoy: '2026-11-18' });
    assert.equal(s.fechaInicio, '2026-11-18');
    assert.equal(s.fechaFin, '2026-11-24');
});

test('opciones de documento: completa valores faltantes', () => {
    assert.deepEqual(normalizarOpcionesDocumento({ nivel: 3, horas: false }), {
        nivel: 3, cantidades: true, horas: false, tareas: true, plazo: true, condiciones: true,
    });
    assert.equal(normalizarOpcionesDocumento({ nivel: 9 }).nivel, 1);
    assert.equal(normalizarOpcionesDocumento(null).nivel, 1);
});
