'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    actions?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Drawer({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    actions,
    size = 'md'
}: DrawerProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        } else {
            // Delay unmounting to allow exit animation
            const timer = setTimeout(() => {
                setShouldRender(false);
                document.body.style.overflow = '';
            }, 300); // 300ms matches the transition duration
            return () => clearTimeout(timer);
        }
        
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isMounted || !shouldRender) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl',
        full: 'max-w-full'
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${
                    isOpen ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div 
                className={`relative w-full ${sizeClasses[size]} flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out will-change-transform ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Header */}
                {(title || subtitle || actions) && (
                    <div className="flex flex-col gap-2 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-card z-10 shrink-0">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                {title && (
                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 truncate">
                                        {title}
                                    </h2>
                                )}
                                {subtitle && (
                                    <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
                                        {subtitle}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {actions}
                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2 hidden sm:block" />
                                <button
                                    onClick={onClose}
                                    className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                                    aria-label="Cerrar panel"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/20 overscroll-contain">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
