import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildProductSearchWhere } from '@/lib/ventas/skuUtils';
import { resolverPrecioProducto } from '@/lib/ventas/pdvService';

const productInclude = {
  marca: { select: { id: true, nombre: true } },
  unidad: { select: { id: true, codigo: true, nombre: true } },
  iva: { select: { id: true, porcentaje: true, nombre: true } },
  proveedores: {
    where: { esPrincipal: true },
    take: 1,
    select: { costo: true },
  },
  stocks: {
    take: 1,
    select: { stockActual: true },
  },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.trim() || '';
    const listaPrecioId = searchParams.get('listaPrecioId') || undefined;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    // 1. Cargar lista de precios activa si se solicitó
    let listaPrecio = null;
    if (listaPrecioId) {
      listaPrecio = await prisma.listaPrecio.findUnique({
        where: { id: listaPrecioId, activo: true },
      });
    }

    // 2. Si no hay término de búsqueda, devolver catálogo inicial activo
    if (!search) {
      const initialProducts = await prisma.producto.findMany({
        where: { activo: true },
        take: limit,
        include: productInclude,
        orderBy: { sku: 'asc' },
      });

      const productos = initialProducts.map((p) => {
        const prov = p.proveedores[0] || null;
        const costo = prov ? prov.costo : 0;
        const stockActual = p.stocks[0]?.stockActual ?? 0;
        const ivaPorcentaje = p.iva?.porcentaje ?? 21;

        const resPrecio = resolverPrecioProducto(
          {
            precioBase: p.precioBase,
            costo,
            familiaId: p.familiaId,
            marcaId: p.marcaId,
            ivaPorcentaje,
          },
          listaPrecio
        );

        return {
          id: p.id,
          sku: p.sku,
          codigoBarras: p.codigoBarras,
          descripcion: p.descripcion,
          marca: p.marca?.nombre || null,
          marcaId: p.marcaId,
          familiaId: p.familiaId,
          unidad: p.unidad?.codigo || p.unidad?.nombre || 'UNID',
          precioBase: p.precioBase,
          precioAplicado: resPrecio.precio,
          esFallbackPrecio: resPrecio.esFallback,
          detalleAjuste: resPrecio.detalleAjuste,
          ivaPorcentaje,
          costo,
          stockActual,
          esCoincidenciaExacta: false,
        };
      });

      return NextResponse.json({
        productos,
        hasExactMatch: false,
        exactMatchId: null,
        query: '',
        ivaDiscriminado: Boolean(listaPrecio?.ivaDiscriminado),
      });
    }

    // 3. Normalización del término de búsqueda
    const isNumeric = /^\d+$/.test(search);
    const unpadded = search.replace(/^0+/, '') || '0';
    const padded5 = unpadded.padStart(5, '0');
    const upperRaw = search.toUpperCase();

    // 4. Búsqueda de coincidencia exacta estricta
    let exactMatch = null;
    const exactConditions: any[] = [];

    if (isNumeric) {
      exactConditions.push({ sku: padded5 });
      exactConditions.push({ sku: unpadded });
      exactConditions.push({ sku: search });
      exactConditions.push({ codigoBarras: search });
      if (search !== padded5) {
        exactConditions.push({ codigoBarras: padded5 });
      }
    } else {
      exactConditions.push({ sku: upperRaw });
      exactConditions.push({ codigoBarras: search });
    }

    exactMatch = await prisma.producto.findFirst({
      where: {
        OR: exactConditions,
        activo: true,
      },
      include: productInclude,
    });

    // Validar rigurosamente que exactMatch realmente coincide con la búsqueda
    if (exactMatch) {
      const matchSku = exactMatch.sku || '';
      const matchBarcode = exactMatch.codigoBarras || '';
      const isActuallyExact = isNumeric
        ? matchSku === padded5 ||
          matchSku === unpadded ||
          matchSku === search ||
          matchBarcode === search ||
          matchBarcode === padded5
        : matchSku.toUpperCase() === upperRaw || matchBarcode === search;

      if (!isActuallyExact) {
        exactMatch = null;
      }
    }

    // 5. Búsqueda incremental / progresiva
    const where: any = { activo: true };

    if (isNumeric) {
      where.OR = [
        { sku: { startsWith: unpadded, mode: 'insensitive' } },
        { sku: { contains: unpadded, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { codigoBarras: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: unpadded, mode: 'insensitive' } },
      ];
    } else {
      const searchWhere = buildProductSearchWhere(search);
      if (searchWhere.AND) {
        where.AND = searchWhere.AND;
      } else if (searchWhere.OR) {
        where.OR = searchWhere.OR;
      }
    }

    const rawList = await prisma.producto.findMany({
      where,
      take: limit,
      include: productInclude,
      orderBy: { sku: 'asc' },
    });

    // Ordenar resultados parciales numéricos dando prioridad a SKUs que empiezan con el número
    if (isNumeric) {
      rawList.sort((a, b) => {
        const aSku = a.sku || '';
        const bSku = b.sku || '';
        const aStarts = aSku.startsWith(unpadded) || aSku.startsWith(search);
        const bStarts = bSku.startsWith(unpadded) || bSku.startsWith(search);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aSku.localeCompare(bSku, undefined, { numeric: true });
      });
    }

    // 6. Unificación: coincidencia exacta siempre en posición 0 si existe
    const combined = [...rawList];
    if (exactMatch) {
      const idx = combined.findIndex((p) => p.id === exactMatch.id);
      if (idx >= 0) {
        combined.splice(idx, 1);
      }
      combined.unshift(exactMatch);
    }

    // 7. Formatear productos con precio resuelto
    const productos = combined.map((p) => {
      const prov = p.proveedores[0] || null;
      const costo = prov ? prov.costo : 0;
      const stockActual = p.stocks[0]?.stockActual ?? 0;
      const ivaPorcentaje = p.iva?.porcentaje ?? 21;

      const resPrecio = resolverPrecioProducto(
        {
          precioBase: p.precioBase,
          costo,
          familiaId: p.familiaId,
          marcaId: p.marcaId,
          ivaPorcentaje,
        },
        listaPrecio
      );

      const isExact = exactMatch && p.id === exactMatch.id;

      return {
        id: p.id,
        sku: p.sku,
        codigoBarras: p.codigoBarras,
        descripcion: p.descripcion,
        marca: p.marca?.nombre || null,
        marcaId: p.marcaId,
        familiaId: p.familiaId,
        unidad: p.unidad?.codigo || p.unidad?.nombre || 'UNID',
        precioBase: p.precioBase,
        precioAplicado: resPrecio.precio,
        esFallbackPrecio: resPrecio.esFallback,
        detalleAjuste: resPrecio.detalleAjuste,
        ivaPorcentaje,
        costo,
        stockActual,
        esCoincidenciaExacta: !!isExact,
      };
    });

    return NextResponse.json({
      productos,
      hasExactMatch: !!exactMatch,
      exactMatchId: exactMatch?.id || null,
      query: search,
      ivaDiscriminado: Boolean(listaPrecio?.ivaDiscriminado),
    });
  } catch (error: any) {
    console.error('Error buscando productos PDV:', error);
    return NextResponse.json(
      { error: 'Error al buscar productos', details: error.message },
      { status: 500 }
    );
  }
}
