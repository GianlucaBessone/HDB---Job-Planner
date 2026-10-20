/**
 * Motor de búsqueda y catálogo en memoria para Punto de Venta (PDV)
 * Optimizado para sub-milisegundo (< 3ms) en catálogos de 4.000+ artículos.
 */

import { getWordVariants } from './skuUtils';

export interface ProductoPDV {
  id: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  marca: string | null;
  marcaId: string | null;
  familiaId: string | null;
  unidad: string;
  precioBase: number;
  precioAplicado: number;
  costo: number;
  rentabilidad?: number;
  stockActual: number;
  ivaPorcentaje: number;
  esFallbackPrecio?: boolean;
  detalleAjuste?: string;
  esCoincidenciaExacta?: boolean;
}

export interface IndexedProduct {
  product: ProductoPDV;
  cleanSku: string;
  unpaddedSku: string;
  padded5Sku: string;
  cleanBarcode: string;
  cleanDesc: string;
  cleanMarca: string;
  searchString: string;
  tokensSet: Set<string>;
}

export interface CatalogIndex {
  items: IndexedProduct[];
  skuMap: Map<string, IndexedProduct>;
  barcodeMap: Map<string, IndexedProduct>;
  totalCount: number;
}

/**
 * Normaliza una cadena a minúsculas y sin acentos diacríticos
 */
export function stripAccents(str: string): string {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Construye el índice en memoria para búsqueda ultrarrápida
 */
export function buildCatalogIndex(products: ProductoPDV[]): CatalogIndex {
  const items: IndexedProduct[] = new Array(products.length);
  const skuMap = new Map<string, IndexedProduct>();
  const barcodeMap = new Map<string, IndexedProduct>();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const rawSku = (p.sku || '').trim();
    const cleanSku = rawSku.toLowerCase();
    const unpaddedSku = cleanSku.replace(/^0+/, '') || cleanSku;
    const padded5Sku = /^\d+$/.test(unpaddedSku) ? unpaddedSku.padStart(5, '0') : cleanSku;
    const cleanBarcode = (p.codigoBarras || '').trim().toLowerCase();
    const cleanDesc = stripAccents(p.descripcion || '');
    const cleanMarca = stripAccents(p.marca || '');

    const searchString = `${cleanSku} ${unpaddedSku} ${cleanBarcode} ${cleanDesc} ${cleanMarca}`;
    const words = searchString.split(/\s+/).filter(Boolean);
    const tokensSet = new Set(words);

    const indexed: IndexedProduct = {
      product: p,
      cleanSku,
      unpaddedSku,
      padded5Sku,
      cleanBarcode,
      cleanDesc,
      cleanMarca,
      searchString,
      tokensSet,
    };

    items[i] = indexed;

    // Indexar mapas de coincidencia exacta O(1)
    if (cleanSku) {
      skuMap.set(cleanSku, indexed);
      skuMap.set(unpaddedSku, indexed);
      skuMap.set(padded5Sku, indexed);
    }
    if (cleanBarcode) {
      barcodeMap.set(cleanBarcode, indexed);
    }
  }

  return {
    items,
    skuMap,
    barcodeMap,
    totalCount: items.length,
  };
}

/**
 * Ejecuta la búsqueda instantánea en el catálogo en memoria
 */
