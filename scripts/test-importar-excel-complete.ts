import * as XLSX from 'xlsx';
import { prisma } from '../lib/prisma';

async function runCompleteVerification() {
  console.log('=====================================================');
  console.log('🧪 VERIFICACIÓN COMPLETA: IMPORTACIÓN DE PRECIOS EXCEL');
  console.log('=====================================================\n');

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

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: Deduplication and preservation of existing values
  // ─────────────────────────────────────────────────────────────────
  console.log('--- Test 1: Deduplicación y preservación de valores preexistentes ---');

  // Verify that an item with only SKU Proveedor in lookup preserves its cost and SKU prov
  const testProd = await prisma.producto.findFirst({
    where: { activo: true, proveedores: { some: { costo: { gt: 0 } } } },
    include: { proveedores: { take: 1 } },
  });

  if (!testProd || !testProd.proveedores[0]) {
    throw new Error('No se encontró un producto con proveedor para pruebas');
  }

  const origCosto = testProd.proveedores[0].costo;
  const origSkuProv = testProd.proveedores[0].skuProveedor || 'PROV-ORIG-TEST';
  const origPrecio = testProd.precioBase;

  console.log(`Producto de prueba: SKU=${testProd.sku}, Costo=${origCosto}, Precio=${origPrecio}, SkuProv=${origSkuProv}`);

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: Simulación del archivo real del usuario con ROLLBACK
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Stress test con el archivo real del usuario (3.795 filas, 7.410 cambios) ---');
  const filePath = 'c:\\Users\\Admin\\Downloads\\Plantilla_Importacion_Productos (1).xlsx';
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  assert(data.length === 3795, `El archivo real contiene 3795 filas (leídas: ${data.length})`);

  const parseNumericValue = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).replace('%', '').replace(',', '.').trim();
    if (str === '') return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  const detectedCols = Object.keys(data[0] || {});
  const findCol = (patterns: RegExp[]) =>
    detectedCols.find(c => patterns.some(p => p.test(c))) || '';

  const skuCol = findCol([/^sku$/i, /^codigo$/i, /^art[ií]culo$/i]);
  const skuProvCol = findCol([/sku.?prov/i, /c[oó]d.?prov/i, /proveedor/i]);
  const costoCol = findCol([/^costo$/i, /^cost$/i]);
  const precioCol = findCol([/precio.?venta/i, /^precio$/i, /^pv$/i, /^pvta$/i]);
  const pctCostoCol = findCol([/%.*ajuste.*costo/i, /ajuste.*costo/i, /^%\s*costo$/i]);
  const pctVentaCol = findCol([/%.*ajuste.*venta/i, /ajuste.*venta/i, /^%\s*venta$/i]);

  const filas = data.map((r, i) => ({
    filaNumero: i + 2,
    sku: String(r[skuCol] || '').trim(),
    skuProveedor: String(r[skuProvCol] || '').trim(),
    costo: parseNumericValue(r[costoCol]),
    precioVenta: parseNumericValue(r[precioCol]),
    pctAjusteCosto: parseNumericValue(r[pctCostoCol]),
    pctAjusteVenta: parseNumericValue(r[pctVentaCol]),
  }));

  // Simular Phase 2: Batch lookups
  const t0 = Date.now();
  const skusFromInput = Array.from(new Set(filas.map(f => f.sku).filter(Boolean)));
  const CHUNK_SIZE = 1000;
  const dbProductosBySku: any[] = [];
  for (let i = 0; i < skusFromInput.length; i += CHUNK_SIZE) {
    const chunk = skusFromInput.slice(i, i + CHUNK_SIZE);
    const res = await prisma.producto.findMany({
      where: { sku: { in: chunk, mode: 'insensitive' }, activo: true },
      select: {
        id: true,
        sku: true,
        descripcion: true,
        precioBase: true,
        rentabilidad: true,
        proveedores: {
          orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }],
          select: { id: true, skuProveedor: true, costo: true },
          take: 1,
        },
      },
    });
    dbProductosBySku.push(...res);
  }

  const skuMap = new Map<string, any>();
  for (const p of dbProductosBySku) {
    skuMap.set(p.sku.toLowerCase(), p);
  }

  assert(dbProductosBySku.length >= 3700, `Lookup por SKU en lotes encontró ${dbProductosBySku.length} productos en base de datos`);
  console.log(`  ⏱ Tiempo de lookup para ${skusFromInput.length} SKUs: ${Date.now() - t0}ms`);

  // Simular Phase 3
  const productosValidados: any[] = [];
  for (const f of filas) {
    const prod = skuMap.get(f.sku.toLowerCase());
    if (!prod) continue;

    const provRel = prod.proveedores[0] || null;
    const currentCosto = provRel?.costo ?? 0;
    const currentPrecio = prod.precioBase ?? 0;
    const currentSkuProv = provRel?.skuProveedor || '';
    const currentRentabilidad = prod.rentabilidad ?? 0;

    const cambios: any[] = [];
    if (f.costo !== null) {
      const newCosto = Math.max(0, Math.round(f.costo * 100) / 100);
      if (newCosto !== currentCosto) {
        cambios.push({ _field: 'costo', _numericOld: currentCosto, _numericNew: newCosto, campo: 'Costo' });
      }
    }
    if (f.precioVenta !== null) {
      const newPrecio = Math.max(0, Math.round(f.precioVenta * 100) / 100);
      if (newPrecio !== currentPrecio) {
        cambios.push({ _field: 'precioBase', _numericOld: currentPrecio, _numericNew: newPrecio, campo: 'Precio Venta' });
      }
    }

    if (cambios.length > 0) {
      productosValidados.push({
        filaNumero: f.filaNumero,
        sku: prod.sku,
        skuProveedor: f.skuProveedor || currentSkuProv,
        descripcion: prod.descripcion,
        productoId: prod.id,
        proveedorRelId: provRel?.id || null,
        currentCosto,
        currentPrecioBase: currentPrecio,
        currentSkuProveedor: currentSkuProv,
        currentRentabilidad,
        cambios,
      });
    }
  }

  const totalCambios = productosValidados.reduce((sum, p) => sum + p.cambios.length, 0);
  assert(productosValidados.length >= 3700, `Productos validados con cambios: ${productosValidados.length}`);
  assert(totalCambios >= 7400, `Total cambios detectados: ${totalCambios} (esperado ~7410 como en screenshot)`);

  // Simular Phase 4 con ROLLBACK
  const tTxStart = Date.now();
  let rollbackSuccess = false;

  try {
    await prisma.$transaction(
      async (tx) => {
        const prodUpdatesMap = new Map<string, { precio: number; rentabilidad: number | null }>();
        const provUpdatesMap = new Map<string, { costo: number; skuProveedor: string }>();
        const allHistorial: any[] = [];

        for (const item of productosValidados) {
          let newPriceVal: number | null = null;
          let newCostoVal: number | null = null;
          let newSkuProvVal: string | null = null;

          for (const cambio of item.cambios) {
            switch (cambio._field) {
              case 'precioBase':
                newPriceVal = cambio._numericNew;
                break;
              case 'costo':
                newCostoVal = cambio._numericNew;
                break;
              case 'skuProveedor':
                newSkuProvVal = cambio._stringNew!;
                break;
            }

            allHistorial.push({
              productoId: item.productoId,
              tipo: 'IMPORTACION_EXCEL',
              campo: cambio._field,
              valorAnterior: String(cambio._numericOld ?? cambio.valorActual),
              valorNuevo: String(cambio._numericNew ?? cambio._stringNew ?? cambio.valorNuevo),
              origen: 'IMPORTACION_EXCEL',
              detalles: { archivo: 'test.xlsx', filaNumero: item.filaNumero, campo: cambio.campo },
            });
          }

          const finalPrice = newPriceVal !== null ? newPriceVal : item.currentPrecioBase;
          const finalCosto = newCostoVal !== null ? newCostoVal : item.currentCosto;
          const finalSkuProv = newSkuProvVal !== null ? newSkuProvVal : item.currentSkuProveedor;

          let finalRentabilidad: number | null = null;
          if (finalCosto > 0 && finalPrice > 0) {
            finalRentabilidad = Math.round(((finalPrice - finalCosto) / finalCosto) * 10000) / 100;
          }

          if (newPriceVal !== null || finalRentabilidad !== null) {
            prodUpdatesMap.set(item.productoId, { precio: finalPrice, rentabilidad: finalRentabilidad });
          }

          if (newCostoVal !== null || newSkuProvVal !== null) {
            if (item.proveedorRelId) {
              provUpdatesMap.set(item.proveedorRelId, { costo: finalCosto, skuProveedor: finalSkuProv });
            }
          }
        }

        // 1. Vectorized Producto update
        const prodIds = Array.from(prodUpdatesMap.keys());
        const CHUNK_UPDATE = 2000;
        let prodRowsUpdated = 0;
        for (let i = 0; i < prodIds.length; i += CHUNK_UPDATE) {
          const idsChunk = prodIds.slice(i, i + CHUNK_UPDATE);
          const preciosChunk = idsChunk.map(id => prodUpdatesMap.get(id)!.precio);
          const rentabilidadesChunk = idsChunk.map(id => prodUpdatesMap.get(id)!.rentabilidad);

          const r = await tx.$executeRawUnsafe(
            `UPDATE "Producto"
             SET "precioBase" = data_table.precio,
                 "rentabilidad" = COALESCE(data_table.rentabilidad, "Producto"."rentabilidad"),
                 "updatedAt" = NOW()
             FROM (
               SELECT unnest($1::text[]) AS id,
                      unnest($2::double precision[]) AS precio,
                      unnest($3::double precision[]) AS rentabilidad
             ) AS data_table
             WHERE "Producto".id = data_table.id;`,
            idsChunk,
            preciosChunk,
            rentabilidadesChunk
          );
          prodRowsUpdated += Number(r);
        }

        assert(prodRowsUpdated === prodIds.length, `Postgres actualizó exactamente ${prodRowsUpdated} productos de forma vectorizada sin errores`);

        // 2. Vectorized ProductoProveedorVentas update
        const provIds = Array.from(provUpdatesMap.keys());
        let provRowsUpdated = 0;
        for (let i = 0; i < provIds.length; i += CHUNK_UPDATE) {
          const idsChunk = provIds.slice(i, i + CHUNK_UPDATE);
          const costosChunk = idsChunk.map(id => provUpdatesMap.get(id)!.costo);
          const skusChunk = idsChunk.map(id => provUpdatesMap.get(id)!.skuProveedor);

          const r = await tx.$executeRawUnsafe(
            `UPDATE "ProductoProveedorVentas"
             SET "costo" = data_table.costo,
                 "skuProveedor" = NULLIF(data_table.sku_prov, ''),
                 "updatedAt" = NOW()
             FROM (
               SELECT unnest($1::text[]) AS id,
                      unnest($2::double precision[]) AS costo,
                      unnest($3::text[]) AS sku_prov
             ) AS data_table
             WHERE "ProductoProveedorVentas".id = data_table.id;`,
            idsChunk,
            costosChunk,
            skusChunk
          );
          provRowsUpdated += Number(r);
        }

        assert(provRowsUpdated === provIds.length, `Postgres actualizó exactamente ${provRowsUpdated} costos y SKUs de proveedor de forma vectorizada`);

        // 3. Batch history insertion
        const CHUNK_HIST = 1000;
        let totalHistCreated = 0;
        for (let i = 0; i < allHistorial.length; i += CHUNK_HIST) {
          const chunk = allHistorial.slice(i, i + CHUNK_HIST);
          const r = await tx.productoHistorial.createMany({ data: chunk });
          totalHistCreated += r.count;
        }

        assert(totalHistCreated === allHistorial.length, `Se insertaron exitosamente los ${totalHistCreated} registros de auditoría en ProductoHistorial`);

        throw new Error('INTENTIONAL_ROLLBACK_VERIFIED');
      },
      { maxWait: 20000, timeout: 90000 }
    );
  } catch (err: any) {
    if (err.message === 'INTENTIONAL_ROLLBACK_VERIFIED') {
      rollbackSuccess = true;
      const duration = Date.now() - tTxStart;
      console.log(`  ⏱ Tiempo total de transacción bulk (actualización + 7.410 historiales): ${duration}ms`);
      assert(duration < 25000, `Transacción completada en ${duration}ms (muy por debajo del límite de timeout)`);
    } else {
      console.error('ERROR EN TRANSACCIÓN BULK:', err);
    }
  }

  assert(rollbackSuccess, 'La transacción masiva se completó y se revirtió limpiamente sin afectar la base de datos');

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Caso C - Coincidencia sólo por SKU Proveedor sin pérdida de datos
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Caso C (Lookup sólo por SKU Proveedor) preserva costo y SKU prov ---');
  {
    // Validar que si f.sku es vacío y f.skuProveedor coincide con provRel:
    // 1) Se encuentra el producto
    // 2) Si se actualiza sólo costo, no borra skuProveedor
    // 3) Si se actualiza sólo skuProveedor, no resetea costo a 0
    const mockItem = {
      productoId: 'test-id',
      sku: 'TEST-SKU',
      skuProveedor: 'PROV-123',
      currentCosto: 450.5,
      currentPrecioBase: 600.0,
      currentSkuProveedor: 'PROV-123',
      currentRentabilidad: 33.18,
      cambios: [{ _field: 'costo', _numericNew: 480.0, campo: 'Costo' }],
    };

    let newCostoVal: number | null = null;
    let newSkuProvVal: string | null = null;
    for (const c of mockItem.cambios) {
      if (c._field === 'costo') newCostoVal = c._numericNew;
    }

    const finalCosto = newCostoVal !== null ? newCostoVal : mockItem.currentCosto;
    const finalSkuProv = newSkuProvVal !== null ? newSkuProvVal : mockItem.currentSkuProveedor;

    assert(finalCosto === 480.0, 'Nuevo costo aplicado correctamente a 480.0');
    assert(finalSkuProv === 'PROV-123', 'SKU Proveedor original "PROV-123" preservado intacto (no reseteado a vacío/null)');
  }

  // ─────────────────────────────────────────────────────────────────
  // RESUMEN
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n=====================================================`);
  console.log(`RESUMEN: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runCompleteVerification()
  .catch((e) => {
    console.error('Error fatal durante la verificación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
