'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Package,
  Plus,
  Loader2,
  X,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Check,
  Tag,
  Hash,
  Boxes
} from 'lucide-react';

export interface MaterialOption {
  id: string; // ID interno de Producto en Gestión Comercial
  sku: string;
  skuProveedor: string | null;
  descripcion: string;
  unidad: string;
  unidadId: string | null;
  costo: number;
  precioBase: number;
  precioReferencia: number;
  stockActual: number;
  proveedorNombre: string | null;
  esManual?: boolean;
  matchTier?: number;
}

interface MaterialSearchSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (material: MaterialOption, cantidad?: number) => void;
  listaPrecioId?: string | null;
  listaPrecioNombre?: string | null;
}

// Caché en memoria para reutilizar resultados recientes durante la sesión (Sección 13)
const searchCache = new Map<string, { timestamp: number; data: MaterialOption[]; hasMore: boolean }>();
const CACHE_TTL_MS = 60_000; // 1 minuto de validez

export function MaterialSearchSelector({
  isOpen,
  onClose,
  onSelect,
  listaPrecioId,
  listaPrecioNombre,
}: MaterialSearchSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual material form state
  const [manualDesc, setManualDesc] = useState('');
  const [manualUnidad, setManualUnidad] = useState('Unidad');
  const [manualPrecio, setManualPrecio] = useState('');
  const [manualCantidad, setManualCantidad] = useState('1');

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Auto-focus al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults([]);
      setHasMore(false);
      setSelectedIndex(0);
      setShowManualModal(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Ejecutar búsqueda optimizada con debounce, cancelación y caché (Secciones 5, 6, 7, 9, 10, 11, 12, 13)
  const performSearch = useCallback(
    async (query: string) => {
      const clean = query.trim();

      // Regla de mínimo de caracteres (Sección 10):
      // Si tiene menos de 2 caracteres y no es un dígito numérico, no buscar
      if (!clean || (clean.length < 2 && !/^\d+$/.test(clean))) {
        setResults([]);
        setLoading(false);
        setHasMore(false);
        return;
      }

      // Clave única de caché que incluye el término y la lista de precios aplicada
      const cacheKey = `${clean.toLowerCase()}__lp_${listaPrecioId || 'base'}`;
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setResults(cached.data);
        setHasMore(cached.hasMore);
        setLoading(false);
        setSelectedIndex(0);
        return;
      }

      // Cancelar request anterior en vuelo para evitar race conditions (Sección 12)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const currentRequestId = ++activeRequestIdRef.current;
      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('q', clean);
        params.set('limit', '25'); // Límite razonable (Sección 11)
        if (listaPrecioId) {
          params.set('listaPrecioId', listaPrecioId);
        }

        const res = await fetch(`/api/ordenes-servicio/materiales-search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error('Error al buscar materiales');
        }

        const data = await res.json();

        // Evitar que una respuesta tardía sobrescriba una búsqueda más reciente (Sección 12)
        if (currentRequestId === activeRequestIdRef.current) {
          const materiales: MaterialOption[] = data.materiales || [];
          setResults(materiales);
          setHasMore(Boolean(data.hasMore));
          setSelectedIndex(0);

          // Guardar en caché reciente
          searchCache.set(cacheKey, {
            timestamp: Date.now(),
            data: materiales,
            hasMore: Boolean(data.hasMore),
          });
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error buscando materiales:', err);
        }
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [listaPrecioId]
  );

  // Manejo de debounce (Sección 9: 250-300 ms)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setResults([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 280);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        handleSelectMaterial(results[selectedIndex]);
      } else if (searchTerm.trim() === '999999') {
        openManualEntry();
      }
    }
  };

  const handleSelectMaterial = (material: MaterialOption) => {
    if (material.esManual) {
      openManualEntry();
      return;
    }
    onSelect(material, 1);
    onClose();
  };

  const openManualEntry = () => {
    setShowManualModal(true);
    setManualDesc(searchTerm === '999999' ? '' : searchTerm);
    setManualUnidad('Unidad');
    setManualPrecio('');
    setManualCantidad('1');
  };

  const handleConfirmManual = () => {
    if (!manualDesc.trim()) return;

    const manualItem: MaterialOption = {
      id: `manual_${Date.now()}`,
      sku: '999999',
      skuProveedor: null,
      descripcion: manualDesc.trim(),
      unidad: manualUnidad || 'Unidad',
      unidadId: null,
      costo: 0,
      precioBase: parseFloat(manualPrecio) || 0,
      precioReferencia: parseFloat(manualPrecio) || 0,
      stockActual: 0,
      proveedorNombre: null,
      esManual: true,
      matchTier: 1,
    };

    onSelect(manualItem, parseFloat(manualCantidad) || 1);
    setShowManualModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-material-search"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card text-card-foreground w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Buscar Material en Gestión Comercial
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Catálogo maestro</span>
                {listaPrecioNombre && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      <Tag className="w-3 h-3" /> {listaPrecioNombre}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            id="btn-close-material-search"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input con Iconos y Debounce */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-background">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 absolute left-3.5 text-slate-400" />
            <input
              ref={inputRef}
              id="input-material-search-query"
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              placeholder="Buscar por SKU (ej: 12345), SKU Proveedor (ej: ABC-123) o descripción..."
              className="w-full pl-11 pr-24 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <div className="absolute right-3 flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Mínimo 2 caracteres o código numérico exacto</span>
            <button
              id="btn-open-manual-entry"
              type="button"
              onClick={openManualEntry}
              className="font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <Hash className="w-3.5 h-3.5" /> Material Manual (999999)
            </button>
          </div>
        </div>

        {/* Resultados determinísticos por prioridad */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[260px] max-h-[420px]">
          {loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-sm font-medium">Buscando productos en Gestión Comercial...</p>
            </div>
          )}

          {!loading && searchTerm.trim().length > 0 && results.length === 0 && (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No se encontraron productos para &ldquo;{searchTerm}&rdquo;
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Verifica el SKU o término ingresado, o carga un material manual si no está en inventario.
                </p>
              </div>
              <button
                onClick={openManualEntry}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Cargar como Material Manual (999999)
              </button>
            </div>
          )}

          {!loading && !searchTerm.trim() && (
            <div className="text-center py-14 text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Ingresa un SKU o nombre para buscar en Gestión Comercial</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1.5">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const isManual = item.esManual;

                // Priority Badge Text (Sección 6)
                let tierLabel: string | null = null;
                let tierColor = 'bg-slate-100 text-slate-600';
                if (item.matchTier === 1) {
                  tierLabel = 'SKU Exacto';
                  tierColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                } else if (item.matchTier === 2) {
                  tierLabel = 'SKU Prov. Exacto';
                  tierColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                } else if (item.matchTier === 3 || item.matchTier === 4) {
                  tierLabel = 'Prefijo';
                  tierColor = 'bg-blue-100 text-blue-800 border-blue-200';
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectMaterial(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-card'
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          {item.sku}
                        </span>

                        {item.skuProveedor && (
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                            Prov: {item.skuProveedor}
                          </span>
                        )}

                        {tierLabel && (
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${tierColor}`}
                          >
                            {tierLabel}
                          </span>
                        )}

                        {isManual && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Manual
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                        {item.descripcion}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Unidad: <strong className="text-slate-700 dark:text-slate-200">{item.unidad}</strong>
                        </span>
                        {!isManual && item.stockActual !== undefined && (
                          <span>
                            Stock: <strong className={item.stockActual > 0 ? 'text-emerald-600' : 'text-rose-500'}>{item.stockActual}</strong>
                          </span>
                        )}
                        {!isManual && item.costo > 0 && (
                          <span>
                            Costo: <strong className="text-slate-700 dark:text-slate-200">${item.costo.toLocaleString('es-AR')}</strong>
                          </span>
                        )}
                        {!isManual && item.precioReferencia > 0 && (
                          <span className="text-primary font-bold">
                            Precio ref: ${item.precioReferencia.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectMaterial(item);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                        isSelected
                          ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary hover:text-white'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                );
              })}

              {hasMore && (
                <div className="p-3 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-medium">
                  Se encontraron más resultados. Continúa escribiendo para refinar la búsqueda...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span>Usa <strong>↑</strong> <strong>↓</strong> para navegar</span>
            <span><strong>Enter</strong> para agregar</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal para Material Manual 999999 (Sección 16) */}
      {showManualModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card text-card-foreground w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-amber-500" />
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Cargar Material Manual (999999)
                </h4>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              El material manual se registrará en la Orden de Servicio sin alterar el catálogo maestro de Gestión Comercial.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                  Descripción *
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: Cable unipolar 4mm especial"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={manualCantidad}
                    onChange={(e) => setManualCantidad(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 text-center"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    value={manualUnidad}
                    onChange={(e) => setManualUnidad(e.target.value)}
                    placeholder="Unidad, Metro, etc."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                  Precio Unitario Aplicado ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={manualPrecio}
                  onChange={(e) => setManualPrecio(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!manualDesc.trim() || Number(manualCantidad) <= 0}
                onClick={handleConfirmManual}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Agregar a OS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
