import React, { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
    label?: React.ReactNode;
    hint?: React.ReactNode;
    error?: string;
    required?: boolean;
    className?: string;
    /** id del control; si falta se genera uno. */
    htmlFor?: string;
    children: React.ReactNode;
}

/** Etiqueta + control + ayuda/error, con la relación accesible ya resuelta. */
export function Field({ label, hint, error, required, className, htmlFor, children }: FieldProps) {
    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label htmlFor={htmlFor} className="field-label">
                    {label}
                    {required && <span className="text-danger-600 ml-0.5" aria-hidden="true">*</span>}
                </label>
            )}
            {children}
            {error ? (
                <p id={htmlFor ? `${htmlFor}-error` : undefined} className="field-error" role="alert">{error}</p>
            ) : hint ? (
                <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="field-hint">{hint}</p>
            ) : null}
        </div>
    );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, hint, error, id, required, ...props }, ref) => {
        const autoId = useId();
        const inputId = id || autoId;
        return (
            <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
                <input
                    ref={ref}
                    id={inputId}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                    className={cn('input', className)}
                    {...props}
                />
            </Field>
        );
    }
);
Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, hint, error, id, required, children, ...props }, ref) => {
        const autoId = useId();
        const selectId = id || autoId;
        return (
            <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
                <select
                    ref={ref}
                    id={selectId}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    className={cn('input pr-8', className)}
                    {...props}
                >
                    {children}
                </select>
            </Field>
        );
    }
);
Select.displayName = 'Select';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, hint, error, id, required, ...props }, ref) => {
        const autoId = useId();
        const areaId = id || autoId;
        return (
            <Field label={label} hint={hint} error={error} required={required} htmlFor={areaId}>
                <textarea
                    ref={ref}
                    id={areaId}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    className={cn('input', className)}
                    {...props}
                />
            </Field>
        );
    }
);
Textarea.displayName = 'Textarea';
