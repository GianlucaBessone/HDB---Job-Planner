'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface AutorizacionPrecioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAutorizado: (supervisor: { id: string; nombre: string; role: string }) => void;
  mensaje?: string;
}

export default function AutorizacionPrecioModal({
  isOpen,
  onClose,
  onAutorizado,
  mensaje = 'Esta acción requiere autorización de un Supervisor o Administrador.',
}: AutorizacionPrecioModalProps) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleValidarPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.trim().length < 3) {
      setError('Ingrese un PIN válido');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Validar con la lista de operadores activos con rol admin o supervisor
      const res = await fetch('/api/operators');
      if (!res.ok) throw new Error('Error al verificar operadores');
      const operators = await res.json();

      const supervisor = operators.find(
        (o: any) =>
          o.pin === pin.trim() &&
          ['admin', 'supervisor'].includes((o.role || '').toLowerCase()) &&
          o.activo
      );

      if (!supervisor) {
        setError('PIN incorrecto o no pertenece a un Supervisor / Administrador');
        setIsLoading(false);
        return;
      }

      showToast(`Autorizado por ${supervisor.nombreCompleto}`, 'success');
      onAutorizado({
        id: supervisor.id,
        nombre: supervisor.nombreCompleto,
        role: supervisor.role,
      });
      setPin('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-card w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Autorización Requerida
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{mensaje}</p>

        <form onSubmit={handleValidarPin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              PIN de Supervisor
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoFocus
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-lg font-black tracking-widest text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            {error && <p className="text-[11px] text-red-600 mt-1 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !pin}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Autorizar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
