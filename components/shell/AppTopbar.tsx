'use client';

import Link from 'next/link';
import { LifeBuoy, Menu, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import SyncIndicator from '@/components/SyncIndicator';
import OneSignalInit from '@/components/OneSignalInit';
import ActivityCenterDropdown from '@/components/ActivityCenterDropdown';
import { OPEN_TICKET_EVENT } from '@/components/tickets/TicketQuickAction';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { BrandMark } from './BrandMark';

interface AppTopbarProps {
    user: any;
    /** Con la barra lateral fija, el botón de menú solo aparece por debajo de lg. */
    sidebarDocked: boolean;
    onOpenMenu: () => void;
    showBreadcrumbs: boolean;
}

export function AppTopbar({ user, sidebarDocked, onOpenMenu, showBreadcrumbs }: AppTopbarProps) {
    const mobileOnly = sidebarDocked ? 'lg:hidden' : '';
    return (
        <header className="sticky top-0 z-[60] shrink-0 h-[var(--topbar-h)] bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-b border-border safe-area-top">
            <div className="h-full flex items-center gap-2 px-3 md:px-5">
                <button onClick={onOpenMenu} className={`btn btn-ghost btn-icon btn-icon-inline -ml-1 ${mobileOnly}`} aria-label="Abrir menú">
                    <Menu className="!w-5 !h-5" />
                </button>
                <Link href="/" className={`flex items-center rounded-md shrink-0 ${mobileOnly}`} aria-label="HDB SGI, ir al inicio">
                    <BrandMark className="w-7 h-7" />
                </Link>

                <div className="min-w-0 flex-1">
                    {showBreadcrumbs && <Breadcrumbs />}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="hidden sm:flex items-center gap-2 h-9 w-56 lg:w-72 pl-3 pr-1.5 rounded-lg border border-border bg-card text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-[13px]"
                        aria-label="Buscar módulos y acciones (Ctrl+K)"
                    >
                        <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-left truncate">Buscar</span>
                        <kbd className="kbd">Ctrl K</kbd>
                    </button>
                    <button
                        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="sm:hidden btn btn-ghost btn-icon btn-icon-inline"
                        aria-label="Buscar"
                    >
                        <Search />
                    </button>

                    <SyncIndicator />

                    <button
                        onClick={() => window.dispatchEvent(new Event(OPEN_TICKET_EVENT))}
                        title="Reportar una falla o sugerencia"
                        aria-label="Reportar una falla o sugerencia"
                        className="btn btn-ghost btn-icon btn-icon-inline"
                    >
                        <LifeBuoy />
                    </button>
                    <ThemeToggle />
                    <OneSignalInit
                        appId={process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "35ce6a9c-c4c7-4645-98dc-b363dc91642b"}
                        user={user}
                    />
                    <ActivityCenterDropdown user={user} />
                </div>
            </div>
        </header>
    );
}
