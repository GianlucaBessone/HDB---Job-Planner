'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  Search,
  Filter,
  Download,
  PackagePlus,
  ArrowUpDown,
  History,
  Barcode,
  Loader2,
  RefreshCw,
  AlertCircle,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sliders,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface StockItem {
  id: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  marca: string | null;
  familia: string | null;
  subFamilia: string | null;
  unidad: string;
  unidadDecimales: number;
  almacenId: string | null;
  almacenNombre: string;
  almacenCodigo: string | null;
  ubicacionId: string | null;
  ubicacionCodigo: string | null;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  estadoStock: 'normal' | 'bajo_minimo' | 'sin_stock' | 'sobre_maximo' | 'no_configurado';
  estadoLabel: string;
  estadoBadge: string;
  cantidadSugeridaReposicion: number;
  ultimoMovimientoAt: string | null;
}

interface MetaData {
  almacenes: Array<{ id: string; codigo: string; nombre: string; ubicaciones: Array<{ id: string; codigo: string }> }>;
  familias: Array<{ id: string; nombre: string }>;
  marcas: Array<{ id: string; nombre: string }>;
}

interface ResumenStockViewProps {
  meta: MetaData;
  onNavigateToAjuste?: (producto?: { id: string; sku: string; descripcion: string; stockActual: number; almacenId?: string | null }) => void;
  onNavigateToMovimientos?: (sku?: string) => void;
  onNavigateToConteo?: (productoId?: string) => void;
}

