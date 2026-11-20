/**
 * Integración: convertir un presupuesto aceptado en proyecto (wizard) y reporte presupuestado vs. real.
 *
 *   DATABASE_URL=<base de PRUEBA> npx tsx scripts/test-proyectos-wizard-integracion.ts
 *
 * ⚠️ Nunca contra producción (crea y borra datos de prueba; la copia congelada solo se borra
 * desactivando el trigger, cosa que puede hacer solo el dueño de la tabla).
 */
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { dataLayer } from '../lib/dataLayer';
import { crearPresupuesto, enviarPresupuesto, aceptarPresupuesto } from '../lib/presupuestosServicio/servicio';
import { precargaDesdePresupuesto, crearProyectoWizard, wizardSchema } from '../lib/proyectos/wizard';
import { presupuestadoVsReal } from '../lib/presupuestosServicio/reporte';
import { calcularDisponibilidad } from '../lib/proyectos/disponibilidad';
import { hoyArgentina, sumarDias, siguienteDiaHabil, finSegunDiasHabiles } from '../lib/presupuestosServicio/calculos';

const sx = Date.now().toString().slice(-6);
const creados = { presupuestos: [] as string[], proyectos: [] as string[], clientes: [] as string[], listas: [] as string[], operadores: [] as string[], tags: [] as string[], planning: [] as string[] };

async function esperarError(fn: () => Promise<unknown>, texto: RegExp, msg: string) {
    try { await fn(); } catch (e: any) { assert.ok(texto.test(String(e?.message)), `${msg}: "${e?.message}"`); return e; }
    assert.fail(`${msg}: se esperaba un error`);
}

