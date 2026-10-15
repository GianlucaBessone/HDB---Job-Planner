export interface ListaPrecioConfig {
  id: string;
  codigo: string;
  nombre: string;
  orden?: number | null;
  tipoAjuste?: string | null; // 'MANUAL' | 'PORCENTAJE_SOBRE_COSTO' | 'MARGEN_SOBRE_COSTO' | 'DESCUENTO_SOBRE_BASE' | 'RECARGO_SOBRE_BASE'
  valorAjuste?: number | null;
  listaBaseId?: string | null;
  aplicaA?: string | null; // 'TODOS' | 'FAMILIA' | 'MARCA'
  familiaId?: string | null;
  marcaId?: string | null;
  activo?: boolean;
}

export interface ProductoInfoForPricing {
  costo: number;
  familiaId?: string | null;
  marcaId?: string | null;
}

/**
 * Determina si la regla de la lista de precio aplica a este producto
 */
export function doesRuleApply(
  lista: ListaPrecioConfig,
  prod: { familiaId?: string | null; marcaId?: string | null }
): boolean {
  if (!lista.aplicaA || lista.aplicaA === 'TODOS') return true;
  if (lista.aplicaA === 'FAMILIA' && lista.familiaId) {
    return lista.familiaId === prod.familiaId;
  }
  if (lista.aplicaA === 'MARCA' && lista.marcaId) {
    return lista.marcaId === prod.marcaId;
  }
  return true;
}

/**
 * Calcula el precio para una lista dada según sus reglas dinámicas
 */
export function calculateSuggestedPrice(
  lista: ListaPrecioConfig,
  prod: ProductoInfoForPricing,
  preciosMap: Record<string, number>
): number | null {
  if (!lista.tipoAjuste || lista.tipoAjuste === 'MANUAL') {
    return null; // Es manual
  }

  if (!doesRuleApply(lista, prod)) {
    return null; // La regla no aplica a este producto específico
  }

  const valor = Number(lista.valorAjuste) || 0;
  const costo = Number(prod.costo) || 0;

  switch (lista.tipoAjuste) {
    case 'PORCENTAJE_COSTO':
    case 'PORCENTAJE_SOBRE_COSTO': {
      // Costo + % (ej: costo 1000 + 30% = 1300)
      const res = costo * (1 + valor / 100);
      return Math.round(res * 100) / 100;
    }
    case 'MARGEN_COSTO':
    case 'MARGEN_SOBRE_COSTO': {
      // Margen sobre venta: Precio = Costo / (1 - margen%)
      // Si el margen es >= 100%, fallback a costo * (1 + margen%)
      if (valor >= 100) {
        return Math.round(costo * (1 + valor / 100) * 100) / 100;
      }
      const divisor = 1 - valor / 100;
      const res = divisor > 0 ? costo / divisor : costo;
      return Math.round(res * 100) / 100;
    }
    case 'DESCUENTO_BASE':
    case 'DESCUENTO_SOBRE_BASE': {
      if (!lista.listaBaseId) return null;
      const basePrice = preciosMap[lista.listaBaseId] || 0;
      const res = basePrice * (1 - valor / 100);
      return Math.round(Math.max(0, res) * 100) / 100;
    }
    case 'RECARGO_BASE':
    case 'RECARGO_SOBRE_BASE': {
      if (!lista.listaBaseId) return null;
      const basePrice = preciosMap[lista.listaBaseId] || 0;
      const res = basePrice * (1 + valor / 100);
      return Math.round(res * 100) / 100;
    }
    default:
      return null;
  }
}

/**
 * Resuelve el precio unitario final aplicable a un producto según la lista seleccionada
 */
export function resolverPrecioProducto(
  producto: {
    precioBase: number;
    costo?: number;
    familiaId?: string | null;
    marcaId?: string | null;
    ivaPorcentaje?: number;
  },
  lista?: (Partial<ListaPrecioConfig> & { tipoAjuste?: string | null; valorAjuste?: number | null; esPredeterminada?: boolean; ivaDiscriminado?: boolean }) | null,
  preciosMap: Record<string, number> = {}
): { precio: number; esFallback: boolean; detalleAjuste?: string } {
  const precioBase = Number(producto.precioBase) || 0;

  let precioConIva = precioBase;
  let esFallback = false;
  let detalleAjuste = 'Precio Base / Manual';

  if (!lista || !lista.tipoAjuste || lista.tipoAjuste === 'MANUAL') {
    precioConIva = precioBase;
    esFallback = false;
    detalleAjuste = 'Precio Base / Manual';
  } else {
    const costo = Number(producto.costo) || 0;
    const mapaCalculo = {
      ...preciosMap,
      ...(lista.listaBaseId ? { [lista.listaBaseId]: precioBase } : {}),
      base: precioBase,
    };

    const precioSugerido = calculateSuggestedPrice(
      lista as ListaPrecioConfig,
      {
        costo,
        familiaId: producto.familiaId,
        marcaId: producto.marcaId,
      },
      mapaCalculo
    );

    if (precioSugerido !== null && precioSugerido > 0) {
      precioConIva = precioSugerido;
      esFallback = false;
      detalleAjuste = `${lista.tipoAjuste} (${lista.valorAjuste}%)`;
    } else {
      precioConIva = precioBase;
      esFallback = true;
      detalleAjuste = 'Fallback a Precio Base (regla no aplicable o sin costo)';
    }
  }

  if (lista?.ivaDiscriminado) {
    const ivaPorc = producto.ivaPorcentaje !== undefined && producto.ivaPorcentaje !== null ? producto.ivaPorcentaje : 21;
    const divisor = 1 + (ivaPorc / 100);
    const precioNeto = divisor > 0 ? Math.round((precioConIva / divisor) * 100) / 100 : precioConIva;
    return {
      precio: precioNeto,
      esFallback,
      detalleAjuste: `${detalleAjuste} (Neto sin IVA)`,
    };
  }

  return {
    precio: precioConIva,
    esFallback,
    detalleAjuste,
  };
}

