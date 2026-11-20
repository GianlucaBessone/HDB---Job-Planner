/**
 * Integración: presupuestos de servicio (crear, versionar, enviar, aceptar con copia congelada,
 * rechazar, vencer, duplicar) contra una base real.
 *
 *   DATABASE_URL=<base de PRUEBA> npx tsx scripts/test-presupuestos-integracion.ts
 *
 * ⚠️ Nunca contra producción: la copia congelada es inmutable y la limpieza necesita
 * desactivar el trigger (solo puede el dueño de la tabla).
 */
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import {
    crearPresupuesto,
    actualizarPresupuesto,
    crearRevision,
    enviarPresupuesto,
    aceptarPresupuesto,
    rechazarPresupuesto,
    duplicarPresupuesto,
    descartarPresupuesto,
    obtenerPresupuesto,
    listarPresupuestos,
    marcarVencidos,
    verificarSnapshot,
} from '../lib/presupuestosServicio/servicio';
import { ErrorNegocio } from '../lib/presupuestosServicio/sesion';
import { hoyArgentina, sumarDias } from '../lib/presupuestosServicio/calculos';
import type { ContenidoPresupuestoInput } from '../lib/presupuestosServicio/schemas';

const sufijo = Date.now().toString().slice(-6);
const creados = { presupuestos: [] as string[], clientes: [] as string[], listas: [] as string[], operadores: [] as string[] };

async function esperarError(fn: () => Promise<unknown>, texto: RegExp, msg: string) {
    try {
        await fn();
    } catch (e: any) {
        assert.ok(texto.test(String(e?.message)), `${msg}: mensaje inesperado "${e?.message}"`);
        return e;
    }
    assert.fail(`${msg}: se esperaba un error`);
}

function contenido(clienteId: string, extra: Partial<ContenidoPresupuestoInput> = {}): ContenidoPresupuestoInput {
    return {
        clienteId,
        clienteNombre: null,
        titulo: `TEST Tendido BT ${sufijo}`,
        alcance: 'Tendido de bandeja y cable',
        condiciones: null,
        fechaInicioTentativa: sumarDias(hoyArgentina(), 14),
        fechaFinTentativa: sumarDias(hoyArgentina(), 20),
        operariosSimultaneos: 3,
        horasDia: 8,
        validezDias: 15,
        listaPrecioId: null,
        descuentoPorcentaje: 0,
        notaRevision: null,
        tareas: [
            {
                descripcion: 'Tendido de bandeja',
                etiqueta: 'Tendido',
                manoObra: [
                    { categoriaId: 'mo_oficial', categoriaNombre: 'Oficial', modo: 'costo', horas: 24, valorHora: 18000, importe: 0, ivaPorcentaje: 21 },
                    { categoriaId: 'mo_ayudante', categoriaNombre: 'Ayudante', modo: 'costo', horas: 24, valorHora: 12000, importe: 0, ivaPorcentaje: 21 },
                ],
            },
            {
                descripcion: 'Conexionado',
                etiqueta: 'Montaje',
                manoObra: [{ categoriaId: 'mo_oficial_especializado', categoriaNombre: 'Oficial especializado', modo: 'tiempo', horas: 0, valorHora: 22000, importe: 264000, ivaPorcentaje: 21 }],
            },
        ],
        materiales: [{ productoId: null, sku: 'TST', descripcion: 'Cable 4x35', unidad: 'M', cantidad: 120, precioUnitario: 9850, precioModificado: false, ivaPorcentaje: 21 }],
        ...extra,
    };
}

