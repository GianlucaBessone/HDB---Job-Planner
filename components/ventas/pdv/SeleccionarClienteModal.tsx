'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User, Check, Building2, Phone, MapPin, Loader2 } from 'lucide-react';

interface ClienteItem {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  listaPrecioId?: string | null;
  listaPrecio?: { id: string; nombre: string; codigo: string } | null;
}

interface SeleccionarClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteActual: {
    id: string | null;
    nombre: string;
    identificacion?: string | null;
  };
  onSeleccionar: (cliente: {
    id: string | null;
    nombre: string;
    identificacion?: string | null;
    listaPrecioId?: string | null;
  }) => void;
}

export default function SeleccionarClienteModal({
  isOpen,
  onClose,
  clienteActual,
  onSeleccionar,
}: SeleccionarClienteModalProps) {
  const [search, setSearch] = useState('');
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      fetchClientes(search);
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, search]);

  const fetchClientes = async (q: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ventas/pdv/clientes?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setClientes(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-card w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              Seleccionar Cliente
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar por nombre, email, teléfono o dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        {/* Lista de clientes */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
          {/* Opción rápida: Consumidor Final */}
          <div
            onClick={() => {
              onSeleccionar({
                id: null,
                nombre: 'Consumidor Final',
                identificacion: null,
                listaPrecioId: null,
              });
              onClose();
            }}
            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              clienteActual.id === null
                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 shadow-xs'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                  Consumidor Final
                </div>
                <div className="text-[11px] text-slate-400">Venta rápida sin identificación nominal</div>
              </div>
            </div>
            {clienteActual.id === null && (
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Clientes nominales */}
          {isLoading ? (
            <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-xs">Buscando clientes...</span>
            </div>
          ) : clientes.length === 0 && search ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No se encontraron clientes registrados con "{search}"
            </div>
          ) : (
            clientes.map((c) => {
              const isSelected = clienteActual.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSeleccionar({
                      id: c.id,
                      nombre: c.nombre,
                      identificacion: c.telefono || c.email || null,
                      listaPrecioId: c.listaPrecioId || null,
                    });
                    onClose();
                  }}
                  className={`pt-2 p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {c.nombre}
                      </span>
                      {c.listaPrecio && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                          {c.listaPrecio.nombre}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {c.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {c.telefono}
                        </span>
                      )}
                      {c.direccion && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {c.direccion}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
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
