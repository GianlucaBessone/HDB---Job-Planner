'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2, Tag, ShieldAlert, KeyRound, CheckCircle2, Loader2, Percent } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ItemCarritoInfo {
  id: string;
  sku: string;
  descripcion: string;
  precioOriginal: number;
  precioUnitario: number;
  cantidad: number;
}

interface ModificarPrecioModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemCarritoInfo | null;
  currentUser: any;
  onPrecioModificado: (nuevoPrecio: number, motivo: string) => void;
}

const MOTIVOS_SUGERIDOS = [
  'Ajuste comercial mostrador',
  'Descuento especial por volumen',
  'Corrección de lista',
  'Autorización gerencial',
  'Bonificación por pago contado',
];

export default function ModificarPrecioModal({
  isOpen,
  onClose,
  item,
  currentUser,
  onPrecioModificado,
}: ModificarPrecioModalProps) {
  const [nuevoPrecio, setNuevoPrecio] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Ajuste comercial mostrador');
  const [pinSupervisor, setPinSupervisor] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const precioInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const rol = (currentUser?.role || '').toLowerCase();
  const esSupervisorOAdmin = ['admin', 'administrador', 'supervisor'].includes(rol);

  useEffect(() => {
    if (isOpen && item) {
      setNuevoPrecio(String(item.precioUnitario));
      setMotivo('Ajuste comercial mostrador');
      setPinSupervisor('');
      setError('');
      setTimeout(() => {
        precioInputRef.current?.focus();
        precioInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, item]);

  // Teclado Escape y Enter
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

  if (!isOpen || !item) return null;

  const precioNum = parseFloat(nuevoPrecio) || 0;
  const difMonto = precioNum - item.precioOriginal;
  const difPorc = item.precioOriginal > 0 ? (difMonto / item.precioOriginal) * 100 : 0;

  const formatARS = (val: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(val || 0);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (isNaN(precioNum) || precioNum < 0) {
      setError('Ingrese un precio numérico válido mayor o igual a $0.');
      return;
    }

    if (!motivo.trim()) {
      setError('Debe especificar el motivo del cambio de precio.');
      return;
    }

    // Si no es supervisor ni admin, requiere validar PIN de un supervisor activo
    if (!esSupervisorOAdmin) {
      if (!pinSupervisor.trim() || pinSupervisor.trim().length < 3) {
        setError('Ingrese el PIN del Supervisor o Administrador que autoriza.');
        pinInputRef.current?.focus();
        return;
      }

      setIsValidating(true);
      try {
        const res = await fetch('/api/auth/verificar-supervisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pinSupervisor.trim() }),
        });
        const supervisor = await res.json();

        if (!res.ok) {
          setError(supervisor.error || 'PIN incorrecto o no pertenece a un Supervisor / Administrador activo.');
          setIsValidating(false);
          pinInputRef.current?.focus();
          return;
        }

        showToast(`Modificación autorizada por ${supervisor.nombreCompleto}`, 'success');
      } catch (err: any) {
        setError('Error al validar autorización: ' + (err.message || 'error de conexión'));
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    onPrecioModificado(precioNum, motivo.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/50-xs animate-in fade-in duration-150">
      <div className="bg-card w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Modificar Precio Unitario
              </h3>
              <p className="text-[11px] text-slate-400">
                Ajuste manual de mostrador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info del Producto */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {item.sku}
            </span>
            <span className="text-[11px] text-slate-400">
              Cant: {item.cantidad}
            </span>
          </div>
          <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
            {item.descripcion}
          </div>
          <div className="flex justify-between items-center pt-1 text-[11px] text-slate-500">
            <span>Precio lista original: <strong>{formatARS(item.precioOriginal)}</strong></span>
            <span>Actual: <strong>{formatARS(item.precioUnitario)}</strong></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Nuevo Precio */}
          <div>
            <label className="block mb-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
              Nuevo Precio Unitario ($ ARS)
            </label>
            <div className="relative">
              <input
                ref={precioInputRef}
                type="number"
                step="0.01"
                min="0"
                value={nuevoPrecio}
                onChange={(e) => setNuevoPrecio(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            {/* Variación */}
            {precioNum > 0 && Math.abs(difMonto) > 0.01 && (
              <div className="flex items-center justify-between mt-1.5 text-[11px] px-1">
                <span className="text-slate-400">Diferencia sobre lista:</span>
                <span
                  className={`font-bold ${
                    difMonto < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {difMonto > 0 ? '+' : ''}
                  {formatARS(difMonto)} ({difPorc.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {/* Motivo de Modificación */}
          <div>
            <label className="block mb-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
              Motivo del Ajuste
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {MOTIVOS_SUGERIDOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                    motivo === m
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Escriba el motivo del ajuste..."
              className="w-full px-3 py-2 bg-card border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Autorización por PIN si es un Vendedor no supervisor */}
          {!esSupervisorOAdmin ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Requiere PIN de Supervisor o Administrador</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN del Supervisor"
                  value={pinSupervisor}
                  onChange={(e) => setPinSupervisor(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-card border border-amber-300 dark:border-amber-700/80 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Autorizado directamente por rol {currentUser?.role || 'Supervisor'}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isValidating}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isValidating || isNaN(precioNum) || precioNum < 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aplicar Precio ({formatARS(precioNum)})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
