import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ProductoCatalogoRaw {
  id: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  marca: string | null;
  marcaId: string | null;
  familiaId: string | null;
  unidad: string;
  precioBase: number;
  costo: number;
  rentabilidad?: number;
  stockActual: number;
  ivaPorcentaje: number;
}

// Caché en memoria en el servidor Node.js
let serverCache: {
  timestamp: number;
  productos: ProductoCatalogoRaw[];
  version: string;
} | null = null;

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

async function fetchCatalogoFromDb(): Promise<ProductoCatalogoRaw[]> {
  const prods = await prisma.producto.findMany({
    where: { activo: true },
    select: {
      id: true,
      sku: true,
      codigoBarras: true,
      descripcion: true,
      precioBase: true,
      rentabilidad: true,
      familiaId: true,
      marcaId: true,
      marca: { select: { nombre: true } },
      unidad: { select: { codigo: true, nombre: true } },
      iva: { select: { porcentaje: true } },
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

  return prods.map((p) => {
    const prov = p.proveedores[0];
    const stock = p.stocks[0];
    return {
      id: p.id,
      sku: p.sku,
      codigoBarras: p.codigoBarras || null,
      descripcion: p.descripcion,
      marca: p.marca?.nombre || null,
      marcaId: p.marcaId,
      familiaId: p.familiaId,
      unidad: p.unidad?.codigo || p.unidad?.nombre || 'UNID',
      precioBase: p.precioBase || 0,
      costo: prov ? Number(prov.costo) || 0 : 0,
      rentabilidad: Number(p.rentabilidad) || 0,
      stockActual: stock ? Number(stock.stockActual) || 0 : 0,
      ivaPorcentaje: p.iva?.porcentaje ?? 21,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const now = Date.now();
    const isCacheValid =
      !forceRefresh &&
      serverCache &&
      now - serverCache.timestamp < CACHE_TTL_MS &&
      serverCache.productos.length > 0;

    if (isCacheValid) {
      return NextResponse.json(
        {
          success: true,
          fromCache: true,
          timestamp: serverCache.timestamp,
          version: serverCache.version,
          total: serverCache.productos.length,
          productos: serverCache.productos,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=180',
          },
        }
      );
    }

    // Cargar desde base de datos
    const productos = await fetchCatalogoFromDb();
    const version = `cat_${now}_${productos.length}`;

    serverCache = {
      timestamp: now,
      productos,
      version,
    };

    return NextResponse.json(
      {
        success: true,
        fromCache: false,
        timestamp: now,
        version,
        total: productos.length,
        productos,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=180',
        },
      }
    );
  } catch (error: any) {
    console.error('Error al obtener catálogo PDV:', error);

    // Si falló la DB pero tenemos un caché previo (incluso vencido), devolverlo como fallback
    if (serverCache && serverCache.productos.length > 0) {
      console.warn('Devolviendo catálogo en caché degradado tras error de DB');
      return NextResponse.json(
        {
          success: true,
          fromCache: true,
          degraded: true,
          timestamp: serverCache.timestamp,
          version: serverCache.version,
          total: serverCache.productos.length,
          productos: serverCache.productos,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Error al cargar catálogo', details: error.message },
      { status: 500 }
    );
  }
}
