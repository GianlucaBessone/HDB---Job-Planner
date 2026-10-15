'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Download,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Package,
  Loader2,
  Info,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface FaltanteItem {
  id: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  marca: string | null;
  familia: string | null;
  almacenNombre: string;
  ubicacionCodigo: string | null;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  unidad: string;
  estadoStock: string;
  estadoLabel: string;
  estadoBadge: string;
  cantidadSugeridaReposicion: number;
  proveedorNombre: string | null;
}

interface MetaData {
  almacenes: Array<{ id: string; codigo: string; nombre: string }>;
  familias: Array<{ id: string; nombre: string }>;
}

interface FaltantesViewProps {
  meta: MetaData;
  onAdjustProduct?: (prod: any) => void;
}

export default function FaltantesView({ meta, onAdjustProduct }: FaltantesViewProps) {
  const [items, setItems] = useState<FaltanteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedAlmacen, setSelectedAlmacen] = useState('');
  const [selectedFamilia, setSelectedFamilia] = useState('');
  const [condicion, setCondicion] = useState<string>('necesitan_reposicion');

  const fetchFaltantes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (selectedAlmacen) params.set('almacenId', selectedAlmacen);
      if (selectedFamilia) params.set('familiaId', selectedFamilia);
      params.set('condicion', condicion);

      const res = await fetch(`/api/almacen/faltantes?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener faltantes');

      setItems(data.items || []);
    } catch (err: any) {
      showToast(err.message || 'Error cargando datos de reposición', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaltantes();
  }, [selectedAlmacen, selectedFamilia, condicion]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFaltantes();
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      showToast('No hay datos para exportar con los filtros seleccionados', 'info');
      return;
    }

    const headers = [
      'SKU',
      'Descripción',
      'Marca',
      'Familia',
      'Almacén',
      'Stock Actual',
      'Stock Mínimo',
      'Stock Máximo',
      'Sugerencia Reposición',
      'Unidad',
      'Estado',
      'Proveedor Habitual',
    ];

    const rows = items.map((it) => [
      `"${it.sku}"`,
      `"${it.descripcion.replace(/"/g, '""')}"`,
      `"${it.marca || ''}"`,
      `"${it.familia || ''}"`,
      `"${it.almacenNombre}"`,
      it.stockActual,
      it.stockMinimo,
      it.stockMaximo,
      it.cantidadSugeridaReposicion,
      `"${it.unidad}"`,
      `"${it.estadoLabel}"`,
      `"${it.proveedorNombre || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Faltantes_Reposicion_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte de reposición exportado', 'success');
  };

  const articulosCriticos = items.filter((it) => it.stockActual <= 0).length;
  const articulosBajoMinimo = items.filter((it) => it.stockActual > 0 && it.stockActual <= it.stockMinimo).length;
  const totalSugerido = items.reduce((acc, it) => acc + (it.cantidadSugeridaReposicion || 0), 0);

  return (
    <div className="space-y-3">
      {/* Aviso Operativo de Reposición */}
      <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Cálculo Operativo de Reposición:</strong> La sugerencia se calcula mediante la fórmula{' '}
          <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 font-mono font-bold">
            máximo(0, Stock Máximo - Stock Actual)
          </code>{' '}
          únicamente cuando existe un stock máximo configurado. Esta vista constituye una guía de necesidades para inventario; no emite órdenes de compra automáticas.
        </div>
      </div>

      {/* Resumen Superior de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total en Lista</span>
          <span className="font-mono text-base font-black text-slate-900 dark:text-slate-100">{items.length}</span>
        </div>
        <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">Sin Stock (Quiebre)</span>
          <span className="font-mono text-base font-black text-rose-700 dark:text-rose-400">{articulosCriticos}</span>
        </div>
        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">Bajo Mínimo</span>
          <span className="font-mono text-base font-black text-amber-700 dark:text-amber-400">{articulosBajoMinimo}</span>
        </div>
        <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-400 block">Unidades Sugeridas</span>
          <span className="font-mono text-base font-black text-indigo-700 dark:text-indigo-400">+{totalSugerido} u.</span>
        </div>
      </div>

      {/* Filtros Rápidos */}
      <form onSubmit={handleSearchSubmit} className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar SKU o descripción..."
              className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              title="Exportar reporte CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              type="button"
              onClick={fetchFaltantes}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title="Refrescar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Fila de Filtros y Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          <select
            value={condicion}
            onChange={(e) => setCondicion(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="necesitan_reposicion">Requieren Reposición (Sin stock + Bajo Mínimo)</option>
            <option value="sin_stock">Solo Sin Stock (0 u.)</option>
            <option value="bajo_minimo">Solo Bajo Mínimo</option>
            <option value="sobre_maximo">Sobre Máximo</option>
            <option value="sin_limites">Sin Límites Configurados</option>
            <option value="todos">Todos los Productos</option>
          </select>

          <select
            value={selectedAlmacen}
            onChange={(e) => setSelectedAlmacen(e.target.value)}
            className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="">Todos los Almacenes</option>
            {meta.almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>

          <select
            value={selectedFamilia}
            onChange={(e) => setSelectedFamilia(e.target.value)}
            className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="">Todas las Familias</option>
            {meta.familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
      </form>

      {/* Tabla de Reposición */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-black text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 w-28">SKU</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-2.5 hidden md:table-cell">Marca</th>
                <th className="py-2.5 px-2.5">Almacén</th>
                <th className="py-2.5 px-3 text-right w-24">Actual</th>
                <th className="py-2.5 px-2.5 text-right w-20">Mín</th>
                <th className="py-2.5 px-2.5 text-right w-20">Máx</th>
                <th className="py-2.5 px-3 text-right w-32">Sugerido Reponer</th>
                <th className="py-2.5 px-2 text-center w-14">Unid</th>
                <th className="py-2.5 px-2.5 text-center">Estado</th>
                <th className="py-2.5 px-3 hidden lg:table-cell">Proveedor Habitual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Calculando sugerencias de reposición...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    <Package className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No se detectaron faltantes</p>
                    <p className="text-[11px] mt-0.5">Todas las existencias están dentro de los márgenes configurados.</p>
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={`${it.id}_${it.almacenNombre}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {it.sku}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs" title={it.descripcion}>
                      {it.descripcion}
                    </td>
                    <td className="py-2 px-2.5 text-slate-500 hidden md:table-cell truncate">
                      {it.marca || '—'}
                    </td>
                    <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {it.almacenNombre}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <span
                        className={`font-mono text-xs font-black ${
                          it.stockActual <= 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : it.stockMinimo > 0 && it.stockActual <= it.stockMinimo
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {it.stockActual}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-[11px] text-slate-500">
                      {it.stockMinimo > 0 ? it.stockMinimo : '—'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-[11px] text-slate-500">
                      {it.stockMaximo > 0 ? it.stockMaximo : '—'}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {it.cantidadSugeridaReposicion > 0 ? (
                        <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 inline-flex items-center">
                          <TrendingUp className="w-3.5 h-3.5 mr-0.5 inline" />
                          +{it.cantidadSugeridaReposicion}
                        </span>
                      ) : (
                        <span className="font-mono text-slate-400 text-xs">0</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-[10px] text-slate-500 uppercase">
                      {it.unidad}
                    </td>
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${it.estadoBadge}`}
                      >
                        {it.estadoLabel}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell truncate max-w-xs">
                      {it.proveedorNombre || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
