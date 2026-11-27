'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface BarraSeleccionProps {
    /** Elementos que se pueden seleccionar en la vista. */
    total: number;
    seleccionadas: number;
    onTodas: () => void;
    onNinguna: () => void;
    /** Acciones masivas: se muestran solo con algo seleccionado. */
    children?: React.ReactNode;
    /** "tarea"/"tareas", "persona"/"personas"… */
    unidad: [singular: string, plural: string];
    className?: string;
}

/**
 * Barra de selección múltiple (P33): casilla para elegir todo lo visible, cuántos hay elegidos y las acciones
 * masivas de la pantalla. Las acciones se aplican con `enLote` (`lib/lote.ts`), que usa la misma API que la acción
 * individual, así valen los mismos permisos y la auditoría.
 */
export function BarraSeleccion({ total, seleccionadas, onTodas, onNinguna, children, unidad, className }: BarraSeleccionProps) {
    const ref = useRef<HTMLInputElement>(null);
    const todas = total > 0 && seleccionadas === total;
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = seleccionadas > 0 && !todas;
    }, [seleccionadas, todas]);
    if (total === 0) return null;
    const [singular, plural] = unidad;

    return (
        <div
            role="toolbar"
            aria-label="Acciones sobre la selección"
            className={cn(
                'sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
                seleccionadas > 0 ? 'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40' : 'border-border bg-card',
                className
            )}
        >
            <label className="flex items-center gap-2 text-[13px] text-foreground cursor-pointer select-none">
                <input ref={ref} type="checkbox" className="w-4 h-4 accent-primary" checked={todas} onChange={() => (todas ? onNinguna() : onTodas())} />
                {seleccionadas > 0
                    ? `${seleccionadas} ${seleccionadas === 1 ? singular : plural} ${seleccionadas === 1 ? 'seleccionada' : 'seleccionadas'}`
                    : `Seleccionar ${total === 1 ? `la ${singular}` : `las ${total} ${plural}`}`}
            </label>
            {seleccionadas > 0 && (
                <>
                    <span className="flex-1" />
                    <div className="flex flex-wrap items-center gap-2">{children}</div>
                    <button type="button" onClick={onNinguna} className="btn btn-ghost btn-sm" aria-label="Quitar la selección" title="Quitar la selección">
                        <X aria-hidden="true" />
                    </button>
                </>
            )}
        </div>
    );
}

/** Estado de selección de una lista: un Set de ids con ayudas para alternar y limpiar. */
export function useSeleccion() {
    const [ids, setIds] = React.useState<Set<string>>(new Set());
    return {
        ids,
        cantidad: ids.size,
        tiene: (id: string) => ids.has(id),
        alternar: (id: string) =>
            setIds(prev => {
                const n = new Set(prev);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
            }),
        poner: (lista: string[]) => setIds(new Set(lista)),
        limpiar: () => setIds(new Set()),
        /** Deja solo los ids que siguen visibles (al filtrar o recargar). */
        recortar: (visibles: string[]) =>
            setIds(prev => {
                const v = new Set(visibles);
                const n = new Set(Array.from(prev).filter(id => v.has(id)));
                return n.size === prev.size ? prev : n;
            }),
    };
}
