import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'danger-ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    /** Ícono a la izquierda del texto (lucide). Se oculta mientras carga. */
    icon?: React.ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-secondary',
    tonal: 'btn-tonal',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    'danger-ghost': 'btn-danger-ghost',
};

const SIZE: Record<ButtonSize, string> = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
    icon: 'btn-icon',
    'icon-sm': 'btn-icon btn-sm',
};

/** Botón del sistema. Una sola acción primaria por vista o diálogo. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { className, variant = 'primary', size = 'md', isLoading = false, icon, children, disabled, type = 'button', ...props },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            className={cn('btn', VARIANT[variant], SIZE[size], className)}
            disabled={disabled || isLoading}
            aria-busy={isLoading || undefined}
            {...props}
        >
            {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
            {children}
        </button>
    );
});
