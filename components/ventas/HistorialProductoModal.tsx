'use client';

import React, { useState, useEffect } from 'react';
import { X, History, Clock, User, ArrowRight, ShieldCheck, Tag, Loader2 } from 'lucide-react';
import { formatDateInline } from '@/lib/formatDate';
import { formatARS } from '@/lib/formatCurrency';

interface HistorialItem {
  id: string;
  tipo: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  origen: string;
  detalles: any;
  usuarioNombre?: string;
  createdAt: string;
}

interface HistorialProductoModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto: { id: string; sku: string; descripcion: string } | null;
}

export default function HistorialProductoModal({
  isOpen,
  onClose,
  producto,
}: HistorialProductoModalProps) {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (producto && isOpen) {
      loadHistorial();
    }
  }, [producto, isOpen]);

  const loadHistorial = async () => {
    if (!producto) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ventas/productos/${producto.id}/historial`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !producto) return null;

  const getTipoBadge = (tipo: string, origen: string) => {
    switch (tipo) {
      case 'CREACION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Alta de Producto</span>;
      case 'CAMBIO_PRECIO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">Modificación Precio</span>;
      case 'CAMBIO_COSTO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">Cambio de Costo</span>;
      case 'CAMBIO_IVA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">Alícuota IVA</span>;
      case 'AJUSTE_STOCK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Ajuste de Stock</span>;
      case 'AJUSTE_MASIVO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">Ajuste por Lotes</span>;
      case 'IMPORTACION_EXCEL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Importación Excel</span>;
      case 'BAJA_LOGICA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">Baja Lógica</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{tipo}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Historial y Auditoría
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  {producto.sku}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-md">{producto.descripcion}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">Cargando eventos de auditoría...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-bold">Sin eventos de modificación registrados</p>
              <p className="text-xs text-slate-500 mt-1">
                Todas las alteraciones de precio, costo, IVA o stock quedarán registradas aquí.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3.5 space-y-6">
              {items.map((item) => (
                <div key={item.id} className="relative pl-6">
                  {/* Dot */}
                  <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-card bg-primary shadow-sm" />

                  <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getTipoBadge(item.tipo, item.origen)}
                        {item.campo && (
                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                            Campo: [{item.campo}]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {item.usuarioNombre || 'Sistema'}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {formatDateInline(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Change diff */}
                    {(item.valorAnterior !== null || item.valorNuevo !== null) && (() => {
                      const isMoney = item.tipo === 'CAMBIO_PRECIO' || item.tipo === 'CAMBIO_COSTO' || item.campo?.includes('precio') || item.campo === 'costo';
                      const oldNum = Number(item.valorAnterior);
                      const newNum = Number(item.valorNuevo);
                      const displayOld = isMoney && !isNaN(oldNum) ? formatARS(oldNum) : (item.valorAnterior ?? '(nulo)');
                      const displayNew = isMoney && !isNaN(newNum) ? formatARS(newNum) : (item.valorNuevo ?? '(nulo)');

                      return (
                        <div className="flex items-center gap-3 text-xs pt-1">
                          <span className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-mono line-through">
                            {displayOld}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                            {displayNew}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Additional Details */}
                    {item.detalles && typeof item.detalles === 'object' && Object.keys(item.detalles).length > 0 && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-background/60 p-2 rounded-lg font-mono">
                        {JSON.stringify(item.detalles)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