export default function ResumenStockView({
  meta,
  onNavigateToAjuste,
  onNavigateToMovimientos,
  onNavigateToConteo,
}: ResumenStockViewProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filtros
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAlmacen, setSelectedAlmacen] = useState('');
  const [selectedUbicacion, setSelectedUbicacion] = useState('');
  const [selectedFamilia, setSelectedFamilia] = useState('');
  const [selectedMarca, setSelectedMarca] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [sortBy, setSortBy] = useState('sku');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Cargar datos
  const fetchStock = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      if (selectedAlmacen) params.set('almacenId', selectedAlmacen);
      if (selectedUbicacion) params.set('ubicacionId', selectedUbicacion);
      if (selectedFamilia) params.set('familiaId', selectedFamilia);
      if (selectedMarca) params.set('marcaId', selectedMarca);
      if (selectedEstado) params.set('estadoStock', selectedEstado);
      params.set('page', String(page));
      params.set('limit', '50');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/almacen/stock?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar stock');

      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      showToast(err.message || 'Error cargando existencias', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [page, debouncedSearch, selectedAlmacen, selectedUbicacion, selectedFamilia, selectedMarca, selectedEstado, sortBy, sortOrder]);

  // Ubicaciones del almacén seleccionado
  const ubicacionesDisponibles =
    meta.almacenes.find((a) => a.id === selectedAlmacen)?.ubicaciones || [];

  // Exportar a CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      showToast('No hay datos para exportar con los filtros actuales', 'info');
      return;
    }

    const headers = [
      'SKU',
      'Código Barras',
      'Descripción',
      'Marca',
      'Familia',
      'Almacén',
      'Ubicación',
      'Stock Disponible',
      'Stock Mínimo',
      'Stock Máximo',
      'Unidad',
      'Estado',
      'Último Movimiento',
    ];

    const rows = items.map((it) => [
      `"${it.sku}"`,
      `"${it.codigoBarras || ''}"`,
      `"${(it.descripcion || '').replace(/"/g, '""')}"`,
      `"${it.marca || ''}"`,
      `"${it.familia || ''}"`,
      `"${it.almacenNombre}"`,
      `"${it.ubicacionCodigo || 'Sin Asignar'}"`,
      it.stockActual,
      it.stockMinimo,
      it.stockMaximo,
      `"${it.unidad}"`,
      `"${it.estadoLabel}"`,
      `"${it.ultimoMovimientoAt ? new Date(it.ultimoMovimientoAt).toLocaleString() : 'Sin movimientos'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Resumen_Stock_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Archivo CSV exportado exitosamente', 'success');
  };

  return (
    <div className="space-y-3">
      {/* Barra de Filtros Compacta estilo ERP (Todo en 1 fila) */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Buscador Rápido con soporte Lector de Código de Barras */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar SKU, Barra o Descripción (lector compatible)..."
              className="w-full pl-8 pr-7 h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Selectores de Filtro Compactos en la misma fila */}
          <select
            value={selectedAlmacen}
            onChange={(e) => {
              setSelectedAlmacen(e.target.value);
              setSelectedUbicacion('');
              setPage(1);
            }}
            className="h-8 px-2 min-w-[130px] rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos Almacenes</option>
            {meta.almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>

          <select
            value={selectedUbicacion}
            onChange={(e) => {
              setSelectedUbicacion(e.target.value);
              setPage(1);
            }}
            disabled={!selectedAlmacen}
            className="h-8 px-2 min-w-[120px] rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="">Ubicaciones</option>
            {ubicacionesDisponibles.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo}
              </option>
            ))}
          </select>

          <select
            value={selectedFamilia}
            onChange={(e) => {
              setSelectedFamilia(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2 min-w-[120px] rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Familias</option>
            {meta.familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>

          <select
            value={selectedMarca}
            onChange={(e) => {
              setSelectedMarca(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2 min-w-[110px] rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Marcas</option>
            {meta.marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>

          <select
            value={selectedEstado}
            onChange={(e) => {
              setSelectedEstado(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2 min-w-[115px] rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Estados</option>
            <option value="normal">Normal</option>
            <option value="bajo_minimo">Bajo Mínimo</option>
            <option value="sin_stock">Sin Stock</option>
            <option value="sobre_maximo">Sobre Máximo</option>
            <option value="no_configurado">Sin Límites</option>
          </select>

          {/* Acciones Rápidas (CSV y Refrescar) */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all"
              title="Exportar reporte CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={fetchStock}
              disabled={loading}
              className="p-1.5 h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-50"
              title="Refrescar existencias"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla Operativa Densa de Stock */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-black text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 w-28">SKU</th>
                <th className="py-2.5 px-2 w-32 hidden md:table-cell">Código Barras</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-2 hidden lg:table-cell">Marca</th>
                <th className="py-2.5 px-2 hidden xl:table-cell">Familia</th>
                <th className="py-2.5 px-2.5">Almacén</th>
                <th className="py-2.5 px-2.5">Ubicación</th>
                <th className="py-2.5 px-3 text-right">Disponible</th>
                <th className="py-2.5 px-2 text-right hidden sm:table-cell">Mín</th>
                <th className="py-2.5 px-2 text-right hidden sm:table-cell">Máx</th>
                <th className="py-2.5 px-2 text-center w-14">Unid</th>
                <th className="py-2.5 px-2.5 text-center">Estado</th>
                <th className="py-2.5 px-2.5 text-right w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Consultando existencias de almacén...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-slate-400">
                    <AlertCircle className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No se encontraron existencias</p>
                    <p className="text-[11px] mt-0.5">Pruebe ajustando o limpiando los filtros de búsqueda.</p>
                  </td>
                </tr>
              ) : (
                items.map((prod) => (
                  <tr
                    key={`${prod.id}_${prod.almacenId}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {prod.sku}
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-slate-500 hidden md:table-cell whitespace-nowrap">
                      {prod.codigoBarras || '—'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate" title={prod.descripcion}>
                      {prod.descripcion}
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300 hidden lg:table-cell truncate">
                      {prod.marca || '—'}
                    </td>
                    <td className="py-2 px-2 text-slate-500 hidden xl:table-cell truncate">
                      {prod.familia || '—'}
                    </td>
                    <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                      {prod.almacenNombre}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap font-mono text-[11px]">
                      {prod.ubicacionCodigo ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                          {prod.ubicacionCodigo}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <span
                        className={`font-mono text-xs font-black ${
                          prod.stockActual <= 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : prod.stockMinimo > 0 && prod.stockActual <= prod.stockMinimo
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {prod.stockActual}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-500 hidden sm:table-cell">
                      {prod.stockMinimo > 0 ? prod.stockMinimo : '—'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-500 hidden sm:table-cell">
                      {prod.stockMaximo > 0 ? prod.stockMaximo : '—'}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-500 text-[10px] uppercase">
                      {prod.unidad}
                    </td>
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${prod.estadoBadge}`}
                      >
                        {prod.estadoLabel}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onNavigateToAjuste && onNavigateToAjuste(prod)}
                          className="p-1 rounded text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Ajustar existencia"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onNavigateToMovimientos && onNavigateToMovimientos(prod.sku)}
                          className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Ver historial de movimientos (Kardex)"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Compacta */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
          <span>
            Total: <strong>{total}</strong> registros {selectedEstado ? `(Filtro: ${selectedEstado})` : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-background disabled:opacity-40 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Anterior
            </button>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-background disabled:opacity-40 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
