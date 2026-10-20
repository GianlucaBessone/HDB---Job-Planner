import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Schema ────────────────────────────────────────────────────────

const filaSchema = z.object({
  filaNumero: z.number(),
  sku: z.string().default(''),
  skuProveedor: z.string().default(''),
  costo: z.number().nullable().default(null),
  precioVenta: z.number().nullable().default(null),
  pctAjusteCosto: z.number().nullable().default(null),
  pctAjusteVenta: z.number().nullable().default(null),
});

const importarExcelSchema = z.object({
  filas: z.array(filaSchema).min(1, 'El archivo no contiene filas válidas para procesar'),
  confirmar: z.boolean().default(false),
  nombreArchivo: z.string().optional(),
});

type FilaParsed = z.infer<typeof filaSchema>;

// ── Types for validation results ──────────────────────────────────

interface ErrorItem {
  filaNumero: number;
  sku: string;
  skuProveedor: string;
  motivo: string;
}

interface CambioItem {
  campo: string;
  valorActual: string;
  valorNuevo: string;
  // Internal fields for application
  _field: 'costo' | 'precioBase' | 'skuProveedor';
  _numericOld: number;
  _numericNew: number;
  _stringNew?: string;
}

interface ProductoValidado {
  filaNumero: number;
  sku: string;
  skuProveedor: string;
  descripcion: string;
  productoId: string;
  proveedorRelId: string | null; // ProductoProveedorVentas.id
  currentCosto: number;
  currentPrecioBase: number;
  currentSkuProveedor: string;
  currentRentabilidad: number;
  cambios: CambioItem[];
}

type ProductoWithProv = {
  id: string;
  sku: string;
  descripcion: string;
  precioBase: number;
  rentabilidad: number;
  proveedores: Array<{
    id: string;
    skuProveedor: string | null;
    costo: number;
  }>;
};

// ── Helper: format currency string for display ────────────────────

