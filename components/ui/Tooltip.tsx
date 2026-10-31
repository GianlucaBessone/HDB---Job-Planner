import React from 'react';
import { cn } from '@/lib/cn';

/**
 * Ayuda breve sobre un control. Aparece con hover y con foco de teclado.
 * Solo para información complementaria: nada que sea imprescindible para
 * completar una tarea puede vivir únicamente en un tooltip.
 */
export function Tooltip({
    content,
    side = 'top',
    children,
    className,
}: {
    content: React.ReactNode;
    side?: 'top' | 'bottom';
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span className={cn('relative inline-flex group/tip', className)}>
            {children}
            <span
                role="tooltip"
                className={cn(
                    'pointer-events-none absolute left-1/2 -translate-x-1/2 z-[300] w-max max-w-[240px] px-2.5 py-1.5 rounded-md',
                    'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs leading-snug shadow-lg',
                    'opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 transition-opacity duration-100 delay-200',
                    side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
                )}
            >
                {content}
            </span>
        </span>
    );
}
