/**
 * Regresión: los proyectos SIN presupuesto se listan, editan y reportan igual que antes,
 * y los KPI no cambian por usar el módulo de presupuestos de servicio.
 *
 *   DATABASE_URL=<base de PRUEBA> npx tsx scripts/test-regresion-proyectos-sin-presupuesto.ts
 *
 * Toma una foto de las respuestas reales de las APIs existentes (listado y detalle de proyectos,
 * costos, dashboard y dashboard crudo), usa todo el módulo nuevo y compara.
 */
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { dataLayer } from '../lib/dataLayer';
import { GET as dashboardGET } from '../app/api/dashboard/route';
import { GET as dashboardRawGET } from '../app/api/dashboard/raw/route';
import { GET as costoGET } from '../app/api/projects/[id]/cost/route';
import { crearPresupuesto, enviarPresupuesto, aceptarPresupuesto, crearRevision, rechazarPresupuesto, duplicarPresupuesto } from '../lib/presupuestosServicio/servicio';
import { actualizarCategoria, listarCategorias } from '../lib/presupuestosServicio/manoObra';
import { crearProyectoWizard, guardarBorrador, wizardSchema } from '../lib/proyectos/wizard';
import { calcularDisponibilidad } from '../lib/proyectos/disponibilidad';
import { presupuestadoVsReal } from '../lib/presupuestosServicio/reporte';
import { hoyArgentina, sumarDias } from '../lib/presupuestosServicio/calculos';

const sx = Date.now().toString().slice(-6);
const creados = { presupuestos: [] as string[], proyectos: [] as string[], clientes: [] as string[], operadores: [] as string[], borradores: [] as string[] };

/** Saca los campos que cambian solos con el reloj (no los produce el módulo). */
function estable(x: any): any {
    return JSON.parse(JSON.stringify(x, (k, v) => (k === 'updatedAt' ? undefined : v)));
}

async function foto(legadoId: string) {
    const [dash, raw, costo, lista, detalle] = await Promise.all([
        dashboardGET(new Request('http://localhost/api/dashboard')).then((r) => r.json()),
        dashboardRawGET().then((r) => r.json()),
        costoGET(new Request(`http://localhost/api/projects/${legadoId}/cost`) as any, { params: Promise.resolve({ id: legadoId }) }).then((r) => r.json()),
        dataLayer.getProjects(),
        dataLayer.getProjectById(legadoId),
    ]);
    return { dash: estable(dash), raw: estable(raw), costo: estable(costo), listado: estable(lista.find((p) => p.id === legadoId)), detalle: estable(detalle) };
}

