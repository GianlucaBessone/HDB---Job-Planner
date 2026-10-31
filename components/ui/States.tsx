import React from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Lista o vista sin contenido. Explica por qué y ofrece el siguiente paso. */
export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
    compact = false,
}: {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
    compact?: boolean;
}) {
    return (
        <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8 px-4' : 'py-16 px-6', className)}>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-3 [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">
                {icon ?? <Inbox />}
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            {description && <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

/** Error recuperable dentro de una vista. */
export function ErrorState({
    title = 'No pudimos cargar la información',
    description,
    onRetry,
    className,
}: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    onRetry?: () => void;
    className?: string;
}) {
    return (
        <div role="alert" className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
            <div className="w-10 h-10 rounded-xl bg-danger-50 text-danger-600 dark:bg-danger-950 dark:text-danger-300 flex items-center justify-center mb-3" aria-hidden="true">
                <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            {description && <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>}
            {onRetry && (
                <button onClick={onRetry} className="btn btn-secondary btn-sm mt-4">Reintentar</button>
            )}
        </div>
    );
}

export function Spinner({ className, label = 'Cargando' }: { className?: string; label?: string }) {
    return (
        <span role="status" className="inline-flex items-center">
            <Loader2 className={cn('w-5 h-5 animate-spin text-slate-400', className)} aria-hidden="true" />
            <span className="sr-only">{label}</span>
        </span>
    );
}

/** Carga de una vista completa o bloque grande. */
export function LoadingState({ label = 'Cargando…', className }: { label?: string; className?: string }) {
    return (
        <div role="status" className={cn('flex flex-col items-center justify-center gap-3 py-16 text-[13px] text-slate-500 dark:text-slate-400', className)}>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span>{label}</span>
        </div>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('skeleton', className)} aria-hidden="true" />;
}
