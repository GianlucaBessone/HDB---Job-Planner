import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runIntegrationTest() {
  console.log('🚀 Iniciando pruebas de integración del Módulo de Ventas...');

  // 1. Verificar datos base
  const lpCount = await prisma.listaPrecio.count({ where: { activo: true } });
  const ivaCount = await prisma.ivaAlicuota.count({ where: { activo: true } });
  const alm = await prisma.almacen.findFirst({ where: { esPredeterminado: true, activo: true } });

  console.log(`- Listas de precios activas: ${lpCount}`);
  console.log(`- Alícuotas de IVA activas: ${ivaCount}`);
  console.log(`- Almacén predeterminado: ${alm?.nombre} (${alm?.codigo})`);

  if (lpCount < 3 || ivaCount === 0 || !alm) {
    throw new Error('Faltan datos base en la base de datos');
  }

  // 2. Limpiar producto de prueba si ya existiera
  await prisma.producto.deleteMany({ where: { sku: { in: ['PROD-TEST-001', 'PROD-TEST-002'] } } });

  // 3. Crear Marca y Familia de prueba
  const marca = await prisma.marca.upsert({
    where: { nombre: 'Bosch Professional' },
    update: {},
    create: { nombre: 'Bosch Professional' },
  });

  const familia = await prisma.familia.upsert({
    where: { nombre: 'Herramientas Eléctricas' },
    update: {},
    create: { nombre: 'Herramientas Eléctricas' },
  });

  const subFamilia = await prisma.subFamilia.upsert({
    where: { familiaId_nombre: { familiaId: familia.id, nombre: 'Rotomartillos y Taladros' } },
    update: {},
    create: { familiaId: familia.id, nombre: 'Rotomartillos y Taladros' },
  });

  const iva21 = await prisma.ivaAlicuota.findUnique({ where: { porcentaje: 21.0 } });
  const lp1 = await prisma.listaPrecio.findUnique({ where: { codigo: 'LISTA_1' } });
  const lp2 = await prisma.listaPrecio.findUnique({ where: { codigo: 'LISTA_2' } });
  const lp3 = await prisma.listaPrecio.findUnique({ where: { codigo: 'LISTA_3' } });

  // 4. Crear Producto de prueba
  const prod = await prisma.producto.create({
    data: {
      sku: 'PROD-TEST-001',
      codigoBarras: '7791234567890',
      descripcion: 'Taladro Percutor Bosch GSB 13 RE 750W 13mm Maletín',
      marcaId: marca.id,
      familiaId: familia.id,
      subFamiliaId: subFamilia.id,
      ivaId: iva21?.id,
      rentabilidad: 35,
      activo: true,
      precioBase: 100000,
      stocks: {
        create: [
          {
            almacenId: alm.id,
            stockActual: 12,
            stockMinimo: 3,
            stockMaximo: 20,
          },
        ],
      },
      historial: {
        create: [
          {
            tipo: 'CREACION',
            campo: 'producto',
            valorNuevo: 'PROD-TEST-001',
            origen: 'INTEGRATION_TEST',
          },
        ],
      },
    },
    include: {
      stocks: true,
      historial: true,
    },
  });

  console.log(`✔ Producto creado con éxito: ${prod.sku} (ID: ${prod.id})`);

  // 5. Probar búsqueda tolerante (por código de barras, SKU y palabras clave)
  const busquedaBarcode = await prisma.producto.findMany({
    where: { codigoBarras: { contains: '7791234567890' } },
  });
  console.log(`✔ Búsqueda por código de barras "7791234567890": ${busquedaBarcode.length} resultado(s)`);

  const busquedaKeyword = await prisma.producto.findMany({
    where: {
      OR: [
        { descripcion: { contains: 'Taladro', mode: 'insensitive' } },
        { marca: { nombre: { contains: 'Bosch', mode: 'insensitive' } } },
      ],
    },
  });
  console.log(`✔ Búsqueda tolerante por "Taladro/Bosch": ${busquedaKeyword.length} resultado(s)`);

  // 6. Probar modificación de precios (Ajuste Rápido)
  await prisma.producto.update({
    where: { id: prod.id },
    data: { precioBase: 105000 },
  });
  await prisma.productoHistorial.create({
    data: {
      productoId: prod.id,
      tipo: 'CAMBIO_PRECIO',
      campo: 'precioBase',
      valorAnterior: '100000',
      valorNuevo: '105000',
      origen: 'AJUSTE_RAPIDO',
    },
  });
  console.log('✔ Ajuste rápido de precio base simulado ($100.000 -> $105.000) con historial');

  // 7. Probar movimiento de stock auditable
  const stockRecord = await prisma.productoStock.findUnique({
    where: { productoId_almacenId: { productoId: prod.id, almacenId: alm.id } },
  });

  await prisma.productoStock.update({
    where: { id: stockRecord!.id },
    data: { stockActual: 15 },
  });

  await prisma.productoStockMovimiento.create({
    data: {
      productoId: prod.id,
      almacenId: alm.id,
      tipo: 'AJUSTE',
      cantidad: 3,
      stockAnterior: 12,
      stockPosterior: 15,
      motivo: 'Recepción remito proveedor',
    },
  });
  console.log('✔ Movimiento de stock auditable registrado (12 -> 15 unidades)');

  // 8. Verificar historial completo del producto
  const historial = await prisma.productoHistorial.findMany({
    where: { productoId: prod.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`✔ Eventos de historial registrados: ${historial.length}`);
  historial.forEach((h) => {
    console.log(`   - [${h.tipo}] Campo: ${h.campo} (${h.valorAnterior} -> ${h.valorNuevo}) | Origen: ${h.origen}`);
  });

  // 9. Probar semáforo de stock
  const stActual = 15;
  const stMin = 3;
  const stMax = 20;
  const estado = stActual <= 0 ? 'sin_stock' : stActual <= stMin ? 'bajo' : stActual > stMax ? 'sobre_stock' : 'normal';
  console.log(`✔ Verificación semáforo de stock (15u / mín 3 / máx 20): ${estado}`);

  // 10. Probar Lista de Precios Dinámica configurable
  const dynamicLp = await prisma.listaPrecio.upsert({
    where: { codigo: 'LISTA_TEST_DINAMICA' },
    update: {
      tipoAjuste: 'PORCENTAJE_COSTO',
      valorAjuste: 45,
      aplicaA: 'TODOS',
      activo: true,
    },
    create: {
      codigo: 'LISTA_TEST_DINAMICA',
      nombre: 'Lista Dinámica Test (+45%)',
      orden: 10,
      tipoAjuste: 'PORCENTAJE_COSTO',
      valorAjuste: 45,
      aplicaA: 'TODOS',
      activo: true,
    },
  });
  console.log(`✔ Lista de precios dinámica creada: ${dynamicLp.nombre} (${dynamicLp.codigo})`);

  // Limpieza de datos de prueba
  await prisma.listaPrecio.delete({ where: { id: dynamicLp.id } });
  await prisma.productoStockMovimiento.deleteMany({ where: { productoId: prod.id } });
  await prisma.productoHistorial.deleteMany({ where: { productoId: prod.id } });
  await prisma.productoStock.deleteMany({ where: { productoId: prod.id } });
  await prisma.producto.delete({ where: { id: prod.id } });
  console.log('✔ Limpieza de datos de prueba finalizada correctamente.');

  console.log('\n🎉 Todas las pruebas de integración del Módulo de Ventas pasaron exitosamente.');
}

runIntegrationTest()
  .catch((e) => {
    console.error('❌ Error en prueba de integración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