async function main() {
    console.log('=== Integración: presupuestos de servicio ===');
    const op = await prisma.operator.create({ data: { nombreCompleto: `TEST Supervisor ${sufijo}`, etiquetas: [], role: 'supervisor' } });
    creados.operadores.push(op.id);
    const usuario = { id: op.id, nombre: op.nombreCompleto };

    const lista = await prisma.listaPrecio.create({
        data: { codigo: `TEST_LISTA_${sufijo}`, nombre: `TEST Gremio ${sufijo}`, ivaDiscriminado: true, activo: true },
    });
    creados.listas.push(lista.id);
    const cliente = await prisma.hdbClient.create({ data: { nombre: `TEST Cliente ${sufijo}`, listaPrecioId: lista.id } });
    creados.clientes.push(cliente.id);

    // 1. Crear: numeración, v1 en borrador, lista del cliente y totales
    const p = await crearPresupuesto(contenido(cliente.id), usuario);
    creados.presupuestos.push(p.id);
    assert.match(p.numero, /^PS-\d{4}-\d{6}$/);
    let d = await obtenerPresupuesto(p.id);
    assert.equal(d.estado, 'borrador');
    assert.equal(d.versiones.length, 1);
    const v1 = d.versiones[0];
    assert.equal(v1.listaPrecioId, lista.id, 'toma la lista del cliente');
    assert.equal(v1.ivaDiscriminado, true);
    assert.equal(v1.horasTotales, 60, '24 + 24 + 12 (calculado por costo)');
    assert.equal(v1.subtotalManoObra, 984000);
    assert.equal(v1.subtotalMateriales, 1182000);
    assert.equal(v1.total, Math.round((984000 + 1182000) * 1.21 * 100) / 100);
    assert.equal(v1.tareas[1].manoObra[0].horas, 12, 'modo tiempo: 264000 ÷ 22000');
    console.log('✓ 1. Presupuesto creado', p.numero);

    // 2. Editar el borrador
    await actualizarPresupuesto(p.id, contenido(cliente.id, { descuentoPorcentaje: 10 }), usuario);
    d = await obtenerPresupuesto(p.id);
    assert.equal(d.versiones.length, 1, 'editar un borrador no crea revisión');
    assert.equal(d.versiones[0].descuentoPorcentaje, 10);
    console.log('✓ 2. Borrador editado');

    // 3. Enviar: queda bloqueado y con vencimiento
    await enviarPresupuesto(p.id, { nivel: 3 }, usuario);
    d = await obtenerPresupuesto(p.id);
    assert.equal(d.estado, 'enviado');
    assert.equal(d.versiones[0].estado, 'enviada');
    assert.equal(d.fechaVencimiento, sumarDias(hoyArgentina(), 15));
    assert.equal((d.versiones[0].opcionesDocumento as any).nivel, 3);
    await esperarError(() => actualizarPresupuesto(p.id, contenido(cliente.id), usuario), /borrador/, 'no se edita enviado');
    console.log('✓ 3. Enviado y bloqueado');

    // 4. Nueva revisión: v2 en borrador, v1 intacta y reemplazada
    const totalV1 = d.versiones[0].total;
    await crearRevision(p.id, 'Suma pruebas', usuario);
    await actualizarPresupuesto(p.id, contenido(cliente.id, { descuentoPorcentaje: 0, notaRevision: 'Suma pruebas' }), usuario);
    d = await obtenerPresupuesto(p.id);
    assert.equal(d.versionActual, 2);
    assert.equal(d.estado, 'borrador');
    assert.equal(d.versiones.length, 2);
    const [rev2, rev1] = d.versiones;
    assert.equal(rev2.version, 2);
    assert.equal(rev1.estado, 'reemplazada');
    assert.equal(rev1.total, totalV1, 'la revisión 1 no cambia');
    assert.equal(rev1.descuentoPorcentaje, 10);
    assert.equal(rev2.tareas.length, rev1.tareas.length, 'copia el contenido');
    console.log('✓ 4. Revisión 2 creada; revisión 1 sin cambios');

    // 5. Aceptar: copia congelada con hash válido e inmutable
    await esperarError(() => aceptarPresupuesto(p.id, { fechaAceptacion: hoyArgentina(), referenciaCliente: null, comentario: null }, usuario), /enviado/, 'no se acepta un borrador');
    await enviarPresupuesto(p.id, undefined, usuario);
    await aceptarPresupuesto(p.id, { fechaAceptacion: hoyArgentina(), referenciaCliente: 'OC 123', comentario: 'Por mail' }, usuario);
    d = await obtenerPresupuesto(p.id);
    assert.equal(d.estado, 'aceptado');
    assert.ok(d.snapshot, 'tiene copia congelada');
    assert.equal(d.snapshot!.numeroVersion, 2);
    assert.equal(d.snapshot!.integra, true);
    assert.equal((d.snapshot!.datos as any).totales.horasTotales, 60);
    assert.equal(verificarSnapshot({ datos: { ...(d.snapshot!.datos as any), titulo: 'otro' }, hashSha256: d.snapshot!.hashSha256 }), false, 'detecta alteraciones');
    await esperarError(
        () => prisma.presupuestoServicioSnapshot.update({ where: { id: d.snapshot!.id }, data: { referenciaCliente: 'alterada' } }),
        /inmutable/,
        'el trigger impide modificar la copia'
    );
    await esperarError(() => prisma.presupuestoServicioSnapshot.delete({ where: { id: d.snapshot!.id } }), /inmutable/, 'el trigger impide borrar la copia');
    await esperarError(() => crearRevision(p.id, null, usuario), /aceptado/, 'un aceptado no se revisa');
    await esperarError(() => aceptarPresupuesto(p.id, { fechaAceptacion: hoyArgentina(), referenciaCliente: null, comentario: null }, usuario), /ya fue aceptado/, 'no se acepta dos veces');
    console.log('✓ 5. Aceptado con copia congelada inmutable');

    // 6. Duplicar el aceptado
    const copia = await duplicarPresupuesto(p.id, usuario);
    creados.presupuestos.push(copia.id);
    const dc = await obtenerPresupuesto(copia.id);
    assert.equal(dc.estado, 'borrador');
    assert.equal(dc.versiones[0].tareas.length, 2);
    console.log('✓ 6. Duplicado', copia.numero);

    // 7. Rechazo y revisión posterior
    await enviarPresupuesto(copia.id, undefined, usuario);
    await rechazarPresupuesto(copia.id, 'Precio alto', usuario);
    let dr = await obtenerPresupuesto(copia.id);
    assert.equal(dr.estado, 'rechazado');
    assert.equal(dr.motivoRechazo, 'Precio alto');
    await crearRevision(copia.id, 'Nuevo precio', usuario);
    dr = await obtenerPresupuesto(copia.id);
    assert.equal(dr.estado, 'borrador');
    assert.equal(dr.versiones[1].estado, 'rechazada', 'la revisión rechazada queda como tal');
    console.log('✓ 7. Rechazo y nueva revisión');

    // 8. Vencimiento automático
    await enviarPresupuesto(copia.id, undefined, usuario);
    await prisma.presupuestoServicio.update({ where: { id: copia.id }, data: { fechaVencimiento: sumarDias(hoyArgentina(), -1) } });
    const n = await marcarVencidos();
    assert.ok(n >= 1);
    dr = await obtenerPresupuesto(copia.id);
    assert.equal(dr.estado, 'vencido');
    console.log('✓ 8. Vencido automáticamente');

    // 9. Descartar: solo uno nunca enviado
    const otro = await crearPresupuesto(contenido(cliente.id, { titulo: `TEST descartable ${sufijo}` }), usuario);
    await descartarPresupuesto(otro.id, usuario);
    assert.equal(await prisma.presupuestoServicio.count({ where: { id: otro.id } }), 0);
    await esperarError(() => descartarPresupuesto(copia.id, usuario), /nunca se envió/, 'no se descarta uno enviado');
    console.log('✓ 9. Descarte');

    // 10. Validaciones de negocio
    const sinNada = contenido(cliente.id, { tareas: [], materiales: [] });
    const e = await esperarError(() => crearPresupuesto(sinNada, usuario), /al menos una tarea/, 'exige contenido');
    assert.ok(e instanceof ErrorNegocio);
    console.log('✓ 10. Validaciones');

    // 11. Listado y conteos
    const l = await listarPresupuestos({ q: sufijo });
    assert.ok(l.presupuestos.length >= 2);
    assert.equal(l.conteos.aceptado >= 1, true);
    console.log('✓ 11. Listado');

    // 12. Auditoría
    const aud = await prisma.auditLog.findMany({ where: { entity: 'PRESUPUESTO_SERVICIO', entityId: p.id }, orderBy: { timestamp: 'asc' } });
    const acciones = aud.map((a) => `${a.action}${(a.metadata as any)?.evento ? ':' + (a.metadata as any).evento : ''}`);
    assert.ok(acciones.includes('CREATE'));
    assert.ok(acciones.includes('UPDATE:ENVIO'));
    assert.ok(acciones.includes('UPDATE:NUEVA_REVISION'));
    assert.ok(acciones.includes('APPROVE'));
    assert.ok(aud.every((a) => a.userId === op.id || a.userName === 'Sistema'), 'auditoría con el usuario');
    console.log('✓ 12. Auditoría:', acciones.join(', '));

    console.log('=== OK ===');
}