async function main() {
    console.log('=== Regresión: proyectos sin presupuesto ===');
    const op = await prisma.operator.create({ data: { nombreCompleto: `TEST Reg ${sx}`, etiquetas: [], role: 'supervisor' } });
    creados.operadores.push(op.id);
    const usuario = { id: op.id, nombre: op.nombreCompleto };
    const cliente = await prisma.hdbClient.create({ data: { nombre: `TEST Cliente Reg ${sx}` } });
    creados.clientes.push(cliente.id);

    // Proyecto "como hoy": alta por el camino de siempre, con horas, materiales y checklist.
    const legado = await dataLayer.createProject({
        nombre: `TEST Legado ${sx}`, clientId: cliente.id, cliente: cliente.nombre, horasEstimadas: 40, estado: 'activo',
        fechaInicio: hoyArgentina(), fechaFin: sumarDias(hoyArgentina(), 30), tags: [],
    });
    creados.proyectos.push(legado.id);
    await prisma.timeEntry.create({ data: { operatorId: op.id, projectId: legado.id, fecha: hoyArgentina(), horasTrabajadas: 6 } });
    await prisma.project.update({ where: { id: legado.id }, data: { horasConsumidas: 6 } });
    const mat = await prisma.materialProyecto.create({ data: { proyectoId: legado.id, nombre: 'Caño', codigo: `R${sx}`, unidad: 'M', cantidadEntregada: 10, precioVenta: 500 } });
    await prisma.materialUso.create({ data: { materialId: mat.id, cantidadUtilizada: 7, operadorNombre: 'test' } });

    const antes = await foto(legado.id);
    assert.ok(antes.listado, 'el proyecto aparece en el listado');
    for (const k of ['presupuestoServicio', 'proyectoTareas', 'asignacionesOperadores']) {
        assert.ok(!(k in antes.listado), `el listado no suma el campo ${k}`);
        assert.ok(!(k in antes.detalle), `el detalle no suma el campo ${k}`);
    }
    assert.equal(antes.costo.summary.totalHours, 6);
    assert.equal(antes.costo.summary.totalMaterialsCost, 3500);

    // ── Fase A: usar todo el módulo sin crear proyectos ──
    const base = {
        clienteId: cliente.id, clienteNombre: null, alcance: null, condiciones: null, fechaInicioTentativa: null, fechaFinTentativa: null,
        operariosSimultaneos: 1, horasDia: 8, validezDias: 15, listaPrecioId: null, descuentoPorcentaje: 0, notaRevision: null, materiales: [],
        tareas: [{ descripcion: 'Tarea', etiqueta: null, manoObra: [{ categoriaId: null, categoriaNombre: 'Oficial', modo: 'costo' as const, horas: 10, valorHora: 1000, importe: 0, ivaPorcentaje: 21 }] }],
    };
    const a = await crearPresupuesto({ ...base, titulo: `TEST RegA ${sx}` }, usuario);
    const b = await crearPresupuesto({ ...base, titulo: `TEST RegB ${sx}` }, usuario);
    creados.presupuestos.push(a.id, b.id);
    await enviarPresupuesto(a.id, undefined, usuario);
    await crearRevision(a.id, 'cambio', usuario);
    await enviarPresupuesto(a.id, undefined, usuario);
    await aceptarPresupuesto(a.id, { fechaAceptacion: hoyArgentina(), referenciaCliente: null, comentario: null }, usuario);
    await enviarPresupuesto(b.id, undefined, usuario);
    await rechazarPresupuesto(b.id, 'precio', usuario);
    const c = await duplicarPresupuesto(a.id, usuario);
    creados.presupuestos.push(c.id);
    const cat = (await listarCategorias())[0];
    if (cat) await actualizarCategoria(cat.id, { nombre: cat.nombre, valorHora: cat.valorHora, ivaPorcentaje: cat.ivaPorcentaje, orden: cat.orden, activo: cat.activo }, usuario);
    const br = await guardarBorrador(op.id, { paso: 3, datos: { estado: { nombre: 'x' } } });
    creados.borradores.push(br!.id);
    await calcularDisponibilidad({ desde: hoyArgentina(), hasta: sumarDias(hoyArgentina(), 13) });

    const faseA = await foto(legado.id);
    assert.deepEqual(faseA.dash, antes.dash, 'dashboard idéntico');
    assert.deepEqual(faseA.raw, antes.raw, 'dashboard crudo idéntico');
    assert.deepEqual(faseA.costo, antes.costo, 'costo del proyecto idéntico');
    assert.deepEqual(faseA.listado, antes.listado, 'listado idéntico');
    assert.deepEqual(faseA.detalle, antes.detalle, 'detalle idéntico');
    console.log('✓ A. Presupuestos, revisiones, aceptación, rechazo, catálogo, borradores y disponibilidad no cambian ningún KPI');

    // ── Fase B: convertir un presupuesto en un proyecto NUEVO ──
    const nuevo = await crearProyectoWizard(
        wizardSchema.parse({ presupuestoId: a.id, nombre: `TEST Convertido ${sx}`, clientId: cliente.id, fechaInicio: hoyArgentina(), fechaFin: hoyArgentina(), tareas: [{ descripcion: 'Tarea', horasEstimadas: 10 }] }),
        usuario,
        { puedeConvertir: true }
    );
    creados.proyectos.push(nuevo.id);
    const faseB = await foto(legado.id);
    assert.deepEqual(faseB.costo, antes.costo, 'costo del proyecto viejo idéntico');
    assert.deepEqual(faseB.listado, antes.listado, 'el proyecto viejo se lista igual');
    assert.deepEqual(faseB.detalle, antes.detalle, 'detalle del proyecto viejo idéntico');
    // Los indicadores por proyecto del viejo no cambian; los totales suman exactamente el proyecto nuevo.
    const delLegado = (d: any) => JSON.stringify([
        (d.criticalProjects || []).find((x: any) => x.nombre === legado.nombre) || null,
        (d.projectPerformance || []).find((x: any) => x.id === legado.id) || null,
    ]);
    assert.equal(delLegado(faseB.dash), delLegado(antes.dash), 'indicadores del proyecto viejo idénticos');
    if (typeof antes.dash?.health?.totalProjects === 'number') {
        assert.equal(faseB.dash.health.totalProjects, antes.dash.health.totalProjects + 1, 'el total suma solo el proyecto nuevo');
    }
    console.log('✓ B. Al convertir, el proyecto viejo y sus indicadores quedan iguales');

    // ── Edición del proyecto viejo (como el PATCH de /api/projects) ──
    const editado = await dataLayer.updateProject(legado.id, { observaciones: 'editado', horasEstimadas: 44 });
    assert.equal(editado.horasEstimadas, 44);
    assert.equal(editado.observaciones, 'editado');
    assert.equal(await prisma.proyectoTarea.count({ where: { projectId: legado.id } }), 0);
    assert.equal(await prisma.proyectoAsignacion.count({ where: { projectId: legado.id } }), 0);
    assert.deepEqual(await presupuestadoVsReal(legado.id), { tienePresupuesto: false });
    console.log('✓ C. El proyecto viejo se edita igual y no tiene presupuesto, tareas ni equipo');

    console.log('=== OK ===');
}

async function limpiar() {
    const q = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* sigue */ } };
    await q(() => prisma.$transaction([
        prisma.$executeRawUnsafe('ALTER TABLE "PresupuestoServicioSnapshot" DISABLE TRIGGER "PresupuestoServicioSnapshot_inmutable"'),
        prisma.presupuestoServicioSnapshot.deleteMany({ where: { presupuestoId: { in: creados.presupuestos } } }),
        prisma.$executeRawUnsafe('ALTER TABLE "PresupuestoServicioSnapshot" ENABLE TRIGGER "PresupuestoServicioSnapshot_inmutable"'),
    ]));
    await q(() => prisma.presupuestoServicio.deleteMany({ where: { id: { in: creados.presupuestos } } }));
    await q(() => prisma.proyectoBorrador.deleteMany({ where: { id: { in: creados.borradores } } }));
    await q(() => prisma.project.deleteMany({ where: { id: { in: creados.proyectos } } }));
    await q(() => prisma.auditLog.deleteMany({ where: { entityId: { in: [...creados.presupuestos, ...creados.proyectos] } } }));
    await q(() => prisma.hdbClient.deleteMany({ where: { id: { in: creados.clientes } } }));
    await q(() => prisma.operator.deleteMany({ where: { id: { in: creados.operadores } } }));
}

main()
    .catch((e) => { console.error('✗ FALLÓ:', e); process.exitCode = 1; })
    .finally(async () => { await limpiar(); await prisma.$disconnect(); });
