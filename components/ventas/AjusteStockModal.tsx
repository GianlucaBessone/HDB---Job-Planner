'use client';

import React, { useState, useEffect } from 'react';
import { X, PackagePlus, AlertCircle, Save, Loader2 } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface MetaData {
  almacenes: Array<{ id: string; codigo: string; nombre: string }>;
}

interface AjusteStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  producto: { id: string; sku: string; descripcion: string; stockActual: number; almacenId?: string | null } | null;
  meta: MetaData;
}

export default function AjusteStockModal({
  isOpen,
  onClose,
  onSuccess,
  producto,
  meta,
}: AjusteStockModalProps) {
  const [almacenId, setAlmacenId] = useState<string>('');
  const [nuevoStock, setNuevoStock] = useState<string | number>('');
  const [tipo, setTipo] = useState<'AJUSTE' | 'CONTEO' | 'CORRECCION'>('AJUSTE');
  const [motivo, setMotivo] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (producto) {
      setNuevoStock(producto.stockActual !== undefined && producto.stockActual !== null ? producto.stockActual : '');
      setAlmacenId(producto.almacenId || meta.almacenes[0]?.id || '');
      setMotivo('');
    }
  }, [producto, meta, isOpen]);

  if (!isOpen || !producto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivo.trim()) {
      showToast('Debe ingresar un motivo o justificación para el movimiento', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const parsedNuevoStock = parseFloat(String(nuevoStock)) || 0;
      const res = await fetch('/api/ventas/stock/ajuste-rapido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId: producto.id,
          almacenId,
          nuevoStock: parsedNuevoStock,
          tipo,
          motivo: motivo.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ajustar stock');

      showToast(data.mensaje || 'Stock actualizado correctamente', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error al registrar ajuste de stock', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const delta = (parseFloat(String(nuevoStock)) || 0) - (producto.stockActual ?? 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Ajuste Rápido de Stock
              </h3>
              <p className="text-xs text-slate-500 font-mono">{producto.sku}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Producto:</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{producto.descripcion}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Stock Actual
              </label>
              <div className="h-10 px-3 flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-sm">
                {producto.stockActual} unidades
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Nuevo Stock <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={nuevoStock}
                onChange={(e) => setNuevoStock(e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-extrabold text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {delta !== 0 && (
            <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
              delta > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
            }`}>
              <span>Diferencia calculada:</span>
              <span className="font-mono">{delta > 0 ? `+${delta}` : delta} unidades</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Almacén
              </label>
              <select
                value={almacenId}
                onChange={(e) => setAlmacenId(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {meta.almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Tipo de Operación
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="AJUSTE">Ajuste de inventario</option>
                <option value="CONTEO">Conteo físico</option>
                <option value="CORRECCION">Corrección de error</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Motivo / Justificación de Auditoría <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Diferencia por rotura, sobrante de conteo..."
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Registrar Ajuste
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