async function limpiar() {
    try {
        await prisma.$transaction([
            prisma.$executeRawUnsafe('ALTER TABLE "PresupuestoServicioSnapshot" DISABLE TRIGGER "PresupuestoServicioSnapshot_inmutable"'),
            prisma.presupuestoServicioSnapshot.deleteMany({ where: { presupuestoId: { in: creados.presupuestos } } }),
            prisma.$executeRawUnsafe('ALTER TABLE "PresupuestoServicioSnapshot" ENABLE TRIGGER "PresupuestoServicioSnapshot_inmutable"'),
        ]);
    } catch (e) {
        console.warn('No se pudieron borrar las copias congeladas de prueba (hace falta ser dueño de la tabla).');
    }
    await prisma.presupuestoServicio.deleteMany({ where: { id: { in: creados.presupuestos } } }).catch(() => undefined);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: creados.presupuestos } } }).catch(() => undefined);
    await prisma.hdbClient.deleteMany({ where: { id: { in: creados.clientes } } }).catch(() => undefined);
    await prisma.listaPrecio.deleteMany({ where: { id: { in: creados.listas } } }).catch(() => undefined);
    await prisma.operator.deleteMany({ where: { id: { in: creados.operadores } } }).catch(() => undefined);
}

main()
    .catch((e) => {
        console.error('✗ FALLÓ:', e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await limpiar();
        await prisma.$disconnect();
    });
