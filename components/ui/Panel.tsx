import React from 'react';
import { cn } from '@/lib/cn';

/**
 * Contenedor de una unidad de contenido (tabla, formulario, gráfico).
 * No anides Panels: dentro de un Panel separá con divisores o espacio.
 */
export function Panel({
    title,
    description,
    actions,
    footer,
    padded = true,
    className,
    bodyClassName,
    children,
    as: Tag = 'section',
}: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    padded?: boolean;
    className?: string;
    bodyClassName?: string;
    children?: React.ReactNode;
    as?: 'section' | 'div' | 'article';
}) {
    return (
        <Tag className={cn('surface overflow-hidden', className)}>
            {(title || actions) && (
                <header className="surface-header">
                    <div className="min-w-0">
                        {title && <h2 className="surface-title truncate">{title}</h2>}
                        {description && <p className="text-caption text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
                    </div>
                    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
                </header>
            )}
            <div className={cn(padded && 'p-4', bodyClassName)}>{children}</div>
            {footer && <footer className="px-4 py-3 border-t border-border bg-surface-sunken/60">{footer}</footer>}
        </Tag>
    );
}

/** Indicador numérico. Sin ícono de color: el dato es el protagonista. */
export function Stat({
    label,
    value,
    hint,
    tone = 'neutral',
    icon,
    className,
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    hint?: React.ReactNode;
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    icon?: React.ReactNode;
    className?: string;
}) {
    const toneText = {
        neutral: 'text-slate-900 dark:text-slate-50',
        success: 'text-success-700 dark:text-success-300',
        warning: 'text-warning-700 dark:text-warning-300',
        danger: 'text-danger-700 dark:text-danger-300',
        info: 'text-info-700 dark:text-info-300',
    }[tone];
    return (
        <div className={cn('surface px-4 py-3.5', className)}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-caption font-medium text-slate-500 dark:text-slate-400 truncate">{label}</span>
                {icon && <span className="text-slate-400 [&>svg]:w-4 [&>svg]:h-4 shrink-0" aria-hidden="true">{icon}</span>}
            </div>
            <div className={cn('mt-1 text-[1.5rem] leading-8 font-semibold tabular-nums tracking-tight', toneText)}>{value}</div>
            {hint && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>}
        </div>
    );
}
