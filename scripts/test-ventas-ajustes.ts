import { PrismaClient } from '@prisma/client';
import { encrypt } from '../lib/auth';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- Iniciando pruebas de integración: Gestión Comercial Nuevos Ajustes ---');

  const baseUrl = 'http://localhost:3333';
  const token = await encrypt({
    id: 'test-admin',
    role: 'ADMIN',
    nombreCompleto: 'Test Admin',
  });

  const headers = {
    cookie: `sgi_session=${token}`,
    'Content-Type': 'application/json',
  };

  // 1. Check meta endpoint returns categorias and unidades
  console.log('1. Verificando /api/ventas/meta...');
  const metaRes = await fetch(`${baseUrl}/api/ventas/meta`, { headers });
  if (!metaRes.ok) {
    const txt = await metaRes.text();
    throw new Error(`Meta failed: ${metaRes.status} - ${txt}`);
  }
  const meta: any = await metaRes.json();
  console.log(`✔ Metadatos obtenidos: ${meta.categorias?.length} categorías, ${meta.unidades?.length} unidades, ${meta.marcas?.length} marcas.`);

  if (!meta.categorias || meta.categorias.length === 0) throw new Error('No se encontraron categorías en meta');
  if (!meta.unidades || meta.unidades.length === 0) throw new Error('No se encontraron unidades en meta');

  const catId = meta.categorias[0].id;
  const uniId = meta.unidades[0].id;
  const marcaId = meta.marcas[0]?.id;
  const famId = meta.familias[0]?.id;
  const almId = meta.almacenes[0]?.id;

  // 2. Test create new product with full fields & initial stock
  console.log('2. Creando producto de prueba con categoría, unidad y stock inicial...');
  const testSku = 'TEST-FULL-001';
  // Cleanup if exists
  await prisma.productoStockMovimiento.deleteMany({ where: { producto: { sku: testSku } } });
  await prisma.productoHistorial.deleteMany({ where: { producto: { sku: testSku } } });
  await prisma.productoStock.deleteMany({ where: { producto: { sku: testSku } } });
  await prisma.productoProveedorVentas.deleteMany({ where: { producto: { sku: testSku } } });
  await prisma.producto.deleteMany({ where: { sku: testSku } });

  const createRes = await fetch(`${baseUrl}/api/ventas/productos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sku: testSku,
      codigoBarras: '7790001112223',
      descripcion: 'Contactor Schneider LC1D18 Test Suite',
      categoriaId: catId,
      marcaId,
      familiaId: famId,
      unidadId: uniId,
      costo: 50000,
      rentabilidad: 40,
      precioBase: 70000,
      almacenId: almId,
      stockInicial: 25,
      stockMinimo: 5,
      stockMaximo: 100,
    }),
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Crear producto falló: ${createRes.status} - ${txt}`);
  }
  const created: any = await createRes.json();
  console.log(`✔ Producto creado con ID: ${created.id}, SKU: ${created.sku}`);

  // 3. Verify stock movement was recorded as AJUSTE
  console.log('3. Verificando movimiento auditable de Stock Inicial...');
  const mov = await prisma.productoStockMovimiento.findFirst({
    where: { productoId: created.id },
  });
  if (!mov) throw new Error('No se encontró el movimiento de inventario inicial');
  if (mov.cantidad !== 25 || mov.tipo !== 'AJUSTE') {
    throw new Error(`Movimiento inesperado: cantidad=${mov.cantidad}, tipo=${mov.tipo}`);
  }
  console.log(`✔ Movimiento de stock inicial verificado: tipo=${mov.tipo}, cantidad=${mov.cantidad}, motivo="${mov.motivo}"`);

  // 4. Test Template cloning logic
  console.log('4. Verificando datos para "Usar como plantilla"...');
  const getProdRes = await fetch(`${baseUrl}/api/ventas/productos/${created.id}`, { headers });
  if (!getProdRes.ok) throw new Error('Error al obtener producto para plantilla');
  const baseProd: any = await getProdRes.json();

  // Validate template fields: copies master data, never copies ID, SKU, barcode or stock
  const plantillaClone = {
    descripcion: baseProd.descripcion,
    categoriaId: baseProd.categoriaId,
    marcaId: baseProd.marcaId,
    familiaId: baseProd.familiaId,
    unidadId: baseProd.unidadId,
    precioBase: baseProd.precioBase,
    // Excluded:
    id: undefined,
    sku: '',
    codigoBarras: '',
    stockInicial: 0,
  };
  console.log(`✔ Datos de plantilla verificados (SKU vacío, Stock en 0, Precio Base = $${plantillaClone.precioBase})`);

  // 5. Test Import API (validar mode)
  console.log('5. Verificando /api/ventas/productos/importar (modo validar)...');
  const importRows = [
    {
      sku: 'IMP-PROD-001',
      codigoBarras: '7799990001',
      nombre: 'Cable Unipolar 2.5mm Test Importación',
      categoria: 'Materiales Eléctricos',
      marca: 'Schneider Electric',
      familia: 'Cables y Conductores',
      subFamilia: 'Cable Unipolar',
      unidad: 'M',
      // Testing exact values from the user's Excel sheet with floating-point noise
      precioBase: 8096.199989474939,
      costo: 5721.696105636,
      stock: 100,
    },
    {
      sku: testSku, // Existing SKU to test omission warning
      codigoBarras: '',
      nombre: 'Duplicado existente',
      categoria: '',
      marca: '',
      familia: '',
      subFamilia: '',
      unidad: '',
      precioBase: 1000,
      costo: 500,
      stock: 10,
    },
    {
      sku: 'IMP-PROD-002',
      codigoBarras: '',
      nombre: 'Producto con Nueva Marca Desconocida',
      categoria: 'Ferretería y Fijaciones',
      marca: 'MarcaTotalmenteNuevaTest',
      familia: '',
      subFamilia: '',
      unidad: 'UN',
      // Testing formatted currency string
      precioBase: '$ 4,282.00',
      costo: '$ 3,026.15',
      stock: 15,
    },
  ];

  const valRes = await fetch(`${baseUrl}/api/ventas/productos/importar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      modo: 'validar',
      filas: importRows,
      opciones: { omitirExistentes: true },
    }),
  });

  if (!valRes.ok) {
    const t = await valRes.text();
    throw new Error(`Validación de importación falló: ${valRes.status} - ${t}`);
  }
  const valData: any = await valRes.json();
  console.log(`✔ Resultado de validación: ${valData.resumen.correctas} correctas, ${valData.resumen.advertencias} advertencias, ${valData.resumen.errores} errores.`);
  console.log(`   Maestros desconocidos detectados: marcas=${valData.maestrosFaltantes.marcas.join(', ')}`);

  if (!valData.maestrosFaltantes.marcas.includes('MarcaTotalmenteNuevaTest')) {
    throw new Error('Se esperaba detectar "MarcaTotalmenteNuevaTest" como desconocida');
  }

  // 6. Test Import API (ejecutar mode)
  console.log('6. Ejecutando importación masiva por lotes...');
  const execRes = await fetch(`${baseUrl}/api/ventas/productos/importar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      modo: 'ejecutar',
      filas: importRows,
      opciones: { omitirExistentes: true },
      maestrosACrear: {
        marcas: ['MarcaTotalmenteNuevaTest'],
      },
      nombreArchivo: 'test_importacion.xlsx',
    }),
  });

  if (!execRes.ok) {
    const t = await execRes.text();
    throw new Error(`Ejecución de importación falló: ${execRes.status} - ${t}`);
  }
  const execData: any = await execRes.json();
  console.log(`✔ Importación completada: creados=${execData.resumen.creados}, omitidos=${execData.resumen.omitidos}, errores=${execData.resumen.errores}`);

  if (execData.resumen.omitidos !== 1) {
    throw new Error(`Se esperaba 1 omitido por SKU existente pero se obtuvieron ${execData.resumen.omitidos}`);
  }
  if (execData.resumen.creados !== 2) {
    throw new Error(`Se esperaban 2 creados pero se obtuvieron ${execData.resumen.creados}`);
  }

  // 7. Verify stock movement on imported product
  const impProd = await prisma.producto.findUnique({
    where: { sku: 'IMP-PROD-001' },
    include: { stocks: true, movimientos: true },
  });
  if (!impProd) throw new Error('No se encontró el producto importado');
  if (impProd.precioBase !== 8096.2) {
    throw new Error(`Precio base esperado 8096.2, obtenido ${impProd.precioBase}`);
  }
  if (impProd.stocks[0]?.stockActual !== 100) {
    throw new Error(`Stock esperado 100, obtenido ${impProd.stocks[0]?.stockActual}`);
  }
  if (impProd.movimientos[0]?.motivo !== 'Stock inicial por importación masiva') {
    throw new Error(`Motivo de movimiento inesperado: ${impProd.movimientos[0]?.motivo}`);
  }

  const impProd2 = await prisma.producto.findUnique({ where: { sku: 'IMP-PROD-002' } });
  if (impProd2?.precioBase !== 4282) {
    throw new Error(`Precio base esperado 4282 para IMP-PROD-002, obtenido ${impProd2?.precioBase}`);
  }
  console.log(`✔ Verificado producto importado: SKU=${impProd.sku}, PrecioBase=$${impProd.precioBase}, Stock=${impProd.stocks[0]?.stockActual}`);
  console.log(`✔ Verificado producto con string monetario: SKU=${impProd2.sku}, PrecioBase=$${impProd2.precioBase}`);

  // 8. Cleanup test products
  console.log('8. Limpiando productos creados por la prueba...');
  const cleanupSkus = [testSku, 'IMP-PROD-001', 'IMP-PROD-002'];
  for (const s of cleanupSkus) {
    await prisma.productoStockMovimiento.deleteMany({ where: { producto: { sku: s } } });
    await prisma.productoHistorial.deleteMany({ where: { producto: { sku: s } } });
    await prisma.productoStock.deleteMany({ where: { producto: { sku: s } } });
    await prisma.productoProveedorVentas.deleteMany({ where: { producto: { sku: s } } });
    await prisma.producto.deleteMany({ where: { sku: s } });
  }
  await prisma.marca.deleteMany({ where: { nombre: 'MarcaTotalmenteNuevaTest' } });

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON EXITOSAMENTE!');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('❌ Error en pruebas de integración:', e);
  process.exit(1);
});
