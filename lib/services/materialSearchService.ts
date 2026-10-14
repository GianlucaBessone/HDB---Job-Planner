import { prisma } from '@/lib/prisma';
import { calculateSuggestedPrice, ListaPrecioConfig } from '@/lib/ventas/priceRules';
import { normalizeSku, getWordVariants } from '@/lib/ventas/skuUtils';

export interface MaterialSearchResult {
  id: string; // Internal stable UUID/CUID of Producto (Gestión Comercial)
  sku: string;
  skuProveedor: string | null;
  descripcion: string;
  unidad: string;
  unidadId: string | null;
  costo: number; // Costo actual en Gestión Comercial (proveedor principal)
  precioBase: number;
  precioReferencia: number; // Precio calculado según lista de precios o base
  stockActual: number;
  proveedorNombre: string | null;
  esManual?: boolean;
  matchTier: number; // 1 to 9 (1 is highest priority)
}

export interface SearchMaterialsOptions {
  query: string;
  listaPrecioId?: string | null;
  limit?: number;
}

export async function searchMaterialsForOS(options: SearchMaterialsOptions): Promise<{
  materiales: MaterialSearchResult[];
  totalCandidates: number;
  hasMore: boolean;
}> {
  const rawQuery = (options.query || '').trim();
  const limit = Math.min(100, Math.max(1, options.limit || 25));

  if (!rawQuery) {
    return { materiales: [], totalCandidates: 0, hasMore: false };
  }

  // 1. Normalización de búsqueda
  const cleanQuery = rawQuery.replace(/\s+/g, ' ');
  const upperQuery = cleanQuery.toUpperCase();
  const normalizedSkuQuery = normalizeSku(cleanQuery);
  const words = cleanQuery.split(' ').filter(Boolean);
  const variants = words.flatMap((w) => getWordVariants(w));

  // 2. Obtener lista de precios si se especificó
  let activeLista: ListaPrecioConfig | null = null;
  if (options.listaPrecioId) {
    const dbLista = await prisma.listaPrecio.findUnique({
      where: { id: options.listaPrecioId, activo: true },
    });
    if (dbLista) {
      activeLista = {
        id: dbLista.id,
        codigo: dbLista.codigo,
        nombre: dbLista.nombre,
        orden: dbLista.orden,
        tipoAjuste: dbLista.tipoAjuste,
        valorAjuste: dbLista.valorAjuste,
        listaBaseId: dbLista.listaBaseId,
        aplicaA: dbLista.aplicaA,
        familiaId: dbLista.familiaId,
        marcaId: dbLista.marcaId,
        activo: dbLista.activo,
      };
    }
  }

  // 3. Consulta optimizada a PostgreSQL usando índices
  // Construir condiciones OR para cubrir SKU exacto, prefijos, descripción y SKU de proveedor
  const orConditions: any[] = [
    { sku: { equals: upperQuery, mode: 'insensitive' } },
    { sku: { equals: normalizedSkuQuery, mode: 'insensitive' } },
    { sku: { contains: cleanQuery, mode: 'insensitive' } },
    { descripcion: { contains: cleanQuery, mode: 'insensitive' } },
    { codigoBarras: { contains: cleanQuery, mode: 'insensitive' } },
    {
      proveedores: {
        some: {
          skuProveedor: { contains: cleanQuery, mode: 'insensitive' },
        },
      },
    },
  ];

  // Agregar variantes lingüísticas comunes si difieren
  for (const v of variants.slice(0, 10)) {
    if (v.toUpperCase() !== upperQuery) {
      orConditions.push({ descripcion: { contains: v, mode: 'insensitive' } });
    }
  }

  // Buscar en Gestión Comercial -> Producto (única fuente de verdad)
  const candidateProducts = await prisma.producto.findMany({
    where: {
      activo: true,
      OR: orConditions,
    },
    include: {
      unidad: { select: { id: true, codigo: true, nombre: true } },
      proveedores: {
        orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }],
        take: 1,
        include: {
          proveedor: {
            select: { id: true, razonSocial: true, nombreFantasia: true },
          },
        },
      },
      stocks: {
        select: { stockActual: true },
      },
    },
    take: 120, // Buffer suficiente para aplicar ordenamiento determinístico por prioridad
  });

  // 4. Algoritmo de clasificación por prioridad determinística (Sección 6):
  // 1: Coincidencia exacta de SKU
  // 2: Coincidencia exacta de SKU Proveedor
  // 3: SKU comienza con búsqueda
  // 4: SKU Proveedor comienza con búsqueda
  // 5: Descripción comienza con búsqueda
  // 6: SKU contiene búsqueda
  // 7: SKU Proveedor contiene búsqueda
  // 8: Descripción contiene búsqueda
  // 9: Coincidencia por variantes/otros
  const scoredList = candidateProducts.map((p) => {
    const sku = (p.sku || '').toUpperCase();
    const primaryProv = p.proveedores[0] || null;
    const skuProv = (primaryProv?.skuProveedor || '').toUpperCase();
    const desc = (p.descripcion || '').toUpperCase();

    let tier = 9;

    if (sku === upperQuery || (normalizedSkuQuery && sku === normalizedSkuQuery)) {
      tier = 1;
    } else if (skuProv && skuProv === upperQuery) {
      tier = 2;
    } else if (sku.startsWith(upperQuery) || (normalizedSkuQuery && sku.startsWith(normalizedSkuQuery))) {
      tier = 3;
    } else if (skuProv && skuProv.startsWith(upperQuery)) {
      tier = 4;
    } else if (desc.startsWith(upperQuery)) {
      tier = 5;
    } else if (sku.includes(upperQuery)) {
      tier = 6;
    } else if (skuProv && skuProv.includes(upperQuery)) {
      tier = 7;
    } else if (desc.includes(upperQuery)) {
      tier = 8;
    } else {
      tier = 9;
    }

    // Cálculo de precio según la lista aplicable
    const costo = primaryProv?.costo ?? 0;
    const precioBase = p.precioBase ?? 0;
    let precioReferencia = precioBase;

    if (activeLista) {
      const suggested = calculateSuggestedPrice(
        activeLista,
        { costo, familiaId: p.familiaId, marcaId: p.marcaId },
        { [activeLista.listaBaseId || '']: precioBase }
      );
      if (suggested !== null && !isNaN(suggested) && suggested > 0) {
        precioReferencia = suggested;
      }
    }

    const totalStock = p.stocks.reduce((acc, s) => acc + (s.stockActual || 0), 0);
    const provName =
      primaryProv?.proveedor?.nombreFantasia ||
      primaryProv?.proveedor?.razonSocial ||
      null;

    const item: MaterialSearchResult = {
      id: p.id,
      sku: p.sku,
      skuProveedor: primaryProv?.skuProveedor || null,
      descripcion: p.descripcion,
      unidad: p.unidad?.codigo || p.unidad?.nombre || 'Unidad',
      unidadId: p.unidadId,
      costo,
      precioBase,
      precioReferencia: Math.round(precioReferencia * 100) / 100,
      stockActual: totalStock,
      proveedorNombre: provName,
      esManual: false,
      matchTier: tier,
    };

    return item;
  });

  // Ordenamiento determinístico:
  // Primer criterio: Tier (1 a 9)
  // Segundo criterio: Longitud de descripción (más corta suele ser coincidencia más directa)
  // Tercer criterio: SKU alfabético
  scoredList.sort((a, b) => {
    if (a.matchTier !== b.matchTier) {
      return a.matchTier - b.matchTier;
    }
    if (a.descripcion.length !== b.descripcion.length) {
      return a.descripcion.length - b.descripcion.length;
    }
    return a.sku.localeCompare(b.sku);
  });

  // Si el usuario buscó "999999", o si la consulta es exactamente 999999,
  // insertar al principio la opción de Material Manual
  if (upperQuery === '999999') {
    scoredList.unshift({
      id: 'manual_999999',
      sku: '999999',
      skuProveedor: null,
      descripcion: 'Material Manual (no inventariado)',
      unidad: 'Unidad',
      unidadId: null,
      costo: 0,
      precioBase: 0,
      precioReferencia: 0,
      stockActual: 0,
      proveedorNombre: null,
      esManual: true,
      matchTier: 1,
    });
  }

  const totalCandidates = scoredList.length;
  const paginatedResults = scoredList.slice(0, limit);
  const hasMore = totalCandidates > limit;

  return {
    materiales: paginatedResults,
    totalCandidates,
    hasMore,
  };
}
