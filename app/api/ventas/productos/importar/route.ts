import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { parseExcelNumber } from '@/lib/formatCurrency';
import { normalizeSku } from '@/lib/ventas/skuUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modo, filas, opciones = {}, maestrosACrear = {}, correcciones = {}, nombreArchivo = 'productos.xlsx' } = body;

    const userId = req.headers.get('x-user-id') || undefined;

    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas para procesar' }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODO 1: VALIDAR
    // ─────────────────────────────────────────────────────────────────────────
    if (modo === 'validar') {
      // 1. Fetch current database masters in parallel for fast matching
      const [
        marcasDb,
        categoriasDb,
        familiasDb,
        unidadesDb,
        skusDb,
        barcodesDb,
      ] = await Promise.all([
        prisma.marca.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
        prisma.categoria.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
        prisma.familia.findMany({
          where: { activo: true },
          select: {
            id: true,
            nombre: true,
            subfamilias: { where: { activo: true }, select: { id: true, nombre: true } },
          },
        }),
        prisma.unidadMedida.findMany({ where: { activo: true }, select: { id: true, codigo: true, nombre: true } }),
        prisma.producto.findMany({ select: { sku: true } }),
        prisma.producto.findMany({ where: { codigoBarras: { not: null } }, select: { codigoBarras: true } }),
      ]);

      const existingSkusSet = new Set(skusDb.map((p) => p.sku.trim().toUpperCase()));
      const existingBarcodesSet = new Set(
        barcodesDb.filter((p) => p.codigoBarras).map((p) => p.codigoBarras!.trim())
      );

      // Maps for case-insensitive lookup
      const marcasMap = new Map<string, string>(); // lowercase name -> canonical
      marcasDb.forEach((m) => marcasMap.set(m.nombre.trim().toLowerCase(), m.nombre));

      const categoriasMap = new Map<string, string>();
      categoriasDb.forEach((c) => categoriasMap.set(c.nombre.trim().toLowerCase(), c.nombre));

      const familiasMap = new Map<string, { id: string; nombre: string; subfamilias: Map<string, string> }>();
      familiasDb.forEach((f) => {
        const sfMap = new Map<string, string>();
        f.subfamilias.forEach((sf) => sfMap.set(sf.nombre.trim().toLowerCase(), sf.nombre));
        familiasMap.set(f.nombre.trim().toLowerCase(), {
          id: f.id,
          nombre: f.nombre,
          subfamilias: sfMap,
        });
      });

      const unidadesMap = new Map<string, string>(); // lowercase code or name -> canonical code
      unidadesDb.forEach((u) => {
        unidadesMap.set(u.codigo.trim().toLowerCase(), u.codigo);
        unidadesMap.set(u.nombre.trim().toLowerCase(), u.codigo);
      });

      // Track duplicates inside the Excel file
      const seenSkusInFile = new Map<string, number>(); // sku -> first row
      const seenBarcodesInFile = new Map<string, number>(); // barcode -> first row

      // Unknown masters collection
      const marcasDesconocidas = new Set<string>();
      const categoriasDesconocidas = new Set<string>();
      const familiasDesconocidas = new Set<string>();
      const subfamiliasDesconocidas = new Map<string, string>(); // subfam -> fam
      const subfamiliaMismatches = new Set<string>(); // "fam > subfam"
      const unidadesDesconocidas = new Set<string>();

      let correctasCount = 0;
      let advertenciasCount = 0;
      let erroresCount = 0;

      const diagnosticoFilas: any[] = [];

      for (let i = 0; i < filas.length; i++) {
        const fila = filas[i];
        const numFila = i + 2; // Excel row numbering
        const rawSku = normalizeSku(fila.sku);
        const upperSku = rawSku;
        const rawBarcode = fila.codigoBarras ? String(fila.codigoBarras).trim() : '';
        const rawNombre = String(fila.nombre || '').trim();
        const rawCategoria = fila.categoria ? String(fila.categoria).trim() : '';
        const rawMarca = fila.marca ? String(fila.marca).trim() : '';
        const rawFamilia = fila.familia ? String(fila.familia).trim() : '';
        const rawSubFamilia = fila.subFamilia ? String(fila.subFamilia).trim() : '';
        const rawUnidad = fila.unidad ? String(fila.unidad).trim() : '';

        // Numeric parsing
        const numPrecio = parseExcelNumber(fila.precioBase ?? fila.precioVenta);
        const numCosto = parseExcelNumber(fila.costo);
        const numStock = parseExcelNumber(fila.stock);

        const errores: string[] = [];
        const advertencias: string[] = [];

        // 1. Validate SKU
        if (!rawSku) {
          errores.push('SKU interno vacío');
        } else {
          if (seenSkusInFile.has(upperSku)) {
            errores.push(`SKU duplicado en el archivo (fila anterior: ${seenSkusInFile.get(upperSku)})`);
          } else {
            seenSkusInFile.set(upperSku, numFila);
          }

          if (existingSkusSet.has(upperSku)) {
            advertencias.push('El SKU ya existe en el sistema (se omitirá por defecto)');
          }
        }

        // 2. Validate Barcode
        if (rawBarcode) {
          if (seenBarcodesInFile.has(rawBarcode)) {
            errores.push(`Código de barras duplicado en el archivo (fila: ${seenBarcodesInFile.get(rawBarcode)})`);
          } else {
            seenBarcodesInFile.set(rawBarcode, numFila);
          }

          if (existingBarcodesSet.has(rawBarcode)) {
            advertencias.push('Código de barras ya asignado a otro producto en la BD');
          }
        }

        // 3. Validate Nombre
        if (!rawNombre) {
          errores.push('Nombre / Descripción obligatoria');
        }

        // 4. Validate Marca
        if (rawMarca) {
          const canonical = marcasMap.get(rawMarca.toLowerCase());
          if (!canonical) {
            marcasDesconocidas.add(rawMarca);
            advertencias.push(`Marca "${rawMarca}" no registrada en el sistema`);
          }
        }

        // 5. Validate Categoría
        if (rawCategoria) {
          const canonicalCat = categoriasMap.get(rawCategoria.toLowerCase());
          if (!canonicalCat) {
            categoriasDesconocidas.add(rawCategoria);
            advertencias.push(`Categoría "${rawCategoria}" no registrada en el sistema`);
          }
        }

        // 6. Validate Familia & SubFamilia
        if (rawFamilia) {
          const famObj = familiasMap.get(rawFamilia.toLowerCase());
          if (!famObj) {
            familiasDesconocidas.add(rawFamilia);
            advertencias.push(`Familia "${rawFamilia}" no registrada en el sistema`);
            if (rawSubFamilia) {
              subfamiliasDesconocidas.set(rawSubFamilia, rawFamilia);
            }
          } else if (rawSubFamilia) {
            const canonicalSub = famObj.subfamilias.get(rawSubFamilia.toLowerCase());
            if (!canonicalSub) {
              subfamiliaMismatches.add(`"${rawSubFamilia}" no pertenece a "${famObj.nombre}"`);
              advertencias.push(`Sub-Familia "${rawSubFamilia}" no pertenece a la familia "${famObj.nombre}"`);
            }
          }
        } else if (rawSubFamilia) {
          errores.push(`Sub-Familia "${rawSubFamilia}" indicada sin Familia asociada`);
        }

        // 7. Validate Unidad
        if (rawUnidad) {
          const canonicalU = unidadesMap.get(rawUnidad.toLowerCase());
          if (!canonicalU) {
            unidadesDesconocidas.add(rawUnidad);
            advertencias.push(`Unidad "${rawUnidad}" no encontrada en el maestro`);
          }
        }

        // 8. Validate Numbers
        if (isNaN(numPrecio) || numPrecio < 0) {
          errores.push('Precio Base inválido');
        }
        if (isNaN(numCosto) || numCosto < 0) {
          errores.push('Costo inválido');
        }
        if (isNaN(numStock) || numStock < 0) {
          errores.push('Stock inicial inválido');
        }

        // Determine row status
        let estado: 'correcta' | 'advertencia' | 'error' = 'correcta';
        if (errores.length > 0) {
          estado = 'error';
          erroresCount++;
        } else if (advertencias.length > 0) {
          estado = 'advertencia';
          advertenciasCount++;
        } else {
          correctasCount++;
        }

        diagnosticoFilas.push({
          filaNumero: numFila,
          sku: rawSku,
          codigoBarras: rawBarcode,
          nombre: rawNombre,
          categoria: rawCategoria,
          marca: rawMarca,
          familia: rawFamilia,
          subFamilia: rawSubFamilia,
          unidad: rawUnidad,
          precioBase: numPrecio,
          costo: numCosto,
          stock: numStock,
          estado,
          errores,
          advertencias,
        });
      }

      return NextResponse.json({
        resumen: {
          totalFilas: filas.length,
          correctas: correctasCount,
          advertencias: advertenciasCount,
          errores: erroresCount,
        },
        filas: diagnosticoFilas,
        maestrosFaltantes: {
          marcas: Array.from(marcasDesconocidas),
          categorias: Array.from(categoriasDesconocidas),
          familias: Array.from(familiasDesconocidas),
          subfamilias: Array.from(subfamiliasDesconocidas.entries()).map(([sub, fam]) => ({ subfamilia: sub, familia: fam })),
          subfamiliaMismatches: Array.from(subfamiliaMismatches),
          unidades: Array.from(unidadesDesconocidas),
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODO 2: EJECUTAR IMPORTACIÓN
    // ─────────────────────────────────────────────────────────────────────────
    if (modo === 'ejecutar') {
      const omitirExistentes = opciones.omitirExistentes !== false; // default true

      // 1. Create any explicitly authorized new masters first
      if (Array.isArray(maestrosACrear.marcas)) {
        for (const m of maestrosACrear.marcas) {
          if (m && m.trim()) {
            await prisma.marca.upsert({
              where: { nombre: m.trim() },
              update: {},
              create: { nombre: m.trim(), activo: true },
            });
          }
        }
      }

      if (Array.isArray(maestrosACrear.categorias)) {
        for (const c of maestrosACrear.categorias) {
          if (c && c.trim()) {
            await prisma.categoria.upsert({
              where: { nombre: c.trim() },
              update: {},
              create: { nombre: c.trim(), activo: true },
            });
          }
        }
      }

      if (Array.isArray(maestrosACrear.familias)) {
        for (const f of maestrosACrear.familias) {
          if (f && f.trim()) {
            await prisma.familia.upsert({
              where: { nombre: f.trim() },
              update: {},
              create: { nombre: f.trim(), activo: true },
            });
          }
        }
      }

      if (Array.isArray(maestrosACrear.subfamilias)) {
        for (const sf of maestrosACrear.subfamilias) {
          if (sf.familia && sf.subfamilia) {
            const fam = await prisma.familia.upsert({
              where: { nombre: sf.familia.trim() },
              update: {},
              create: { nombre: sf.familia.trim(), activo: true },
            });
            await prisma.subFamilia.upsert({
              where: {
                familiaId_nombre: {
                  familiaId: fam.id,
                  nombre: sf.subfamilia.trim(),
                },
              },
              update: {},
              create: {
                familiaId: fam.id,
                nombre: sf.subfamilia.trim(),
                activo: true,
              },
            });
          }
        }
      }

      if (Array.isArray(maestrosACrear.unidades)) {
        for (const u of maestrosACrear.unidades) {
          if (u && u.trim()) {
            const code = u.trim().toUpperCase().slice(0, 10);
            await prisma.unidadMedida.upsert({
              where: { codigo: code },
              update: {},
              create: { codigo: code, nombre: u.trim(), activo: true },
            });
          }
        }
      }

      // 2. Fetch all fresh masters for lookup
      const [
        marcasDb,
        categoriasDb,
        familiasDb,
        unidadesDb,
        defaultWarehouse,
        defaultIva,
        existingProductsDb,
      ] = await Promise.all([
        prisma.marca.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
        prisma.categoria.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
        prisma.familia.findMany({
          where: { activo: true },
          select: {
            id: true,
            nombre: true,
            subfamilias: { where: { activo: true }, select: { id: true, nombre: true } },
          },
        }),
        prisma.unidadMedida.findMany({ where: { activo: true }, select: { id: true, codigo: true, nombre: true } }),
        prisma.almacen.findFirst({ where: { activo: true, esPredeterminado: true } }) ||
          prisma.almacen.findFirst({ where: { activo: true } }),
        prisma.ivaAlicuota.findFirst({ where: { activo: true, predeterminado: true } }) ||
          prisma.ivaAlicuota.findFirst({ where: { activo: true } }),
        prisma.producto.findMany({ select: { sku: true, codigoBarras: true } }),
      ]);

      const marcasMap = new Map<string, string>(); // lowercase -> id
      marcasDb.forEach((m) => marcasMap.set(m.nombre.trim().toLowerCase(), m.id));

      const categoriasMap = new Map<string, string>();
      categoriasDb.forEach((c) => categoriasMap.set(c.nombre.trim().toLowerCase(), c.id));

      const familiasMap = new Map<string, { id: string; subfamilias: Map<string, string> }>();
      familiasDb.forEach((f) => {
        const sfMap = new Map<string, string>();
        f.subfamilias.forEach((sf) => sfMap.set(sf.nombre.trim().toLowerCase(), sf.id));
        familiasMap.set(f.nombre.trim().toLowerCase(), { id: f.id, subfamilias: sfMap });
      });

      const unidadesMap = new Map<string, string>(); // lowercase -> id
      unidadesDb.forEach((u) => {
        unidadesMap.set(u.codigo.trim().toLowerCase(), u.id);
        unidadesMap.set(u.nombre.trim().toLowerCase(), u.id);
      });

      const existingSkusSet = new Set(existingProductsDb.map((p) => p.sku.trim().toUpperCase()));
      const existingBarcodesSet = new Set(
        existingProductsDb
          .filter((p) => p.codigoBarras)
          .map((p) => p.codigoBarras!.trim())
      );

      const warehouseId = defaultWarehouse?.id || null;
      const ivaId = defaultIva?.id || null;

      let creados = 0;
      let omitidos = 0;
      let errores = 0;
      const reporteDetalles: Array<{ filaNumero: number; sku: string; campo: string; valor: string; motivo: string }> = [];

      // Process rows with concurrency to avoid long-running transactions and timeout issues
      const CONCURRENCY_LIMIT = 5;
      for (let i = 0; i < filas.length; i += CONCURRENCY_LIMIT) {
        const batch = filas.slice(i, i + CONCURRENCY_LIMIT);

        await Promise.all(
          batch.map(async (fila: any, idx: number) => {
            const numFila = fila.filaNumero || (i + idx + 2);
            const sku = normalizeSku(fila.sku);
            const upperSku = sku;

            if (!sku || !fila.nombre) {
              errores++;
              reporteDetalles.push({
                filaNumero: numFila,
                sku: sku || 'S/N',
                campo: 'sku/nombre',
                valor: sku,
                motivo: 'SKU o Nombre vacío',
              });
              return;
            }

            // Check if SKU already exists in database or previous batch
            if (existingSkusSet.has(upperSku)) {
              if (omitirExistentes) {
                omitidos++;
                reporteDetalles.push({
                  filaNumero: numFila,
                  sku,
                  campo: 'sku',
                  valor: sku,
                  motivo: 'SKU ya existente en el catálogo (omitido)',
                });
                return;
              }
            }

            // Reserve SKU immediately in local set
            existingSkusSet.add(upperSku);

            // Resolve Barcode - avoid unique constraint collision
            let codigoBarras = fila.codigoBarras ? String(fila.codigoBarras).trim() : null;
            if (codigoBarras) {
              if (existingBarcodesSet.has(codigoBarras)) {
                reporteDetalles.push({
                  filaNumero: numFila,
                  sku,
                  campo: 'codigoBarras',
                  valor: codigoBarras,
                  motivo: 'Código de barras ya asignado a otro producto; se omitió el código para este ítem',
                });
                codigoBarras = null;
              } else {
                existingBarcodesSet.add(codigoBarras);
              }
            }

            // Resolve Marca
            const rawMarca = fila.marca ? String(fila.marca).trim().toLowerCase() : '';
            const marcaId = marcasMap.get(rawMarca) || null;

            // Resolve Categoria
            const rawCat = fila.categoria ? String(fila.categoria).trim().toLowerCase() : '';
            const categoriaId = categoriasMap.get(rawCat) || null;

            // Resolve Familia & SubFamilia
            const rawFam = fila.familia ? String(fila.familia).trim().toLowerCase() : '';
            const famObj = familiasMap.get(rawFam);
            const familiaId = famObj?.id || null;

            const rawSub = fila.subFamilia ? String(fila.subFamilia).trim().toLowerCase() : '';
            const subFamiliaId = famObj ? famObj.subfamilias.get(rawSub) || null : null;

            // Resolve Unidad
            const rawU = fila.unidad ? String(fila.unidad).trim().toLowerCase() : '';
            const unidadId = unidadesMap.get(rawU) || null;

            const precioBase = parseExcelNumber(fila.precioBase ?? fila.precioVenta);
            const stockInicial = parseExcelNumber(fila.stock);

            try {
              // Each product runs in its own atomic transaction with a safe timeout
              await prisma.$transaction(
                async (tx) => {
                  // 1. Create Producto
                  const nuevoProd = await tx.producto.create({
                    data: {
                      sku,
                      codigoBarras,
                      descripcion: String(fila.nombre).trim(),
                      categoriaId,
                      marcaId,
                      familiaId,
                      subFamiliaId,
                      unidadId,
                      ivaId,
                      rentabilidad: 0,
                      precioBase,
                      activo: true,
                    },
                  });

                  // 2. Register Initial Stock and Movement
                  if (warehouseId) {
                    await tx.productoStock.create({
                      data: {
                        productoId: nuevoProd.id,
                        almacenId: warehouseId,
                        stockActual: stockInicial,
                        stockMinimo: 0,
                        stockMaximo: 0,
                      },
                    });

                    if (stockInicial > 0) {
                      await tx.productoStockMovimiento.create({
                        data: {
                          productoId: nuevoProd.id,
                          almacenId: warehouseId,
                          tipo: 'AJUSTE',
                          cantidad: stockInicial,
                          stockAnterior: 0,
                          stockPosterior: stockInicial,
                          motivo: 'Stock inicial por importación masiva',
                          usuarioId: userId,
                        },
                      });
                    }
                  }

                  // 3. Product History entry
                  await tx.productoHistorial.create({
                    data: {
                      productoId: nuevoProd.id,
                      tipo: 'IMPORTACION_EXCEL',
                      campo: 'producto',
                      valorNuevo: nuevoProd.sku,
                      origen: 'IMPORTACION_EXCEL',
                      detalles: {
                        nombreArchivo,
                        precioBase,
                        stockInicial,
                        filaNumero: numFila,
                      },
                      usuarioId: userId,
                    },
                  });
                },
                {
                  maxWait: 5000,
                  timeout: 15000,
                }
              );

              creados++;
            } catch (err: any) {
              errores++;
              reporteDetalles.push({
                filaNumero: numFila,
                sku,
                campo: 'database',
                valor: sku,
                motivo: err.message || 'Error al persistir fila',
              });
            }
          })
        );
      }

      // 4. Global Audit entry
      await logAudit({
        userId,
        action: 'CREATE',
        entity: 'VENTAS_IMPORTACION_MASIVA',
        newValue: {
          nombreArchivo,
          totalFilas: filas.length,
          creados,
          omitidos,
          errores,
        },
      });

      return NextResponse.json({
        completado: true,
        resumen: {
          totalFilas: filas.length,
          creados,
          omitidos,
          errores,
        },
        reporteDetalles,
      });
    }

    return NextResponse.json({ error: 'Modo no reconocido (validar | ejecutar)' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en importación de productos:', error);
    return NextResponse.json(
      { error: error.message || 'Error en el procesamiento de importación' },
      { status: 500 }
    );
  }
}
