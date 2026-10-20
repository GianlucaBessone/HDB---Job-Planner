import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';
import { buildProductSearchWhere } from '@/lib/ventas/skuUtils';

const ajusteLotesSchema = z.object({
  filtros: z.object({
    proveedorId: z.string().optional(),
    marcaId: z.string().optional(),
    familiaId: z.string().optional(),
    subFamiliaId: z.string().optional(),
    almacenId: z.string().optional(),
    estadoStock: z.string().optional(),
    q: z.string().optional(),
    minCosto: z.number().optional(),
    maxCosto: z.number().optional(),
    minPrecio: z.number().optional(),
    maxPrecio: z.number().optional(),
  }),
  listas: z.array(z.string()).optional().default([]),
  porcentaje: z.coerce.number().optional().default(0),
  tipoAjuste: z.enum(['PRECIO_BASE', 'COSTO', 'RENTABILIDAD']).default('PRECIO_BASE'),
  margenRentabilidad: z.coerce.number().optional().nullable(),
  preview: z.boolean().default(true),
  countOnly: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filtros, porcentaje, tipoAjuste, margenRentabilidad, preview, countOnly } = ajusteLotesSchema.parse(body);

    const userId = req.headers.get('x-user-id') || undefined;

    // Build WHERE clause matching filters
    const where: any = { activo: true };

    if (filtros.marcaId) where.marcaId = filtros.marcaId;
    if (filtros.familiaId) where.familiaId = filtros.familiaId;
    if (filtros.subFamiliaId) where.subFamiliaId = filtros.subFamiliaId;

    if (filtros.proveedorId) {
      where.proveedores = {
        some: { proveedorId: filtros.proveedorId },
      };
    }

    if (filtros.almacenId) {
      where.stocks = {
        some: { almacenId: filtros.almacenId },
      };
    }

    // Búsqueda inteligente multi-palabra con variantes fonéticas, tildes y nomenclatura técnica
    if (filtros.q && filtros.q.trim() !== '') {
      const searchWhere = buildProductSearchWhere(filtros.q);
      if (searchWhere.AND) {
        where.AND = searchWhere.AND;
      } else if (searchWhere.OR) {
        where.OR = searchWhere.OR;
      }
    }

    // Modo rápido countOnly para feedback en vivo en la UI
    if (countOnly) {
      const needsPostFiltering =
        Boolean(filtros.estadoStock) ||
        filtros.minCosto !== undefined ||
        filtros.maxCosto !== undefined ||
        filtros.minPrecio !== undefined ||
        filtros.maxPrecio !== undefined;

      if (!needsPostFiltering) {
        const cantidadProductos = await prisma.producto.count({ where });
        return NextResponse.json({ cantidadProductos });
      }

      // Con filtros de stock o rango de precios/costos
      const prods = await prisma.producto.findMany({
        where,
        select: {
          id: true,
          precioBase: true,
          stocks: filtros.almacenId
            ? { where: { almacenId: filtros.almacenId }, select: { almacenId: true, stockActual: true, stockMinimo: true, stockMaximo: true } }
            : { select: { almacenId: true, stockActual: true, stockMinimo: true, stockMaximo: true } },
          proveedores: { where: { esPrincipal: true }, select: { costo: true }, take: 1 },
        },
      });

      let filtered = prods;
      if (filtros.estadoStock) {
        filtered = filtered.filter((p) => {
          const stockItem = filtros.almacenId
            ? p.stocks.find((s) => s.almacenId === filtros.almacenId)
            : p.stocks[0];
          const stockActual = stockItem?.stockActual ?? 0;
          const stockMinimo = stockItem?.stockMinimo ?? 0;
          const stockMaximo = stockItem?.stockMaximo ?? 0;

          let status = 'normal';
          if (stockActual <= 0) status = 'sin_stock';
          else if (stockMinimo > 0 && stockActual <= stockMinimo) status = 'bajo';
          else if (stockMaximo > 0 && stockActual > stockMaximo) status = 'sobre_stock';

          return status === filtros.estadoStock;
        });
      }

      if (filtros.minCosto !== undefined) {
        filtered = filtered.filter((p) => (p.proveedores[0]?.costo ?? 0) >= (filtros.minCosto || 0));
      }
      if (filtros.maxCosto !== undefined) {
        filtered = filtered.filter((p) => (p.proveedores[0]?.costo ?? 0) <= (filtros.maxCosto || Infinity));
      }
      if (filtros.minPrecio !== undefined) {
        filtered = filtered.filter((p) => (p.precioBase ?? 0) >= (filtros.minPrecio || 0));
      }
      if (filtros.maxPrecio !== undefined) {
        filtered = filtered.filter((p) => (p.precioBase ?? 0) <= (filtros.maxPrecio || Infinity));
      }

      return NextResponse.json({ cantidadProductos: filtered.length });
    }

    // Fetch products matching filters
    const productos = await prisma.producto.findMany({
      where,
      include: {
        stocks: filtros.almacenId ? { where: { almacenId: filtros.almacenId } } : true,
        proveedores: { orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }], take: 1 },
      },
    });

    // Filter by stock state if needed
    let filteredProductos = productos;
    if (filtros.estadoStock) {
      filteredProductos = productos.filter((p) => {
        const stockItem = filtros.almacenId
          ? p.stocks.find((s) => s.almacenId === filtros.almacenId)
          : p.stocks[0];
        const stockActual = stockItem?.stockActual ?? 0;
        const stockMinimo = stockItem?.stockMinimo ?? 0;
        const stockMaximo = stockItem?.stockMaximo ?? 0;

        let status = 'normal';
        if (stockActual <= 0) status = 'sin_stock';
        else if (stockMinimo > 0 && stockActual <= stockMinimo) status = 'bajo';
        else if (stockMaximo > 0 && stockActual > stockMaximo) status = 'sobre_stock';

        return status === filtros.estadoStock;
      });
    }

    // Filter by cost/price range if specified
    if (filtros.minCosto !== undefined) {
      filteredProductos = filteredProductos.filter((p) => (p.proveedores[0]?.costo ?? 0) >= (filtros.minCosto || 0));
    }
    if (filtros.maxCosto !== undefined) {
      filteredProductos = filteredProductos.filter((p) => (p.proveedores[0]?.costo ?? 0) <= (filtros.maxCosto || Infinity));
    }
    if (filtros.minPrecio !== undefined) {
      filteredProductos = filteredProductos.filter((p) => (p.precioBase ?? 0) >= (filtros.minPrecio || 0));
    }
    if (filtros.maxPrecio !== undefined) {
      filteredProductos = filteredProductos.filter((p) => (p.precioBase ?? 0) <= (filtros.maxPrecio || Infinity));
    }

    // Calculate diff preview
    const previsualizacion: Array<{
      productoId: string;
      sku: string;
      descripcion: string;
      tipoAjuste: 'PRECIO_BASE' | 'COSTO' | 'RENTABILIDAD';
      costoActual: number;
      nuevoCosto: number;
      rentabilidadActual: number;
      rentabilidad: number;
      precioActual: number;
      porcentaje: number;
      nuevoPrecio: number;
      productoProveedorId: string | null;
    }> = [];

    const factor = 1 + porcentaje / 100;

    for (const p of filteredProductos) {
      const costoActual = p.proveedores[0]?.costo ?? 0;
      const precioActual = p.precioBase ?? 0;
      let rentabilidadActual = p.rentabilidad ?? 0;

      // Si el producto no tiene rentabilidad explícita registrada (> 0) pero tiene costo y precio > costo,
      // calculamos su margen real actual para preservarlo y no resetear el precio al costo.
      if (rentabilidadActual <= 0 && costoActual > 0 && precioActual > costoActual) {
        rentabilidadActual = Math.round(((precioActual - costoActual) / costoActual) * 10000) / 100;
      }

      let nuevoCosto = costoActual;
      let nuevoPrecio = precioActual;
      let nuevaRentabilidad = rentabilidadActual;

      if (tipoAjuste === 'RENTABILIDAD') {
        nuevaRentabilidad = porcentaje;
        nuevoPrecio = costoActual > 0
          ? Math.round(costoActual * (1 + nuevaRentabilidad / 100) * 100) / 100
          : precioActual;
      } else if (tipoAjuste === 'COSTO') {
        nuevoCosto = Math.round(costoActual * factor * 100) / 100;
        nuevaRentabilidad = (margenRentabilidad !== undefined && margenRentabilidad !== null)
          ? margenRentabilidad
          : rentabilidadActual;
        nuevoPrecio = Math.round(nuevoCosto * (1 + nuevaRentabilidad / 100) * 100) / 100;
      } else {
        nuevoPrecio = Math.max(0, Math.round(precioActual * factor * 100) / 100);
        if (costoActual > 0) {
          nuevaRentabilidad = Math.round(((nuevoPrecio - costoActual) / costoActual) * 10000) / 100;
        }
      }

      previsualizacion.push({
        productoId: p.id,
        sku: p.sku,
        descripcion: p.descripcion,
        tipoAjuste,
        costoActual,
        nuevoCosto,
        rentabilidadActual,
        rentabilidad: nuevaRentabilidad,
        precioActual,
        porcentaje,
        nuevoPrecio,
        productoProveedorId: p.proveedores[0]?.id || null,
      });
    }

    // If PREVIEW mode, return preview without updating DB
    if (preview) {
      return NextResponse.json({
        modo: 'preview',
        tipoAjuste,
        cantidadProductos: filteredProductos.length,
        cantidadAjustes: previsualizacion.length,
        previsualizacion: previsualizacion.slice(0, 500), // Return preview rows capped for speed
      });
    }

    // If CONFIRM mode: Execute updates in transaction
    const totalActualizados = await prisma.$transaction(async (tx) => {
      let count = 0;

      let defaultProvId: string | null = null;
      if (tipoAjuste === 'COSTO') {
        const defaultProv = await tx.proveedorVentas.findFirst({ where: { activo: true }, orderBy: { createdAt: 'asc' } });
        defaultProvId = defaultProv?.id || null;
      }

      for (const item of previsualizacion) {
        if (tipoAjuste === 'RENTABILIDAD') {
          // Actualizar Producto con nuevo margen de rentabilidad y precio base
          await tx.producto.update({
            where: { id: item.productoId },
            data: {
              precioBase: item.nuevoPrecio,
              rentabilidad: item.rentabilidad,
            },
          });

          // Historial doble: CAMBIO_RENTABILIDAD y AJUSTE_MASIVO precioBase
          await tx.productoHistorial.createMany({
            data: [
              {
                productoId: item.productoId,
                tipo: 'CAMBIO_RENTABILIDAD',
                campo: 'rentabilidad',
                valorAnterior: String(item.rentabilidadActual),
                valorNuevo: String(item.rentabilidad),
                origen: 'AJUSTE_LOTES',
                detalles: { nuevoMargen: item.rentabilidad, tipoAjuste: 'RENTABILIDAD' },
                usuarioId: userId,
              },
              {
                productoId: item.productoId,
                tipo: 'AJUSTE_MASIVO',
                campo: 'precioBase',
                valorAnterior: String(item.precioActual),
                valorNuevo: String(item.nuevoPrecio),
                origen: 'AJUSTE_LOTES',
                detalles: { margenAplicado: item.rentabilidad, tipoAjuste: 'RENTABILIDAD' },
                usuarioId: userId,
              },
            ],
          });
        } else if (tipoAjuste === 'COSTO') {
          // 1. Actualizar o crear registro de costo en proveedor
          if (item.productoProveedorId) {
            await tx.productoProveedorVentas.update({
              where: { id: item.productoProveedorId },
              data: { costo: item.nuevoCosto },
            });
          } else if (defaultProvId) {
            await tx.productoProveedorVentas.create({
              data: {
                productoId: item.productoId,
                proveedorId: defaultProvId,
                costo: item.nuevoCosto,
                esPrincipal: true,
                orden: 1,
              },
            });
          }

          // 2. Actualizar Producto con nuevo precio base y rentabilidad
          await tx.producto.update({
            where: { id: item.productoId },
            data: {
              precioBase: item.nuevoPrecio,
              rentabilidad: item.rentabilidad,
            },
          });

          // 3. Historial doble: CAMBIO_COSTO y AJUSTE_MASIVO precioBase
          await tx.productoHistorial.createMany({
            data: [
              {
                productoId: item.productoId,
                tipo: 'CAMBIO_COSTO',
                campo: 'costo',
                valorAnterior: String(item.costoActual),
                valorNuevo: String(item.nuevoCosto),
                origen: 'AJUSTE_LOTES',
                detalles: { porcentaje, tipoAjuste: 'COSTO' },
                usuarioId: userId,
              },
              {
                productoId: item.productoId,
                tipo: 'AJUSTE_MASIVO',
                campo: 'precioBase',
                valorAnterior: String(item.precioActual),
                valorNuevo: String(item.nuevoPrecio),
                origen: 'AJUSTE_LOTES',
                detalles: { porcentaje, tipoAjuste: 'COSTO', rentabilidad: item.rentabilidad },
                usuarioId: userId,
              },
            ],
          });
        } else {
          // PRECIO_BASE mode
          await tx.producto.update({
            where: { id: item.productoId },
            data: {
              precioBase: item.nuevoPrecio,
              ...(item.costoActual > 0 ? { rentabilidad: item.rentabilidad } : {}),
            },
          });

          await tx.productoHistorial.create({
            data: {
              productoId: item.productoId,
              tipo: 'AJUSTE_MASIVO',
              campo: 'precioBase',
              valorAnterior: String(item.precioActual),
              valorNuevo: String(item.nuevoPrecio),
              origen: 'AJUSTE_LOTES',
              detalles: { porcentaje, tipoAjuste: 'PRECIO_BASE' },
              usuarioId: userId,
            },
          });
        }

        count++;
      }

      return count;
    }, {
      maxWait: 15000,
      timeout: 120000,
    });

    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_PRECIOS_AJUSTE_LOTES',
      metadata: {
        tipoAjuste,
        porcentaje,
        margenRentabilidad,
        productosAfectados: filteredProductos.length,
        preciosActualizados: totalActualizados,
        filtros,
      },
    });

    return NextResponse.json({
      success: true,
      tipoAjuste,
      mensaje: tipoAjuste === 'RENTABILIDAD'
        ? `Ajuste completado: se actualizó el margen de ganancia a ${porcentaje}% y se recalcularon precios base sobre ${filteredProductos.length} productos.`
        : tipoAjuste === 'COSTO'
        ? `Ajuste completado: se actualizaron costos y se recalcularon precios base sobre ${filteredProductos.length} productos.`
        : `Ajuste masivo completado: se actualizaron ${totalActualizados} precios sobre ${filteredProductos.length} productos.`,
      productosAfectados: filteredProductos.length,
      preciosActualizados: totalActualizados,
    });
  } catch (error: any) {
    console.error('Error en ajuste de precios por lotes:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar ajuste por lotes' },
      { status: 500 }
    );
  }
}
