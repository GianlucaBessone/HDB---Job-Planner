export type TipoMovimientoStock =
  | 'STOCK_INICIAL'
  | 'ENTRADA'
  | 'SALIDA'
  | 'AJUSTE_POSITIVO'
  | 'AJUSTE_NEGATIVO'
  | 'TRANSFERENCIA_ENTRADA'
  | 'TRANSFERENCIA_SALIDA'
  | 'CONTEO'
  | 'REVERSA';

export type TipoOperacionStock =
  | 'AJUSTE'
  | 'TRANSFERENCIA'
  | 'ENTRADA'
  | 'SALIDA'
  | 'CONTEO'
  | 'STOCK_INICIAL'
  | 'REVERSA';

export type ModoAjuste = 'DIFERENCIA' | 'EXISTENCIA_REAL';

export type EstadoStock =
  | 'normal'
  | 'bajo_minimo'
  | 'sin_stock'
  | 'sobre_maximo'
  | 'no_configurado';

export type EstadoConteo =
  | 'BORRADOR'
  | 'EN_CONTEO'
  | 'PENDIENTE_REVISION'
  | 'CONFIRMADO'
  | 'CANCELADO';

export type TipoConteo =
  | 'GENERAL'
  | 'UBICACION'
  | 'FAMILIA'
  | 'SELECCION'
  | 'CICLICO';

export interface StockStatusInfo {
  estado: EstadoStock;
  label: string;
  badgeClass: string;
  cantidadSugeridaReposicion: number;
}

/**
 * Calcula el estado de stock rigurosamente según cantidades reales y límites configurados.
 * Si no tiene límites configurados (ambos <= 0), no inventa valores y marca 'no_configurado' o 'sin_stock'.
 */
export function calcularEstadoStock(
  stockActual: number,
  stockMinimo?: number | null,
  stockMaximo?: number | null
): StockStatusInfo {
  const actual = Number(stockActual) || 0;
  const min = Number(stockMinimo) || 0;
  const max = Number(stockMaximo) || 0;

  // Sugerencia de reposición: sólo cuando hay un stock máximo configurado (> 0)
  // Regla: sugerencia = max(0, stockMaximo - stockActual)
  const reposicionSugerida = max > 0 ? Math.max(0, max - actual) : 0;

  if (actual <= 0) {
    return {
      estado: 'sin_stock',
      label: 'Sin Stock',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      cantidadSugeridaReposicion: reposicionSugerida,
    };
  }

  if (min > 0 && actual <= min) {
    return {
      estado: 'bajo_minimo',
      label: 'Bajo Mínimo',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      cantidadSugeridaReposicion: reposicionSugerida,
    };
  }

  if (max > 0 && actual > max) {
    return {
      estado: 'sobre_maximo',
      label: 'Sobre Máximo',
      badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      cantidadSugeridaReposicion: 0,
    };
  }

  if (min <= 0 && max <= 0) {
    return {
      estado: 'no_configurado',
      label: 'Sin Límites',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      cantidadSugeridaReposicion: 0,
    };
  }

  return {
    estado: 'normal',
    label: 'Normal',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    cantidadSugeridaReposicion: reposicionSugerida,
  };
}

export function redondearCantidad(val: number, decimales: number = 4): number {
  const factor = Math.pow(10, decimales);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}
