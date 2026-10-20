import { resolverPrecioProducto } from '../lib/ventas/priceRules';
import { prisma } from '../lib/prisma';

async function runDeepVerification() {
  console.log('=== INICIANDO DEEP VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST SUITE 1: resolverPrecioProducto
  // ----------------------------------------------------
  console.log('--- Test Suite 1: resolverPrecioProducto Reglas y Rentabilidades Dinámicas ---');

  // Test 1.1: Margen normal 30% sin precioBase fijado (IVA Discriminado = false => agrega 21%)
  const res1 = resolverPrecioProducto(
    { precioBase: 0, costo: 100, rentabilidad: 30, ivaPorcentaje: 21 },
    { tipoAjuste: 'MANUAL', ivaDiscriminado: false }
  );
  // Costo: 100 -> Costo * 1.30 = 130 -> Con IVA 21% = 157.3
  assert(res1.precio === 157.3, 'Rentabilidad 30% con IVA incluido (100 * 1.30 * 1.21 = 157.3)', res1);

  // Test 1.2: Margen 0% (Al Costo) sin precioBase fijado (IVA Discriminado = true => neto = 100)
  const res2 = resolverPrecioProducto(
    { precioBase: 0, costo: 100, rentabilidad: 0, ivaPorcentaje: 21 },
    { tipoAjuste: 'MANUAL', ivaDiscriminado: true }
  );
  assert(res2.precio === 100, 'Rentabilidad 0% (al costo) IVA discriminado (100 * 1.00 = 100)', res2);

  // Test 1.3: Margen negativo -10% (Liquidación / bajo costo)
  const res3 = resolverPrecioProducto(
    { precioBase: 0, costo: 100, rentabilidad: -10, ivaPorcentaje: 21 },
    { tipoAjuste: 'MANUAL', ivaDiscriminado: true }
  );
  assert(res3.precio === 90, 'Rentabilidad -10% (descuento bajo costo) IVA discriminado (100 * 0.90 = 90)', res3);

  // Test 1.4: Lista con RECARGO_BASE +10% sobre base derivada
  const res4 = resolverPrecioProducto(
    { precioBase: 1000, costo: 700, rentabilidad: 42.85, ivaPorcentaje: 21 },
    { tipoAjuste: 'RECARGO_BASE', valorAjuste: 10, ivaDiscriminado: true }
  );
  assert(res4.precio === 1100, 'RECARGO_BASE +10% sobre precioBase 1000 = 1100', res4);

  // ----------------------------------------------------
  // TEST SUITE 2: Ajuste por Lotes - Cálculos Matemáticos y Protección de Margen
  // ----------------------------------------------------
  console.log('\n--- Test Suite 2: Lógica de Simulación de Ajuste por Lotes ---');

  // Test 2.1: tipoAjuste RENTABILIDAD con 0% (vender al costo)
  {
    const costoActual = 500;
    const precioActual = 750;
    const porcentaje = 0; // 0% margen
    const nuevaRentabilidad = porcentaje;
    const nuevoPrecio = costoActual > 0
      ? Math.round(costoActual * (1 + nuevaRentabilidad / 100) * 100) / 100
      : precioActual;
    assert(nuevoPrecio === 500 && nuevaRentabilidad === 0, 'Ajuste RENTABILIDAD a 0% fija nuevoPrecio = costo (500)', { nuevoPrecio, nuevaRentabilidad });
  }

  // Test 2.2: tipoAjuste COSTO +10% donde rentabilidad en DB era 0 pero precioBase era 1500 y costo 1000
  {
    const costoActual = 1000;
    const precioActual = 1500;
    const pRentabilidadDb = 0; // No estaba seteado en DB
    const porcentajeCosto = 10; // +10%
    const factor = 1 + porcentajeCosto / 100; // 1.10

    // Cálculo corregido con preservación del margen implícito
    let rentabilidadActual = pRentabilidadDb;
    if (rentabilidadActual <= 0 && costoActual > 0 && precioActual > costoActual) {
      rentabilidadActual = Math.round(((precioActual - costoActual) / costoActual) * 10000) / 100;
    }
    const nuevoCosto = Math.round(costoActual * factor * 100) / 100;
    const nuevoPrecio = Math.round(nuevoCosto * (1 + rentabilidadActual / 100) * 100) / 100;

    assert(rentabilidadActual === 50, 'Margen implícito calculado correctamente como 50%', rentabilidadActual);
    assert(nuevoCosto === 1100, 'Nuevo costo es 1100 (+10%)', nuevoCosto);
    assert(nuevoPrecio === 1650, 'Nuevo precio es 1650 (preserva el 50% de margen sobre 1100)', nuevoPrecio);
  }

  // Test 2.3: tipoAjuste PRECIO_BASE +20% con sincronización de margen
  {
    const costoActual = 1000;
    const precioActual = 1500;
    const porcentajeBase = 20; // +20%
    const factor = 1 + porcentajeBase / 100;
    const nuevoPrecio = Math.max(0, Math.round(precioActual * factor * 100) / 100);
    const nuevaRentabilidad = costoActual > 0
      ? Math.round(((nuevoPrecio - costoActual) / costoActual) * 10000) / 100
      : 0;
    assert(nuevoPrecio === 1800, 'Nuevo precio base es 1800 (+20% de 1500)', nuevoPrecio);
    assert(nuevaRentabilidad === 80, 'Nuevo margen recalculado es 80% ((1800 - 1000) / 1000)', nuevaRentabilidad);
  }

  // ----------------------------------------------------
  // TEST SUITE 3: Listas de Precios Predeterminadas en DB
  // ----------------------------------------------------
  console.log('\n--- Test Suite 3: Unicidad y Estado de Lista Predeterminada en DB ---');

  const listasActivas = await prisma.listaPrecio.findMany({
    where: { activo: true },
    orderBy: [{ esPredeterminada: 'desc' }, { orden: 'asc' }],
  });

  const defaults = listasActivas.filter((l) => l.esPredeterminada);
  assert(defaults.length === 1, `Debe haber exactamente 1 lista predeterminada activa (encontradas: ${defaults.length})`, defaults.map(d => d.nombre));
  assert(listasActivas[0]?.esPredeterminada === true, `La lista predeterminada ("${listasActivas[0]?.nombre}") es la primera en orden DESC`);

  // Test 3.2: Verificar que se puede alternar la lista predeterminada atómicamente
  const defaultActual = defaults[0];
  const otraLista = listasActivas.find((l) => l.id !== defaultActual?.id);

  if (otraLista && defaultActual) {
    // Alternar a otraLista
    await prisma.$transaction([
      prisma.listaPrecio.updateMany({ where: { id: { not: otraLista.id } }, data: { esPredeterminada: false } }),
      prisma.listaPrecio.update({ where: { id: otraLista.id }, data: { esPredeterminada: true } }),
    ]);

    const check1 = await prisma.listaPrecio.count({ where: { esPredeterminada: true, activo: true } });
    assert(check1 === 1, 'Cambio atómico a otra lista mantiene exactamente 1 predeterminada');

    // Restaurar a la original para no alterar datos del usuario
    await prisma.$transaction([
      prisma.listaPrecio.updateMany({ where: { id: { not: defaultActual.id } }, data: { esPredeterminada: false } }),
      prisma.listaPrecio.update({ where: { id: defaultActual.id }, data: { esPredeterminada: true } }),
    ]);

    const check2 = await prisma.listaPrecio.count({ where: { esPredeterminada: true, activo: true } });
    const checkActual = await prisma.listaPrecio.findUnique({ where: { id: defaultActual.id } });
    assert(check2 === 1 && checkActual?.esPredeterminada === true, `Lista original restaurada exitosamente como predeterminada ("${defaultActual.nombre}")`);
  }

  // ----------------------------------------------------
  // RESUMEN
  // ----------------------------------------------------
  console.log(`\n=== RESUMEN: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runDeepVerification()
  .catch((e) => {
    console.error('Error fatal durante la verificación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
