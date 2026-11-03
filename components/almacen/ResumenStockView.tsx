'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  Search,
  Filter,
  Download,
  PackagePlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import { ColumnPicker } from '@/components/ui/ColumnPicker';
import { useConfigurableColumns } from '@/lib/hooks/useConfigurableColumns';
import type { ColumnConfigItem } from '@/lib/viewPreferences';

interface StockItem {
  id: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  marca: string | null;
  familia: string | null;
  subFamilia: string | null;
  categoria?: string | null;
  proveedorNombre?: string | null;
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


type ColumnKey =
  | 'sku'
  | 'codigoBarras'
  | 'descripcion'
  | 'categoria'
  | 'marca'
  | 'familia'
  | 'subFamilia'
  | 'proveedor'
  | 'almacen'
  | 'ubicacion'
  | 'stockActual'
  | 'stockMinimo'
  | 'stockMaximo'
  | 'unidad'
  | 'estadoStock'
  | 'cantidadSugeridaReposicion'
  | 'ultimoMovimiento';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  sku: 'SKU',
  codigoBarras: 'Código Barras',
  descripcion: 'Descripción',
  categoria: 'Categoría',
  marca: 'Marca',
  familia: 'Familia',
  subFamilia: 'SubFamilia',
  proveedor: 'Proveedor',
  almacen: 'Almacén',
  ubicacion: 'Ubicación',
  stockActual: 'Disponible',
  stockMinimo: 'Mín',
  stockMaximo: 'Máx',
  unidad: 'Unid',
  estadoStock: 'Estado',
  cantidadSugeridaReposicion: 'Sugerido Repos.',
  ultimoMovimiento: 'Último Mov.',
};

const DEFAULT_COLUMN_ORDER: ColumnConfigItem[] = [
  { key: 'sku', visible: true },
  { key: 'codigoBarras', visible: true },
  { key: 'descripcion', visible: true },
  { key: 'categoria', visible: false },
  { key: 'marca', visible: true },
  { key: 'familia', visible: true },
  { key: 'subFamilia', visible: false },
  { key: 'proveedor', visible: false },
  { key: 'almacen', visible: true },
  { key: 'ubicacion', visible: true },
  { key: 'stockActual', visible: true },
  { key: 'stockMinimo', visible: true },
  { key: 'stockMaximo', visible: true },
  { key: 'unidad', visible: true },
  { key: 'estadoStock', visible: true },
  { key: 'cantidadSugeridaReposicion', visible: false },
  { key: 'ultimoMovimiento', visible: false },
];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  sku: 100,
  codigoBarras: 130,
  descripcion: 280,
  categoria: 120,
  marca: 110,
  familia: 150,
  subFamilia: 130,
  proveedor: 150,
  almacen: 140,
  ubicacion: 100,
  stockActual: 100,
  stockMinimo: 70,
  stockMaximo: 70,
  unidad: 70,
  estadoStock: 120,
  cantidadSugeridaReposicion: 110,
  ultimoMovimiento: 140,
};

const ACTIONS_WIDTH = 88;

/** Columnas que el endpoint sabe ordenar (las demás no muestran el control de orden). */
const SORTABLE: Partial<Record<ColumnKey, string>> = {
  sku: 'sku',
  codigoBarras: 'codigoBarras',
  descripcion: 'descripcion',
  categoria: 'categoria',
  marca: 'marca',
  familia: 'familia',
  subFamilia: 'subFamilia',
  proveedor: 'proveedor',
  almacen: 'almacen',
  ubicacion: 'ubicacion',
  stockActual: 'stockActual',
  stockMinimo: 'stockMinimo',
  stockMaximo: 'stockMaximo',
  estadoStock: 'estadoStock',
  cantidadSugeridaReposicion: 'cantidadSugeridaReposicion',
};

const ALIGN: Partial<Record<ColumnKey, 'right' | 'center'>> = {
  stockActual: 'right',
  stockMinimo: 'right',
  stockMaximo: 'right',
  cantidadSugeridaReposicion: 'right',
  unidad: 'center',
  estadoStock: 'center',
};

