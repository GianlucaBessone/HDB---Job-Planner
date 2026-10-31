'use client';

import React from 'react';
import { Search } from 'lucide-react';
import HelpContextual from '@/components/HelpContextual';
import { cn } from '@/lib/cn';
import { Tabs } from '@/components/ui/Tabs';

export interface ModuleTab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    /** Contador opcional (p. ej. pendientes). */
    count?: number;
}

export interface ModuleAction {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
    hideLabelOnMobile?: boolean;
    disabled?: boolean;
}

interface ModuleHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;

    tabs?: ModuleTab[];
    activeTabId?: string;
    onTabChange?: (tabId: string) => void;

    actions?: ModuleAction[];
    /** Controles propios de la vista (filtros, selectores) que van junto a las acciones. */
    toolbar?: React.ReactNode;

    searchValue?: string;
    onSearchChange?: (val: string) => void;
    searchPlaceholder?: string;

    helpSlug?: string;
    className?: string;
}

const ACTION_CLASS: Record<NonNullable<ModuleAction['variant']>, string> = {
    primary: 'btn-primary',
    secondary: 'btn-tonal',
    outline: 'btn-secondary',
    danger: 'btn-danger-ghost border-danger-200 dark:border-danger-900',
    ghost: 'btn-ghost',
};

/**
 * Encabezado de página (patrón único del sistema). Responde "¿dónde estoy?"
 * (título), "¿qué veo?" (descripción, pestañas) y "¿qué puedo hacer?"
 * (acciones, con la primaria siempre al final).
 */
export default function ModuleHeader({
    title,
    description,
    icon,
    tabs,
    activeTabId,
    onTabChange,
    actions,
    toolbar,
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Buscar…',
    helpSlug,
    className,
}: ModuleHeaderProps) {
    // La acción primaria va última (más cerca del borde derecho, donde termina la lectura)
    const orderedActions = actions
        ? [...actions.filter(a => a.variant !== 'primary'), ...actions.filter(a => a.variant === 'primary')]
        : [];

    return (
        <header className={cn('mb-5 w-full', className)}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6 w-full">
                <div className="min-w-0">
                    <div className="min-w-0">
                        <h1 className="text-title text-slate-900 dark:text-slate-50 flex items-center gap-2">
                            {icon && (
                                <span className="text-brand-600 dark:text-brand-300 shrink-0 [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">{icon}</span>
                            )}
                            <span className="truncate">{title}</span>
                            {helpSlug && <HelpContextual slug={helpSlug} />}
                        </h1>
                        {description && (
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{description}</p>
                        )}
                    </div>
                </div>

                {(onSearchChange !== undefined || toolbar || orderedActions.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {onSearchChange !== undefined && (
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                                <input
                                    type="search"
                                    value={searchValue}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    aria-label={searchPlaceholder.replace(/…|\.\.\./g, '')}
                                    className="input !pl-9 w-full sm:w-[240px] lg:w-[280px]"
                                />
                            </div>
                        )}
                        {toolbar}
                        {orderedActions.map(action => (
                            <button
                                key={action.id}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                className={cn('btn', ACTION_CLASS[action.variant || 'ghost'])}
                                aria-label={action.hideLabelOnMobile ? action.label : undefined}
                                title={action.hideLabelOnMobile ? action.label : undefined}
                            >
                                {action.icon}
                                <span className={action.hideLabelOnMobile ? 'hidden md:inline' : ''}>{action.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {tabs && tabs.length > 0 && (
                <Tabs
                    className="mt-4"
                    tabs={tabs}
                    value={activeTabId}
                    onChange={(id) => onTabChange?.(id)}
                    label={`Secciones de ${title}`}
                />
            )}
        </header>
    );
}

export { ModuleHeader as PageHeader };