async function main() {
    console.log('=== Integración: wizard de proyectos y reporte ===');
    const sup = await prisma.operator.create({ data: { nombreCompleto: `TEST Sup ${sx}`, etiquetas: ['Electricista'], role: 'supervisor' } });
    const op2 = await prisma.operator.create({ data: { nombreCompleto: `TEST Oper ${sx}`, etiquetas: ['Ayudante'], role: 'operador' } });
    creados.operadores.push(sup.id, op2.id);
    const usuario = { id: sup.id, nombre: sup.nombreCompleto };
    const lista = await prisma.listaPrecio.create({ data: { codigo: `TSTW_${sx}`, nombre: `TEST Lista ${sx}`, ivaDiscriminado: true } });
    creados.listas.push(lista.id);
    const cliente = await prisma.hdbClient.create({ data: { nombre: `TEST Cliente W ${sx}`, listaPrecioId: lista.id } });
    creados.clientes.push(cliente.id);
    const tag = await prisma.projectTag.create({
        data: { name: `TEST-Tendido-${sx}`, checklists: { create: [{ description: 'Verificar bandeja', order: 1 }, { description: 'Medir aislación', order: 2 }] } },
    });
    creados.tags.push(tag.id);

    const inicio = siguienteDiaHabil(sumarDias(hoyArgentina(), 10));
    const p = await crearPresupuesto({
        clienteId: cliente.id, clienteNombre: null, titulo: `TEST Obra ${sx}`, alcance: 'Alcance de prueba', condiciones: null,
        fechaInicioTentativa: inicio, fechaFinTentativa: null, operariosSimultaneos: 2, horasDia: 10, validezDias: 15, listaPrecioId: null,
        descuentoPorcentaje: 0, notaRevision: null,
        tareas: [
            { descripcion: 'Tendido', etiqueta: tag.name, manoObra: [{ categoriaId: null, categoriaNombre: 'Oficial', modo: 'costo', horas: 40, valorHora: 10000, importe: 0, ivaPorcentaje: 21 }] },
            { descripcion: 'Pruebas', etiqueta: null, manoObra: [{ categoriaId: null, categoriaNombre: 'Oficial', modo: 'costo', horas: 10.5, valorHora: 10000, importe: 0, ivaPorcentaje: 21 }] },
        ],
        materiales: [
            { productoId: null, sku: `T${sx}A`, descripcion: 'Cable', unidad: 'M', cantidad: 100, precioUnitario: 1000, precioModificado: false, ivaPorcentaje: 21 },
            { productoId: null, sku: `T${sx}B`, descripcion: 'Bandeja', unidad: 'UN', cantidad: 10, precioUnitario: 5000, precioModificado: false, ivaPorcentaje: 21 },
        ],
    }, usuario);
    creados.presupuestos.push(p.id);

    // 1. No se convierte un presupuesto que no está aceptado
    await esperarError(() => precargaDesdePresupuesto(p.id), /aceptado/, 'precarga de un borrador');
    await enviarPresupuesto(p.id, undefined, usuario);
    await aceptarPresupuesto(p.id, { fechaAceptacion: hoyArgentina(), referenciaCliente: 'OC 1', comentario: null }, usuario);

    // 2. Precarga desde la copia congelada
    const pre = await precargaDesdePresupuesto(p.id);
    assert.equal(pre.presupuesto.horas, 50.5);
    assert.equal(pre.presupuesto.integra, true);
    assert.equal(pre.sugerido.clientId, cliente.id);
    assert.equal(pre.sugerido.listaPrecioId, lista.id);
    assert.deepEqual(pre.sugerido.tags, [tag.name]);
    assert.equal(pre.sugerido.fechaInicio, inicio);
    assert.equal(pre.sugerido.horasDia, 10, 'jornada del presupuesto');
    // 50,5 h ÷ (2 operarios × 10 h) = 2,5 → 3 días hábiles (con 8 h serían 4)
    assert.equal(pre.sugerido.fechaFin, finSegunDiasHabiles(inicio, 3));
    assert.equal(pre.sugerido.tareas.length, 2);
    assert.equal(pre.sugerido.materiales[0].precioVenta, 1000);
    console.log('✓ 1-2. Precarga', pre.sugerido.fechaInicio, '→', pre.sugerido.fechaFin);

    // 3. Conversión
    const input = wizardSchema.parse({
        presupuestoId: p.id,
        nombre: pre.sugerido.nombre,
        clientId: pre.sugerido.clientId,
        responsableId: sup.id,
        tags: pre.sugerido.tags,
        observaciones: pre.sugerido.observaciones,
        fechaInicio: pre.sugerido.fechaInicio,
        fechaFin: pre.sugerido.fechaFin,
        horasDia: pre.sugerido.horasDia,
        aprovisionamiento: true,
        listaPrecioId: lista.id,
        cargarMateriales: true,
        tareas: [...pre.sugerido.tareas, { descripcion: 'Extra', horasEstimadas: 4, presupuestoTareaId: null }],
        materiales: pre.sugerido.materiales.map((m, i) => (i === 0 ? { ...m, cantidad: 120 } : m)),
        operadores: [sup.id, op2.id],
    });
    await esperarError(() => crearProyectoWizard(input, usuario, { puedeConvertir: false }), /permiso/, 'sin permiso de convertir');
    const proj = await crearProyectoWizard(input, usuario, { puedeConvertir: true });
    creados.proyectos.push(proj.id);
    assert.match(proj.codigoProyecto || '', /^PR-\d{4}-\d{4}$/);
    assert.equal(proj.clientId, cliente.id);
    assert.equal(proj.cliente, cliente.nombre, 'guarda también el nombre (lo usa el dashboard)');
    assert.equal(proj.responsable, sup.nombreCompleto);
    assert.equal(proj.horasEstimadas, 55, '40 + 10,5 + 4 = 54,5 → redondeo a 55');
    assert.equal(proj.estado, 'planificado', 'inicio futuro');
    assert.equal(proj.horasConsumidas, 0);
    const [tareas, mats, asig, checklist, vinc] = await Promise.all([
        prisma.proyectoTarea.findMany({ where: { projectId: proj.id }, orderBy: { orden: 'asc' } }),
        prisma.materialProyecto.findMany({ where: { proyectoId: proj.id }, orderBy: { codigo: 'asc' } }),
        prisma.proyectoAsignacion.findMany({ where: { projectId: proj.id } }),
        prisma.checklistItem.findMany({ where: { projectId: proj.id } }),
        prisma.presupuestoServicio.findUnique({ where: { id: p.id } }),
    ]);
    assert.deepEqual(tareas.map((t) => [t.descripcion, t.horasEstimadas, t.origen]), [['Tendido', 40, 'presupuesto'], ['Pruebas', 10.5, 'presupuesto'], ['Extra', 4, 'manual']]);
    assert.deepEqual(mats.map((m) => [m.codigo, m.cantidadSolicitada, m.precioVenta, m.estado]), [[`T${sx}A`, 120, 1000, 'material_cargado'], [`T${sx}B`, 10, 5000, 'material_cargado']]);
    assert.equal(asig.length, 2);
    assert.ok(asig.every((a) => a.horasDia === 10), 'el equipo queda con la jornada del presupuesto');
    assert.ok(asig.every((a) => a.fechaDesde === input.fechaInicio && a.fechaHasta === input.fechaFin));
    assert.deepEqual(checklist.map((c) => c.description).sort(), ['Medir aislación', 'Verificar bandeja'], 'checklist por etiqueta');
    assert.equal(vinc?.proyectoId, proj.id);
    assert.equal(vinc?.convertidoPorId, sup.id);
    console.log('✓ 3. Proyecto', proj.codigoProyecto, 'con tareas, materiales, equipo, checklist y vínculo');

    // 4. Auditoría
    const audProj = await prisma.auditLog.findFirst({ where: { entity: 'PROJECT', entityId: proj.id, action: 'CREATE' } });
    const audConv = await prisma.auditLog.findFirst({ where: { entity: 'PRESUPUESTO_SERVICIO', entityId: p.id, action: 'CONVERT' } });
    assert.equal(audProj?.userId, sup.id);
    assert.equal((audProj?.metadata as any)?.presupuestoId, p.id);
    assert.equal((audConv?.newValue as any)?.proyectoId, proj.id);
    console.log('✓ 4. Auditoría CREATE (PROJECT) y CONVERT (PRESUPUESTO_SERVICIO) con el usuario');

    // 5. No se convierte dos veces (ni en paralelo)
    const antes = await prisma.project.count();
    await esperarError(() => crearProyectoWizard(input, usuario, { puedeConvertir: true }), /ya se convirtió/, 'segunda conversión');
    assert.equal(await prisma.project.count(), antes, 'no queda un proyecto a medias');
    await esperarError(() => precargaDesdePresupuesto(p.id), /ya se convirtió/, 'precarga de uno convertido');
    console.log('✓ 5. Doble conversión rechazada sin dejar datos a medias');

    // 5b. Dos conversiones simultáneas del mismo presupuesto: gana una sola
    const p2 = await crearPresupuesto({
        clienteId: cliente.id, clienteNombre: null, titulo: `TEST Paralelo ${sx}`, alcance: null, condiciones: null,
        fechaInicioTentativa: null, fechaFinTentativa: null, operariosSimultaneos: 1, horasDia: 8, validezDias: 15, listaPrecioId: null,
        descuentoPorcentaje: 0, notaRevision: null,
        tareas: [{ descripcion: 'Única', etiqueta: null, manoObra: [{ categoriaId: null, categoriaNombre: 'Oficial', modo: 'costo', horas: 8, valorHora: 10000, importe: 0, ivaPorcentaje: 21 }] }],
        materiales: [],
    }, usuario);
    creados.presupuestos.push(p2.id);
    await enviarPresupuesto(p2.id, undefined, usuario);
    await aceptarPresupuesto(p2.id, { fechaAceptacion: hoyArgentina(), referenciaCliente: null, comentario: null }, usuario);
    const in2 = wizardSchema.parse({ presupuestoId: p2.id, nombre: `TEST Paralelo ${sx}`, fechaInicio: hoyArgentina(), fechaFin: hoyArgentina(), tareas: [{ descripcion: 'Única', horasEstimadas: 8 }] });
    const resultados = await Promise.allSettled([1, 2, 3].map(() => crearProyectoWizard(in2, usuario, { puedeConvertir: true })));
    const ok = resultados.filter((x) => x.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    for (const x of ok) creados.proyectos.push(x.value.id);
    assert.equal(ok.length, 1, `tres intentos en paralelo: ${resultados.map((x) => x.status).join(', ')}`);
    assert.equal(await prisma.project.count({ where: { nombre: `TEST Paralelo ${sx}` } }), 1);
    console.log('✓ 5b. Tres conversiones en paralelo: gana una sola');

    // 6. Disponibilidad: el equipo asignado aparece ocupado en otro proyecto
    const disp = await calcularDisponibilidad({ desde: input.fechaInicio, hasta: input.fechaFin });
    const celda = disp.operadores.find((o) => o.id === op2.id)!.celdas[input.fechaInicio];
    assert.equal(celda.tipo, 'ocupado');
    assert.ok(celda.detalle.some((d) => d.includes(proj.codigoProyecto!)));
    const dispExcl = await calcularDisponibilidad({ desde: input.fechaInicio, hasta: input.fechaFin, excluirProyectoId: proj.id });
    assert.equal(dispExcl.operadores.find((o) => o.id === op2.id)!.celdas[input.fechaInicio].tipo, 'libre');
    const plan = await prisma.planning.upsert({
        where: { fecha: input.fechaFin },
        update: {},
        create: { fecha: input.fechaFin, blocks: [{ projectId: 'otro', projectName: 'Otro proyecto', startTime: '08:00', endTime: '12:00', operatorIds: [sup.id], operatorNames: [] }] },
    });
    if (plan.createdAt.getTime() > Date.now() - 60000) creados.planning.push(plan.id);
    const disp2 = await calcularDisponibilidad({ desde: input.fechaFin, hasta: input.fechaFin, excluirProyectoId: proj.id });
    const cSup = disp2.operadores.find((o) => o.id === sup.id)!.celdas[input.fechaFin];
    if (creados.planning.length) assert.equal(cSup.horas, 4, 'toma las horas del bloque de Planificación');
    console.log('✓ 6. Disponibilidad con otros proyectos y Planificación');

    // 7. Reporte presupuestado vs. real
    await prisma.timeEntry.createMany({
        data: [
            { operatorId: sup.id, projectId: proj.id, fecha: input.fechaInicio, horasTrabajadas: 8 },
            { operatorId: op2.id, projectId: proj.id, fecha: input.fechaInicio, horasTrabajadas: 6, isExtra: true },
            { operatorId: op2.id, projectId: proj.id, fecha: input.fechaInicio, horasTrabajadas: 3, isDevolucion: true },
        ],
    });
    await prisma.project.update({ where: { id: proj.id }, data: { horasConsumidas: 20 } }); // 8 + 6×2 (criterio de KPI)
    await prisma.proyectoTarea.updateMany({ where: { projectId: proj.id, descripcion: 'Pruebas' }, data: { completada: true } });
    const cable = mats.find((m) => m.codigo === `T${sx}A`)!;
    const bandeja = mats.find((m) => m.codigo === `T${sx}B`)!;
    await prisma.materialUso.create({ data: { materialId: cable.id, cantidadUtilizada: 50, operadorNombre: 'test' } });
    await prisma.materialProyecto.update({ where: { id: bandeja.id }, data: { cantidadEntregada: 10 } });
    await prisma.materialProyecto.create({ data: { proyectoId: proj.id, nombre: 'Precintos', unidad: 'UN', cantidadEntregada: 100, precioVenta: 10 } });

    const r: any = await presupuestadoVsReal(proj.id);
    assert.equal(r.tienePresupuesto, true);
    assert.equal(r.horas.presupuestadas, 50.5);
    assert.equal(r.horas.proyecto, 54.5);
    assert.equal(r.horas.consumidas, 20);
    assert.ok(Math.abs(r.horas.avance - 10.5 / 54.5) < 1e-9);
    assert.equal(r.horas.proyeccion, Math.round(20 / (10.5 / 54.5)));
    assert.deepEqual(r.horas.operadores.map((o: any) => [o.horas, o.extras]).sort(), [[6, 6], [8, 0]], 'sin devoluciones');
    assert.equal(r.materiales.presupuestado, 150000);
    assert.equal(r.materiales.real, 50 * 1000 + 10 * 5000 + 100 * 10);
    assert.equal(r.materiales.extras.length, 1);
    assert.equal(r.materiales.filas.find((f: any) => f.codigo === `T${sx}A`).desvio, 50000 - 100000);
    assert.equal(r.monto.presupuestado.manoObra, 505000);
    assert.equal(r.monto.presupuestado.total, 655000);
    assert.equal(r.monto.real.manoObra, 200000, '20 h × $ 10.000 de promedio');
    assert.equal(r.monto.real.total, 200000 + 101000);
    console.log('✓ 7. Reporte presupuestado vs. real con valores exactos');

    // 8. Proyecto manual por el asistente (sin presupuesto) y proyecto "como hoy"
    const manual = await crearProyectoWizard(
        wizardSchema.parse({ nombre: `TEST Manual ${sx}`, tags: [tag.name], fechaInicio: hoyArgentina(), fechaFin: hoyArgentina(), horasEstimadas: 12 }),
        usuario,
        { puedeConvertir: false }
    );
    creados.proyectos.push(manual.id);
    assert.equal(manual.horasEstimadas, 12);
    assert.equal(manual.estado, 'activo');
    const viejo = await dataLayer.createProject({ nombre: `TEST Viejo ${sx}`, tags: [tag.name], horasEstimadas: 12 });
    creados.proyectos.push(viejo.id);
    const chkManual = (await prisma.checklistItem.findMany({ where: { projectId: manual.id } })).map((c) => `${c.tag}|${c.description}`).sort();
    const chkViejo = (await prisma.checklistItem.findMany({ where: { projectId: viejo.id } })).map((c) => `${c.tag}|${c.description}`).sort();
    assert.deepEqual(chkManual, chkViejo, 'mismo checklist por etiqueta que el alta de siempre');
    assert.deepEqual(await presupuestadoVsReal(viejo.id), { tienePresupuesto: false });
    console.log('✓ 8. Alta manual por asistente y alta de siempre generan el mismo checklist');

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
    await q(() => prisma.project.deleteMany({ where: { id: { in: creados.proyectos } } }));
    await q(() => prisma.planning.deleteMany({ where: { id: { in: creados.planning } } }));
    await q(() => prisma.auditLog.deleteMany({ where: { entityId: { in: [...creados.presupuestos, ...creados.proyectos] } } }));
    await q(() => prisma.projectTag.deleteMany({ where: { id: { in: creados.tags } } }));
    await q(() => prisma.hdbClient.deleteMany({ where: { id: { in: creados.clientes } } }));
    await q(() => prisma.listaPrecio.deleteMany({ where: { id: { in: creados.listas } } }));
    await q(() => prisma.operator.deleteMany({ where: { id: { in: creados.operadores } } }));
}

main()
    .catch((e) => { console.error('✗ FALLÓ:', e); process.exitCode = 1; })
    .finally(async () => { await limpiar(); await prisma.$disconnect(); });
