'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

let toastCount = 0;
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastCount;
    toasts = [...toasts, { id, message, type }];
    toastListeners.forEach(listener => listener(toasts));

    setTimeout(() => {
        toasts = toasts.filter(t => t.id !== id);
        toastListeners.forEach(listener => listener(toasts));
    }, type === 'error' ? 6000 : 4000); // los errores quedan más tiempo para poder leerlos
};

export default function ToastContainer() {
    const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

    useEffect(() => {
        toastListeners.push(setCurrentToasts);
        return () => {
            toastListeners = toastListeners.filter(l => l !== setCurrentToasts);
        };
    }, []);

    // Abajo a la derecha en escritorio (no tapa encabezados ni acciones); arriba en móvil, sobre el teclado
    return (
        <div
            className="fixed z-[9999] flex flex-col gap-2 pointer-events-none top-3 left-3 right-3 sm:top-auto sm:left-auto sm:bottom-5 sm:right-5 sm:w-[380px]"
            aria-live="polite"
            aria-relevant="additions"
        >
            {currentToasts.map(toast => (
                <div
                    key={toast.id}
                    role={toast.type === 'error' ? 'alert' : 'status'}
                    className="flex items-start gap-3 pl-3.5 pr-2 py-3 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
                >
                    {toast.type === 'success' && <CheckCircle2 className="w-[18px] h-[18px] mt-px text-success-600 dark:text-success-400 shrink-0" aria-hidden="true" />}
                    {toast.type === 'error' && <AlertCircle className="w-[18px] h-[18px] mt-px text-danger-600 dark:text-danger-400 shrink-0" aria-hidden="true" />}
                    {toast.type === 'info' && <Info className="w-[18px] h-[18px] mt-px text-info-600 dark:text-info-400 shrink-0" aria-hidden="true" />}

                    <p className="text-[13px] font-medium flex-1 leading-snug pt-px">{toast.message}</p>

                    <button
                        onClick={() => {
                            toasts = toasts.filter(t => t.id !== toast.id);
                            toastListeners.forEach(listener => listener(toasts));
                        }}
                        className="btn btn-ghost btn-icon btn-sm btn-icon-inline -my-1"
                        aria-label="Cerrar aviso"
                    >
                        <X />
                    </button>
                </div>
            ))}
        </div>
    );
}
