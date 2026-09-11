'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  Search,
  Plus,
  ChevronDown,
  Percent,
  FileSpreadsheet,
  PackagePlus,
  History,
  Settings2,
  SlidersHorizontal,
  X,
  Edit2,
  Trash2,
  Barcode,
  ArrowUpDown,
  Check,
  RotateCcw,
  Loader2,
  TrendingUp,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import ProductoFormModal from '@/components/ventas/ProductoFormModal';
import AjusteLotesModal from '@/components/ventas/AjusteLotesModal';
import ImportarExcelModal from '@/components/ventas/ImportarExcelModal';
import HistorialProductoModal from '@/components/ventas/HistorialProductoModal';
import AjusteStockModal from '@/components/ventas/AjusteStockModal';
import ConfigListasPreciosModal from '@/components/ventas/ConfigListasPreciosModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import { formatARS } from '@/lib/formatCurrency';

interface ProductoItem {
  id: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  categoria: string | null;
  categoriaId: string | null;
  marca: string | null;
  marcaId: string | null;
  familia: string | null;
  familiaId: string | null;
  subFamilia: string | null;
  subFamiliaId: string | null;
  unidad: string | null;
  unidadId: string | null;
  unidadCodigo: string | null;
  iva: string;
  ivaPorcentaje: number;
  ivaId: string | null;
  rentabilidad: number;
  proveedorNombre: string | null;
  proveedorId: string | null;
  skuProveedor: string | null;
  costo: number;
  precioBase: number;
  almacenNombre: string;
  almacenId: string | null;
  ubicacionCodigo: string | null;
  ubicacionId: string | null;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  estadoStock: 'normal' | 'bajo' | 'sin_stock' | 'sobre_stock';
}

interface MetaData {
  proveedores: Array<{ id: string; razonSocial: string; nombreFantasia?: string | null; cuit: string }>;
  marcas: Array<{ id: string; nombre: string }>;
  familias: Array<{ id: string; nombre: string; subfamilias: Array<{ id: string; nombre: string }> }>;
  almacenes: Array<{ id: string; codigo: string; nombre: string; ubicaciones: Array<{ id: string; codigo: string }> }>;
  alicuotasIva: Array<{ id: string; porcentaje: number; nombre: string; predeterminado: boolean }>;
  listasPrecios: Array<{
    id: string;
    codigo: string;
    nombre: string;
    orden: number;
    tipoAjuste?: string | null;
    valorAjuste?: number | null;
    listaBaseId?: string | null;
    aplicaA?: string | null;
    familiaId?: string | null;
    marcaId?: string | null;
  }>;
}

const DEFAULT_COLUMNS = {
  sku: true,
  codigoBarras: true,
  descripcion: true,
  categoria: true,
  marca: true,
  familia: true,
  subFamilia: true,
  unidad: true,
  proveedor: true,
  costo: true,
  iva: true,
  rentabilidad: true,
  precioBase: true,
  almacen: true,
  stock: true,
};

