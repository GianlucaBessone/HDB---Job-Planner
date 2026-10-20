import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { DEFAULT_VIEWS, getViewConfig, isViewAllowed } from '../lib/viewAccess';
import { resolverPrecioProducto } from '../lib/ventas/priceRules';
import { buildProductSearchWhere } from '../lib/ventas/skuUtils';

async function main() {
  console.log('=== TEST 1: Verificación de desactivación de /inventario ===');
  const configs = getViewConfig(DEFAULT_VIEWS);
  const rolesToCheck = ['admin', 'qa', 'vendedor', 'supervisor', 'operador'];
  
  for (const role of rolesToCheck) {
    const allowed = isViewAllowed('/inventario', role, 'sidebar', configs);
    console.log(`Rol ${role} acceso a /inventario: ${allowed ? '❌ PERMITIDO' : '✅ DENEGADO'}`);
    assert.equal(allowed, false, `El rol ${role} no debería tener acceso a /inventario`);
  }

  const inventarioConfig = configs.find(c => c.key === '/inventario');
  assert.ok(inventarioConfig, 'Config de /inventario encontrada');
  assert.equal(inventarioConfig.roles.length, 0, 'Roles de /inventario debe ser un array vacío');
  console.log('✅ /inventario desactivada exitosamente en viewAccess para todos los roles.\n');

  console.log('=== TEST 2: Búsqueda y precios en Gestión Comercial (Producto) ===');
  const suffix = Date.now().toString().slice(-5);
  const testSku = `TST-PRV-${suffix}`;
  let testProductId: string | null = null;
  let testListaId: string | null = null;
  let testProjectId: string | null = null;
  let testMaterialId: string | null = null;

  try {
    // 1. Crear Lista de Precios de prueba (+25% sobre base)
    const testLista = await prisma.listaPrecio.create({
      data: {
        codigo: `LP_TEST_${suffix}`,
        nombre: `Lista Test +25% ${suffix}`,
        tipoAjuste: 'RECARGO_BASE',
        valorAjuste: 25,
        ivaDiscriminado: true,
        activo: true,
      }
    });
    testListaId = testLista.id;
    console.log(`- Creada Lista de Precios temporal: ${testLista.nombre}`);

    // 2. Crear Producto de prueba en Gestión Comercial
    const testProd = await prisma.producto.create({
      data: {
        sku: testSku,
        descripcion: `Material de Prueba Provisión ${suffix}`,
        precioBase: 2000,
        activo: true,
      }
    });
    testProductId = testProd.id;
    console.log(`- Creado Producto temporal en Gestión Comercial: ${testProd.sku} ($${testProd.precioBase})`);

    // 3. Crear Proyecto de prueba con aprovisionamiento asignado a la Lista de Precios
    const testProj = await prisma.project.create({
      data: {
        codigoProyecto: `PRJ-TST-${suffix}`,
        nombre: `Proyecto Test Provisión ${suffix}`,
        aprovisionamiento: true,
        listaPrecioId: testLista.id,
      }
    });
    testProjectId = testProj.id;
    console.log(`- Creado Proyecto temporal: ${testProj.nombre} con lista ${testLista.codigo}`);

    // 4. Test: Resolución de precio con Lista de Precios del Proyecto
    const precioCalculadoConLista = resolverPrecioProducto({
      precioBase: testProd.precioBase,
      costo: 0,
    }, testLista);
    console.log(`- Precio base: 2000 | Con lista +25% (Neto s/IVA): ${precioCalculadoConLista.precio}`);
    assert.equal(precioCalculadoConLista.precio, 2500, 'El precio con lista +25% debe ser 2500');

    // 5. Test: Simulación de búsqueda por código exacto y numérico (como en GET /api/materiales-proyecto)
    const upperTerm = testSku.toUpperCase();
    const productoEncontrado = await prisma.producto.findFirst({
      where: {
        activo: true,
        OR: [
          { sku: { equals: upperTerm, mode: 'insensitive' } },
        ]
      }
    });
    assert.ok(productoEncontrado, 'Debe encontrar el producto por SKU en Producto (Gestión Comercial)');
    assert.equal(productoEncontrado?.id, testProd.id);
    console.log('✅ Búsqueda por código en Gestión Comercial exitosa.');

    // 6. Test: Búsqueda con ceros desfasados en productos reales existentes (ej: SKU "00003")
    const prodReal03 = await prisma.producto.findFirst({
      where: {
        activo: true,
        OR: [
          { sku: '00003' },
          { sku: '3' },
        ]
      }
    });
    assert.ok(prodReal03, 'Debe encontrar el producto real "00003"');
    console.log(`- Producto real existente encontrado: SKU ${prodReal03.sku} - "${prodReal03.descripcion}" ($${prodReal03.precioBase})`);

    // 7. Test: Búsqueda multi-token / fuzzy por palabras
    const searchWhere = buildProductSearchWhere('unipolar marron');
    const prodsFuzzy = await prisma.producto.findMany({
      where: {
        activo: true,
        ...searchWhere
      },
      take: 3
    });
    assert.ok(prodsFuzzy.length > 0, 'Búsqueda fuzzy multi-token debe arrojar resultados');
    console.log(`- Búsqueda fuzzy multi-token ("unipolar marron") arrojó ${prodsFuzzy.length} resultados.`);

    // 8. Test: Creación de MaterialProyecto tomando el precio calculado de Gestión Comercial
    const nuevoMaterialProyecto = await prisma.materialProyecto.create({
      data: {
        proyectoId: testProj.id,
        nombre: testProd.descripcion,
        codigo: testProd.sku,
        unidad: 'Unid.',
        cantidadSolicitada: 10,
        cantidadDisponible: 10,
        cantidadEntregada: 0,
        precioVenta: precioCalculadoConLista.precio, // $2500 de Gestión Comercial
      }
    });
    testMaterialId = nuevoMaterialProyecto.id;
    assert.equal(nuevoMaterialProyecto.precioVenta, 2500, 'MaterialProyecto debe tener el precio resuelto de Gestión Comercial ($2500)');
    console.log(`✅ Material cargado en proyecto con precio de Gestión Comercial: $${nuevoMaterialProyecto.precioVenta}`);

  } finally {
    console.log('\n=== LIMPIEZA DE DATOS DE PRUEBA (Sin contaminación) ===');
    if (testMaterialId) {
      await prisma.materialProyecto.deleteMany({ where: { id: testMaterialId } });
      console.log('- Material de proyecto de prueba eliminado.');
    }
    if (testProjectId) {
      await prisma.project.deleteMany({ where: { id: testProjectId } });
      console.log('- Proyecto de prueba eliminado.');
    }
    if (testProductId) {
      await prisma.producto.deleteMany({ where: { id: testProductId } });
      console.log('- Producto de prueba eliminado.');
    }
    if (testListaId) {
      await prisma.listaPrecio.deleteMany({ where: { id: testListaId } });
      console.log('- Lista de precios de prueba eliminada.');
    }
    console.log('✅ Base de datos restaurada limpiamente.');
  }

  console.log('\n🎉 ¡TODAS LAS VERIFICACIONES PASARON CON ÉXITO!');
}

main().catch((err) => {
  console.error('❌ Error en test:', err);
  process.exit(1);
});
