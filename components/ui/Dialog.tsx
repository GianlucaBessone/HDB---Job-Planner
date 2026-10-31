'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Info, Loader2, Trash2, X } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';
import { cn } from '@/lib/cn';

const SIZES = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-[min(1200px,calc(100vw-3rem))]',
};

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
    /** Ícono junto al título (diálogos de confirmación). */
    icon?: React.ReactNode;
    size?: keyof typeof SIZES;
    footer?: React.ReactNode;
    children?: React.ReactNode;
    /** false mientras una operación está en curso: bloquea Escape y el clic fuera. */
    dismissible?: boolean;
    className?: string;
    bodyClassName?: string;
    zIndex?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal del sistema: foco atrapado, Escape para cerrar, foco devuelto
 * al disparador y hoja inferior en pantallas chicas.
 */
export function Dialog({
    open,
    onClose,
    title,
    description,
    icon,
    size = 'md',
    footer,
    children,
    dismissible = true,
    className,
    bodyClassName,
    zIndex = 'z-[200]',
}: DialogProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descId = useId();
    useModalScroll(open);

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const first = panel?.querySelector<HTMLElement>('[data-autofocus]') || panel?.querySelector<HTMLElement>(FOCUSABLE);
        (first || panel)?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dismissible) {
                e.stopPropagation();
                onClose();
            }
            if (e.key === 'Tab' && panel) {
                const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
                if (items.length === 0) return;
                const firstEl = items[0];
                const lastEl = items[items.length - 1];
                if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
                else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    return (
        <div
            className={cn('fixed inset-0 flex items-end sm:items-center justify-center sm:p-6', zIndex)}
            onMouseDown={(e) => { if (dismissible && e.target === e.currentTarget) onClose(); }}
        >
            <div className="scrim -z-10 animate-in fade-in duration-150" aria-hidden="true" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={cn(
                    'relative w-full flex flex-col max-h-[92dvh] bg-popover text-popover-foreground border border-border shadow-2xl outline-none',
                    'rounded-t-3xl sm:rounded-3xl animate-in fade-in slide-in-from-bottom-2 sm:zoom-in-95 duration-200',
                    SIZES[size],
                    className
                )}
            >
                {title && (
                    <header className="flex items-start gap-3 px-5 pt-5 pb-3">
                        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
                        <div className="min-w-0 flex-1">
                            <h2 id={titleId} className="text-heading text-slate-900 dark:text-slate-50">{title}</h2>
                            {description && <div id={descId} className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">{description}</div>}
                        </div>
                        {dismissible && (
                            <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm btn-icon-inline -mr-2 -mt-1" aria-label="Cerrar">
                                <X />
                            </button>
                        )}
                    </header>
                )}
                {children && <div className={cn('px-5 pb-5 overflow-y-auto', !title && 'pt-5', bodyClassName)}>{children}</div>}
                {footer && (
                    <footer className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 px-5 py-4 border-t border-border safe-area-bottom">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
}

export type ConfirmTone = 'danger' | 'warning' | 'primary';

const TONE = {
    danger: { icon: <Trash2 className="w-[18px] h-[18px]" />, iconBox: 'bg-danger-50 text-danger-600 dark:bg-danger-950 dark:text-danger-300', button: 'btn-danger' },
    warning: { icon: <AlertTriangle className="w-[18px] h-[18px]" />, iconBox: 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-300', button: 'btn-primary' },
    primary: { icon: <Info className="w-[18px] h-[18px]" />, iconBox: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200', button: 'btn-primary' },
};

/** Confirmación de una acción. El botón principal nombra la acción ("Eliminar"), nunca "Aceptar". */
export function ConfirmDialogBase({
    open,
    onCancel,
    onConfirm,
    title,
    message,
    detail,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    tone = 'danger',
    loading = false,
    loadingLabel,
    icon,
}: {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    title: React.ReactNode;
    message?: React.ReactNode;
    detail?: React.ReactNode;
    confirmLabel?: React.ReactNode;
    cancelLabel?: React.ReactNode;
    tone?: ConfirmTone;
    loading?: boolean;
    loadingLabel?: React.ReactNode;
    icon?: React.ReactNode;
}) {
    const t = TONE[tone];
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            size="sm"
            dismissible={!loading}
            icon={<div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', t.iconBox)}>{icon || t.icon}</div>}
            title={title}
            description={message}
            footer={
                <>
                    {/* En acciones destructivas el foco inicial queda en Cancelar: Enter no borra por accidente */}
                    <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary" data-autofocus={tone === 'danger' ? true : undefined}>
                        {cancelLabel}
                    </button>
                    <button type="button" onClick={onConfirm} disabled={loading} className={cn('btn', t.button)} data-autofocus={tone !== 'danger' ? true : undefined}>
                        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
                        {loading && loadingLabel ? loadingLabel : confirmLabel}
                    </button>
                </>
            }
        >
            {detail && (
                <p className="text-[13px] text-slate-600 dark:text-slate-300 bg-surface-sunken border border-border rounded-lg p-3">{detail}</p>
            )}
        </Dialog>
    );
}
