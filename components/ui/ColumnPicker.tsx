'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Settings2, X } from 'lucide-react';
import type { ColumnConfigItem } from '@/lib/viewPreferences';

interface ColumnPickerProps {
  columnOrder: ColumnConfigItem[];
  labels: Record<string, string>;
  draggedIdx: number | null;
  onToggle: (key: string) => void;
  onReset: () => void;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
}

/** Botón "Columnas" con el panel para mostrar/ocultar y reordenar columnas (arrastrando). */
export function ColumnPicker({
  columnOrder,
  labels,
  draggedIdx,
  onToggle,
  onReset,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
        title="Configurar columnas visibles"
      >
        <Settings2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="hidden sm:inline">Columnas</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2.5 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Configurar Columnas
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReset}
                className="text-[11px] text-primary hover:underline font-bold"
                title="Restablecer orden, visibilidad y anchos por defecto"
              >
                Restablecer
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 pb-1">Arrastre para reordenar</p>
          <div className="max-h-72 overflow-y-auto space-y-0.5 text-xs">
            {columnOrder.map((col, idx) => (
              <div
                key={col.key}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-1.5 py-1 px-1 rounded-lg cursor-grab active:cursor-grabbing select-none transition-colors ${
                  draggedIdx === idx
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() => onToggle(col.key)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-slate-300 text-primary h-3.5 w-3.5 shrink-0"
                  aria-label={`Mostrar ${labels[col.key] || col.key}`}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {labels[col.key] || col.key}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColumnPicker;
