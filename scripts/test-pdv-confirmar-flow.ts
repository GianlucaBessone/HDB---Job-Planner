import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import {
  confirmarVentaPDV,
  anularVentaPDV,
  crearRemitoEntrega,
  generarNumeroVenta,
  calcularTotalesVenta,
} from '../lib/ventas/pdvService';

async function main() {
  console.log('=== Iniciando Suite de Pruebas: PDV Confirmar Venta, Remitos y Limpieza ===');

  const suffix = Date.now().toString().slice(-6);
  const createdVentaIds: string[] = [];
  const createdRemitoIds: string[] = [];
  let testClientId = '';
  let testProductId = '';

  try {
    // 1. Obtener datos maestros existentes
    const alm = await prisma.almacen.findFirst({ where: { activo: true } });
    const listaPrecio = await prisma.listaPrecio.findFirst({ where: { activo: true } });
    const operador = await prisma.operator.findFirst({ where: { activo: true } });

    console.log(`- Almacén de prueba: ${alm?.nombre || 'Default'}`);
    console.log(`- Lista de precios: ${listaPrecio?.nombre || 'General'}`);
    console.log(`- Operador / Vendedor: ${operador?.nombreCompleto || 'Ventas HDB'}`);

    // 2. Crear Cliente y Producto temporales para la prueba
    const testClient = await prisma.hdbClient.create({
      data: {
        nombre: `TEST_PDV_CLIENTE_${suffix}`,
        telefono: '11-4444-5555',
        email: `pdv_test_${suffix}@hdb.local`,
        direccion: 'Calle Falsa 123',
        activo: true,
      },
    });
    testClientId = testClient.id;

    const testProd = await prisma.producto.create({
      data: {
        sku: `TST-PDV-${suffix}`,
        descripcion: `Producto Test PDV Automatizado ${suffix}`,
        precioBase: 25000,
        activo: true,
      },
    });
    testProductId = testProd.id;

    console.log(`✔ Cliente de test creado: ID=${testClientId}`);
    console.log(`✔ Producto de test creado: ID=${testProductId}, SKU=${testProd.sku}`);

    // 3. Probar cálculo de totales preciso
    console.log('\n--- Test 1: Cálculo de totales y decimales ---');
    const calculoTest = calcularTotalesVenta(
      [
        {
          productoId: testProductId,
          sku: testProd.sku,
          descripcion: testProd.descripcion,
          cantidad: 2,
          precioOriginal: 25000,
          precioUnitario: 25000,
          descuentoPorcentaje: 10,
          ivaPorcentaje: 21,
        },
      ],
      5, // 5% descuento global
      0
    );
    // 2 * 25000 = 50000; -10% linea = 45000; -5% global = 42750
    assert.equal(calculoTest.subtotalBruto, 50000);
    assert.equal(calculoTest.descuentoLineasTotal, 5000);
    assert.equal(calculoTest.subtotal, 45000);
    assert.equal(calculoTest.descuentoMonto, 2250);
    assert.equal(calculoTest.total, 42750);
    console.log('✔ Test 1 superado: Cálculo de totales con descuentos precisos.');

    // 4. Probar Confirmar Venta estándar (Consumidor Final, Efectivo con Vuelto)
    console.log('\n--- Test 2: Confirmar Venta PDV Consumidor Final con Efectivo y Vuelto ---');
    const venta1 = await confirmarVentaPDV({
      clienteNombre: 'Consumidor Final',
      listaPrecioId: listaPrecio?.id || null,
      almacenId: alm?.id || null,
      vendedorId: operador?.id || null,
      vendedorNombre: operador?.nombreCompleto || 'Vendedor Test',
      items: [
        {
          productoId: testProductId,
          sku: testProd.sku,
          descripcion: testProd.descripcion,
          cantidad: 1,
          precioOriginal: 25000,
          precioUnitario: 25000,
          descuentoPorcentaje: 0,
          ivaPorcentaje: 21,
        },
      ],
      pagos: [
        {
          metodo: 'EFECTIVO',
          monto: 25000,
          montoRecibido: 30000,
          vuelto: 5000,
        },
      ],
    });
    createdVentaIds.push(venta1.id);

    assert.ok(venta1.id);
    assert.ok(venta1.numero.startsWith('VTA-'));
    assert.equal(venta1.total, 25000);
    assert.equal(venta1.totalPagado, 25000);
    assert.equal(venta1.saldoPendiente, 0);
    assert.equal(venta1.estado, 'CONFIRMADA');
    assert.equal(venta1.estadoPago, 'PAGADO');
    assert.equal(venta1.estadoEntrega, 'PENDIENTE');
    assert.equal(venta1.items.length, 1);
    assert.equal(venta1.pagos.length, 1);
    assert.equal(venta1.pagos[0].vuelto, 5000);
    // Validar que listaPrecio esté incluida
    if (listaPrecio) {
      assert.ok(venta1.listaPrecio !== undefined);
    }
    console.log(`✔ Test 2 superado: Venta ${venta1.numero} confirmada exitosamente con vuelto.`);

    // 5. Probar Confirmar Venta con Ítem Manual + Ítem Catálogo + Pago Mixto
    console.log('\n--- Test 3: Venta con Ítem Manual + Ítem Catálogo + Pagos Mixtos ---');
    const venta2 = await confirmarVentaPDV({
      clienteId: testClientId,
      clienteNombre: testClient.nombre,
      clienteIdentificacion: '20-33445566-7',
      listaPrecioId: listaPrecio?.id || null,
      almacenId: alm?.id || null,
      vendedorId: operador?.id || null,
      vendedorNombre: operador?.nombreCompleto || 'Vendedor Test',
      items: [
        {
          productoId: testProductId,
          sku: testProd.sku,
          descripcion: testProd.descripcion,
          cantidad: 1,
          precioOriginal: 25000,
          precioUnitario: 25000,
          descuentoPorcentaje: 0,
          ivaPorcentaje: 21,
        },
        {
          productoId: null,
          esManual: true,
          sku: 'SERV-INSTALACION',
          descripcion: 'Mano de obra técnica en obra',
          cantidad: 1,
          precioOriginal: 15000,
          precioUnitario: 15000,
          descuentoPorcentaje: 0,
          ivaPorcentaje: 21,
        },
      ],
      pagos: [
        {
          metodo: 'EFECTIVO',
          monto: 20000,
          montoRecibido: 20000,
          vuelto: 0,
        },
        {
          metodo: 'TRANSFERENCIA',
          monto: 20000,
          referencia: 'TRF-BANCO-9988',
        },
      ],
    });
    createdVentaIds.push(venta2.id);

    assert.equal(venta2.total, 40000);
    assert.equal(venta2.items.length, 2);
    assert.equal(venta2.pagos.length, 2);
    assert.equal(venta2.estadoPago, 'PAGADO');
    console.log(`✔ Test 3 superado: Venta ${venta2.numero} con ítem manual y pago mixto.`);

    // 6. Probar Generación de Remito de Entrega
    console.log('\n--- Test 4: Generar Remito de Entrega sobre Venta ---');
    const remito = await crearRemitoEntrega({
      ventaId: venta2.id,
      receptorNombre: 'Juan Perez Receptor',
      receptorDni: '33445566',
      items: [
        {
          ventaItemId: venta2.items[0].id,
          cantidad: 1,
        },
      ],
    });
    createdRemitoIds.push(remito.id);

    assert.ok(remito.id);
    assert.ok(remito.numero.startsWith('REM-'));
    assert.equal(remito.items.length, 1);
    assert.equal(remito.receptorNombre, 'Juan Perez Receptor');

    // Verificar que la venta ahora tenga entrega PARCIAL
    const venta2Actualizada = await prisma.venta.findUnique({
      where: { id: venta2.id },
      include: { items: true },
    });
    assert.equal(venta2Actualizada?.estadoEntrega, 'PARCIAL');
    console.log(`✔ Test 4 superado: Remito ${remito.numero} generado y estadoEntrega actualizado a PARCIAL.`);

    // 7. Probar Anulación de Venta con trazabilidad
    console.log('\n--- Test 5: Anular Venta ---');
    const venta1Anulada = await anularVentaPDV(
      venta1.id,
      'Prueba de anulación automatizada de dev senior',
      operador?.id || 'admin',
      operador?.nombreCompleto || 'Admin Tester',
      'ADMIN' // Requiere rol supervisor o admin
    );
    assert.equal(venta1Anulada.estado, 'ANULADA');
    assert.equal(venta1Anulada.motivoAnulacion, 'Prueba de anulación automatizada de dev senior');
    console.log(`✔ Test 5 superado: Venta ${venta1Anulada.numero} anulada correctamente.`);

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE SERVICIO Y FLUJO PDV COMPLETADAS CON ÉXITO!');
  } finally {
    // 8. Limpiar la DB escrupulosamente de los datos creados en el test
    console.log('\n--- Limpiando base de datos de registros temporales de prueba... ---');
    try {
      // Limpiar remitos
      const remitosToDelete = await prisma.remitoEntrega.findMany({
        where: {
          OR: [
            { id: { in: createdRemitoIds } },
            { ventaId: { in: createdVentaIds } },
            { clienteNombre: { startsWith: 'TEST_PDV_CLIENTE_' } },
          ],
        },
        select: { id: true },
      });
      const remitoIds = remitosToDelete.map((r) => r.id);

      if (remitoIds.length > 0) {
        await prisma.remitoEntregaItem.deleteMany({
          where: { remitoId: { in: remitoIds } },
        });
        await prisma.remitoEntrega.deleteMany({
          where: { id: { in: remitoIds } },
        });
        console.log(`✔ Remitos de prueba eliminados: ${remitoIds.length}`);
      }

      // Limpiar ventas
      const ventasToDelete = await prisma.venta.findMany({
        where: {
          OR: [
            { id: { in: createdVentaIds } },
            { clienteNombre: { startsWith: 'TEST_PDV_CLIENTE_' } },
            { items: { some: { sku: { startsWith: 'TST-PDV-' } } } },
          ],
        },
        select: { id: true },
      });
      const vtaIds = ventasToDelete.map((v) => v.id);

      if (vtaIds.length > 0) {
        await prisma.ventaPago.deleteMany({
          where: { ventaId: { in: vtaIds } },
        });
        await prisma.ventaItem.deleteMany({
          where: { ventaId: { in: vtaIds } },
        });
        await prisma.venta.deleteMany({
          where: { id: { in: vtaIds } },
        });
        console.log(`✔ Ventas de prueba eliminadas: ${vtaIds.length}`);
      }

      // Limpiar productos de prueba
      const deletedProds = await prisma.producto.deleteMany({
        where: {
          OR: [
            testProductId ? { id: testProductId } : {},
            { sku: { startsWith: 'TST-PDV-' } },
          ],
        },
      });
      if (deletedProds.count > 0) {
        console.log(`✔ Productos de prueba eliminados: ${deletedProds.count}`);
      }

      // Limpiar clientes de prueba
      const deletedClients = await prisma.hdbClient.deleteMany({
        where: {
          OR: [
            testClientId ? { id: testClientId } : {},
            { nombre: { startsWith: 'TEST_PDV_CLIENTE_' } },
          ],
        },
      });
      if (deletedClients.count > 0) {
        console.log(`✔ Clientes de prueba eliminados: ${deletedClients.count}`);
      }

      // Limpiar logs de auditoría de prueba
      await prisma.auditLog.deleteMany({
        where: {
          entityId: { in: [...createdVentaIds, ...createdRemitoIds, testClientId, testProductId, ...vtaIds, ...remitoIds] },
        },
      }).catch(() => {});

      console.log('✔ Base de datos limpia e íntegra. Cero registros temporales residuales.');
    } catch (cleanupErr: any) {
      console.error('Error durante la limpieza de la base de datos:', cleanupErr.message);
    }

    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Error en suite de pruebas:', err);
  process.exit(1);
});
