'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  Loader2,
  CheckCircle2,
  Info,
  Warehouse,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface MetaData {
  almacenes: Array<{ id: string; codigo: string; nombre: string; ubicaciones: Array<{ id: string; codigo: string }> }>;
}

interface AjusteGridLine {
  productoId: string;
  sku: string;
  descripcion: string;
  unidad: string;
  unidadDecimales: number;
  stockActual: number;
  valorIngresado: string | number; // Delta o existencia física según modo
  diferenciaCalculada: number;
  stockResultante: number;
  observaciones?: string;
}

interface AjusteRapidoViewProps {
  meta: MetaData;
  initialProduct?: {
    id: string;
    sku: string;
    descripcion: string;
    stockActual: number;
    almacenId?: string | null;
  } | null;
  onSuccess?: () => void;
}

export default function AjusteRapidoView({ meta, initialProduct, onSuccess }: AjusteRapidoViewProps) {
  const [almacenId, setAlmacenId] = useState<string>(
    initialProduct?.almacenId || meta.almacenes[0]?.id || ''
  );
  const [modoAjuste, setModoAjuste] = useState<'DIFERENCIA' | 'EXISTENCIA_REAL'>('EXISTENCIA_REAL');
  const [motivoGeneral, setMotivoGeneral] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<AjusteGridLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscador de productos
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Precargar producto inicial si viene por props
  useEffect(() => {
    if (initialProduct && lineas.length === 0) {
      setLineas([
        {
          productoId: initialProduct.id,
          sku: initialProduct.sku,
          descripcion: initialProduct.descripcion,
          unidad: 'UN',
          unidadDecimales: 0,
          stockActual: initialProduct.stockActual,
          valorIngresado: initialProduct.stockActual,
          diferenciaCalculada: 0,
          stockResultante: initialProduct.stockActual,
        },
      ]);
    }
  }, [initialProduct]);

  // Búsqueda en vivo de productos
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/almacen/stock?q=${encodeURIComponent(searchQuery.trim())}&almacenId=${almacenId}&limit=10`);
        const data = await res.json();
        setSearchResults(data.items || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Error buscando productos:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, almacenId]);

  // Recalcular stock de las líneas existentes si cambia el almacén seleccionado
  useEffect(() => {
    if (lineas.length === 0 || !almacenId) return;

    const actualizarSaldos = async () => {
      const prodIds = lineas.map((l) => l.productoId);
      try {
        const res = await fetch(`/api/almacen/stock?almacenId=${almacenId}&limit=200`);
        const data = await res.json();
        const stockMap = new Map<string, number>((data.items || []).map((it: any) => [it.id, Number(it.stockActual) || 0]));

        setLineas((prev) =>
          prev.map((l) => {
            const actual = Number(stockMap.get(l.productoId) ?? 0);
            return recalcularFila(l, l.valorIngresado, modoAjuste, actual);
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    actualizarSaldos();
  }, [almacenId]);

  // Función para calcular stock resultante y diferencia
  const recalcularFila = (
    linea: AjusteGridLine,
    nuevoValor: string | number,
    modo: 'DIFERENCIA' | 'EXISTENCIA_REAL',
    stockActual: number = linea.stockActual
  ): AjusteGridLine => {
    const valNum = parseFloat(String(nuevoValor)) || 0;
    let dif = 0;
    let res = 0;

    if (modo === 'DIFERENCIA') {
      dif = valNum;
      res = stockActual + dif;
    } else {
      // EXISTENCIA_REAL
      res = valNum;
      dif = res - stockActual;
    }

    return {
      ...linea,
      stockActual,
      valorIngresado: nuevoValor,
      diferenciaCalculada: Math.round(dif * 10000) / 10000,
      stockResultante: Math.round(res * 10000) / 10000,
    };
  };

  // Cambiar modo de ajuste
  const handleCambiarModo = (nuevoModo: 'DIFERENCIA' | 'EXISTENCIA_REAL') => {
    setModoAjuste(nuevoModo);
    setLineas((prev) =>
      prev.map((l) => {
        const defaultVal = nuevoModo === 'DIFERENCIA' ? 0 : l.stockActual;
        return recalcularFila(l, defaultVal, nuevoModo);
      })
    );
  };

  // Agregar producto a la grilla
  const handleAgregarProducto = (prod: any) => {
    if (lineas.some((l) => l.productoId === prod.id)) {
      showToast(`El producto "${prod.sku}" ya está en la grilla`, 'info');
      setSearchQuery('');
      setShowDropdown(false);
      return;
    }

    const defaultVal = modoAjuste === 'DIFERENCIA' ? 0 : prod.stockActual;
    const nuevaLinea: AjusteGridLine = {
      productoId: prod.id,
      sku: prod.sku,
      descripcion: prod.descripcion,
      unidad: prod.unidad || 'UN',
      unidadDecimales: prod.unidadDecimales || 0,
      stockActual: prod.stockActual,
      valorIngresado: defaultVal,
      diferenciaCalculada: 0,
      stockResultante: prod.stockActual,
    };

    setLineas((prev) => [...prev, nuevaLinea]);
    setSearchQuery('');
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  // Modificar valor de una línea
  const handleUpdateLinea = (idx: number, valor: string) => {
    setLineas((prev) => {
      const clone = [...prev];
      clone[idx] = recalcularFila(clone[idx], valor, modoAjuste);
      return clone;
    });
  };

  // Quitar línea
  const handleQuitarLinea = (idx: number) => {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  };

  // Totales
  const lineasConCambio = lineas.filter((l) => l.diferenciaCalculada !== 0);
  const totalAumentos = lineas.filter((l) => l.diferenciaCalculada > 0).reduce((acc, l) => acc + l.diferenciaCalculada, 0);
  const totalDisminuciones = lineas.filter((l) => l.diferenciaCalculada < 0).reduce((acc, l) => acc + Math.abs(l.diferenciaCalculada), 0);
  const tieneNegativosBloqueantes = lineas.some((l) => l.stockResultante < 0);

  // Confirmar operación
  const handleSubmitAjuste = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lineas.length === 0) {
      showToast('Debe agregar al menos un producto a la grilla', 'info');
      return;
    }

    if (!motivoGeneral.trim()) {
      showToast('El motivo de auditoría es obligatorio para confirmar ajustes', 'info');
      return;
    }

    if (lineasConCambio.length === 0) {
      showToast('Ninguno de los productos ingresados presenta diferencias respecto al stock actual', 'info');
      return;
    }

    if (tieneNegativosBloqueantes) {
      showToast('Hay líneas con stock resultante negativo. Por defecto no está permitido dejar stock negativo.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `AJU-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const res = await fetch('/api/almacen/ajuste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          almacenId,
          modoAjuste,
          motivoGeneral: motivoGeneral.trim(),
          observaciones: observaciones.trim() || undefined,
          idempotencyKey,
          items: lineasConCambio.map((l) => ({
            productoId: l.productoId,
            cantidad: parseFloat(String(l.valorIngresado)) || 0,
            observaciones: l.observaciones,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar ajuste de inventario');

      showToast(data.mensaje || 'Ajuste de inventario aplicado exitosamente', 'success');
      setLineas([]);
      setMotivoGeneral('');
      setObservaciones('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Error registrando ajuste', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabecera de Operación */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Ajuste Rápido y Masivo de Stock
              </h2>
              <p className="text-xs text-slate-500">
                Modifique existencias operativas con registro auditable inmutable
              </p>
            </div>
          </div>

          {/* Selector de Modo con aclaración visual */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleCambiarModo('EXISTENCIA_REAL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                modoAjuste === 'EXISTENCIA_REAL'
                  ? 'bg-card text-primary shadow-xs ring-1 ring-slate-300 dark:ring-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Existencia Real (Físico)
            </button>
            <button
              type="button"
              onClick={() => handleCambiarModo('DIFERENCIA')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                modoAjuste === 'DIFERENCIA'
                  ? 'bg-card text-primary shadow-xs ring-1 ring-slate-300 dark:ring-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Por Diferencia (+ / -)
            </button>
          </div>
        </div>

        {/* Guía explicativa según modo */}
        <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" />
          <div className="leading-relaxed">
            {modoAjuste === 'EXISTENCIA_REAL' ? (
              <span>
                <strong>Modo Existencia Real:</strong> Ingrese el recuento físico total encontrado (ej: si el sistema dice 20 y cuenta 17, ingrese 17 y el sistema registrará una merma de -3).
              </span>
            ) : (
              <span>
                <strong>Modo por Diferencia:</strong> Ingrese la cantidad a aumentar (+) o disminuir (-) sobre el stock existente (ej: ingrese +5 para agregar 5 unidades al saldo).
              </span>
            )}
          </div>
        </div>

        {/* Datos Principales: Almacén y Buscador */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Almacén Afectado <span className="text-rose-500">*</span>
            </label>
            <select
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {meta.almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.codigo})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 relative">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Buscar e Incorporar Productos (admite lector de código de barras)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escanee código de barras o escriba SKU / descripción..."
                className="w-full pl-9 pr-8 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>

            {/* Dropdown de resultados de búsqueda */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {searchResults.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAgregarProducto(prod)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{prod.sku}</div>
                      <div className="text-slate-600 dark:text-slate-300 truncate text-[11px]">{prod.descripcion}</div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-primary">{prod.stockActual} {prod.unidad}</span>
                      <span className="block text-[10px] text-slate-400">{prod.almacenNombre}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grilla Multi-Producto */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-black text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 w-32">SKU</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3 text-right w-28">Stock Actual</th>
                <th className="py-2.5 px-3 text-center w-36">
                  {modoAjuste === 'EXISTENCIA_REAL' ? 'Conteo Físico' : 'Variación (+/-)'}
                </th>
                <th className="py-2.5 px-3 text-right w-28">Diferencia</th>
                <th className="py-2.5 px-3 text-right w-28">Stock Resultante</th>
                <th className="py-2.5 px-2 text-center w-14">Unid</th>
                <th className="py-2.5 px-2 text-center w-12">Quitar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lineas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <Sliders className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Grilla vacía</p>
                    <p className="text-[11px] mt-0.5">Busque productos por SKU o lector de código de barras arriba.</p>
                  </td>
                </tr>
              ) : (
                lineas.map((linea, idx) => {
                  const dif = linea.diferenciaCalculada;
                  const esNegativo = linea.stockResultante < 0;

                  return (
                    <tr
                      key={linea.productoId}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        esNegativo ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {linea.sku}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 truncate max-w-sm" title={linea.descripcion}>
                        {linea.descripcion}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {linea.stockActual}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          step="any"
                          value={linea.valorIngresado}
                          onChange={(e) => handleUpdateLinea(idx, e.target.value)}
                          className="w-28 h-8 px-2 text-right font-mono text-xs font-black rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-bold whitespace-nowrap">
                        {dif > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center">
                            <TrendingUp className="w-3.5 h-3.5 mr-0.5 inline" />
                            +{dif}
                          </span>
                        ) : dif < 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 inline-flex items-center">
                            <TrendingDown className="w-3.5 h-3.5 mr-0.5 inline" />
                            {dif}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-black whitespace-nowrap">
                        <span className={esNegativo ? 'text-rose-600 font-extrabold' : 'text-slate-900 dark:text-slate-100'}>
                          {linea.stockResultante}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-[10px] text-slate-500 uppercase">
                        {linea.unidad}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuitarLinea(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                          title="Quitar de la grilla"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Resumen de Impacto Operativo */}
        {lineas.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-4">
              <span>Líneas: <strong>{lineas.length}</strong> (Con variación: <strong>{lineasConCambio.length}</strong>)</span>
              {totalAumentos > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Ingreso total: +{totalAumentos} u.
                </span>
              )}
              {totalDisminuciones > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  Merma total: -{totalDisminuciones} u.
                </span>
              )}
            </div>

            {tieneNegativosBloqueantes && (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Existen saldos negativos no permitidos
              </span>
            )}
          </div>
        )}
      </div>

      {/* Justificación y Confirmación */}
      <form onSubmit={handleSubmitAjuste} className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Motivo o Justificación de Auditoría <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={motivoGeneral}
              onChange={(e) => setMotivoGeneral(e.target.value)}
              placeholder="Ej: Ajuste por rotura en depósito, recuento físico, sobrante..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones Adicionales (Opcional)
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas internas o referencia de remito / informe..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setLineas([]);
              setMotivoGeneral('');
            }}
            disabled={lineas.length === 0}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40"
          >
            Limpiar Grilla
          </button>

          <button
            type="submit"
            disabled={isSubmitting || lineasConCambio.length === 0 || !motivoGeneral.trim() || tieneNegativosBloqueantes}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aplicando Ajuste Atómico...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Confirmar Ajuste ({lineasConCambio.length} productos)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
