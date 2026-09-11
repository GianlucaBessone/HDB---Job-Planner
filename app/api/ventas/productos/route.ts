import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

import { calculateSuggestedPrice } from '@/lib/ventas/priceRules';
import { normalizeSku, buildProductSearchWhere } from '@/lib/ventas/skuUtils';

const productoCreateSchema = z.object({
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

  // Precio base de venta
  precioBase: z.coerce.number().default(0),
  p1: z.coerce.number().default(0),
  p2: z.coerce.number().default(0),
  p3: z.coerce.number().default(0),
  precios: z.record(z.string(), z.coerce.number()).optional().default({}),

  // Inventario inicial
  almacenId: z.string().optional().nullable(),
  ubicacionId: z.string().optional().nullable(),
  stockInicial: z.coerce.number().default(0),
  stockMinimo: z.coerce.number().default(0),
  stockMaximo: z.coerce.number().default(0),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.trim() || '';
    const categoriaId = searchParams.get('categoriaId') || undefined;
    const marcaId = searchParams.get('marcaId') || undefined;
    const familiaId = searchParams.get('familiaId') || undefined;
    const subFamiliaId = searchParams.get('subFamiliaId') || undefined;
    const unidadId = searchParams.get('unidadId') || undefined;
    const proveedorId = searchParams.get('proveedorId') || undefined;
    const almacenId = searchParams.get('almacenId') || undefined;
    const estadoStock = searchParams.get('estadoStock') || undefined; // 'normal' | 'bajo' | 'sin_stock' | 'sobre_stock'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const sortBy = searchParams.get('sortBy') || 'sku';
    const sortOrder = (searchParams.get('sortOrder') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';

    // Base WHERE
    const where: any = {
      activo: true,
    };

    if (categoriaId) where.categoriaId = categoriaId;
    if (marcaId) where.marcaId = marcaId;
    if (familiaId) where.familiaId = familiaId;
    if (subFamiliaId) where.subFamiliaId = subFamiliaId;
    if (unidadId) where.unidadId = unidadId;

    if (proveedorId) {
      where.proveedores = {
        some: { proveedorId, esPrincipal: true },
      };
    }

    if (almacenId) {
      where.stocks = {
        some: { almacenId },
      };
    }

    // Smart word-based search (palabra por palabra con normalización de SKU)
    if (search) {
      const searchWhere = buildProductSearchWhere(search);
      if (searchWhere.AND) {
        where.AND = searchWhere.AND;
      } else if (searchWhere.OR) {
        where.OR = searchWhere.OR;
      }
    }

    // Query DB
    const [total, rawProductos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        include: {
          categoria: { select: { id: true, nombre: true } },
          marca: { select: { id: true, nombre: true } },
          familia: { select: { id: true, nombre: true } },
          subFamilia: { select: { id: true, nombre: true } },
          unidad: { select: { id: true, codigo: true, nombre: true } },
          iva: { select: { id: true, porcentaje: true, nombre: true } },
          proveedores: {
            orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }],
            take: 1,
            include: {
              proveedor: {
                select: { id: true, razonSocial: true, nombreFantasia: true, cuit: true },
              },
            },
          },
          stocks: {
            include: {
              almacen: { select: { id: true, codigo: true, nombre: true } },
              ubicacion: { select: { id: true, codigo: true, nombre: true } },
            },
          },
        },
        orderBy: sortBy === 'marca'
          ? { marca: { nombre: sortOrder } }
          : sortBy === 'descripcion'
          ? { descripcion: sortOrder }
          : { sku: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Prioritize exact SKU match at the top of results on page 1
    if (page === 1 && search) {
      const targetSku = /^\d+$/.test(search.trim()) && search.trim().length <= 5
        ? search.trim().padStart(5, '0')
        : search.trim().toUpperCase();

      const exactIndex = rawProductos.findIndex((p) => p.sku === targetSku);
      if (exactIndex > 0) {
        const [exactMatch] = rawProductos.splice(exactIndex, 1);
        rawProductos.unshift(exactMatch);
      }
    }

    // Format and calculate stock states
    const productos = rawProductos.map((p) => {
      // Primary supplier
      const provPrincipal = p.proveedores[0] || null;

      // Primary stock (first warehouse or central)
      const stockItem = p.stocks[0] || null;
      const stockActual = stockItem ? stockItem.stockActual : 0;
      const stockMinimo = stockItem ? stockItem.stockMinimo : 0;
      const stockMaximo = stockItem ? stockItem.stockMaximo : 0;

      // Stock status calculation:
      let estadoStockCalc: 'sin_stock' | 'bajo' | 'sobre_stock' | 'normal' = 'normal';
      if (stockActual <= 0) {
        estadoStockCalc = 'sin_stock';
      } else if (stockMinimo > 0 && stockActual <= stockMinimo) {
        estadoStockCalc = 'bajo';
      } else if (stockMaximo > 0 && stockActual > stockMaximo) {
        estadoStockCalc = 'sobre_stock';
      }

      return {
        id: p.id,
        sku: p.sku,
        codigoBarras: p.codigoBarras,
        descripcion: p.descripcion,
        categoria: p.categoria?.nombre || null,
        categoriaId: p.categoriaId,
        marca: p.marca?.nombre || null,
        marcaId: p.marcaId,
        familia: p.familia?.nombre || null,
        familiaId: p.familiaId,
        subFamilia: p.subFamilia?.nombre || null,
        subFamiliaId: p.subFamiliaId,
        unidad: p.unidad?.nombre || p.unidad?.codigo || null,
        unidadCodigo: p.unidad?.codigo || null,
        unidadId: p.unidadId,
        iva: p.iva ? `${p.iva.porcentaje}%` : '0%',
        ivaPorcentaje: p.iva?.porcentaje ?? 0,
        ivaId: p.ivaId,
        rentabilidad: p.rentabilidad,

        // Proveedor
        proveedorNombre: provPrincipal?.proveedor?.nombreFantasia || provPrincipal?.proveedor?.razonSocial || null,
        proveedorId: provPrincipal?.proveedorId || null,
        skuProveedor: provPrincipal?.skuProveedor || null,
        costo: provPrincipal?.costo ?? 0,

        // Precio Base de Venta (campo único del producto)
        precioBase: p.precioBase,
        p1: p.precioBase,
        p2: 0,
        p3: 0,
        preciosMap: {},
        precios: [],

        // Stock e inventario
        almacenNombre: stockItem?.almacen?.nombre || 'Central',
        almacenId: stockItem?.almacenId || null,
        ubicacionCodigo: stockItem?.ubicacion?.codigo || null,
        ubicacionId: stockItem?.ubicacionId || null,
        stockActual,
        stockMinimo,
        stockMaximo,
        estadoStock: estadoStockCalc,
      };
    });

    // Client-side filter for stock status if requested
    let finalProductos = productos;
    if (estadoStock) {
      finalProductos = productos.filter((p) => p.estadoStock === estadoStock);
    }

    return NextResponse.json({
      productos: finalProductos,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error fetching productos:', error);
    return NextResponse.json({ error: 'Error al listar productos', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = productoCreateSchema.parse(body);
    data.sku = normalizeSku(data.sku);

    const userId = req.headers.get('x-user-id') || undefined;

    // Check SKU duplicate
    const existingSku = await prisma.producto.findUnique({
      where: { sku: data.sku },
    });
    if (existingSku) {
      return NextResponse.json(
        { error: `El SKU "${data.sku}" ya existe en el sistema` },
        { status: 400 }
      );
    }

    // Check Barcode duplicate if provided
    if (data.codigoBarras && data.codigoBarras.trim() !== '') {
      const existingBarcode = await prisma.producto.findUnique({
        where: { codigoBarras: data.codigoBarras.trim() },
      });
      if (existingBarcode) {
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

    // Resolve default warehouse
    let targetAlmacenId = data.almacenId;
    if (!targetAlmacenId) {
      const defaultAlm = await prisma.almacen.findFirst({
        where: { esPredeterminado: true, activo: true },
      });
      targetAlmacenId = defaultAlm?.id;
    }

    const resolvedPrecioBase = data.precioBase || data.p1 || 0;

    // Execute atomic product creation
    const newProducto = await prisma.$transaction(async (tx) => {
      // 1. Create Producto
      const prod = await tx.producto.create({
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
          precioBase: resolvedPrecioBase,
          activo: true,
        },
      });

      // 2. Link primary supplier if provided
      if (data.proveedorId) {
        await tx.productoProveedorVentas.create({
          data: {
            productoId: prod.id,
            proveedorId: data.proveedorId,
            skuProveedor: data.skuProveedor?.trim() || null,
            costo: data.costo,
            esPrincipal: true,
            orden: 1,
          },
        });
      }

      // 3. Initialize Warehouse stock
      if (targetAlmacenId) {
        const prodStock = await tx.productoStock.create({
          data: {
            productoId: prod.id,
            almacenId: targetAlmacenId,
            ubicacionId: data.ubicacionId || null,
            stockActual: data.stockInicial,
            stockMinimo: data.stockMinimo,
            stockMaximo: data.stockMaximo,
          },
        });

        // If initial stock was given, record movement
        if (data.stockInicial > 0) {
          await tx.productoStockMovimiento.create({
            data: {
              productoId: prod.id,
              almacenId: targetAlmacenId,
              tipo: 'AJUSTE',
              cantidad: data.stockInicial,
              stockAnterior: 0,
              stockPosterior: data.stockInicial,
              motivo: 'Stock inicial por alta de producto',
              usuarioId: userId,
            },
          });
        }
      }

      // 4. Audit creation in ProductoHistorial
      await tx.productoHistorial.create({
        data: {
          productoId: prod.id,
          tipo: 'CREACION',
          campo: 'producto',
          valorNuevo: prod.sku,
          origen: 'ALTA_PRODUCTO',
          detalles: {
            descripcion: prod.descripcion,
            costo: data.costo,
            precioBase: resolvedPrecioBase,
            stockInicial: data.stockInicial,
          },
          usuarioId: userId,
        },
      });

      return prod;
    });

    // Global Audit Log
    await logAudit({
      userId,
      action: 'CREATE',
      entity: 'VENTAS_PRODUCTO',
      entityId: newProducto.id,
      newValue: {
        sku: newProducto.sku,
        descripcion: newProducto.descripcion,
        precioBase: resolvedPrecioBase,
        costo: data.costo,
      },
    });

    return NextResponse.json(newProducto, { status: 201 });
  } catch (error: any) {
    console.error('Error creating producto:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear producto' },
      { status: 500 }
    );
  }
}
