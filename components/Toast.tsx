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
    }, 3000);
};

export default function ToastContainer() {
    const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

    useEffect(() => {
        toastListeners.push(setCurrentToasts);
        return () => {
            toastListeners = toastListeners.filter(l => l !== setCurrentToasts);
        };
    }, []);

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 w-[90%] max-w-sm pointer-events-none">
            {currentToasts.map(toast => (
                <div
                    key={toast.id}
                    className={`
                        flex items-center gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-4 duration-300 pointer-events-auto
                        ${toast.type === 'success' ? 'bg-white/90 border-green-100 text-slate-800' :
                            toast.type === 'error' ? 'bg-red-50/90 border-red-100 text-red-800' :
                                'bg-white/90 border-slate-100 text-slate-800'}
                    `}
                >
                    {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                    {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    {toast.type === 'info' && <Info className="w-5 h-5 text-primary shrink-0" />}

                    <p className="text-sm font-semibold flex-1 leading-tight">{toast.message}</p>

                    <button
                        onClick={() => {
                            toasts = toasts.filter(t => t.id !== toast.id);
                            toastListeners.forEach(listener => listener(toasts));
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
