'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Receipt,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Coins,
  ShieldAlert,
  User,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import SeleccionarClienteModal from './SeleccionarClienteModal';

export interface MetodoPagoRow {
  id: string;
  metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'CUENTA_CORRIENTE' | 'CHEQUE';
  monto: number;
  montoRecibido?: number | null;
  vuelto?: number | null;
  referencia?: string;
  observaciones?: string;
}

interface CobroModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: {
    id: string | null;
    nombre: string;
    identificacion?: string | null;
  };
  totalVenta: number;
  subtotal: number;
  descuentoMonto: number;
  impuestosMonto: number;
  itemsCount: number;
  listaPrecioNombre: string;
  ivaDiscriminado?: boolean;
  onCambiarCliente?: (cliente: {
    id: string | null;
    nombre: string;
    identificacion?: string | null;
    listaPrecioId?: string | null;
  }) => void;
  onConfirmarVenta: (datosCobro: {
    pagos: Array<{
      metodo: string;
      monto: number;
      montoRecibido?: number | null;
      vuelto?: number | null;
      referencia?: string | null;
    }>;
    observaciones?: string;
    idempotencyKey: string;
  }) => Promise<any>;
}

const formatARS = (val: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(val || 0);

export default function CobroModal({
  isOpen,
  onClose,
  cliente,
  totalVenta,
  subtotal,
  descuentoMonto,
  impuestosMonto,
  itemsCount,
  listaPrecioNombre,
  ivaDiscriminado = false,
  onCambiarCliente,
  onConfirmarVenta,
}: CobroModalProps) {
  const [pagos, setPagos] = useState<MetodoPagoRow[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [showModalCambioCliente, setShowModalCambioCliente] = useState(false);

  // Inicializar pagos al abrir
  useEffect(() => {
    if (isOpen) {
      setPagos([
        {
          id: 'pago-1',
          metodo: 'EFECTIVO',
          monto: totalVenta,
          montoRecibido: totalVenta,
          vuelto: 0,
        },
      ]);
      setObservaciones('');
      setErrorValidacion(null);
      setIsSubmitting(false);
    }
  }, [isOpen, totalVenta]);

  // Cálculos de pagos
  const totalPagos = Math.round(pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0) * 100) / 100;
  const saldoRestante = Math.round((totalVenta - totalPagos) * 100) / 100;

  const pagoCuentaCorriente = pagos.find((p) => p.metodo === 'CUENTA_CORRIENTE');
  const montoCuentaCorriente = pagoCuentaCorriente ? Number(pagoCuentaCorriente.monto) || 0 : 0;
  const pagoEfectivo = pagos.find((p) => p.metodo === 'EFECTIVO');
  const vueltoEfectivo = pagoEfectivo && (pagoEfectivo.montoRecibido || 0) > pagoEfectivo.monto
    ? Math.round(((pagoEfectivo.montoRecibido || 0) - pagoEfectivo.monto) * 100) / 100
    : 0;

  const handleUpdatePago = (id: string, field: keyof MetodoPagoRow, value: any) => {
    setPagos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };

        // Recalcular vuelto si es efectivo
        if (updated.metodo === 'EFECTIVO') {
          const m = Number(updated.monto) || 0;
          const rec = Number(updated.montoRecibido) || 0;
          updated.vuelto = rec > m ? Math.round((rec - m) * 100) / 100 : 0;
        }

        return updated;
      })
    );
    setErrorValidacion(null);
  };

  const handleMetodoChange = (id: string, nuevoMetodo: MetodoPagoRow['metodo']) => {
    if (nuevoMetodo === 'CUENTA_CORRIENTE' && (!cliente.id || cliente.nombre === 'Consumidor Final')) {
      setErrorValidacion('No se puede seleccionar Cuenta Corriente para un Consumidor Final genérico. Seleccione un cliente registrado.');
      return;
    }

    setPagos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          metodo: nuevoMetodo,
          montoRecibido: nuevoMetodo === 'EFECTIVO' ? p.monto : null,
          vuelto: null,
          referencia: '',
        };
      })
    );
    setErrorValidacion(null);
  };

  const handleAgregarMedioPago = () => {
    const restante = Math.max(0, saldoRestante);
    const nuevoId = `pago-${Date.now()}`;
    setPagos((prev) => [
      ...prev,
      {
        id: nuevoId,
        metodo: 'TRANSFERENCIA',
        monto: restante,
        montoRecibido: null,
        vuelto: null,
      },
    ]);
  };

  const handleEliminarMedioPago = (id: string) => {
    if (pagos.length <= 1) return;
    setPagos((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePagarConCuentaCorriente = () => {
    if (!cliente.id || cliente.nombre === 'Consumidor Final') {
      setErrorValidacion('Debe seleccionar un cliente registrado para imputar a Cuenta Corriente.');
      return;
    }

    // Si ya existe medio CC, actualizarlo; si no, cambiar el primero
    setPagos([
      {
        id: 'pago-cc',
        metodo: 'CUENTA_CORRIENTE',
        monto: totalVenta,
        montoRecibido: null,
        vuelto: null,
      },
    ]);
    setErrorValidacion(null);
  };

  const handleConfirmar = useCallback(async () => {
    setErrorValidacion(null);

    // Validar suma de montos
    if (Math.abs(saldoRestante) > 0.05) {
      setErrorValidacion(
        saldoRestante > 0
          ? `Faltan imputar ${formatARS(saldoRestante)} para cubrir el total de la venta.`
          : `El total de pagos supera la venta por ${formatARS(Math.abs(saldoRestante))}.`
      );
      return;
    }

    // Validar cuenta corriente sin cliente
    if (montoCuentaCorriente > 0 && (!cliente.id || cliente.nombre === 'Consumidor Final')) {
      setErrorValidacion('Para imputar saldo a Cuenta Corriente es obligatorio un cliente registrado.');
      return;
    }

    // Validar efectivo recibido
    if (pagoEfectivo && (pagoEfectivo.montoRecibido || 0) < pagoEfectivo.monto) {
      setErrorValidacion('El importe recibido en efectivo no puede ser menor al monto asignado a pagar en efectivo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `idemp-vta-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      await onConfirmarVenta({
        pagos: pagos.map((p) => ({
          metodo: p.metodo,
          monto: Number(p.monto) || 0,
          montoRecibido: p.metodo === 'EFECTIVO' ? Number(p.montoRecibido) || Number(p.monto) : null,
          vuelto: p.metodo === 'EFECTIVO' ? p.vuelto || 0 : null,
          referencia: p.referencia || null,
        })),
        observaciones: observaciones.trim() || undefined,
        idempotencyKey,
      });

      onClose();
    } catch (err: any) {
      setErrorValidacion(err.message || 'Error al confirmar la venta');
      setIsSubmitting(false);
    }
  }, [
    saldoRestante,
    montoCuentaCorriente,
    cliente,
    pagoEfectivo,
    onConfirmarVenta,
    pagos,
    observaciones,
    onClose,
  ]);

  // Atajos de teclado: Escape para cerrar, Enter para confirmar si el foco no está en un input y está cuadrado
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !isSubmitting) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        if (Math.abs(saldoRestante) <= 0.05) {
          e.preventDefault();
          handleConfirmar();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, saldoRestante, handleConfirmar, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-card w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Confirmar Venta y Cobro
              </h3>
              <p className="text-[11px] text-slate-400">
                {itemsCount} {itemsCount === 1 ? 'artículo' : 'artículos'} • Lista: {listaPrecioNombre} {ivaDiscriminado ? '(IVA Discriminado)' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Tarjeta de Resumen y Total */}
          <div className="p-4 rounded-xl bg-slate-900 text-white dark:bg-slate-950 dark:border dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total a Cobrar
              </span>
              <span className="text-3xl font-black text-emerald-400 tracking-tight">
                {formatARS(totalVenta)}
              </span>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                <span>
                  Cliente: <strong className="text-white">{cliente.nombre}</strong>
                  {cliente.identificacion ? ` (${cliente.identificacion})` : ''}
                </span>
                {onCambiarCliente && (
                  <button
                    type="button"
                    onClick={() => setShowModalCambioCliente(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-slate-800/80 hover:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 transition-colors ml-1"
                  >
                    <User className="w-2.5 h-2.5" />
                    Cambiar cliente
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1 text-[11px] text-slate-300 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
              <div>Subtotal {ivaDiscriminado ? '(Neto)' : ''}: {formatARS(subtotal)}</div>
              {descuentoMonto > 0 && (
                <div className="text-emerald-400">Desc: -{formatARS(descuentoMonto)}</div>
              )}
              {ivaDiscriminado && impuestosMonto > 0 && (
                <div className="text-amber-400 font-bold">
                  IVA: +{formatARS(impuestosMonto)}
                </div>
              )}
            </div>
          </div>

          {/* Accesos rápidos de cobro */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPagos([
                  {
                    id: 'pago-1',
                    metodo: 'EFECTIVO',
                    monto: totalVenta,
                    montoRecibido: totalVenta,
                    vuelto: 0,
                  },
                ]);
                setErrorValidacion(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              100% Efectivo
            </button>
            <button
              type="button"
              onClick={() => {
                setPagos([
                  {
                    id: 'pago-1',
                    metodo: 'TRANSFERENCIA',
                    monto: totalVenta,
                    montoRecibido: null,
                    vuelto: null,
                  },
                ]);
                setErrorValidacion(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
              100% Transferencia
            </button>
            <button
              type="button"
              onClick={() => {
                setPagos([
                  {
                    id: 'pago-1',
                    metodo: 'TARJETA_DEBITO',
                    monto: totalVenta,
                    montoRecibido: null,
                    vuelto: null,
                  },
                ]);
                setErrorValidacion(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5 text-cyan-600" />
              100% Tarjeta Débito
            </button>
            {cliente.id && cliente.nombre !== 'Consumidor Final' && (
              <button
                type="button"
                onClick={handlePagarConCuentaCorriente}
                className="px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/80 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 transition-colors"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                100% Cuenta Corriente
              </button>
            )}
          </div>

          {/* Medios de Pago Configurados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Desglose de Medios de Pago
              </span>
              <button
                type="button"
                onClick={handleAgregarMedioPago}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 font-bold text-[11px] hover:bg-indigo-100/70 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Agregar otro medio (pago mixto)
              </button>
            </div>

            <div className="space-y-2.5">
              {pagos.map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                    p.metodo === 'CUENTA_CORRIENTE'
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
                      : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Selector de método */}
                    <div className="w-44 shrink-0">
                      <select
                        value={p.metodo}
                        onChange={(e) => handleMetodoChange(p.id, e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                      >
                        <option value="EFECTIVO">💵 Efectivo</option>
                        <option value="TRANSFERENCIA">🏦 Transferencia</option>
                        <option value="TARJETA_DEBITO">💳 Tarjeta Débito</option>
                        <option value="TARJETA_CREDITO">💳 Tarjeta Crédito</option>
                        <option
                          value="CUENTA_CORRIENTE"
                          disabled={!cliente.id || cliente.nombre === 'Consumidor Final'}
                        >
                          📋 Cuenta Corriente {(!cliente.id || cliente.nombre === 'Consumidor Final') ? '(Requiere cliente)' : ''}
                        </option>
                        <option value="CHEQUE">📑 Cheque</option>
                      </select>
                    </div>

                    {/* Input de monto */}
                    <div className="flex-1 min-w-[140px]">
                      <div className="relative">
                        <span className="text-slate-400 text-xs font-bold absolute left-2.5 top-1/2 -translate-y-1/2">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={p.monto === 0 ? '' : p.monto}
                          onChange={(e) =>
                            handleUpdatePago(p.id, 'monto', parseFloat(e.target.value) || 0)
                          }
                          placeholder="Monto..."
                          className="w-full pl-6 pr-3 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                        />
                      </div>
                    </div>

                    {/* Botón eliminar fila */}
                    {pagos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleEliminarMedioPago(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Eliminar este pago"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Campos específicos por medio */}
                  {p.metodo === 'EFECTIVO' && (
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Importe Recibido del Cliente
                        </label>
                        <div className="relative">
                          <span className="text-slate-400 text-xs font-bold absolute left-2.5 top-1/2 -translate-y-1/2">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={p.montoRecibido ?? ''}
                            onChange={(e) =>
                              handleUpdatePago(
                                p.id,
                                'montoRecibido',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="0.00"
                            className="w-full pl-6 pr-3 py-1 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Cambio / Vuelto a Entregar
                        </label>
                        <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-black text-emerald-700 dark:text-emerald-300">
                          {formatARS(vueltoEfectivo)}
                        </div>
                      </div>
                    </div>
                  )}

                  {['TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CHEQUE'].includes(
                    p.metodo
                  ) && (
                    <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                      <input
                        type="text"
                        value={p.referencia || ''}
                        onChange={(e) => handleUpdatePago(p.id, 'referencia', e.target.value)}
                        placeholder={
                          p.metodo === 'TRANSFERENCIA'
                            ? 'N° Comprobante / CBU / Operación (opcional)...'
                            : 'Últimos 4 dígitos o lote (opcional)...'
                        }
                        className="w-full px-3 py-1 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  )}

                  {p.metodo === 'CUENTA_CORRIENTE' && (
                    <div className="p-2 rounded-lg bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
                      <Receipt className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Saldo a Cuenta Corriente: {formatARS(p.monto)}</strong>
                        <p className="text-[10px] text-amber-800 dark:text-amber-400 mt-0.5">
                          Este monto quedará registrado como pendiente de cobro en la cuenta del cliente <strong>{cliente.nombre}</strong>. La venta se registrará como Confirmada con estado de pago <strong>{totalPagos - p.monto > 0 ? 'PARCIAL' : 'PENDIENTE'}</strong>.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Alerta de cuadre de importes */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400">
              Total Cubierto por Pagos:
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`font-black text-sm ${
                  Math.abs(saldoRestante) <= 0.05
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {formatARS(totalPagos)}
              </span>
              {Math.abs(saldoRestante) > 0.05 && (
                <span className="text-[11px] font-bold text-amber-600">
                  ({saldoRestante > 0 ? `Resta ${formatARS(saldoRestante)}` : `Sobra ${formatARS(Math.abs(saldoRestante))}`})
                </span>
              )}
            </div>
          </div>

          {/* Observaciones opcionales */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Observaciones de la Venta (opcional)
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Entrega por mostrador, retira comisionista, etc..."
              className="w-full px-3 py-2 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Mensaje de error de validación */}
          {errorValidacion && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorValidacion}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={isSubmitting || Math.abs(saldoRestante) > 0.05}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Confirmando Venta...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar y Registrar Venta ({formatARS(totalVenta)})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selector modal de cliente integrado */}
      <SeleccionarClienteModal
        isOpen={showModalCambioCliente}
        onClose={() => setShowModalCambioCliente(false)}
        clienteActual={cliente}
        onSeleccionar={(nuevoCli) => {
          if (onCambiarCliente) {
            onCambiarCliente(nuevoCli);
          }
          setShowModalCambioCliente(false);
        }}
      />
    </div>
  );
}
