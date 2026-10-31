'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserCheck,
  Search,
  KeyRound,
  Shield,
  Loader2,
  Check,
  ArrowRight,
  Delete,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface OperatorItem {
  id: string;
  nombreCompleto: string;
  role: string;
  pin?: string;
  activo: boolean;
  dni?: string | null;
  posicion?: string | null;
}

interface CambioRapidoVendedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onVendedorCambiado: (operador: { id: string; nombreCompleto: string; role: string }) => void;
}

export default function CambioRapidoVendedorModal({
  isOpen,
  onClose,
  currentUserId,
  onVendedorCambiado,
}: CambioRapidoVendedorModalProps) {
  const [operadores, setOperadores] = useState<OperatorItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Operador seleccionado para ingresar PIN
  const [operadorSeleccionado, setOperadorSeleccionado] = useState<OperatorItem | null>(null);
  const [pin, setPin] = useState('');
  const [errorPin, setErrorPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setOperadorSeleccionado(null);
      setPin('');
      setErrorPin('');
      setSearch('');
      return;
    }

    fetchOperadores();
  }, [isOpen]);

  const fetchOperadores = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/operators');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Filtrar estrictamente solo usuarios activos con rol VENDEDOR
          const vendedores = data.filter(
            (o: any) => o.activo !== false && (o.role || '').toLowerCase() === 'vendedor'
          );
          setOperadores(vendedores);
        }
      }
    } catch (e) {
      console.error('Error al cargar operadores:', e);
      showToast('Error al cargar lista de vendedores', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Tecla Escape para volver o cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (operadorSeleccionado) {
          setOperadorSeleccionado(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, operadorSeleccionado, onClose]);

  useEffect(() => {
    if (operadorSeleccionado) {
      setPin('');
      setErrorPin('');
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 50);
    } else if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [operadorSeleccionado, isOpen]);

  if (!isOpen) return null;

  const handleSeleccionarOperador = (op: OperatorItem) => {
    setOperadorSeleccionado(op);
  };

  const handleValidarPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!operadorSeleccionado) return;

    if (!pin.trim()) {
      setErrorPin('Ingrese el PIN del usuario');
      return;
    }

    setIsValidating(true);
    setErrorPin('');

    try {
      // 1. Validar contra el PIN del operador seleccionado o si es igual
      const pinIngresado = pin.trim();

      // Consultar endpoint de login o validar con el operador
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: operadorSeleccionado.id,
          pin: pinIngresado,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorPin(data.error || 'PIN incorrecto');
        setPin('');
        setIsValidating(false);
        return;
      }

      const userData = await res.json();

      if ((userData.role || '').toLowerCase() !== 'vendedor') {
        setErrorPin('El cambio en caja solo está permitido para usuarios con rol Vendedor.');
        setPin('');
        setIsValidating(false);
        return;
      }

      // Actualizar localStorage para persistencia de sesión
      localStorage.setItem('lastActiveUserId', userData.id);
      localStorage.setItem('currentUser', JSON.stringify(userData));

      showToast(`Vendedor activo: ${userData.nombreCompleto}`, 'success');
      onVendedorCambiado(userData);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorPin('Error al validar credenciales');
    } finally {
      setIsValidating(false);
    }
  };

  const handleNumericClick = (digit: string) => {
    if (pin.length < 8) {
      const nuevoPin = pin + digit;
      setPin(nuevoPin);
      setErrorPin('');
      if (nuevoPin.length === 4) {
        // Auto-validar al llegar a 4 dígitos para máxima velocidad
        setTimeout(() => {
          validarPinDirecto(nuevoPin);
        }, 80);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorPin('');
  };

  const validarPinDirecto = async (pinAValidar: string) => {
    if (!operadorSeleccionado) return;
    setIsValidating(true);
    setErrorPin('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: operadorSeleccionado.id,
          pin: pinAValidar,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorPin(data.error || 'PIN incorrecto');
        setPin('');
        setIsValidating(false);
        return;
      }

      const userData = await res.json();

      if ((userData.role || '').toLowerCase() !== 'vendedor') {
        setErrorPin('El cambio en caja solo está permitido para usuarios con rol Vendedor.');
        setPin('');
        setIsValidating(false);
        return;
      }

      localStorage.setItem('lastActiveUserId', userData.id);
      localStorage.setItem('currentUser', JSON.stringify(userData));

      showToast(`Vendedor activo: ${userData.nombreCompleto}`, 'success');
      onVendedorCambiado(userData);
      onClose();
    } catch (err) {
      setErrorPin('Error de conexión');
    } finally {
      setIsValidating(false);
    }
  };

  const normalize = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filtrados = operadores.filter(
    (o) =>
      normalize(o.nombreCompleto).includes(normalize(search)) ||
      (o.dni && o.dni.includes(search)) ||
      normalize(o.role).includes(normalize(search))
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/50-xs">
      <div className="bg-card w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Cambio Rápido de Vendedor
              </h3>
              <p className="text-[11px] text-slate-400">
                Seleccione el vendedor que atiende en caja (sólo vendedores)
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

        {/* Contenido: Si no seleccionó operador, muestra lista. Si seleccionó, pide PIN */}
        {!operadorSeleccionado ? (
          <>
            {/* Buscador de operadores */}
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar operador por nombre o DNI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {/* Lista de operadores */}
            <div className="p-3 overflow-y-auto space-y-1.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[420px]">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-xs">Cargando operadores...</span>
                </div>
              ) : filtrados.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No se encontraron operadores activos.
                </div>
              ) : (
                filtrados.map((op) => {
                  const isCurrent = op.id === currentUserId;
                  return (
                    <div
                      key={op.id}
                      onClick={() => handleSeleccionarOperador(op)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-card border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                            isCurrent
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {op.nombreCompleto.substring(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            {op.nombreCompleto}
                            {isCurrent && (
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                (Actual)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span className="capitalize">{op.role}</span>
                            {op.posicion && <span>• {op.posicion}</span>}
                            {op.dni && <span>• DNI: {op.dni}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-indigo-600 dark:text-indigo-400">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Pantalla de ingreso de PIN para el operador seleccionado */
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm uppercase">
                  {operadorSeleccionado.nombreCompleto.substring(0, 2)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {operadorSeleccionado.nombreCompleto}
                  </h4>
                  <p className="text-[11px] text-slate-400 capitalize">
                    {operadorSeleccionado.role} • Ingrese PIN de acceso
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOperadorSeleccionado(null)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Cambiar
              </button>
            </div>

            <form onSubmit={handleValidarPin} className="space-y-4">
              <div className="relative max-w-[200px] mx-auto">
                <input
                  ref={pinInputRef}
                  type="password"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setErrorPin('');
                    if (e.target.value.length === 4) {
                      validarPinDirecto(e.target.value);
                    }
                  }}
                  placeholder="••••"
                  className="w-full py-2.5 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-2xl font-bold tracking-wider text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              {errorPin && (
                <p className="text-center text-xs font-bold text-red-600 dark:text-red-400">
                  {errorPin}
                </p>
              )}

              {/* Teclado numérico táctil para mostrador */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={isValidating}
                    onClick={() => handleNumericClick(digit)}
                    className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-base font-bold text-slate-800 dark:text-slate-100 transition-all"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isValidating}
                  onClick={() => setPin('')}
                  className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-500 transition-all"
                >
                  C
                </button>
                <button
                  type="button"
                  disabled={isValidating}
                  onClick={() => handleNumericClick('0')}
                  className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-base font-bold text-slate-800 dark:text-slate-100 transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={isValidating}
                  onClick={handleBackspace}
                  className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-2 flex items-center justify-center">
                <button
                  type="submit"
                  disabled={isValidating || !pin}
                  className="w-full max-w-[240px] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validando PIN...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Ingresar como Vendedor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <span className="text-[11px] text-slate-400">Atajo [F9]</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
