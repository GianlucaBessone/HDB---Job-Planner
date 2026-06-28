import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-all ${
                        error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''
                    } ${className}`}
                    {...props}
                />
                {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
