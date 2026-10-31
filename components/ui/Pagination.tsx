'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Paginación de tablas y listados. Muestra el rango visible y el total para
 * que la persona sepa cuánto falta, no solo en qué página está.
 */
export function Pagination({
    page,
    pageSize,
    total,
    onPageChange,
    className,
}: {
    /** Página actual, empezando en 1. */
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    className?: string;
}) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);

    return (
        <nav aria-label="Paginación" className={cn('flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border text-[13px] text-slate-500 dark:text-slate-400', className)}>
            <span className="tabular-nums">
                {from}–{to} de {total}
            </span>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                >
                    <ChevronLeft />
                </button>
                <span className="px-2 tabular-nums" aria-current="page">
                    {page} / {pages}
                </span>
                <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= pages}
                    aria-label="Página siguiente"
                >
                    <ChevronRight />
                </button>
            </div>
        </nav>
    );
}
