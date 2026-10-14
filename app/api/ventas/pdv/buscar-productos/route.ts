import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildProductSearchWhere } from '@/lib/ventas/skuUtils';
import { resolverPrecioProducto } from '@/lib/ventas/pdvService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.trim() || '';
    const listaPrecioId = searchParams.get('listaPrecioId') || undefined;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!search && !searchParams.get('all')) {
      return NextResponse.json({ productos: [] });
    }

    // 1. Cargar lista de precios activa si se solicitó
    let listaPrecio = null;
    if (listaPrecioId) {
      listaPrecio = await prisma.listaPrecio.findUnique({
        where: { id: listaPrecioId, activo: true },
      });
    }

    // 2. Normalización ignorando ceros a la izquierda
    const isNumeric = /^\d+$/.test(search);
    const unpadded = search.replace(/^0+/, '') || '0';
    const padded5 = unpadded.padStart(5, '0');
    const upperRaw = search.toUpperCase();

    // 3. Búsqueda de COINCIDENCIA EXACTA (Prioridad Máxima e Indexada)
    // Se ignoran ceros a la izquierda: "3", "03", "00003" coinciden inequívocamente con "00003" o "3"
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
      include: {
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
      },
    });

    // 4. Búsqueda incremental filtrando a medida que se escribe cada número
    const where: any = { activo: true };

    if (isNumeric) {
      // Si es numérico, filtrar por SKU con y sin ceros, código de barras o descripción
      where.OR = [
        { sku: { contains: unpadded, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { sku: { contains: padded5, mode: 'insensitive' } },
        { codigoBarras: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: unpadded, mode: 'insensitive' } },
      ];
    } else if (search) {
      const searchWhere = buildProductSearchWhere(search);
      if (searchWhere.AND) {
        where.AND = searchWhere.AND;
      } else if (searchWhere.OR) {
        where.OR = searchWhere.OR;
      }
    }

    // Consulta de resultados secundarios
    const rawList = await prisma.producto.findMany({
      where,
      take: limit,
      include: {
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
      },
      orderBy: { sku: 'asc' },
    });

    // 5. UNIFICACIÓN: SIEMPRE QUEDARSE CON LA COINCIDENCIA EXACTA EN LA POSICIÓN 0
    const combined = [...rawList];
    if (exactMatch) {
      const idx = combined.findIndex((p) => p.id === exactMatch.id);
      if (idx >= 0) {
        combined.splice(idx, 1);
      }
      // Poner SIEMPRE la coincidencia exacta en el primer lugar
      combined.unshift(exactMatch);
    }

    // 6. Formatear productos con precio resuelto y bandera de coincidencia exacta
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
    });
  } catch (error: any) {
    console.error('Error buscando productos PDV:', error);
    return NextResponse.json(
      { error: 'Error al buscar productos', details: error.message },
      { status: 500 }
    );
  }
}