export default function VentasGestionPage() {
  const router = useRouter();

  // Data state
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMarca, setSelectedMarca] = useState('');
  const [selectedFamilia, setSelectedFamilia] = useState('');
  const [selectedSubFamilia, setSelectedSubFamilia] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [selectedAlmacen, setSelectedAlmacen] = useState('');
  const [selectedEstadoStock, setSelectedEstadoStock] = useState('');
  const [sortBy, setSortBy] = useState('sku');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Metadata
  const [meta, setMeta] = useState<MetaData>({
    proveedores: [],
    marcas: [],
    familias: [],
    almacenes: [],
    alicuotasIva: [],
    listasPrecios: [],
  });

  // Cascading subfamilies for the selected family
  const availableSubFamilias = useMemo(() => {
    if (!selectedFamilia) return [];
    const fam = meta.familias.find((f) => f.id === selectedFamilia);
    return fam?.subfamilias || [];
  }, [selectedFamilia, meta.familias]);

  // Configurable Columns
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  // Dropdown menus
  const [isPreciosMenuOpen, setIsPreciosMenuOpen] = useState(false);
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<ProductoItem | null>(null);

  const [isLotesModalOpen, setIsLotesModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isConfigListasOpen, setIsConfigListasOpen] = useState(false);

  const [isHistorialOpen, setIsHistorialOpen] = useState(false);
  const [selectedHistorialProd, setSelectedHistorialProd] = useState<ProductoItem | null>(null);

  const [isAjusteStockOpen, setIsAjusteStockOpen] = useState(false);
  const [selectedStockProd, setSelectedStockProd] = useState<ProductoItem | null>(null);

  const [deleteConfirmProd, setDeleteConfirmProd] = useState<ProductoItem | null>(null);

  // Inline Quick Price Editing Mode (keyed by prodId -> precioBase)
  const [isQuickPriceMode, setIsQuickPriceMode] = useState(false);
  const [pendingPriceChanges, setPendingPriceChanges] = useState<Record<string, number>>({});
  const [isSavingQuickPrices, setIsSavingQuickPrices] = useState(false);
  const pendingCount = Object.keys(pendingPriceChanges).length;

  // Search input ref for scanner
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setIsPreciosMenuOpen(false);
        setIsStockMenuOpen(false);
        setIsColumnPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Load Metadata
  const loadMeta = useCallback(() => {
    fetch('/api/ventas/meta')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setMeta(data);
      })
      .catch((err) => console.error('Error loading meta:', err));
  }, []);

  useEffect(() => {
    loadMeta();

    const savedCols = localStorage.getItem('hdb_ventas_columns');
    if (savedCols) {
      try {
        setColumns(JSON.parse(savedCols));
      } catch {}
    }
  }, [loadMeta]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load Products
  const loadProductos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch) params.set('q', debouncedSearch);
      if (selectedMarca) params.set('marcaId', selectedMarca);
      if (selectedFamilia) params.set('familiaId', selectedFamilia);
      if (selectedSubFamilia) params.set('subFamiliaId', selectedSubFamilia);
      if (selectedProveedor) params.set('proveedorId', selectedProveedor);
      if (selectedAlmacen) params.set('almacenId', selectedAlmacen);
      if (selectedEstadoStock) params.set('estadoStock', selectedEstadoStock);

      const res = await fetch(`/api/ventas/productos?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setProductos(data.productos || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        showToast(data.error || 'Error al cargar productos', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedMarca, selectedFamilia, selectedSubFamilia, selectedProveedor, selectedAlmacen, selectedEstadoStock, sortBy, sortOrder]);

  useEffect(() => {
    loadProductos();
  }, [loadProductos]);

  // Handle column toggle
  const toggleColumn = (col: keyof typeof DEFAULT_COLUMNS) => {
    const updated = { ...columns, [col]: !columns[col] };
    setColumns(updated);
    localStorage.setItem('hdb_ventas_columns', JSON.stringify(updated));
  };

  // Inline Quick Price Change Handler (Direct base price)
  const handleQuickPriceChange = (prodId: string, value: number) => {
    setPendingPriceChanges((prev) => ({
      ...prev,
      [prodId]: value,
    }));
  };

  // Cancel Quick Price Mode
  const handleCancelQuickPrices = () => {
    setPendingPriceChanges({});
    setIsQuickPriceMode(false);
  };

  // Save Quick Prices
  const handleSaveQuickPrices = async () => {
    const changesList: Array<{ productoId: string; precioBase: number }> = [];

    Object.entries(pendingPriceChanges).forEach(([prodId, val]) => {
      if (val !== undefined && !isNaN(val)) {
        changesList.push({ productoId: prodId, precioBase: val });
      }
    });

    if (changesList.length === 0) {
      setIsQuickPriceMode(false);
      return;
    }

    setIsSavingQuickPrices(true);
    try {
      const res = await fetch('/api/ventas/precios/ajuste-rapido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cambios: changesList }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar cambios');

      showToast(data.message || 'Precios base actualizados con éxito', 'success');
      setPendingPriceChanges({});
      setIsQuickPriceMode(false);
      loadProductos();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar cambios', 'error');
    } finally {
      setIsSavingQuickPrices(false);
    }
  };

  // Soft Delete Handler
  const handleDeleteProduct = async () => {
    if (!deleteConfirmProd) return;
    try {
      const res = await fetch(`/api/ventas/productos/${deleteConfirmProd.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      showToast('Producto dado de baja con éxito', 'success');
      setDeleteConfirmProd(null);
      loadProductos();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar producto', 'error');
    }
  };

  // Active filters count
  const activeFiltersCount = [
    selectedMarca,
    selectedFamilia,
    selectedSubFamilia,
    selectedProveedor,
    selectedAlmacen,
    selectedEstadoStock,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedMarca('');
    setSelectedFamilia('');
    setSelectedSubFamilia('');
    setSelectedProveedor('');
    setSelectedAlmacen('');
    setSelectedEstadoStock('');
    setSearchTerm('');
  };

  // Compact dot indicator for stock
  const renderCompactStock = (prod: ProductoItem) => {
    switch (prod.estadoStock) {
      case 'sin_stock':
        return (
          <div className="flex items-center justify-center gap-1.5" title="Sin Stock (0 u.)">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">0 u.</span>
          </div>
        );
      case 'bajo':
        return (
          <div className="flex items-center justify-center gap-1.5" title={`Stock Bajo (≤ mín: ${prod.stockMinimo})`}>
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{prod.stockActual} u.</span>
          </div>
        );
      case 'sobre_stock':
        return (
          <div className="flex items-center justify-center gap-1.5" title={`Sobre Stock (> máx: ${prod.stockMaximo})`}>
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">{prod.stockActual} u.</span>
          </div>
        );
      case 'normal':
      default:
        return (
          <div className="flex items-center justify-center gap-1.5" title={`Stock Normal (Mín: ${prod.stockMinimo} / Máx: ${prod.stockMaximo})`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{prod.stockActual} u.</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      {/* 4-Area Navigation Tabs (Height: ~36px) */}
      <VentasNavTabs currentTab="gestion" />

      {/* Unified Compact ERP Toolbar (Rows 1 & 2 in single card) */}
      <div className="bg-card px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        {/* Row 1: Title + Total Badge + Action Menus + New Product CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Title & Count */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Boxes className="w-4 h-4" />
            </div>
            <h1 className="text-sm md:text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
              Gestión Comercial
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
              {total} {total === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          {/* Right: Actions Dropdowns & CTA */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Precios Dropdown */}
            <div className="relative" data-dropdown>
              <button
                onClick={() => {
                  setIsPreciosMenuOpen(!isPreciosMenuOpen);
                  setIsStockMenuOpen(false);
                  setIsColumnPickerOpen(false);
                }}
                className={`flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-bold transition-colors shadow-sm ${
                  isQuickPriceMode
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 bg-background text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Percent className="w-3.5 h-3.5 text-indigo-500" />
                Precios
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isPreciosMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-56 bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 space-y-0.5 animate-in fade-in duration-150"
                  onClick={() => setIsPreciosMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      setIsQuickPriceMode(!isQuickPriceMode);
                      if (isQuickPriceMode) setPendingPriceChanges({});
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                  >
                    <span className={`w-2 h-2 rounded-full ${isQuickPriceMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {isQuickPriceMode ? 'Desactivar Ajuste Rápido' : 'Edición Rápida de Precios'}
                  </button>
                  <button
                    onClick={() => setIsLotesModalOpen(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                  >
                    <Percent className="w-3.5 h-3.5 text-indigo-500" />
                    Ajuste Masivo por Lotes
                  </button>
                  <button
                    onClick={() => setIsExcelModalOpen(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    Importar desde Excel
                  </button>
                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                  <button
                    onClick={() => setIsConfigListasOpen(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-primary"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-primary" />
                    Configurar Listas de Precios
                  </button>
                </div>
              )}
            </div>

            {/* Stock Dropdown */}
            <div className="relative" data-dropdown>
              <button
                onClick={() => {
                  setIsStockMenuOpen(!isStockMenuOpen);
                  setIsPreciosMenuOpen(false);
                  setIsColumnPickerOpen(false);
                }}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
              >
                <PackagePlus className="w-3.5 h-3.5 text-amber-500" />
                Stock
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isStockMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-52 bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 space-y-0.5 animate-in fade-in duration-150"
                  onClick={() => setIsStockMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      if (productos.length > 0) {
                        setSelectedStockProd(productos[0]);
                        setIsAjusteStockOpen(true);
                      } else {
                        showToast('No hay productos disponibles para ajustar', 'info');
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                  >
                    <PackagePlus className="w-3.5 h-3.5 text-amber-500" />
                    Ajuste Rápido de Stock
                  </button>
                  <button
                    onClick={() => showToast('Conteo físico disponible en Fase 2 — Almacén', 'info')}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-400"
                  >
                    <span>Conteo de Stock</span>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600">
                      Fase 2
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (productos.length > 0) {
                        setSelectedHistorialProd(productos[0]);
                        setIsHistorialOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-200"
                  >
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    Historial de Movimientos
                  </button>
                </div>
              )}
            </div>

            {/* Configurable Columns */}
            <div className="relative" data-dropdown>
              <button
                onClick={() => {
                  setIsColumnPickerOpen(!isColumnPickerOpen);
                  setIsPreciosMenuOpen(false);
                  setIsStockMenuOpen(false);
                }}
                className="flex items-center gap-1 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                title="Configurar columnas visibles"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Columnas</span>
              </button>

              {isColumnPickerOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2.5 space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Columnas Visibles
                    </span>
                    <button onClick={() => setIsColumnPickerOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
                    {Object.entries(columns).map(([key, isVisible]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleColumn(key as any)}
                          className="rounded border-slate-300 text-primary h-3.5 w-3.5"
                        />
                        <span className="capitalize text-xs font-medium text-slate-700 dark:text-slate-300">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Importar Productos (Pantalla Completa) */}
            <button
              onClick={() => router.push('/ventas/gestion/productos/importar')}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
              title="Importar productos masivamente desde Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Importar Productos</span>
            </button>

            {/* Nuevo Producto (Pantalla Completa) */}
            <button
              onClick={() => router.push('/ventas/gestion/productos/nuevo')}
              className="flex items-center gap-1 h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold shadow-sm shadow-primary/25 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search Input (~40-45%) + Inline Filter Selects + Reset */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {/* Integrated Search Input with Scanner shortcut */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar SKU, código de barras, descripción, marca..."
              className="w-full h-8 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                title="Compatible con escáner USB"
              >
                <Barcode className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Inline Filter Selects */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {/* Marca */}
            <select
              value={selectedMarca}
              onChange={(e) => {
                setSelectedMarca(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-medium max-w-[130px] truncate focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas las Marcas</option>
              {meta.marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>

            {/* Familia */}
            <select
              value={selectedFamilia}
              onChange={(e) => {
                setSelectedFamilia(e.target.value);
                setSelectedSubFamilia('');
                setPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-medium max-w-[130px] truncate focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas las Familias</option>
              {meta.familias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>

            {/* SubFamilia (Cascada dependiente de Familia) */}
            <select
              value={selectedSubFamilia}
              disabled={!selectedFamilia}
              onChange={(e) => {
                setSelectedSubFamilia(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-medium max-w-[130px] truncate focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
            >
              <option value="">{selectedFamilia ? 'Todas las Subfam.' : 'Selec. Familia...'}</option>
              {availableSubFamilias.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.nombre}
                </option>
              ))}
            </select>

            {/* Proveedor */}
            <select
              value={selectedProveedor}
              onChange={(e) => {
                setSelectedProveedor(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-medium max-w-[140px] truncate focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos los Prov.</option>
              {meta.proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreFantasia || p.razonSocial}
                </option>
              ))}
            </select>

            {/* Almacén */}
            <select
              value={selectedAlmacen}
              onChange={(e) => {
                setSelectedAlmacen(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-medium max-w-[125px] truncate focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos Almacenes</option>
              {meta.almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>

            {/* Semáforo Stock */}
            <select
              value={selectedEstadoStock}
              onChange={(e) => {
                setSelectedEstadoStock(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-medium max-w-[125px] truncate focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos Stocks</option>
              <option value="normal">Normal</option>
              <option value="bajo">Stock Bajo</option>
              <option value="sin_stock">Sin Stock</option>
              <option value="sobre_stock">Sobre Stock</option>
            </select>

            {/* Reset Filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 h-8 px-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 text-xs transition-colors"
                title="Limpiar filtros activos"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpiar ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slim Quick Pricing Notification Banner (Height: ~36px) */}
      {isQuickPriceMode && (
        <div className="h-9 px-3 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/40 flex items-center justify-between text-xs animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span className="font-bold text-amber-900 dark:text-amber-200">
              Edición Rápida de Precios Activa:
            </span>
            <span className="text-amber-700 dark:text-amber-400 hidden sm:inline">
              Modifique los precios directamente en la tabla.
            </span>
            {pendingCount > 0 && (
              <span className="font-black text-amber-800 dark:text-amber-300">
                ({pendingCount} productos modificados pendientes)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCancelQuickPrices}
              className="h-6 px-2 rounded bg-background border border-amber-300 dark:border-amber-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              disabled={isSavingQuickPrices || pendingCount === 0}
              onClick={handleSaveQuickPrices}
              className="flex items-center gap-1 h-6 px-2.5 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSavingQuickPrices ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Guardar ({pendingCount})
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container: ERP Density & Viewport Height Pinned */}
      <div className="flex-1 min-h-[480px] max-h-[calc(100vh-250px)] flex flex-col bg-card rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Table Scroll Area */}
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
              <tr>
                {columns.sku && (
                  <th
                    onClick={() => {
                      setSortBy('sku');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="py-2 px-2.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <div className="flex items-center gap-1">
                      SKU
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                )}
                {columns.codigoBarras && <th className="py-2 px-2">Cód. Barras</th>}
                {columns.descripcion && (
                  <th
                    onClick={() => {
                      setSortBy('descripcion');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="py-2 px-2.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <div className="flex items-center gap-1">
                      Descripción
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                )}
                {columns.categoria && <th className="py-2 px-2">Categoría</th>}
                {columns.marca && <th className="py-2 px-2">Marca</th>}
                {columns.familia && <th className="py-2 px-2">Familia</th>}
                {columns.subFamilia && <th className="py-2 px-2">SubFamilia</th>}
                {columns.unidad && <th className="py-2 px-2 text-center">Unidad</th>}
                {columns.proveedor && <th className="py-2 px-2">Proveedor</th>}
                {columns.costo && <th className="py-2 px-2 text-right">Costo</th>}
                {columns.iva && <th className="py-2 px-2 text-center">IVA</th>}
                {columns.rentabilidad && <th className="py-2 px-2 text-center">Margen</th>}
                {columns.precioBase && <th className="py-2 px-2 text-right">Precio Base (ARS)</th>}
                {columns.almacen && <th className="py-2 px-2">Ubicación</th>}
                {columns.stock && <th className="py-2 px-2 text-center">Stock</th>}
                <th className="py-2 px-2 text-center sticky right-0 bg-slate-100 dark:bg-slate-800 shadow-sm w-28">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={16} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    <span>Cargando productos comerciales...</span>
                  </td>
                </tr>
              ) : productos.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-16 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      No se encontraron productos
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Intente cambiar los filtros o crear un nuevo producto.
                    </p>
                  </td>
                </tr>
              ) : (
                productos.map((prod) => {
                  const pending = pendingPriceChanges[prod.id];

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        pending ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* SKU */}
                      {columns.sku && (
                        <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {prod.sku}
                        </td>
                      )}

                      {/* Barcode */}
                      {columns.codigoBarras && (
                        <td className="py-1.5 px-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {prod.codigoBarras ? (
                            <span className="flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-slate-400" />
                              {prod.codigoBarras}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      )}

                      {/* Descripción */}
                      {columns.descripcion && (
                        <td
                          className="py-1.5 px-2.5 max-w-[240px] truncate text-slate-800 dark:text-slate-200 font-semibold text-xs"
                          title={prod.descripcion}
                        >
                          {prod.descripcion}
                        </td>
                      )}

                      {/* Categoría */}
                      {columns.categoria && (
                        <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap truncate max-w-[100px]" title={prod.categoria || ''}>
                          {prod.categoria || '-'}
                        </td>
                      )}

                      {/* Marca */}
                      {columns.marca && (
                        <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap truncate max-w-[100px]" title={prod.marca || ''}>
                          {prod.marca || '-'}
                        </td>
                      )}

                      {/* Familia */}
                      {columns.familia && (
                        <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap truncate max-w-[100px]" title={prod.familia || ''}>
                          {prod.familia || '-'}
                        </td>
                      )}

                      {/* SubFamilia */}
                      {columns.subFamilia && (
                        <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap truncate max-w-[100px]" title={prod.subFamilia || ''}>
                          {prod.subFamilia || '-'}
                        </td>
                      )}

                      {/* Unidad */}
                      {columns.unidad && (
                        <td className="py-1.5 px-2 text-center text-slate-500 whitespace-nowrap text-[11px] font-mono">
                          {prod.unidad || '-'}
                        </td>
                      )}

                      {/* Proveedor */}
                      {columns.proveedor && (
                        <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap truncate max-w-[120px]" title={prod.proveedorNombre || ''}>
                          {prod.proveedorNombre || '-'}
                        </td>
                      )}

                      {/* Costo */}
                      {columns.costo && (
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {prod.costo > 0 ? formatARS(prod.costo) : '-'}
                        </td>
                      )}

                      {/* IVA */}
                      {columns.iva && (
                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {prod.iva}
                          </span>
                        </td>
                      )}

                      {/* Rentabilidad */}
                      {columns.rentabilidad && (
                        <td className="py-1.5 px-2 text-center font-bold text-slate-500 whitespace-nowrap">
                          {prod.rentabilidad > 0 ? `${prod.rentabilidad}%` : '-'}
                        </td>
                      )}

                      {/* Precio Base de Venta (ARS) */}
                      {columns.precioBase && (
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">
                          {isQuickPriceMode ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pending !== undefined ? pending : prod.precioBase}
                              onChange={(e) => handleQuickPriceChange(prod.id, parseFloat(e.target.value) || 0)}
                              className={`w-24 h-6 px-1.5 text-right rounded font-mono font-bold text-xs bg-background border focus:outline-none focus:ring-1 focus:ring-primary ${
                                pending !== undefined
                                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                  : 'border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400'
                              }`}
                            />
                          ) : (
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatARS(prod.precioBase)}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Almacén & Ubicación */}
                      {columns.almacen && (
                        <td className="py-1.5 px-2 whitespace-nowrap text-slate-500">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{prod.almacenNombre}</span>
                          {prod.ubicacionCodigo && (
                            <span className="ml-1 text-[10px] text-slate-400">({prod.ubicacionCodigo})</span>
                          )}
                        </td>
                      )}

                      {/* Compact Stock (Dot Indicator + Units) */}
                      {columns.stock && (
                        <td className="py-1.5 px-2 whitespace-nowrap text-center">
                          {renderCompactStock(prod)}
                        </td>
                      )}

                      {/* Acciones Directas */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap sticky right-0 bg-card shadow-sm">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => {
                              setSelectedStockProd(prod);
                              setIsAjusteStockOpen(true);
                            }}
                            className="p-1 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            title="Ajuste de Stock"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedHistorialProd(prod);
                              setIsHistorialOpen(true);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Historial de Movimientos"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/ventas/gestion/productos/nuevo?plantillaId=${prod.id}`)}
                            className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            title="Usar como plantilla (SAP / ERP)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/ventas/gestion/productos/${prod.id}/editar`)}
                            className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors"
                            title="Editar Producto (Pantalla Completa)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmProd(prod)}
                            className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Dar de Baja (Baja Lógica)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Pagination Footer */}
        <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/40 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Filas:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="h-6 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium text-xs">
              Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-6 px-2 rounded border border-slate-200 dark:border-slate-700 bg-background font-bold text-xs hover:bg-slate-100 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-6 px-2 rounded border border-slate-200 dark:border-slate-700 bg-background font-bold text-xs hover:bg-slate-100 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductoFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingProducto(null);
        }}
        onSuccess={loadProductos}
        producto={editingProducto}
        meta={meta}
      />

      <AjusteLotesModal
        isOpen={isLotesModalOpen}
        onClose={() => setIsLotesModalOpen(false)}
        onSuccess={loadProductos}
        meta={meta}
      />

      <ImportarExcelModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onSuccess={loadProductos}
        meta={meta}
      />

      <HistorialProductoModal
        isOpen={isHistorialOpen}
        onClose={() => {
          setIsHistorialOpen(false);
          setSelectedHistorialProd(null);
        }}
        producto={selectedHistorialProd}
      />

      <AjusteStockModal
        isOpen={isAjusteStockOpen}
        onClose={() => {
          setIsAjusteStockOpen(false);
          setSelectedStockProd(null);
        }}
        onSuccess={loadProductos}
        producto={selectedStockProd}
        meta={meta}
      />

      <ConfigListasPreciosModal
        isOpen={isConfigListasOpen}
        onClose={() => setIsConfigListasOpen(false)}
        onListasUpdated={() => {
          loadMeta();
          loadProductos();
        }}
        meta={meta}
      />

      {/* Soft Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirmProd}
        onCancel={() => setDeleteConfirmProd(null)}
        onConfirm={handleDeleteProduct}
        title="Dar de Baja Producto"
        message={`¿Está seguro de que desea dar de baja el producto "${deleteConfirmProd?.descripcion}" (SKU: ${deleteConfirmProd?.sku})? Para preservar la integridad histórica, el producto será desactivado (baja lógica) sin eliminar registros anteriores.`}
        confirmLabel="Confirmar Baja"
        variant="danger"
      />
    </div>
  );
}

