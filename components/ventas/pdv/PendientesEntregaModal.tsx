'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Truck,
  RotateCcw,
  PackageCheck,
  Ban,
  Clock,
  User,
  AlertCircle,
  Loader2,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface PendientesEntregaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEntregar: (venta: any) => void;
  onVerRemito: (remito: any) => void;
}

export default function PendientesEntregaModal({
  isOpen,
  onClose,
  onEntregar,
  onVerRemito,
}: PendientesEntregaModalProps) {
  const [ventas, setVentas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Cancelación de pendientes
  const [ventaACancelar, setVentaACancelar] = useState<any | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchPendientes();
  }, [isOpen, search]);

  // Atajo de teclado: Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (ventaACancelar) {
          setVentaACancelar(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, ventaACancelar, onClose]);

  const fetchPendientes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ventas/pdv/pendientes?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setVentas(data.ventas || []);
      }
    } catch (e) {
      console.error(e);
      showToast('Error al cargar pendientes de entrega', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmarCancelacion = async () => {
    if (!ventaACancelar) return;
    setIsCancelling(true);
    try {
      const res = await fetch('/api/ventas/pdv/pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ventaId: ventaACancelar.id,
          motivo: motivoCancelacion.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al cancelar pendientes');
      }

      showToast(`Pendientes de venta ${ventaACancelar.numero} cancelados`, 'success');
      setVentaACancelar(null);
      setMotivoCancelacion('');
      fetchPendientes();
    } catch (err: any) {
      showToast(err.message || 'Error al cancelar pendientes', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-2 sm:p-3 bg-slate-950/50-xs">
      <div className="bg-card w-[98vw] max-w-none h-[96vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Pendientes de Entrega de Materiales
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40">
                  {ventas.length} {ventas.length === 1 ? 'venta pendiente' : 'ventas pendientes'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Control de materiales pagados o en cuenta corriente pendientes de retiro físico en almacén
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

        {/* Barra de Filtros */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número de venta, cliente o vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          <button
            onClick={fetchPendientes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
            title="Refrescar lista"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Lista de Ventas con Pendientes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs font-semibold">Cargando entregas pendientes...</span>
            </div>
          ) : ventas.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-800">
                <PackageCheck className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                ¡Al día! No hay materiales pendientes de entrega
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Todos los pedidos y ventas registradas han sido entregados íntegramente a sus respectivos clientes.
              </p>
            </div>
          ) : (
            ventas.map((v) => {
              const fechaObj = new Date(v.fecha || v.createdAt);
              return (
                <div
                  key={v.id}
                  className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
                >
                  {/* Encabezado de la Venta */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                          {v.numero}
                        </span>
                        <span className="text-xs text-slate-500">
                          {fechaObj.toLocaleDateString('es-AR')}{' '}
                          {fechaObj.toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                            v.estadoEntrega === 'PARCIAL'
                              ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200'
                              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200'
                          }`}
                        >
                          Entrega {v.estadoEntrega}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-3">
                        <span>
                          <strong className="text-slate-800 dark:text-slate-200">Cliente:</strong>{' '}
                          {v.clienteNombre}{' '}
                          {v.clienteIdentificacion && `(${v.clienteIdentificacion})`}
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-slate-800 dark:text-slate-200">Vendedor:</strong>{' '}
                          {v.vendedorNombre || v.vendedor?.nombreCompleto || 'Ventas HDB'}
                        </span>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEntregar(v)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Entregar Materiales</span>
                      </button>

                      <button
                        onClick={() => {
                          setVentaACancelar(v);
                          setMotivoCancelacion('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 font-bold text-xs border border-red-200 dark:border-red-800 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancelar Pendientes</span>
                      </button>
                    </div>
                  </div>

                  {/* Remitos previos si existen */}
                  {v.remitos && v.remitos.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50/40 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-semibold text-[11px]">Remitos previos emitidos:</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {v.remitos.map((rem: any) => (
                          <button
                            key={rem.id}
                            onClick={() =>
                              onVerRemito({
                                ...rem,
                                items: rem.items || [],
                                venta: rem.venta || v,
                                clienteNombre: rem.clienteNombre || v.clienteNombre,
                                clienteIdentificacion: rem.clienteIdentificacion || v.clienteIdentificacion,
                                clienteDireccion: rem.clienteDireccion || v.clienteDireccion,
                                clienteTelefono: rem.clienteTelefono || v.clienteTelefono,
                                vendedorNombre:
                                  rem.vendedorNombre ||
                                  v.vendedorNombre ||
                                  v.vendedor?.nombreCompleto ||
                                  'Ventas HDB',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors"
                            title="Ver e imprimir remito"
                          >
                            <Printer className="w-3 h-3" />
                            <span>{rem.numero}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tabla de Artículos con Saldo Pendiente */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 w-28">SKU</th>
                          <th className="py-2.5 px-3">Descripción del Material</th>
                          <th className="py-2.5 px-3 text-center w-24">Venta Total</th>
                          <th className="py-2.5 px-3 text-center w-24">Ya Entregado</th>
                          <th className="py-2.5 px-3 text-center w-24">Cancelado</th>
                          <th className="py-2.5 px-3 text-right w-28 font-bold text-amber-700 dark:text-amber-400">
                            Saldo Pendiente
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {v.itemsPendientes?.map((it: any) => (
                          <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {it.sku}
                            </td>
                            <td className="py-2 px-3 text-slate-900 dark:text-slate-100 font-medium">
                              {it.descripcion}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">
                              {it.cantidad} {it.unidad || 'u.'}
                            </td>
                            <td className="py-2 px-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                              {it.cantidadEntregada || 0} {it.unidad || 'u.'}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-400">
                              {it.cantidadCancelada || 0} {it.unidad || 'u.'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-amber-600 dark:text-amber-400 text-xs">
                              {it.cantidadPendiente} {it.unidad || 'u.'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal interno para Confirmar Cancelación */}
        {ventaACancelar && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-950/50-xs">
            <div className="bg-card w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Cancelar Saldo Pendiente
                  </h4>
                  <p className="text-xs text-slate-500">
                    Venta {ventaACancelar.numero} • {ventaACancelar.clienteNombre}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                ¿Está seguro de que desea cancelar los materiales pendientes de retiro de esta venta? Los saldos no retirados se darán de baja del compromiso de entrega.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Motivo de Cancelación (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cliente desistió del saldo, cambio de especificación..."
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  className="w-full px-3 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVentaACancelar(null)}
                  disabled={isCancelling}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarCancelacion}
                  disabled={isCancelling}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cancelando...</span>
                    </>
                  ) : (
                    <span>Confirmar Cancelación</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500">
            Los remitos emitidos registran el retiro físico sin alterar facturación comercial
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
