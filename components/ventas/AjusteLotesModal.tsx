'use client';

import React, { useState, useEffect } from 'react';
import { X, Percent, Eye, CheckCircle2, AlertTriangle, ArrowRight, Loader2, RefreshCw, Search, RotateCcw } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { formatARS } from '@/lib/formatCurrency';

interface MetaData {
  proveedores: Array<{ id: string; razonSocial: string; nombreFantasia?: string | null }>;
  marcas: Array<{ id: string; nombre: string }>;
  familias: Array<{ id: string; nombre: string; subfamilias: Array<{ id: string; nombre: string }> }>;
  almacenes: Array<{ id: string; codigo: string; nombre: string }>;
  listasPrecios: Array<{ id: string; codigo: string; nombre: string }>;
}

interface AjusteLotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  meta: MetaData;
}

export default function AjusteLotesModal({
  isOpen,
  onClose,
  onSuccess,
  meta,
}: AjusteLotesModalProps) {
  const [step, setStep] = useState<'config' | 'preview'>('config');

  // Filter state
  const [filters, setFilters] = useState({
    proveedorId: '',
    marcaId: '',
    familiaId: '',
    subFamiliaId: '',
    almacenId: '',
    estadoStock: '',
    q: '',
  });

  // Adjustment config
  const [selectedListas, setSelectedListas] = useState<string[]>(['LISTA_1']);
  const [porcentaje, setPorcentaje] = useState<string | number>('10');
  const [tipoAjuste, setTipoAjuste] = useState<'COSTO' | 'PRECIO_BASE'>('COSTO');

  // Live match counter
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  // Preview data
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    modo: string;
    tipoAjuste: 'PRECIO_BASE' | 'COSTO';
    cantidadProductos: number;
    cantidadAjustes: number;
    previsualizacion: Array<{
      productoId: string;
      sku: string;
      descripcion: string;
      tipoAjuste: 'PRECIO_BASE' | 'COSTO';
      costoActual: number;
      nuevoCosto: number;
      rentabilidad: number;
      precioActual: number;
      porcentaje: number;
      nuevoPrecio: number;
      productoProveedorId: string | null;
    }>;
  } | null>(null);

  const [isApplying, setIsApplying] = useState(false);

  // Live count debounced effect
  useEffect(() => {
    if (!isOpen || step !== 'config') return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsCounting(true);
      try {
        const res = await fetch('/api/ventas/precios/ajuste-lotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filtros: filters,
            countOnly: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setMatchingCount(data.cantidadProductos ?? 0);
        }
      } catch (e) {
        console.error('Error fetching matching count:', e);
      } finally {
        if (isMounted) setIsCounting(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, step, filters]);

  const handleResetFilters = () => {
    setFilters({
      proveedorId: '',
      marcaId: '',
      familiaId: '',
      subFamiliaId: '',
      almacenId: '',
      estadoStock: '',
      q: '',
    });
  };

  const hasActiveFilters = Boolean(
    filters.proveedorId ||
    filters.marcaId ||
    filters.familiaId ||
    filters.subFamiliaId ||
    filters.almacenId ||
    filters.estadoStock ||
    filters.q.trim()
  );

  // Toggle price list checkbox
  const handleToggleLista = (codigo: string) => {
    if (selectedListas.includes(codigo)) {
      if (selectedListas.length === 1) {
        showToast('Debe seleccionar al menos una lista', 'info');
        return;
      }
      setSelectedListas(selectedListas.filter((c) => c !== codigo));
    } else {
      setSelectedListas([...selectedListas, codigo]);
    }
  };

  // Run Preview
  const handleFetchPreview = async () => {
    const numPorcentaje = parseFloat(String(porcentaje)) || 0;
    if (numPorcentaje === 0) {
      showToast('El porcentaje de ajuste no puede ser 0%', 'info');
      return;
    }

    setIsLoadingPreview(true);
    try {
      const res = await fetch('/api/ventas/precios/ajuste-lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filtros: filters,
          porcentaje: numPorcentaje,
          tipoAjuste,
          preview: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener previsualización');

      if (data.cantidadProductos === 0) {
        showToast('Ningún producto coincide con los filtros aplicados', 'info');
        return;
      }

      setPreviewData(data);
      setStep('preview');
    } catch (err: any) {
      showToast(err.message || 'Error en previsualización', 'error');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Confirm and Apply Adjustment
  const handleApplyAdjustment = async () => {
    setIsApplying(true);
    const numPorcentaje = parseFloat(String(porcentaje)) || 0;
    try {
      const res = await fetch('/api/ventas/precios/ajuste-lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filtros: filters,
          porcentaje: numPorcentaje,
          tipoAjuste,
          preview: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar ajuste');

      showToast(data.mensaje || 'Ajuste aplicado correctamente', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error al aplicar cambios', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Ajuste de Precios por Lotes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'config'
                  ? 'Paso 1: Filtrar productos y definir porcentaje de modificación'
                  : 'Paso 2: Previsualizar diferencias y confirmar aplicación'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'config' ? (
            <div className="space-y-6">
              {/* Step 1: Filters */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    1. Filtrar Productos a Modificar
                  </h4>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[11px] font-semibold text-slate-500 hover:text-primary dark:hover:text-primary flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Limpiar filtros
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Proveedor
                    </label>
                    <select
                      value={filters.proveedorId}
                      onChange={(e) => setFilters({ ...filters, proveedorId: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Todos los proveedores</option>
                      {meta.proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombreFantasia || p.razonSocial}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Marca
                    </label>
                    <select
                      value={filters.marcaId}
                      onChange={(e) => setFilters({ ...filters, marcaId: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Todas las marcas</option>
                      {meta.marcas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Familia
                    </label>
                    <select
                      value={filters.familiaId}
                      onChange={(e) => setFilters({ ...filters, familiaId: e.target.value, subFamiliaId: '' })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Todas las familias</option>
                      {meta.familias.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Sub-Familia
                    </label>
                    <select
                      value={filters.subFamiliaId}
                      onChange={(e) => setFilters({ ...filters, subFamiliaId: e.target.value })}
                      disabled={!filters.familiaId}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                    >
                      <option value="">Todas las subfamilias</option>
                      {meta.familias
                        .find((f) => f.id === filters.familiaId)
                        ?.subfamilias.map((sf) => (
                          <option key={sf.id} value={sf.id}>
                            {sf.nombre}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Almacén
                    </label>
                    <select
                      value={filters.almacenId}
                      onChange={(e) => setFilters({ ...filters, almacenId: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Todos los almacenes</option>
                      {meta.almacenes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Estado de Stock
                    </label>
                    <select
                      value={filters.estadoStock}
                      onChange={(e) => setFilters({ ...filters, estadoStock: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Cualquier estado</option>
                      <option value="normal">Stock Normal (&gt; mín)</option>
                      <option value="bajo">Stock Bajo (&le; mín)</option>
                      <option value="sin_stock">Sin Stock (= 0)</option>
                      <option value="sobre_stock">Sobre Stock (&gt; máx)</option>
                    </select>
                  </div>

                  {/* Campo de búsqueda libre con buscador inteligente */}
                  <div className="sm:col-span-2 md:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Texto libre (SKU, Modelo o Descripción)
                      </label>
                      {filters.q && (
                        <button
                          type="button"
                          onClick={() => setFilters({ ...filters, q: '' })}
                          className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          Limpiar texto
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={filters.q}
                        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                        placeholder="Ej: SKU '05610', 'termomagnética 10A', 'NXB-63', 'Curva C', 'C10'..."
                        className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-400"
                      />
                      {filters.q && (
                        <button
                          type="button"
                          onClick={() => setFilters({ ...filters, q: '' })}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                          title="Borrar búsqueda"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Búsqueda inteligente insensible a tildes, mayúsculas, espacios y términos técnicos.
                    </p>
                  </div>
                </div>

                {/* Banner de conteo en tiempo real */}
                <div
                  className={`mt-3.5 p-3 rounded-xl border flex items-center justify-between transition-all ${
                    matchingCount === 0
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300'
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isCounting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : matchingCount === 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <div className="text-xs">
                      {isCounting ? (
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          Buscando productos coincidentes...
                        </span>
                      ) : matchingCount === 0 ? (
                        <span className="font-bold">
                          Ningún producto coincide con los filtros aplicados.
                        </span>
                      ) : (
                        <span>
                          Se encontraron{' '}
                          <strong className="text-slate-900 dark:text-slate-100 font-extrabold text-sm">
                            {matchingCount}
                          </strong>{' '}
                          producto{matchingCount === 1 ? '' : 's'} disponible{matchingCount === 1 ? '' : 's'} para modificar.
                        </span>
                      )}
                    </div>
                  </div>

                  {matchingCount !== null && matchingCount > 0 && !isCounting && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                      Listo para previsualizar
                    </span>
                  )}
                </div>
              </div>

              {/* Step 2: Campo a ajustar */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    2. ¿Qué deseas ajustar?
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Margen estándar de rentabilidad: <strong className="text-primary font-bold">41.5%</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Opción 1: Costo de Adquisición */}
                  <div
                    onClick={() => setTipoAjuste('COSTO')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      tipoAjuste === 'COSTO'
                        ? 'bg-primary/5 border-primary ring-1 ring-primary shadow-sm'
                        : 'bg-background border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="tipoAjuste"
                          checked={tipoAjuste === 'COSTO'}
                          onChange={() => setTipoAjuste('COSTO')}
                          className="text-primary h-4 w-4"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Costo de Adquisición
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                        + Margen 41.5%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Se actualiza el costo del producto y su <strong>Precio Base de Venta</strong> se recalcula automáticamente sumando el <strong>41.5% de margen</strong> sobre el nuevo costo (<code>Nuevo Costo × 1.415</code>).
                    </p>
                  </div>

                  {/* Opción 2: Precio Base de Venta */}
                  <div
                    onClick={() => setTipoAjuste('PRECIO_BASE')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      tipoAjuste === 'PRECIO_BASE'
                        ? 'bg-primary/5 border-primary ring-1 ring-primary shadow-sm'
                        : 'bg-background border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="tipoAjuste"
                          checked={tipoAjuste === 'PRECIO_BASE'}
                          onChange={() => setTipoAjuste('PRECIO_BASE')}
                          className="text-primary h-4 w-4"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Precio Base de Venta
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                        Directo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      El porcentaje modifica directamente el <strong>Precio Base</strong> de venta de los productos seleccionados sin alterar su costo de adquisición cargado en la base de datos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3: Porcentaje */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  3. Porcentaje de Ajuste {tipoAjuste === 'COSTO' ? 'sobre el Costo' : 'sobre el Precio Base'}
                </h4>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative w-48">
                    <input
                      type="number"
                      step="0.1"
                      value={porcentaje}
                      onChange={(e) => setPorcentaje(e.target.value)}
                      placeholder="10"
                      className="w-full h-11 px-4 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-base font-black focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="absolute right-3.5 top-3 text-slate-400 font-bold">%</span>
                  </div>

                  {/* Quick percentage chips */}
                  <div className="flex items-center gap-2">
                    {[5, 10, 15, 20, -5, -10].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPorcentaje(String(val))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          Number(porcentaje) === val
                            ? 'bg-primary text-white border-primary'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {val > 0 ? `+${val}%` : `${val}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Use valores positivos para incrementos (ej. <code>+10%</code>) y negativos para reducciones o descuentos (ej. <code>-5%</code>).
                </p>
              </div>
            </div>
          ) : (
            /* PREVIEW VIEW */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200">
                      Previsualización del Ajuste {previewData?.tipoAjuste === 'COSTO' ? 'de Costos (+ Margen 41.5%)' : 'de Precios Base'}: {Number(porcentaje) > 0 ? `+${porcentaje}%` : `${porcentaje}%`}
                    </h4>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400">
                      {previewData?.tipoAjuste === 'COSTO'
                        ? `Se recalcularán ${previewData?.cantidadAjustes} costos y precios base con 41.5% de margen sobre ${previewData?.cantidadProductos} productos seleccionados.`
                        : `Se modificarán ${previewData?.cantidadAjustes} precios en ${previewData?.cantidadProductos} productos seleccionados.`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep('config')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 bg-background hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Modificar Filtros
                </button>
              </div>

              {/* Diff Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                    {previewData?.tipoAjuste === 'COSTO' ? (
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-right">Costo Actual</th>
                        <th className="py-2.5 px-3 text-center">Ajuste Costo</th>
                        <th className="py-2.5 px-3 text-right">Nuevo Costo</th>
                        <th className="py-2.5 px-3 text-center">Margen</th>
                        <th className="py-2.5 px-3 text-right">Nuevo Precio Base (ARS)</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-right">Precio Base Actual</th>
                        <th className="py-2.5 px-3 text-center">Ajuste</th>
                        <th className="py-2.5 px-3 text-right">Nuevo Precio Base (ARS)</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {previewData?.previsualizacion.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {item.sku}
                        </td>
                        <td className="py-2 px-3 truncate max-w-xs">{item.descripcion}</td>
                        {previewData?.tipoAjuste === 'COSTO' ? (
                          <>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                              {formatARS(item.costoActual)}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                              {item.porcentaje > 0 ? `+${item.porcentaje}%` : `${item.porcentaje}%`}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {formatARS(item.nuevoCosto)}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {item.rentabilidad}%
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatARS(item.nuevoPrecio)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                              {formatARS(item.precioActual)}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                              {item.porcentaje > 0 ? `+${item.porcentaje}%` : `${item.porcentaje}%`}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatARS(item.nuevoPrecio)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancelar
          </button>

          {step === 'config' ? (
            <button
              type="button"
              disabled={isLoadingPreview || isCounting || matchingCount === 0}
              onClick={handleFetchPreview}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculando diferencias...
                </>
              ) : isCounting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando productos...
                </>
              ) : (
                <>
                  Previsualizar Ajuste{matchingCount !== null && matchingCount > 0 ? ` (${matchingCount})` : ''}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('config')}
                className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={handleApplyAdjustment}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aplicando cambios...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar y Aplicar Ajuste
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
