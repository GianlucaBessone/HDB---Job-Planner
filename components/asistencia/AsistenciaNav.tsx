'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, Radio, Settings, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAcceso } from '@/lib/store/useAccessStore';

/**
 * Asistencia y horas: une en una sola navegación las tres pantallas que sirven
 * para confirmar cuánto y dónde trabajó cada persona (auditoría, FU2).
 * Cada pestaña aparece solo si la persona puede abrirla.
 */
export function AsistenciaNav({ className }: { className?: string }) {
    const pathname = usePathname();
    const { puedeVer, puede } = useAcceso();

    const items = [
        { href: '/monitoreo-fichadas', label: 'Fichadas en curso', icon: <Radio />, visible: puedeVer('/monitoreo-fichadas') },
        { href: '/aprobaciones', label: 'Fichadas a aprobar', icon: <ShieldCheck />, visible: puedeVer('/aprobaciones') },
        { href: '/timesheets/control-horario', label: 'Control horario', icon: <ClipboardCheck />, visible: puede('timesheets.control_horario') },
        { href: '/monitoreo-fichadas/ajustes', label: 'Ajustes', icon: <Settings />, visible: puede('config.administrar') },
    ].filter(i => i.visible);

    if (items.length < 2) return null;

    return (
        <nav aria-label="Asistencia y horas" className={cn('w-full overflow-x-auto hide-scrollbar border-b border-border', className)}>
            <p className="eyebrow pb-1">Asistencia y horas</p>
            <div className="flex items-center gap-1 min-w-max">
                {items.map(item => {
                    const activo = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={activo ? 'page' : undefined}
                            className={cn(
                                'relative flex items-center gap-2 h-10 px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
                                'after:absolute after:left-2 after:right-2 after:-bottom-px after:h-0.5 after:rounded-full',
                                activo
                                    ? 'text-slate-900 dark:text-slate-50 after:bg-primary'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 after:bg-transparent'
                            )}
                        >
                            <span className="[&>svg]:w-4 [&>svg]:h-4 shrink-0" aria-hidden="true">{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
