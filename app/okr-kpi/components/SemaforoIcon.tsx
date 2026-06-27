import React from 'react';

export default function SemaforoIcon({ estado, size = 'md' }: { estado: string | null; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
    
    let colorClass = 'bg-slate-300 shadow-slate-400/50';
    let pulseClass = 'bg-slate-400';
    let title = 'Sin datos';

    switch (estado) {
        case 'Cumple':
        case 'Verde':
            colorClass = 'bg-emerald-500 shadow-emerald-500/60';
            pulseClass = 'bg-emerald-400';
            title = 'Cumple';
            break;
        case 'En Riesgo':
        case 'Amarillo':
            colorClass = 'bg-amber-500 shadow-amber-500/60';
            pulseClass = 'bg-amber-400';
            title = 'En Riesgo';
            break;
        case 'No Cumple':
        case 'Rojo':
            colorClass = 'bg-rose-500 shadow-rose-500/60';
            pulseClass = 'bg-rose-400';
            title = 'No Cumple';
            break;
    }

    return (
        <div className="relative flex items-center justify-center shrink-0" title={title}>
            <div className={`absolute ${sizeClass} rounded-full ${pulseClass} animate-ping opacity-40`} />
            <div className={`relative ${sizeClass} rounded-full ${colorClass} shadow-[0_0_8px_var(--tw-shadow-color)] ring-2 ring-white/50 dark:ring-black/20`} />
        </div>
    );
}
