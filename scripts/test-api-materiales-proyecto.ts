import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { GET, POST } from '../app/api/materiales-proyecto/route';

async function testApi() {
  console.log('=== TEST SUITE: API /api/materiales-proyecto con Gestión Comercial ===\n');

  const suffix = Date.now().toString().slice(-5);
  let testProductId: string | null = null;
  let testListaId: string | null = null;
  let testProjectId: string | null = null;
  let createdMaterialId: string | null = null;

  try {
    // 1. Crear Lista de Precios de prueba (-10% sobre base)
    const testLista = await prisma.listaPrecio.create({
      data: {
        codigo: `LP_DISC_${suffix}`,
        nombre: `Lista Descuento 10% ${suffix}`,
        tipoAjuste: 'DESCUENTO_BASE',
        valorAjuste: 10,
        ivaDiscriminado: true,
        activo: true,
      }
    });
    testListaId = testLista.id;

    // 2. Crear Producto en Gestión Comercial con SKU estándar de 5 dígitos
    const testSkuNumber = (80000 + Math.floor(Math.random() * 9000)).toString();
    const testSku = `0${testSkuNumber.slice(1)}`; // Ej: 08421
    const unpaddedSearch = testSkuNumber.slice(1).replace(/^0+/, ''); // Ej: 8421

    const testProd = await prisma.producto.create({
      data: {
        sku: testSku,
        descripcion: `Contactor Modular Schneider Test ${suffix}`,
        precioBase: 10000,
        activo: true,
      }
    });
    testProductId = testProd.id;

    // 3. Crear Proyecto con aprovisionamiento y asignado a la Lista de Precios
    const testProj = await prisma.project.create({
      data: {
        codigoProyecto: `PRJ-API-${suffix}`,
        nombre: `Proyecto Test API ${suffix}`,
        aprovisionamiento: true,
        listaPrecioId: testLista.id,
      }
    });
    testProjectId = testProj.id;

    // Test A: Buscar por código desfasado sin ceros (ej: `${unpaddedSearch}` vs `${testSku}`)
    console.log(`- Test A: Búsqueda con desfasaje de ceros (${unpaddedSearch} vs SKU ${testSku})`);
    const reqA = new Request(`http://localhost:3333/api/materiales-proyecto?codigo=${unpaddedSearch}&proyectoId=${testProj.id}`);
    const resA = await GET(reqA);
    assert.equal(resA.status, 200, 'Status debe ser 200');
    const dataA = await resA.json();

    assert.ok(dataA, 'Debe devolver un producto');
    assert.equal(dataA.id, testProd.id, 'Debe ser el producto de prueba');
    assert.equal(dataA.codigo, testProd.sku, 'El código debe ser el SKU');
    console.log(`  Resultado: SKU ${dataA.codigo} | Precio aplicado: $${dataA.precioVenta} (Base: $10000 - 10% = $9000)`);
    assert.equal(dataA.precioVenta, 9000, 'El precio debe ser 9000 según la lista de precios del proyecto');
    assert.ok(Array.isArray(dataA.candidatos), 'Debe incluir la lista de candidatos para autocompletado');
    console.log('  ✅ Test A superado: Búsqueda por código desfasado y cálculo de precio dinámico.');

    // Test B: Búsqueda multi-token por texto/descripción (como PDV)
    console.log('\n- Test B: Búsqueda multi-token ("contactor schneider")');
    const reqB = new Request(`http://localhost:3333/api/materiales-proyecto?q=contactor%20schneider&proyectoId=${testProj.id}`);
    const resB = await GET(reqB);
    assert.equal(resB.status, 200);
    const dataB = await resB.json();
    assert.ok(Array.isArray(dataB.productos), 'Debe retornar array de productos');
    const foundInB = dataB.productos.find((p: any) => p.id === testProd.id);
    assert.ok(foundInB, 'El producto debe figurar en los resultados de búsqueda multi-token');
    assert.equal(foundInB.precioVenta, 9000, 'Precio debe tener aplicada la lista');
    console.log('  ✅ Test B superado: Búsqueda multi-token fuzzy estilo PDV.');

    // Test C: POST para crear material de proyecto con precio automático desde Gestión Comercial
    console.log('\n- Test C: POST crear material de proyecto sin especificar precioVenta');
    const reqC = new Request('http://localhost:3333/api/materiales-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyectoId: testProj.id,
        nombre: testProd.descripcion,
        codigo: testProd.sku,
        unidad: 'Unid.',
        cantidadSolicitada: '5',
        cantidadDisponible: '5',
        cantidadEntregada: '0',
        precioVenta: '', // Vacío para probar auto-resolución
      })
    });
    const resC = await POST(reqC);
    assert.equal(resC.status, 201, 'Status debe ser 201');
    const dataC = await resC.json();
    createdMaterialId = dataC.id;
    assert.equal(dataC.precioVenta, 9000, 'Debe haber resuelto el precio dinámicamente ($9000)');
    console.log(`  Resultado: Material creado en proyecto con precio resuelto: $${dataC.precioVenta}`);
    console.log('  ✅ Test C superado: Creación con precio de Gestión Comercial.');

  } finally {
    console.log('\n=== LIMPIEZA RIGUROSA DE DATOS DE PRUEBA ===');
    if (createdMaterialId) {
      await prisma.materialProyecto.deleteMany({ where: { id: createdMaterialId } });
      console.log('- MaterialProyecto eliminado');
    }
    if (testProjectId) {
      await prisma.project.deleteMany({ where: { id: testProjectId } });
      console.log('- Project eliminado');
    }
    if (testProductId) {
      await prisma.producto.deleteMany({ where: { id: testProductId } });
      console.log('- Producto eliminado');
    }
    if (testListaId) {
      await prisma.listaPrecio.deleteMany({ where: { id: testListaId } });
      console.log('- ListaPrecio eliminada');
    }
    console.log('✅ Base de datos restaurada al 100% sin contaminación.');
  }

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LA API FUERON EXITOSAS!');
}

testApi().catch((e) => {
  console.error('❌ Error en testApi:', e);
  process.exit(1);
});
