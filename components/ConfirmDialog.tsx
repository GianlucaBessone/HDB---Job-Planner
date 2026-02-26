'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Eliminar',
    cancelLabel = 'Cancelar',
    variant = 'danger'
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: 'bg-red-600 hover:bg-red-700 shadow-red-200 text-white',
        warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 text-white',
        info: 'bg-primary hover:bg-primary/90 shadow-primary/20 text-white',
    };

    const iconStyles = {
        danger: 'text-red-500 bg-red-50',
        warning: 'text-amber-500 bg-amber-50',
        info: 'text-primary bg-primary/5',
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`p-3 rounded-2xl ${iconStyles[variant]}`}>
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-2 mb-8">
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-6 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-[1.5] px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${variantStyles[variant]}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
