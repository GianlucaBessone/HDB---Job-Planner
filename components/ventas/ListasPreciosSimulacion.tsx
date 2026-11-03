'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { formatARS } from '@/lib/formatCurrency';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';

export interface ListaPrecioSimulable {
  id: string;
  codigo: string;
  nombre: string;
  orden?: number | null;
  tipoAjuste?: string | null;
  valorAjuste?: number | null;
  listaBaseId?: string | null;
  aplicaA?: string | null;
  familiaId?: string | null;
  marcaId?: string | null;
  ivaDiscriminado?: boolean | null;
}

interface ListasPreciosSimulacionProps {
  listas: ListaPrecioSimulable[];
  precioBase: number | string;
  costo: number | string;
  rentabilidad?: number | string;
  familiaId?: string | null;
  marcaId?: string | null;
  /** Alícuota de IVA del producto (%). */
  ivaPorcentaje: number;
}

function describirRegla(lp: ListaPrecioSimulable): string {
  const v = Number(lp.valorAjuste) || 0;
  switch (lp.tipoAjuste) {
    case 'PORCENTAJE_COSTO':
      return `Costo +${v}%`;
    case 'MARGEN_COSTO':
      return `Margen ${v}% s/ venta`;
    case 'DESCUENTO_BASE':
      return `-${v}% s/ base`;
    case 'RECARGO_BASE':
      return `+${v}% s/ base`;
    default:
      return 'Precio base';
  }
}

/**
 * Vista previa del precio final de cada lista, calculado con la misma regla que usa el PDV
 * (`resolverPrecioProducto`): incluye el IVA en las listas que no lo discriminan.
 */
export default function ListasPreciosSimulacion({
  listas,
  precioBase,
  costo,
  rentabilidad,
  familiaId,
  marcaId,
  ivaPorcentaje,
}: ListasPreciosSimulacionProps) {
  const producto = {
    precioBase: parseFloat(String(precioBase)) || 0,
    costo: parseFloat(String(costo)) || 0,
    rentabilidad: parseFloat(String(rentabilidad ?? '')) || 0,
    familiaId: familiaId || null,
    marcaId: marcaId || null,
    ivaPorcentaje,
  };

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Layers className="w-3 h-3 text-primary" />
          Listas de Precios Configuradas ({listas.length})
        </span>
        <span className="text-[11px] text-slate-400">Precio final que cobra el PDV · IVA {ivaPorcentaje}%</span>
      </div>

      {listas.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No hay listas de precios activas.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {listas.map((lp) => {
            const { precio, esFallback } = resolverPrecioProducto(producto, {
              ...lp,
              ivaDiscriminado: Boolean(lp.ivaDiscriminado),
            } as any);
            const ivaIncluido = !lp.ivaDiscriminado;

            return (
              <div
                key={lp.id}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate" title={lp.nombre}>
                    {lp.nombre}
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {formatARS(precio)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">
                    {esFallback ? 'Precio base (regla no aplica)' : describirRegla(lp)}
                  </span>
                  <span
                    className={`whitespace-nowrap font-semibold ${
                      ivaIncluido ? 'text-success-700 dark:text-success-300' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {ivaIncluido ? 'IVA incluido' : 'Neto + IVA al cobrar'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
