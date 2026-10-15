'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  PackageCheck,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
  User,
  FileText,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface VentaItemData {
  id: string;
  sku: string;
  descripcion: string;
  unidad?: string | null;
  cantidad: number;
  cantidadEntregada?: number;
  cantidadCancelada?: number;
}

interface VentaData {
  id: string;
  numero: string;
  fecha: string | Date;
  clienteNombre: string;
  clienteIdentificacion?: string | null;
  items: VentaItemData[];
}

interface GenerarRemitoModalProps {
  isOpen: boolean;
  onClose: () => void;
  venta: VentaData | null;
  onRemitoGenerado: (remito: any) => void;
}

interface ItemState {
  seleccionado: boolean;
  cantidadAEntregar: number;
  maxPendiente: number;
}

export default function GenerarRemitoModal({
  isOpen,
  onClose,
  venta,
  onRemitoGenerado,
}: GenerarRemitoModalProps) {
  const [itemsState, setItemsState] = useState<Record<string, ItemState>>({});
  const [receptorNombre, setReceptorNombre] = useState('');
  const [receptorDni, setReceptorDni] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !venta) return;

    // Inicializar estado de ítems calculando pendientes
    const initialState: Record<string, ItemState> = {};
    for (const it of venta.items || []) {
      const entregado = it.cantidadEntregada || 0;
      const cancelado = it.cantidadCancelada || 0;
      const pendiente = Math.max(0, it.cantidad - entregado - cancelado);

      if (pendiente > 0) {
        initialState[it.id] = {
          seleccionado: true, // Marcados por defecto para agilidad, permitiendo desmarcar en el conteo físico
          cantidadAEntregar: pendiente,
          maxPendiente: pendiente,
        };
      }
    }

    setItemsState(initialState);
    setReceptorNombre(
      venta.clienteNombre === 'Consumidor Final' ? '' : venta.clienteNombre
    );
    setReceptorDni(venta.clienteIdentificacion || '');
    setObservaciones('');
    setIsSubmitting(false);
  }, [isOpen, venta]);

  // Atajo de teclado: Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !venta) return null;

  const itemsPendientes = (venta.items || []).filter((it) => {
    const entregado = it.cantidadEntregada || 0;
    const cancelado = it.cantidadCancelada || 0;
    return it.cantidad - entregado - cancelado > 0;
  });

  const toggleItem = (id: string) => {
    setItemsState((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: {
          ...current,
          seleccionado: !current.seleccionado,
        },
      };
    });
  };

  const handleCantidadChange = (id: string, val: number) => {
    setItemsState((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const cleanVal = isNaN(val) ? 0 : Math.max(0, Math.min(val, current.maxPendiente));
      return {
        ...prev,
        [id]: {
          ...current,
          cantidadAEntregar: cleanVal,
        },
      };
    });
  };

  const toggleSelectAll = (select: boolean) => {
    setItemsState((prev) => {
      const updated = { ...prev };
      for (const k of Object.keys(updated)) {
        updated[k].seleccionado = select;
      }
      return updated;
    });
  };

  // Cálculos de conteo
  const itemsAEntregar = Object.entries(itemsState).filter(
    ([_, st]) => st.seleccionado && st.cantidadAEntregar > 0
  );

  const hayPendientesRestantes = itemsPendientes.some((it) => {
    const st = itemsState[it.id];
    if (!st || !st.seleccionado) return true;
    return st.cantidadAEntregar < st.maxPendiente;
  });

  const handleConfirmar = async () => {
    if (itemsAEntregar.length === 0) {
      showToast('Seleccione al menos un material con cantidad mayor a 0 para entregar', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ventaId: venta.id,
        receptorNombre: receptorNombre.trim() || undefined,
        receptorDni: receptorDni.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        items: itemsAEntregar.map(([id, st]) => ({
          ventaItemId: id,
          cantidad: st.cantidadAEntregar,
        })),
      };

      const res = await fetch('/api/ventas/pdv/remitos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar el remito de entrega');
      }

      showToast(`Remito ${data.remito.numero} generado con éxito`, 'success');
      onRemitoGenerado(data.remito);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error al emitir remito', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Generar Remito de Entrega
              </h3>
              <p className="text-[11px] text-slate-400">
                Venta {venta.numero} • Cliente: {venta.clienteNombre}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Datos del Receptor */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span>Datos de Quien Retira los Materiales</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Nombre y Apellido
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={receptorNombre}
                  onChange={(e) => setReceptorNombre(e.target.value)}
                  className="w-full px-3 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  DNI / CUIT de quien retira
                </label>
                <input
                  type="text"
                  placeholder="Ej: 30123456"
                  value={receptorDni}
                  onChange={(e) => setReceptorDni(e.target.value)}
                  className="w-full px-3 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
          </div>

          {/* Lista de Conteo Físico con Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Conteo Físico de Materiales a Entregar
                </h4>
                <p className="text-[11px] text-slate-400">
                  Marque cada material a medida que lo despacha físicamente y ajuste la cantidad si es parcial.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(true)}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Marcar todos
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(false)}
                  className="text-[10px] font-bold text-slate-500 hover:underline"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {itemsPendientes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Todos los materiales de esta venta ya han sido entregados o cancelados.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 shadow-xs">
                {itemsPendientes.map((it) => {
                  const st = itemsState[it.id] || {
                    seleccionado: false,
                    cantidadAEntregar: it.cantidad,
                    maxPendiente: it.cantidad,
                  };
                  return (
                    <div
                      key={it.id}
                      className={`p-3.5 flex items-center justify-between gap-4 transition-colors ${
                        st.seleccionado
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleItem(it.id)}
                          className="shrink-0 text-indigo-600 dark:text-indigo-400"
                        >
                          {st.seleccionado ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              {it.sku}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {it.descripcion}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Venta total: {it.cantidad} {it.unidad || 'u.'}</span>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Saldo disponible: {st.maxPendiente} {it.unidad || 'u.'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Selector de cantidad a entregar */}
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[11px] font-semibold text-slate-500">
                          A Entregar:
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={st.maxPendiente}
                          disabled={!st.seleccionado}
                          value={st.cantidadAEntregar}
                          onChange={(e) =>
                            handleCantidadChange(it.id, parseFloat(e.target.value))
                          }
                          className="w-20 px-2 py-1 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-right text-slate-800 dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-slate-400 w-6">
                          {it.unidad || 'u.'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aviso de Remanente / Saldo Pendiente */}
          {hayPendientesRestantes && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-bold">Entrega Parcial detectada:</span> Los materiales no seleccionados o con cantidad menor al saldo quedarán registrados automáticamente en la sección de{' '}
                <span className="font-bold underline">Pendientes de Entrega</span>, desde donde se podrá emitir un nuevo remito posterior o cancelar el saldo pendiente.
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Observaciones del Remito (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Retirado en flete particular, transportista asignado, etc."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {itemsAEntregar.length}
            </span>{' '}
            {itemsAEntregar.length === 1 ? 'artículo seleccionado' : 'artículos seleccionados'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold text-xs transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={isSubmitting || itemsAEntregar.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando Remito...</span>
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4" />
                  <span>Confirmar y Emitir Remito</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
