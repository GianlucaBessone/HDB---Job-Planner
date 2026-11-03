'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  ColumnConfigItem,
  getColumnConfig,
  getColumnWidths,
  setColumnConfig,
  setColumnWidths,
} from '@/lib/viewPreferences';

/**
 * Columnas configurables de una tabla (orden, visibilidad y ancho), guardadas por usuario
 * en localStorage. Es el mismo comportamiento que la grilla de Gestión Comercial.
 */

function getUserId(): string {
  try {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const user = JSON.parse(stored);
      return user?.legajo || user?.id || 'default';
    }
  } catch {
    /* ignore */
  }
  return 'default';
}

interface Options {
  /** Clave de persistencia (p. ej. 'almacen_resumen'). */
  moduleKey: string;
  defaultOrder: ColumnConfigItem[];
  defaultWidths: Record<string, number>;
  minWidth?: number;
}

export function useConfigurableColumns({ moduleKey, defaultOrder, defaultWidths, minWidth = 50 }: Options) {
  const [columnOrder, setColumnOrder] = useState<ColumnConfigItem[]>(defaultOrder);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>(defaultWidths);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const orderRef = useRef(columnOrder);
  orderRef.current = columnOrder;
  const widthsRef = useRef(columnWidths);
  widthsRef.current = columnWidths;
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Cargar preferencias guardadas (sumando columnas nuevas agregadas en código y descartando las eliminadas)
  useEffect(() => {
    const uid = getUserId();
    const validKeys = new Set(defaultOrder.map((c) => c.key));
    const saved = getColumnConfig(uid, moduleKey);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const merged = saved.filter((c) => c && validKeys.has(c.key));
      const savedKeys = new Set(merged.map((c) => c.key));
      for (const def of defaultOrder) {
        if (!savedKeys.has(def.key)) merged.push(def);
      }
      setColumnOrder(merged);
    }
    const savedWidths = getColumnWidths(uid, moduleKey);
    if (savedWidths && typeof savedWidths === 'object') {
      setColumnWidthsState((prev) => ({ ...prev, ...savedWidths }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  const visibleColumns = useMemo(() => columnOrder.filter((c) => c.visible), [columnOrder]);

  const getWidth = useCallback(
    (key: string) => columnWidths[key] || defaultWidths[key] || 100,
    [columnWidths, defaultWidths]
  );

  const toggleColumn = useCallback(
    (key: string) => {
      const updated = orderRef.current.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
      // Siempre debe quedar al menos una columna visible
      if (!updated.some((c) => c.visible)) return;
      setColumnOrder(updated);
      setColumnConfig(getUserId(), moduleKey, updated);
    },
    [moduleKey]
  );

  const resetColumns = useCallback(() => {
    setColumnOrder(defaultOrder);
    setColumnWidthsState(defaultWidths);
    setColumnConfig(getUserId(), moduleKey, defaultOrder);
    setColumnWidths(getUserId(), moduleKey, defaultWidths);
  }, [moduleKey, defaultOrder, defaultWidths]);

  const onDragStart = useCallback((idx: number) => setDraggedIdx(idx), []);

  const onDragOver = useCallback(
    (e: ReactDragEvent, idx: number) => {
      e.preventDefault();
      if (draggedIdx === null || draggedIdx === idx) return;
      const reordered = [...orderRef.current];
      const [moved] = reordered.splice(draggedIdx, 1);
      reordered.splice(idx, 0, moved);
      setColumnOrder(reordered);
      setDraggedIdx(idx);
    },
    [draggedIdx]
  );

  const onDragEnd = useCallback(() => {
    setDraggedIdx(null);
    setColumnConfig(getUserId(), moduleKey, orderRef.current);
  }, [moduleKey]);

  const startResize = useCallback(
    (e: ReactMouseEvent, key: string) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = {
        key,
        startX: e.clientX,
        startWidth: widthsRef.current[key] || defaultWidths[key] || 100,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        const r = resizingRef.current;
        if (!r) return;
        const next = Math.max(minWidth, r.startWidth + (ev.clientX - r.startX));
        setColumnWidthsState((prev) => ({ ...prev, [r.key]: next }));
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (resizingRef.current) {
          setColumnWidths(getUserId(), moduleKey, { ...widthsRef.current });
          resizingRef.current = null;
        }
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [moduleKey, defaultWidths, minWidth]
  );

  return {
    columnOrder,
    visibleColumns,
    getWidth,
    toggleColumn,
    resetColumns,
    draggedIdx,
    onDragStart,
    onDragOver,
    onDragEnd,
    startResize,
  };
}