const formatFechaHora = (val: string | null) =>
  val
    ? new Date(val).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/** Valor plano de una columna (para exportar a CSV). */
function csvValue(key: ColumnKey, it: StockItem): string | number {
  switch (key) {
    case 'sku': return it.sku;
    case 'codigoBarras': return it.codigoBarras || '';
    case 'descripcion': return it.descripcion || '';
    case 'categoria': return it.categoria || '';
    case 'marca': return it.marca || '';
    case 'familia': return it.familia || '';
    case 'subFamilia': return it.subFamilia || '';
    case 'proveedor': return it.proveedorNombre || '';
    case 'almacen': return it.almacenNombre;
    case 'ubicacion': return it.ubicacionCodigo || 'Sin Asignar';
    case 'stockActual': return it.stockActual;
    case 'stockMinimo': return it.stockMinimo;
    case 'stockMaximo': return it.stockMaximo;
    case 'unidad': return it.unidad;
    case 'estadoStock': return it.estadoLabel;
    case 'cantidadSugeridaReposicion': return it.cantidadSugeridaReposicion;
    case 'ultimoMovimiento': return it.ultimoMovimientoAt ? formatFechaHora(it.ultimoMovimientoAt) : 'Sin movimientos';
  }
}

function renderCell(key: ColumnKey, prod: StockItem): React.ReactNode {
  const dash = <span className="text-slate-400">—</span>;
  switch (key) {
    case 'sku':
      return <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{prod.sku}</span>;
    case 'codigoBarras':
      return <span className="font-mono text-[11px] text-slate-500">{prod.codigoBarras || '—'}</span>;
    case 'descripcion':
      return <span className="font-semibold text-slate-900 dark:text-slate-100" title={prod.descripcion}>{prod.descripcion}</span>;
    case 'categoria':
      return <span className="text-slate-600 dark:text-slate-300">{prod.categoria || '—'}</span>;
    case 'marca':
      return <span className="text-slate-600 dark:text-slate-300">{prod.marca || '—'}</span>;
    case 'familia':
      return <span className="text-slate-500">{prod.familia || '—'}</span>;
    case 'subFamilia':
      return <span className="text-slate-500">{prod.subFamilia || '—'}</span>;
    case 'proveedor':
      return <span className="text-slate-600 dark:text-slate-300">{prod.proveedorNombre || '—'}</span>;
    case 'almacen':
      return <span className="text-slate-700 dark:text-slate-300 font-medium">{prod.almacenNombre}</span>;
    case 'ubicacion':
      return prod.ubicacionCodigo ? (
        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold font-mono text-[11px]">
          {prod.ubicacionCodigo}
        </span>
      ) : (
        dash
      );
    case 'stockActual':
      return (
        <span
          className={`font-mono text-xs font-bold ${
            prod.stockActual <= 0
              ? 'text-rose-600 dark:text-rose-400'
              : prod.stockMinimo > 0 && prod.stockActual <= prod.stockMinimo
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {prod.stockActual}
        </span>
      );
    case 'stockMinimo':
      return <span className="font-mono text-[11px] text-slate-500">{prod.stockMinimo > 0 ? prod.stockMinimo : '—'}</span>;
    case 'stockMaximo':
      return <span className="font-mono text-[11px] text-slate-500">{prod.stockMaximo > 0 ? prod.stockMaximo : '—'}</span>;
    case 'unidad':
      return <span className="font-bold text-slate-500 text-[11px] uppercase">{prod.unidad}</span>;
    case 'estadoStock':
      return (
        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wider ${prod.estadoBadge}`}>
          {prod.estadoLabel}
        </span>
      );
    case 'cantidadSugeridaReposicion':
      return (
        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
          {prod.cantidadSugeridaReposicion > 0 ? prod.cantidadSugeridaReposicion : '—'}
        </span>
      );
    case 'ultimoMovimiento':
      return prod.ultimoMovimientoAt ? (
        <span className="text-[11px] text-slate-500">{formatFechaHora(prod.ultimoMovimientoAt)}</span>
      ) : (
        dash
      );
  }
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

  // Columnas configurables (orden, visibilidad y ancho por usuario), como en Gestión Comercial
  const cols = useConfigurableColumns({
    moduleKey: 'almacen_resumen_stock',
    defaultOrder: DEFAULT_COLUMN_ORDER,
    defaultWidths: DEFAULT_COLUMN_WIDTHS,
  });
  const visibleKeys = cols.visibleColumns.map((c) => c.key as ColumnKey);
  const totalTableWidth =
    visibleKeys.reduce((acc, k) => acc + cols.getWidth(k), 0) + ACTIONS_WIDTH;

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

    const esc = (v: string | number) => (typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`);
    const headers = visibleKeys.map((k) => COLUMN_LABELS[k]);
    const rows = items.map((it) => visibleKeys.map((k) => esc(csvValue(k, it))));

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
              onKeyDown={(e) => {
                if (e.key === 'Escape' && search) {
                  setSearch('');
                }
              }}
              placeholder="Buscar SKU, Barra o Descripción (lector compatible)..."
              className="w-full pl-8 pr-7 h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-card focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
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
            <ColumnPicker
              columnOrder={cols.columnOrder}
              labels={COLUMN_LABELS}
              draggedIdx={cols.draggedIdx}
              onToggle={cols.toggleColumn}
              onReset={cols.resetColumns}
              onDragStart={cols.onDragStart}
              onDragOver={cols.onDragOver}
              onDragEnd={cols.onDragEnd}
            />
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all whitespace-nowrap"
              title="Exportar reporte CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
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

      {/* Tabla Operativa Densa de Stock (columnas configurables) */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="text-left text-xs border-collapse"
            style={{ tableLayout: 'fixed', width: totalTableWidth, minWidth: '100%' }}
          >
            <colgroup>
              {visibleKeys.map((k) => (
                <col key={k} style={{ width: cols.getWidth(k) }} />
              ))}
              <col style={{ width: ACTIONS_WIDTH }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none whitespace-nowrap">
                {visibleKeys.map((k) => {
                  const sortKey = SORTABLE[k];
                  const isSorted = !!sortKey && sortBy === sortKey;
                  const align = ALIGN[k];
                  return (
                    <th
                      key={k}
                      onClick={() => {
                        if (!sortKey) return;
                        if (sortBy === sortKey) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(sortKey);
                          setSortOrder('asc');
                        }
                        setPage(1);
                      }}
                      className={`py-2.5 px-2.5 relative group/resize overflow-hidden transition-colors ${
                        sortKey ? 'cursor-pointer hover:text-slate-800 dark:hover:text-slate-200' : ''
                      } ${isSorted ? 'text-primary dark:text-primary bg-primary/[0.04]' : ''} ${
                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
                      }`}
                      title={sortKey ? `Ordenar por ${COLUMN_LABELS[k]}` : COLUMN_LABELS[k]}
                    >
                      <div
                        className={`flex items-center gap-1 overflow-hidden ${
                          align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''
                        }`}
                      >
                        <span className="truncate">{COLUMN_LABELS[k]}</span>
                        {sortKey &&
                          (isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-primary shrink-0" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-primary shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-35 shrink-0" />
                          ))}
                      </div>
                      {/* Redimensionar columna */}
                      <div
                        onMouseDown={(e) => cols.startResize(e, k)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize group-hover/resize:bg-primary/30 hover:!bg-primary/60 transition-colors"
                        title="Arrastrar para redimensionar"
                      />
                    </th>
                  );
                })}
                <th className="py-2.5 px-2.5 text-right sticky right-0 bg-slate-50 dark:bg-slate-900">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={visibleKeys.length + 1} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Consultando existencias de almacén...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={visibleKeys.length + 1} className="py-10 text-center text-slate-400">
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
                    {visibleKeys.map((k) => {
                      const align = ALIGN[k];
                      return (
                        <td
                          key={k}
                          className={`py-2 px-2.5 whitespace-nowrap overflow-hidden text-ellipsis ${
                            align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
                          }`}
                        >
                          {renderCell(k, prod)}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2.5 text-right whitespace-nowrap sticky right-0 bg-card">
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