function fmtARS(val: number): string {
  return `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Main handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filas, confirmar, nombreArchivo } = importarExcelSchema.parse(body);

    const userId = req.headers.get('x-user-id') || undefined;

    // ── Phase 1: Client-side validation (conflicts, missing identifiers) ──

    const errores: ErrorItem[] = [];
    const filasValidas: FilaParsed[] = [];

    for (const f of filas) {
      const cleanSku = (f.sku || '').trim();
      const cleanSkuProv = (f.skuProveedor || '').trim();

      // Caso D: Both empty
      if (!cleanSku && !cleanSkuProv) {
        errores.push({
          filaNumero: f.filaNumero,
          sku: '',
          skuProveedor: '',
          motivo: 'La fila no contiene SKU ni SKU Proveedor para identificar el producto.',
        });
        continue;
      }

      // Conflict: Costo + % Ajuste sobre costo
      if (f.costo !== null && f.pctAjusteCosto !== null) {
        errores.push({
          filaNumero: f.filaNumero,
          sku: cleanSku,
          skuProveedor: cleanSkuProv,
          motivo: 'No se puede informar Costo y % Ajuste sobre costo simultáneamente.',
        });
        continue;
      }

      // Conflict: Precio Venta + % Ajuste sobre venta
      if (f.precioVenta !== null && f.pctAjusteVenta !== null) {
        errores.push({
          filaNumero: f.filaNumero,
          sku: cleanSku,
          skuProveedor: cleanSkuProv,
          motivo: 'No se puede informar Precio Venta y % Ajuste sobre venta simultáneamente.',
        });
        continue;
      }

      filasValidas.push({
        ...f,
        sku: cleanSku,
        skuProveedor: cleanSkuProv,
      });
    }

    // ── Phase 2: Database lookup ──────────────────────────────────

    // Collect SKUs and SKU Proveedores for batch fetch
    const skusFromInput = Array.from(new Set(filasValidas.map(f => f.sku).filter(Boolean)));
    const CHUNK_SIZE = 1000;

    const dbProductosBySku: ProductoWithProv[] = [];
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
            select: {
              id: true,
              skuProveedor: true,
              costo: true,
            },
            take: 1,
          },
        },
      });
      dbProductosBySku.push(...res);
    }

    // Build SKU->Product map
    const skuMap = new Map<string, ProductoWithProv>();
    for (const p of dbProductosBySku) {
      skuMap.set(p.sku.toLowerCase(), p);
    }

    // Fetch products by SKU Proveedor (only for rows that don't have SKU)
    const skuProvsToLookup = filasValidas
      .filter(f => !f.sku && f.skuProveedor)
      .map(f => f.skuProveedor);

    const uniqueSkuProvs = Array.from(new Set(skuProvsToLookup));
    const skuProvMap = new Map<string, ProductoWithProv[]>();

    if (uniqueSkuProvs.length > 0) {
      for (let i = 0; i < uniqueSkuProvs.length; i += CHUNK_SIZE) {
        const chunk = uniqueSkuProvs.slice(i, i + CHUNK_SIZE);
        const dbBySkuProv = await prisma.productoProveedorVentas.findMany({
          where: {
            skuProveedor: { in: chunk, mode: 'insensitive' },
            producto: { activo: true },
          },
          select: {
            id: true,
            skuProveedor: true,
            costo: true,
            producto: {
              select: {
                id: true,
                sku: true,
                descripcion: true,
                precioBase: true,
                rentabilidad: true,
              },
            },
          },
        });

        for (const ppv of dbBySkuProv) {
          const key = (ppv.skuProveedor || '').toLowerCase();
          const existing = skuProvMap.get(key) || [];
          const itemProd: ProductoWithProv = {
            id: ppv.producto.id,
            sku: ppv.producto.sku,
            descripcion: ppv.producto.descripcion,
            precioBase: ppv.producto.precioBase,
            rentabilidad: ppv.producto.rentabilidad,
            proveedores: [{
              id: ppv.id,
              skuProveedor: ppv.skuProveedor,
              costo: ppv.costo,
            }],
          };
          existing.push(itemProd);
          skuProvMap.set(key, existing);

          // Also populate skuMap so product is accessible by its SKU
          if (ppv.producto.sku && !skuMap.has(ppv.producto.sku.toLowerCase())) {
            skuMap.set(ppv.producto.sku.toLowerCase(), itemProd);
          }
        }
      }
    }

    // ── Phase 3: Resolve products and calculate changes ───────────

    const productosValidados: ProductoValidado[] = [];

    for (const f of filasValidas) {
      let prod: ProductoWithProv | null = null;

      // Caso A/B: SKU provided
      if (f.sku) {
        prod = skuMap.get(f.sku.toLowerCase()) || null;
        if (!prod) {
          errores.push({
            filaNumero: f.filaNumero,
            sku: f.sku,
            skuProveedor: f.skuProveedor,
            motivo: `Producto no encontrado por SKU: ${f.sku}`,
          });
          continue;
        }
      }
      // Caso C: Only SKU Proveedor
      else if (f.skuProveedor) {
        const matches = skuProvMap.get(f.skuProveedor.toLowerCase()) || [];
        if (matches.length === 0) {
          errores.push({
            filaNumero: f.filaNumero,
            sku: '',
            skuProveedor: f.skuProveedor,
            motivo: `Producto no encontrado por SKU Proveedor: ${f.skuProveedor}`,
          });
          continue;
        }
        if (matches.length > 1) {
          errores.push({
            filaNumero: f.filaNumero,
            sku: '',
            skuProveedor: f.skuProveedor,
            motivo: `SKU Proveedor "${f.skuProveedor}" está asociado a ${matches.length} productos. Especifique el SKU para desambiguar.`,
          });
          continue;
        }
        prod = matches[0];
      }

      if (!prod) continue;

      const provRel = prod.proveedores[0] || null;
      const currentCosto = provRel?.costo ?? 0;
      const currentPrecio = prod.precioBase ?? 0;
      const currentSkuProv = provRel?.skuProveedor || '';
      const currentRentabilidad = prod.rentabilidad ?? 0;

      const cambios: CambioItem[] = [];

      // SKU Proveedor update (Caso A: update if provided and different)
      if (f.skuProveedor && f.skuProveedor !== currentSkuProv) {
        cambios.push({
          campo: 'SKU Proveedor',
          valorActual: currentSkuProv || '(vacío)',
          valorNuevo: f.skuProveedor,
          _field: 'skuProveedor',
          _numericOld: 0,
          _numericNew: 0,
          _stringNew: f.skuProveedor,
        });
      }

      // Costo: direct value or percentage adjustment
      if (f.costo !== null) {
        const newCosto = Math.max(0, Math.round(f.costo * 100) / 100);
        if (newCosto !== currentCosto) {
          cambios.push({
            campo: 'Costo',
            valorActual: fmtARS(currentCosto),
            valorNuevo: fmtARS(newCosto),
            _field: 'costo',
            _numericOld: currentCosto,
            _numericNew: newCosto,
          });
        }
      } else if (f.pctAjusteCosto !== null) {
        const factor = 1 + f.pctAjusteCosto / 100;
        const newCosto = Math.max(0, Math.round(currentCosto * factor * 100) / 100);
        if (newCosto !== currentCosto) {
          cambios.push({
            campo: 'Costo',
            valorActual: fmtARS(currentCosto),
            valorNuevo: `${fmtARS(newCosto)} (${f.pctAjusteCosto > 0 ? '+' : ''}${f.pctAjusteCosto}%)`,
            _field: 'costo',
            _numericOld: currentCosto,
            _numericNew: newCosto,
          });
        }
      }

      // Precio Venta: direct value or percentage adjustment
      if (f.precioVenta !== null) {
        const newPrecio = Math.max(0, Math.round(f.precioVenta * 100) / 100);
        if (newPrecio !== currentPrecio) {
          cambios.push({
            campo: 'Precio Venta',
            valorActual: fmtARS(currentPrecio),
            valorNuevo: fmtARS(newPrecio),
            _field: 'precioBase',
            _numericOld: currentPrecio,
            _numericNew: newPrecio,
          });
        }
      } else if (f.pctAjusteVenta !== null) {
        const factor = 1 + f.pctAjusteVenta / 100;
        const newPrecio = Math.max(0, Math.round(currentPrecio * factor * 100) / 100);
        if (newPrecio !== currentPrecio) {
          cambios.push({
            campo: 'Precio Venta',
            valorActual: fmtARS(currentPrecio),
            valorNuevo: `${fmtARS(newPrecio)} (${f.pctAjusteVenta > 0 ? '+' : ''}${f.pctAjusteVenta}%)`,
            _field: 'precioBase',
            _numericOld: currentPrecio,
            _numericNew: newPrecio,
          });
        }
      }

      // Only add to validated list if there are actual changes
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

    // ── Build response ────────────────────────────────────────────

    const totalCambios = productosValidados.reduce((sum, p) => sum + p.cambios.length, 0);

    const resumen = {
      totalFilas: filas.length,
      productosEncontrados: filasValidas.length - errores.filter(e =>
        e.motivo.includes('no encontrado') || e.motivo.includes('no contiene')
      ).length,
      productosNoEncontrados: errores.filter(e => e.motivo.includes('no encontrado')).length,
      filasConError: errores.length,
      cambiosPendientes: totalCambios,
    };

    // ── If NOT confirmed: Return validation report ────────────────

    if (!confirmar) {
      return NextResponse.json({
        resumen,
        errores,
        previsualizacion: productosValidados.slice(0, 500).map(p => ({
          filaNumero: p.filaNumero,
          sku: p.sku,
          skuProveedor: p.skuProveedor,
          descripcion: p.descripcion,
          cambios: p.cambios.map(c => ({
            campo: c.campo,
            valorActual: c.valorActual,
            valorNuevo: c.valorNuevo,
          })),
        })),
      });
    }

    // ── If CONFIRMED: Execute updates in transaction ──────────────

    if (productosValidados.length === 0) {
      return NextResponse.json(
        { error: 'No hay registros válidos para aplicar' },
        { status: 400 }
      );
    }

    let totalProductosActualizados = 0;

    // Find fallback provider once if needed
    let defaultProvId: string | null = null;
    const defaultProv = await prisma.proveedorVentas.findFirst({
      where: { activo: true },
      orderBy: { createdAt: 'asc' },
    });
    defaultProvId = defaultProv?.id || null;

    // Build deduplicated maps for PostgreSQL vectorized execution
    // Later rows in the Excel file cleanly override earlier duplicates
    const prodUpdatesMap = new Map<string, { precio: number; rentabilidad: number | null }>();
    const provUpdatesMap = new Map<string, { costo: number; skuProveedor: string }>();
    const newProvRelationsMap = new Map<string, {
      productoId: string;
      proveedorId: string;
      costo: number;
      skuProveedor: string | null;
      esPrincipal: boolean;
      orden: number;
    }>();

    const allHistorial: Array<{
      productoId: string;
      tipo: string;
      campo: string;
      valorAnterior: string;
      valorNuevo: string;
      origen: string;
      detalles: any;
      usuarioId?: string;
    }> = [];

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
          detalles: {
            archivo: nombreArchivo || 'importacion.xlsx',
            filaNumero: item.filaNumero,
            campo: cambio.campo,
          },
          usuarioId: userId,
        });
      }

      // Compute final synchronized values
      const finalPrice = newPriceVal !== null ? newPriceVal : item.currentPrecioBase;
      const finalCosto = newCostoVal !== null ? newCostoVal : item.currentCosto;
      const finalSkuProv = newSkuProvVal !== null ? newSkuProvVal : item.currentSkuProveedor;

      // Recalculate profit margin if price or cost changed
      let finalRentabilidad: number | null = null;
      if (finalCosto > 0 && finalPrice > 0) {
        finalRentabilidad = Math.round(((finalPrice - finalCosto) / finalCosto) * 10000) / 100;
      }

      // 1. Queue Producto update
      if (newPriceVal !== null || finalRentabilidad !== null) {
        prodUpdatesMap.set(item.productoId, {
          precio: finalPrice,
          rentabilidad: finalRentabilidad,
        });
      }

      // 2. Queue ProductoProveedorVentas update
      if (newCostoVal !== null || newSkuProvVal !== null) {
        if (item.proveedorRelId) {
          provUpdatesMap.set(item.proveedorRelId, {
            costo: finalCosto,
            skuProveedor: finalSkuProv,
          });
        } else if (defaultProvId) {
          const relKey = `${item.productoId}_${defaultProvId}`;
          newProvRelationsMap.set(relKey, {
            productoId: item.productoId,
            proveedorId: defaultProvId,
            costo: finalCosto,
            skuProveedor: finalSkuProv || null,
            esPrincipal: true,
            orden: 1,
          });
        }
      }
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          // 1. Bulk update Producto.precioBase and rentabilidad via PostgreSQL unnest
          const prodIds = Array.from(prodUpdatesMap.keys());
          if (prodIds.length > 0) {
            const CHUNK_UPDATE = 2000;
            for (let i = 0; i < prodIds.length; i += CHUNK_UPDATE) {
              const idsChunk = prodIds.slice(i, i + CHUNK_UPDATE);
              const preciosChunk = idsChunk.map(id => prodUpdatesMap.get(id)!.precio);
              const rentabilidadesChunk = idsChunk.map(id => prodUpdatesMap.get(id)!.rentabilidad);

              await tx.$executeRawUnsafe(
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
            }
          }

          // 2. Bulk update ProductoProveedorVentas via PostgreSQL unnest
          const provIds = Array.from(provUpdatesMap.keys());
          if (provIds.length > 0) {
            const CHUNK_UPDATE = 2000;
            for (let i = 0; i < provIds.length; i += CHUNK_UPDATE) {
              const idsChunk = provIds.slice(i, i + CHUNK_UPDATE);
              const costosChunk = idsChunk.map(id => provUpdatesMap.get(id)!.costo);
              const skusChunk = idsChunk.map(id => provUpdatesMap.get(id)!.skuProveedor);

              await tx.$executeRawUnsafe(
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
            }
          }

          // 3. Bulk insert new provider relationships (with duplicate skip protection)
          const newProvList = Array.from(newProvRelationsMap.values());
          if (newProvList.length > 0) {
            const CHUNK_CREATE = 1000;
            for (let i = 0; i < newProvList.length; i += CHUNK_CREATE) {
              const chunk = newProvList.slice(i, i + CHUNK_CREATE);
              await tx.productoProveedorVentas.createMany({
                data: chunk,
                skipDuplicates: true,
              });
            }
          }

          // 4. Bulk insert ProductoHistorial in chunks of 1000
          if (allHistorial.length > 0) {
            const CHUNK_HIST = 1000;
            for (let i = 0; i < allHistorial.length; i += CHUNK_HIST) {
              const chunk = allHistorial.slice(i, i + CHUNK_HIST);
              await tx.productoHistorial.createMany({
                data: chunk,
              });
            }
          }
        },
        {
          maxWait: 20000,
          timeout: 90000,
        }
      );

      totalProductosActualizados = productosValidados.length;
    } catch (bulkError: any) {
      console.error('Error en actualización masiva ultrarrápida, ejecutando fallback por lotes:', bulkError);

      // Resilient Fallback: chunk by 100 products per transaction to prevent WAN roundtrip timeout
      const BATCH_SIZE = 100;
      for (let i = 0; i < productosValidados.length; i += BATCH_SIZE) {
        const batch = productosValidados.slice(i, i + BATCH_SIZE);
        try {
          await prisma.$transaction(
            async (tx) => {
              for (const item of batch) {
                const productoUpdate: Record<string, any> = {};
                let costoUpdate: { id?: string | null; costo?: number; skuProveedor?: string } | null = null;
                const itemHistorial: any[] = [];

                for (const cambio of item.cambios) {
                  switch (cambio._field) {
                    case 'precioBase':
                      productoUpdate.precioBase = cambio._numericNew;
                      break;
                    case 'costo':
                      if (!costoUpdate) costoUpdate = { id: item.proveedorRelId };
                      costoUpdate.costo = cambio._numericNew;
                      break;
                    case 'skuProveedor':
                      if (!costoUpdate) costoUpdate = { id: item.proveedorRelId };
                      costoUpdate.skuProveedor = cambio._stringNew!;
                      break;
                  }

                  itemHistorial.push({
                    productoId: item.productoId,
                    tipo: 'IMPORTACION_EXCEL',
                    campo: cambio._field,
                    valorAnterior: String(cambio._numericOld ?? cambio.valorActual),
                    valorNuevo: String(cambio._numericNew ?? cambio._stringNew ?? cambio.valorNuevo),
                    origen: 'IMPORTACION_EXCEL',
                    detalles: {
                      archivo: nombreArchivo || 'importacion.xlsx',
                      filaNumero: item.filaNumero,
                      campo: cambio.campo,
                    },
                    usuarioId: userId,
                  });
                }

                // If cost and price are both known, keep rentabilidad synchronized
                const finalP = productoUpdate.precioBase ?? item.currentPrecioBase;
                const finalC = costoUpdate?.costo ?? item.currentCosto;
                if (finalC > 0 && finalP > 0) {
                  productoUpdate.rentabilidad = Math.round(((finalP - finalC) / finalC) * 10000) / 100;
                }

                if (Object.keys(productoUpdate).length > 0) {
                  await tx.producto.update({
                    where: { id: item.productoId },
                    data: productoUpdate,
                  });
                }

                if (costoUpdate) {
                  if (costoUpdate.id) {
                    const { id, ...updateData } = costoUpdate;
                    if (Object.keys(updateData).length > 0) {
                      await tx.productoProveedorVentas.update({
                        where: { id },
                        data: updateData,
                      });
                    }
                  } else if (defaultProvId) {
                    await tx.productoProveedorVentas.upsert({
                      where: {
                        productoId_proveedorId: {
                          productoId: item.productoId,
                          proveedorId: defaultProvId,
                        },
                      },
                      update: {
                        costo: costoUpdate.costo ?? 0,
                        skuProveedor: costoUpdate.skuProveedor || null,
                      },
                      create: {
                        productoId: item.productoId,
                        proveedorId: defaultProvId,
                        costo: costoUpdate.costo ?? 0,
                        skuProveedor: costoUpdate.skuProveedor || null,
                        esPrincipal: true,
                        orden: 1,
                      },
                    });
                  }
                }

                if (itemHistorial.length > 0) {
                  await tx.productoHistorial.createMany({
                    data: itemHistorial,
                  });
                }
              }
            },
            { maxWait: 15000, timeout: 30000 }
          );

          totalProductosActualizados += batch.length;
        } catch (batchError: any) {
          for (const item of batch) {
            errores.push({
              filaNumero: item.filaNumero,
              sku: item.sku,
              skuProveedor: item.skuProveedor,
              motivo: `Error al aplicar lote: ${batchError.message || 'Error en base de datos'}`,
            });
          }
        }
      }
    }

    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_PRECIOS_IMPORTACION_EXCEL',
      metadata: {
        nombreArchivo,
        resumen,
        productosActualizados: totalProductosActualizados,
        totalCambios,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: `Importación aplicada con éxito: ${totalProductosActualizados} productos actualizados (${totalCambios} cambios aplicados).`,
      resumen: {
        filasProcesadas: filas.length,
        filasProcessadas: filas.length,
        productosActualizados: totalProductosActualizados,
        filasOmitidas: Math.max(0, filas.length - totalProductosActualizados),
        errores: errores.length,
      },
      errores,
    });
  } catch (error: any) {
    console.error('Error importando desde Excel:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar archivo Excel' },
      { status: 500 }
    );
  }
}
