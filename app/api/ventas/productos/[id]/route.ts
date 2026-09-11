import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

import { calculateSuggestedPrice } from '@/lib/ventas/priceRules';
import { normalizeSku } from '@/lib/ventas/skuUtils';

const productoUpdateSchema = z.object({
  sku: z.string().min(1, 'El SKU es obligatorio'),
  codigoBarras: z.string().optional().nullable(),
  descripcion: z.string().min(1, 'La descripción es obligatoria'),
  categoriaId: z.string().optional().nullable(),
  nuevaCategoria: z.string().optional().nullable(),
  marcaId: z.string().optional().nullable(),
  nuevaMarca: z.string().optional().nullable(),
  familiaId: z.string().optional().nullable(),
  nuevaFamilia: z.string().optional().nullable(),
  subFamiliaId: z.string().optional().nullable(),
  nuevaSubFamilia: z.string().optional().nullable(),
  unidadId: z.string().optional().nullable(),
  nuevaUnidad: z.string().optional().nullable(),
  ivaId: z.string().optional().nullable(),
  rentabilidad: z.coerce.number().default(0),

  // Proveedor principal
  proveedorId: z.string().optional().nullable(),
  skuProveedor: z.string().optional().nullable(),
  costo: z.coerce.number().default(0),

  // Precios
  precioBase: z.coerce.number().default(0),
  p1: z.coerce.number().default(0),
  p2: z.coerce.number().default(0),
  p3: z.coerce.number().default(0),
  precios: z.record(z.string(), z.coerce.number()).optional().default({}),

  // Inventario
  almacenId: z.string().optional().nullable(),
  ubicacionId: z.string().optional().nullable(),
  stockMinimo: z.coerce.number().default(0),
  stockMaximo: z.coerce.number().default(0),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
        marca: true,
        familia: true,
        subFamilia: true,
        unidad: true,
        iva: true,
        proveedores: {
          include: { proveedor: true },
          orderBy: { orden: 'asc' },
        },
        stocks: {
          include: { almacen: true, ubicacion: true },
        },
        historial: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(producto);
  } catch (error: any) {
    console.error('Error getting producto by id:', error);
    return NextResponse.json({ error: 'Error al obtener producto', details: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const data = productoUpdateSchema.parse(body);
    data.sku = normalizeSku(data.sku);

    const userId = req.headers.get('x-user-id') || undefined;

    // Fetch existing product with relations
    const existing = await prisma.producto.findUnique({
      where: { id },
      include: {
        marca: true,
        familia: true,
        subFamilia: true,
        iva: true,
        proveedores: { where: { esPrincipal: true }, take: 1 },
        stocks: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Check SKU duplicate on other products
    if (data.sku !== existing.sku) {
      const duplicateSku = await prisma.producto.findUnique({
        where: { sku: data.sku },
      });
      if (duplicateSku && duplicateSku.id !== id) {
        return NextResponse.json(
          { error: `El SKU "${data.sku}" ya está en uso por otro producto` },
          { status: 400 }
        );
      }
    }

    // Check Barcode duplicate on other products
    if (data.codigoBarras && data.codigoBarras.trim() !== '') {
      const duplicateBarcode = await prisma.producto.findUnique({
        where: { codigoBarras: data.codigoBarras.trim() },
      });
      if (duplicateBarcode && duplicateBarcode.id !== id) {
        return NextResponse.json(
          { error: `El código de barras "${data.codigoBarras}" ya está asignado a otro producto` },
          { status: 400 }
        );
      }
    }

    // Resolve or create Categoria
    let resolvedCategoriaId = data.categoriaId || null;
    if (data.nuevaCategoria && data.nuevaCategoria.trim() !== '') {
      const cat = await prisma.categoria.upsert({
        where: { nombre: data.nuevaCategoria.trim() },
        update: {},
        create: { nombre: data.nuevaCategoria.trim() },
      });
      resolvedCategoriaId = cat.id;
    }

    // Resolve or create Brand
    let resolvedMarcaId = data.marcaId || null;
    if (data.nuevaMarca && data.nuevaMarca.trim() !== '') {
      const marca = await prisma.marca.upsert({
        where: { nombre: data.nuevaMarca.trim() },
        update: {},
        create: { nombre: data.nuevaMarca.trim() },
      });
      resolvedMarcaId = marca.id;
    }

    // Resolve or create Family
    let resolvedFamiliaId = data.familiaId || null;
    if (data.nuevaFamilia && data.nuevaFamilia.trim() !== '') {
      const fam = await prisma.familia.upsert({
        where: { nombre: data.nuevaFamilia.trim() },
        update: {},
        create: { nombre: data.nuevaFamilia.trim() },
      });
      resolvedFamiliaId = fam.id;
    }

    // Resolve or create SubFamily
    let resolvedSubFamiliaId = data.subFamiliaId || null;
    if (resolvedFamiliaId && data.nuevaSubFamilia && data.nuevaSubFamilia.trim() !== '') {
      const subFam = await prisma.subFamilia.upsert({
        where: {
          familiaId_nombre: {
            familiaId: resolvedFamiliaId,
            nombre: data.nuevaSubFamilia.trim(),
          },
        },
        update: {},
        create: {
          familiaId: resolvedFamiliaId,
          nombre: data.nuevaSubFamilia.trim(),
        },
      });
      resolvedSubFamiliaId = subFam.id;
    }

    // Resolve or create Unidad
    let resolvedUnidadId = data.unidadId || null;
    if (data.nuevaUnidad && data.nuevaUnidad.trim() !== '') {
      const trimmedU = data.nuevaUnidad.trim();
      const code = trimmedU.toUpperCase().slice(0, 10);
      const uni = await prisma.unidadMedida.upsert({
        where: { codigo: code },
        update: {},
        create: { codigo: code, nombre: trimmedU },
      });
      resolvedUnidadId = uni.id;
    }

    const oldCosto = existing.proveedores[0]?.costo ?? 0;
    const oldPrecioBase = existing.precioBase ?? 0;
    const newPrecioBase = data.precioBase || data.p1 || 0;

    // Track changed fields for granular history
    const historyEntries: Array<{
      tipo: string;
      campo: string;
      valorAnterior: string | null;
      valorNuevo: string | null;
    }> = [];

    if (existing.sku !== data.sku.trim()) {
      historyEntries.push({ tipo: 'EDICION_DATOS', campo: 'sku', valorAnterior: existing.sku, valorNuevo: data.sku.trim() });
    }
    if (existing.descripcion !== data.descripcion.trim()) {
      historyEntries.push({ tipo: 'EDICION_DATOS', campo: 'descripcion', valorAnterior: existing.descripcion, valorNuevo: data.descripcion.trim() });
    }
    if (existing.codigoBarras !== (data.codigoBarras?.trim() || null)) {
      historyEntries.push({ tipo: 'EDICION_DATOS', campo: 'codigoBarras', valorAnterior: existing.codigoBarras, valorNuevo: data.codigoBarras?.trim() || null });
    }
    if (existing.ivaId !== (data.ivaId || null)) {
      historyEntries.push({ tipo: 'CAMBIO_IVA', campo: 'iva', valorAnterior: existing.iva?.nombre || '0%', valorNuevo: data.ivaId || null });
    }
    if (existing.rentabilidad !== data.rentabilidad) {
      historyEntries.push({ tipo: 'EDICION_DATOS', campo: 'rentabilidad', valorAnterior: String(existing.rentabilidad), valorNuevo: String(data.rentabilidad) });
    }
    if (oldCosto !== data.costo) {
      historyEntries.push({ tipo: 'CAMBIO_COSTO', campo: 'costo', valorAnterior: String(oldCosto), valorNuevo: String(data.costo) });
    }
    if (oldPrecioBase !== newPrecioBase) {
      historyEntries.push({
        tipo: 'CAMBIO_PRECIO',
        campo: 'precioBase',
        valorAnterior: String(oldPrecioBase),
        valorNuevo: String(newPrecioBase),
      });
    }

    // Execute atomic update
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update master product
      const p = await tx.producto.update({
        where: { id },
        data: {
          sku: data.sku.trim(),
          codigoBarras: data.codigoBarras ? data.codigoBarras.trim() : null,
          descripcion: data.descripcion.trim(),
          categoriaId: resolvedCategoriaId,
          marcaId: resolvedMarcaId,
          familiaId: resolvedFamiliaId,
          subFamiliaId: resolvedSubFamiliaId,
          unidadId: resolvedUnidadId,
          ivaId: data.ivaId || null,
          rentabilidad: data.rentabilidad,
          precioBase: newPrecioBase,
        },
      });

      // 2. Update/upsert primary supplier
      if (data.proveedorId) {
        const existingProvLink = existing.proveedores[0];
        if (existingProvLink) {
          await tx.productoProveedorVentas.update({
            where: { id: existingProvLink.id },
            data: {
              proveedorId: data.proveedorId,
              skuProveedor: data.skuProveedor?.trim() || null,
              costo: data.costo,
            },
          });
        } else {
          await tx.productoProveedorVentas.create({
            data: {
              productoId: id,
              proveedorId: data.proveedorId,
              skuProveedor: data.skuProveedor?.trim() || null,
              costo: data.costo,
              esPrincipal: true,
              orden: 1,
            },
          });
        }
      }

      // 3. Update Stock thresholds
      const primaryStock = existing.stocks[0];
      if (primaryStock) {
        await tx.productoStock.update({
          where: { id: primaryStock.id },
          data: {
            stockMinimo: data.stockMinimo,
            stockMaximo: data.stockMaximo,
            ubicacionId: data.ubicacionId || null,
          },
        });
      } else if (data.almacenId) {
        await tx.productoStock.create({
          data: {
            productoId: id,
            almacenId: data.almacenId,
            ubicacionId: data.ubicacionId || null,
            stockMinimo: data.stockMinimo,
            stockMaximo: data.stockMaximo,
            stockActual: 0,
          },
        });
      }

      // 4. Insert history logs
      for (const h of historyEntries) {
        await tx.productoHistorial.create({
          data: {
            productoId: id,
            tipo: h.tipo,
            campo: h.campo,
            valorAnterior: h.valorAnterior,
            valorNuevo: h.valorNuevo,
            origen: 'EDICION_DIRECTA',
            usuarioId: userId,
          },
        });
      }

      return p;
    });

    // Global Audit
    await logAudit({
      userId,
      action: 'UPDATE',
      entity: 'VENTAS_PRODUCTO',
      entityId: id,
      oldValue: {
        sku: existing.sku,
        descripcion: existing.descripcion,
        precioBase: oldPrecioBase,
        costo: oldCosto,
      },
      newValue: {
        sku: updated.sku,
        descripcion: updated.descripcion,
        precioBase: newPrecioBase,
        costo: data.costo,
      },
      metadata: { cambios: historyEntries.length },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating producto:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar producto' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = req.headers.get('x-user-id') || undefined;

    const existing = await prisma.producto.findUnique({
      where: { id },
      include: { movimientos: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Always perform soft delete (baja lógica) to respect historic integrity
    await prisma.$transaction([
      prisma.producto.update({
        where: { id },
        data: { activo: false },
      }),
      prisma.productoHistorial.create({
        data: {
          productoId: id,
          tipo: 'BAJA_LOGICA',
          campo: 'activo',
          valorAnterior: 'true',
          valorNuevo: 'false',
          origen: 'BAJA_PRODUCTO',
          usuarioId: userId,
        },
      }),
    ]);

    await logAudit({
      userId,
      action: 'DELETE',
      entity: 'VENTAS_PRODUCTO',
      entityId: id,
      oldValue: { sku: existing.sku, descripcion: existing.descripcion },
    });

    return NextResponse.json({ success: true, message: 'Producto dado de baja correctamente' });
  } catch (error: any) {
    console.error('Error deleting producto:', error);
    return NextResponse.json({ error: 'Error al eliminar producto', details: error.message }, { status: 500 });
  }
}
