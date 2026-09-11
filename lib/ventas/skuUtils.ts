/**
 * Utilidades para normalización y manejo de SKUs y búsquedas en Ventas
 */

/**
 * Normaliza un código SKU:
 * - Si es numérico y tiene 5 dígitos o menos, se completa con ceros a la izquierda hasta 5 dígitos (ej: "25" -> "00025").
 * - Si contiene letras o símbolos o supera los 5 dígitos, se limpia con trim y uppercase.
 */
export function normalizeSku(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d+$/.test(str) && str.length <= 5) {
    return str.padStart(5, '0');
  }
  return str.toUpperCase();
}

/**
 * Genera variantes de una palabra para búsquedas insensibles a tildes,
 * género gramatical (o/a), plurales y términos técnicos en español.
 */
export function getWordVariants(word: string): string[] {
  const clean = word.toLowerCase().trim();
  if (!clean) return [];

  const variants = new Set<string>();
  variants.add(clean);

  // Versión sin tildes (NFD)
  const unaccented = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  variants.add(unaccented);

  // Raíces y acentuaciones comunes en catálogos eléctricos e industriales
  if (unaccented.includes('termomagnet')) {
    variants.add('termomagnet');
    variants.add('termomagnét');
  }

  const withAccents = unaccented
    .replace(/termomagnet/g, 'termomagnét')
    .replace(/electric/g, 'eléctric')
    .replace(/modul/g, 'módul')
    .replace(/medicion/g, 'medición')
    .replace(/conexion/g, 'conexión')
    .replace(/iluminacion/g, 'iluminación')
    .replace(/senalizacion/g, 'señalización')
    .replace(/proteccion/g, 'protección')
    .replace(/estacion/g, 'estación')
    .replace(/alimentacion/g, 'alimentación')
    .replace(/instalacion/g, 'instalación')
    .replace(/rele/g, 'relé')
    .replace(/automatic/g, 'automátic')
    .replace(/trifasic/g, 'trifásic')
    .replace(/monofasic/g, 'monofásic');
  variants.add(withAccents);

  // Reducción de terminaciones de adjetivos técnicos (ico/ica/icos/icas) a la raíz común
  if (clean.length > 5 && /(ica|ico|icas|icos)$/.test(clean)) {
    const root = clean.replace(/(ica|ico|icas|icos)$/, '');
    variants.add(root);
    const unaccentedRoot = root.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    variants.add(unaccentedRoot);
    if (unaccentedRoot.includes('termomagnet')) {
      variants.add('termomagnét');
    }
  }

  // Reducción de plurales regulares en español
  if (clean.length > 4 && clean.endsWith('es')) {
    variants.add(clean.slice(0, -2));
  } else if (clean.length > 3 && clean.endsWith('s')) {
    variants.add(clean.slice(0, -1));
  }

  return Array.from(variants).filter((v) => v.length >= 1);
}

/**
 * Construye el filtro Prisma WHERE para búsqueda inteligente por palabras ("palabra por palabra"):
 * - Divide la consulta por espacios en palabras individuales (todas deben cumplirse -> AND).
 * - Genera variantes fonéticas y gramaticales (tildes, género, plurales, abreviaciones eléctricas).
 * - Si un término es numérico de <= 5 dígitos (ej: "5610" o "25"), busca coincidencia exacta con el SKU completado
 *   con ceros ("05610" / "00025") y evita búsquedas de subcadenas falsas en códigos de barras largos.
 * - Soporta nomenclatura eléctrica argentina (ej: "C10", "10C", "C16", "Curva C", "1-polo" / "1 polo").
 */
export function buildProductSearchWhere(search: string): any {
  const trimmed = search.trim();
  if (!trimmed) return {};

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return {};

  const andConditions = words.map((word) => {
    const isNumeric = /^\d+$/.test(word);
    const paddedSku = isNumeric && word.length <= 5 ? word.padStart(5, '0') : null;
    const variants = getWordVariants(word);

    const orList: any[] = [];

    // Búsqueda por SKU (exacta si es número formateado a 5 dígitos, y parcial por variantes)
    if (paddedSku) {
      orList.push({ sku: paddedSku });
      if (word !== paddedSku) {
        orList.push({ sku: word });
      }
    }
    for (const v of variants) {
      orList.push({ sku: { contains: v, mode: 'insensitive' } });
    }

    // Búsqueda por Código de Barras
    if (word.length >= 6) {
      orList.push({ codigoBarras: { contains: word, mode: 'insensitive' } });
    } else {
      orList.push({ codigoBarras: word });
    }

    // Búsqueda por Descripción con variantes léxicas y tildes
    for (const v of variants) {
      orList.push({ descripcion: { contains: v, mode: 'insensitive' } });
    }

    // Patrón especial eléctrico: C10, C16, 10C -> Curva C, In:10A
    const cAmpMatch = word.match(/^c(\d+)$/i) || word.match(/^(\d+)c$/i);
    if (cAmpMatch) {
      const amp = cAmpMatch[1];
      orList.push(
        { descripcion: { contains: `${amp}A`, mode: 'insensitive' } },
        { descripcion: { contains: `In:${amp}`, mode: 'insensitive' } }
      );
    }

    // Búsqueda por Marca, Categoría, Familia, SubFamilia
    for (const v of variants) {
      orList.push(
        { marca: { nombre: { contains: v, mode: 'insensitive' } } },
        { categoria: { nombre: { contains: v, mode: 'insensitive' } } },
        { familia: { nombre: { contains: v, mode: 'insensitive' } } },
        { subFamilia: { nombre: { contains: v, mode: 'insensitive' } } }
      );
    }

    // Búsqueda por Proveedor (SKU del proveedor, razón social, nombre de fantasía, CUIT)
    for (const v of variants) {
      orList.push({
        proveedores: {
          some: {
            OR: [
              { skuProveedor: { contains: v, mode: 'insensitive' } },
              {
                proveedor: {
                  OR: [
                    { razonSocial: { contains: v, mode: 'insensitive' } },
                    { nombreFantasia: { contains: v, mode: 'insensitive' } },
                    { cuit: { contains: v } },
                  ],
                },
              },
            ],
          },
        },
      });
    }

    return { OR: orList };
  });

  return andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
}
