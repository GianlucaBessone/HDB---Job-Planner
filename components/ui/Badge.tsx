import React from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/**
 * Estado o categoría corta. El color comunica significado, nunca decora:
 * success = completado/válido, warning = requiere atención, danger = error o
 * vencido, info = en curso, brand = selección/propio, neutral = el resto.
 */
export function Badge({
    tone = 'neutral',
    dot = false,
    className,
    children,
}: {
    tone?: BadgeTone;
    dot?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <span className={cn('badge', `badge-${tone}`, className)}>
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />}
            {children}
        </span>
    );
}
