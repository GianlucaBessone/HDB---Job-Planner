import React from 'react';
import { Search } from 'lucide-react';

export interface ModuleTab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

export interface ModuleAction {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
    hideLabelOnMobile?: boolean;
}

interface ModuleHeaderProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;

    tabs?: ModuleTab[];
    activeTabId?: string;
    onTabChange?: (tabId: string) => void;

    actions?: ModuleAction[];

    searchValue?: string;
    onSearchChange?: (val: string) => void;
    searchPlaceholder?: string;
}

export default function ModuleHeader({
    title,
    description,
    icon,
    tabs,
    activeTabId,
    onTabChange,
    actions,
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Buscar...'
}: ModuleHeaderProps) {

    const renderActionBtn = (action: ModuleAction) => {
        const baseClass = "flex items-center gap-1.5 h-9 px-3 rounded-lg font-bold text-[13px] transition-all whitespace-nowrap border";
        let variantClass = "";
        
        switch (action.variant) {
            case 'primary':
                variantClass = "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-sm";
                break;
            case 'secondary':
                variantClass = "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100";
                break;
            case 'outline':
                variantClass = "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";
                break;
            case 'danger':
                variantClass = "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800 hover:bg-rose-100";
                break;
            case 'ghost':
            default:
                variantClass = "bg-transparent text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800";
                break;
        }

        return (
            <button key={action.id} onClick={action.onClick} className={`${baseClass} ${variantClass}`}>
                {action.icon && <span className="[&>svg]:w-4 [&>svg]:h-4 shrink-0">{action.icon}</span>}
                <span className={action.hideLabelOnMobile ? "hidden md:inline" : ""}>{action.label}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300 w-full">
            {/* Top row: Title/Desc and Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                
                {/* Title & Description */}
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400 shrink-0">
                            <div className="[&>svg]:w-6 [&>svg]:h-6">
                                {icon}
                            </div>
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none truncate">{title}</h1>
                        {description && (
                            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5 truncate">
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onSearchChange !== undefined && (
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="h-9 !pl-10 pr-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-full md:w-[220px] lg:w-[280px] transition-all"
                            />
                        </div>
                    )}
                    {actions?.map(renderActionBtn)}
                </div>
            </div>

            {/* Bottom row: Sub-Header Contextual Tabs */}
            {tabs && tabs.length > 0 && (
                <div className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-1 min-w-max px-0.5">
                        {tabs.map((tab) => {
                            const isActive = activeTabId === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange && onTabChange(tab.id)}
                                    className={`
                                        flex items-center gap-1.5 h-[40px] px-4 font-bold text-[13px] border-b-2 transition-all whitespace-nowrap outline-none
                                        ${isActive 
                                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
                                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-t-lg'
                                        }
                                    `}
                                >
                                    {tab.icon && <span className="[&>svg]:w-4 [&>svg]:h-4 shrink-0">{tab.icon}</span>}
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
