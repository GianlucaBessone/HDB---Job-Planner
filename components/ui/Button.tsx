import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export function Button({ 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    isLoading = false, 
    children, 
    disabled, 
    ...props 
}: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
        primary: 'bg-primary text-white hover:bg-primary/90 shadow-lg',
        secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20',
        ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        outline: 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
    };

    const sizes = {
        sm: 'py-2 px-3 text-xs rounded-xl gap-2',
        md: 'py-3 px-4 text-sm rounded-xl gap-2',
        lg: 'py-4 px-6 text-base rounded-2xl gap-3',
        icon: 'p-2 rounded-full'
    };

    return (
        <button 
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
}