export function searchCatalog(
  query: string,
  catalog: CatalogIndex
): {
  resultados: ProductoPDV[];
  hasExactMatch: boolean;
  exactMatchId: string | null;
  totalEncontrados: number;
} {
  const cleanQ = stripAccents(query.trim());

  // 1. Si no hay búsqueda, devolver catálogo completo ordenado por SKU natural
  if (!cleanQ) {
    const todos = catalog.items.map((it) => ({
      ...it.product,
      esCoincidenciaExacta: false,
    }));
    return {
      resultados: todos,
      hasExactMatch: false,
      exactMatchId: null,
      totalEncontrados: todos.length,
    };
  }

  const isNumeric = /^\d+$/.test(cleanQ);
  const unpaddedQ = cleanQ.replace(/^0+/, '') || cleanQ;
  const padded5Q = isNumeric ? unpaddedQ.padStart(5, '0') : cleanQ;

  // 2. Buscar coincidencia exacta O(1)
  let exactItem: IndexedProduct | null = null;
  if (isNumeric) {
    exactItem =
      catalog.skuMap.get(padded5Q) ||
      catalog.skuMap.get(unpaddedQ) ||
      catalog.skuMap.get(cleanQ) ||
      catalog.barcodeMap.get(cleanQ) ||
      catalog.barcodeMap.get(padded5Q) ||
      null;
  } else {
    exactItem =
      catalog.skuMap.get(cleanQ) ||
      catalog.barcodeMap.get(cleanQ) ||
      null;
  }

  const exactMatchId = exactItem ? exactItem.product.id : null;

  // 3. Filtrar y puntuar productos
  type ScoredItem = { indexed: IndexedProduct; score: number };
  const matches: ScoredItem[] = [];

  if (isNumeric) {
    // Búsqueda orientada a números (SKU / Código de Barras)
    for (let i = 0; i < catalog.items.length; i++) {
      const it = catalog.items[i];
      let score = 0;

      const isExact = exactItem && it.product.id === exactMatchId;
      if (isExact) {
        score += 20000;
      }

      // Prioridad alta: SKU empieza con el número buscado
      if (it.cleanSku.startsWith(cleanQ) || it.unpaddedSku.startsWith(unpaddedQ)) {
        score += 5000;
        // Si la longitud es más cercana al número, mayor relevancia
        score += Math.max(0, 1000 - Math.abs(it.cleanSku.length - cleanQ.length) * 100);
      } else if (it.cleanBarcode.startsWith(cleanQ)) {
        score += 4000;
      } else if (it.cleanSku.includes(cleanQ) || it.unpaddedSku.includes(unpaddedQ)) {
        score += 2000;
      } else if (it.cleanBarcode.includes(cleanQ)) {
        score += 1500;
      } else if (it.cleanDesc.includes(unpaddedQ) || it.cleanDesc.includes(cleanQ)) {
        score += 500;
      }

      if (score > 0) {
        matches.push({ indexed: it, score });
      }
    }
  } else {
    // Búsqueda por palabras / texto (con variantes gramaticales y eléctricas)
    const rawWords = cleanQ.split(/\s+/).filter(Boolean);
    const wordVariantsList = rawWords.map((w) => getWordVariants(w));

    for (let i = 0; i < catalog.items.length; i++) {
      const it = catalog.items[i];
      let score = 0;

      const isExact = exactItem && it.product.id === exactMatchId;
      if (isExact) {
        score += 20000;
      }

      // Verificar que CADA término de búsqueda tenga al menos una variante que coincida
      let allWordsMatch = true;
      for (let wIdx = 0; wIdx < wordVariantsList.length; wIdx++) {
        const variants = wordVariantsList[wIdx];
        let termMatch = false;
        for (let vIdx = 0; vIdx < variants.length; vIdx++) {
          const v = variants[vIdx];
          if (it.searchString.includes(v)) {
            termMatch = true;
            // Bonificación si coincide en el SKU directamente
            if (it.cleanSku.includes(v)) score += 800;
            // Bonificación si coincide en la descripción al inicio
            if (it.cleanDesc.startsWith(v)) score += 500;
            break;
          }
        }
        if (!termMatch) {
          allWordsMatch = false;
          break;
        }
      }

      if (allWordsMatch) {
        score += 1000;

        // Frase exacta completa en descripción
        if (it.cleanDesc.includes(cleanQ)) {
          score += 3000;
        }

        // SKU empieza con la consulta
        if (it.cleanSku.startsWith(cleanQ)) {
          score += 4000;
        }

        matches.push({ indexed: it, score });
      }
    }
  }

  // 4. Ordenar: mayor puntaje primero, desempate por SKU natural
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.indexed.product.sku.localeCompare(b.indexed.product.sku, undefined, {
      numeric: true,
    });
  });

  const resultados = matches.map((m) => ({
    ...m.indexed.product,
    esCoincidenciaExacta: Boolean(exactMatchId && m.indexed.product.id === exactMatchId),
  }));

  return {
    resultados,
    hasExactMatch: Boolean(exactMatchId),
    exactMatchId,
    totalEncontrados: resultados.length,
  };
}
