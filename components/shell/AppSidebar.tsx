'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import OneSignal from 'react-onesignal';
import { BellRing, ChevronDown, Home, LogOut, MoreHorizontal, PanelLeftClose, Star, X } from 'lucide-react';
import { ViewConfig, isViewAllowed, groupViewsBySection } from '@/lib/viewAccess';
import { getFavorites, getSidebarFavorites, setSidebarFavorites } from '@/lib/viewPreferences';
import { renderIcon } from '@/lib/iconRegistry';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { BrandWordmark } from './BrandMark';

interface AppSidebarProps {
    /** Barra fija a la izquierda (escritorio) o panel deslizante (móvil / PDV). */
    docked: boolean;
    open: boolean;
    onClose: () => void;
    onUndock?: () => void;
    user: any;
    views: ViewConfig[];
    onLogout: () => void;
}

/** Una ruta está activa si coincide o si es una subruta (p. ej. /ventas/gestion/productos/nuevo). */
export function isRouteActive(pathname: string | null, key: string) {
    if (!pathname) return false;
    if (key === '/') return pathname === '/';
    return pathname === key || pathname.startsWith(key + '/');
}

const ROLE_LABEL: Record<string, string> = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    operador: 'Operador',
    qa: 'Calidad',
    vendedor: 'Vendedor',
};

async function activatePushNotifications() {
    if (!(window as any).__ONESIGNAL_INITIALIZED__) {
        showToast('Las notificaciones todavía no están listas. Recargá la página e intentá de nuevo.', 'error');
        return;
    }
    if (!OneSignal.Notifications.isPushSupported()) {
        showToast('Este navegador no admite notificaciones. En iPhone, instalá la app desde Safari (Compartir → Agregar a inicio).', 'error');
        return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        showToast('Las notificaciones están bloqueadas. Habilitalas desde el candado de la barra de direcciones y recargá.', 'error');
        return;
    }
    try {
        // optIn pide permiso si hace falta y crea la suscripción aunque el permiso ya estuviera concedido
        await OneSignal.User.PushSubscription.optIn();
        if (OneSignal.User.PushSubscription.optedIn) {
            showToast('Notificaciones activadas');
        } else {
            showToast('No se pudo activar. Revisá el permiso de notificaciones del navegador.', 'error');
        }
    } catch (e) {
        console.error('Error al activar notificaciones:', e);
        showToast('Error al activar notificaciones', 'error');
    }
}

export function AppSidebar({ docked, open, onClose, onUndock, user, views, onLogout }: AppSidebarProps) {
    const pathname = usePathname();
    const role = user?.role?.toLowerCase() || 'operador';
    const userId = user?.legajo || 'default';

    const [showFavorites, setShowFavorites] = useState(() => getSidebarFavorites(userId));
    const [favorites, setFavoritesState] = useState<string[]>(() => getFavorites(userId));
    const grouped = groupViewsBySection(views, role, 'sidebar');

    // La sección que contiene la ruta actual arranca abierta.
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        grouped.forEach(({ section, views: sv }, i) => {
            initial[section.key] = sv.some(v => isRouteActive(pathname, v.key)) || (i === 0 && pathname === '/');
        });
        return initial;
    });

    useEffect(() => {
        const active = grouped.find(g => g.views.some(v => isRouteActive(pathname, v.key)));
        if (active) setExpanded(prev => (prev[active.section.key] ? prev : { ...prev, [active.section.key]: true }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    // Los favoritos se editan desde Inicio: se refrescan al abrir o navegar.
    useEffect(() => {
        setFavoritesState(getFavorites(userId));
        setShowFavorites(getSidebarFavorites(userId));
    }, [open, pathname, userId]);

    // Escape cierra el panel deslizante
    useEffect(() => {
        if (docked || !open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [docked, open, onClose]);

    const toggleFavorites = () => {
        const next = !showFavorites;
        setShowFavorites(next);
        setSidebarFavorites(userId, next);
    };

    const favoriteViews = favorites
        .map(key => views.find(v => v.key === key))
        .filter((v): v is ViewConfig => !!v && isViewAllowed(v.key, role, 'home', views));

    const navLink = (item: ViewConfig, keyPrefix = '') => (
        <Link
            key={keyPrefix + item.key}
            href={item.key}
            onClick={docked ? undefined : onClose}
            aria-current={isRouteActive(pathname, item.key) ? 'page' : undefined}
            className="nav-item"
            title={item.description}
        >
            {renderIcon(item.iconName, 'w-[18px] h-[18px]')}
            <span className="truncate">{item.label}</span>
        </Link>
    );

    const panel = (
        <aside
            aria-label="Navegación principal"
            className={cn(
                'fixed top-0 left-0 bottom-0 w-[var(--sidebar-w)] flex flex-col bg-card border-r border-border',
                docked ? 'z-40' : 'z-[110] shadow-2xl animate-sheet-in'
            )}
        >
            <div className="h-[var(--topbar-h)] shrink-0 flex items-center justify-between px-4 border-b border-border">
                <Link href="/" onClick={docked ? undefined : onClose} className="rounded-md" aria-label="HDB SGI, ir al inicio">
                    <BrandWordmark />
                </Link>
                {docked ? (
                    onUndock && (
                        <button onClick={onUndock} className="btn btn-ghost btn-icon btn-sm btn-icon-inline" title="Ocultar menú" aria-label="Ocultar menú">
                            <PanelLeftClose />
                        </button>
                    )
                ) : (
                    <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm btn-icon-inline" aria-label="Cerrar menú">
                        <X />
                    </button>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4" aria-label="Módulos">
                <div>
                    <Link
                        href="/"
                        onClick={docked ? undefined : onClose}
                        aria-current={pathname === '/' ? 'page' : undefined}
                        className="nav-item"
                    >
                        <Home />
                        <span>Inicio</span>
                    </Link>
                </div>

                {favoriteViews.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between px-2.5 mb-1">
                            <span className="eyebrow flex items-center gap-1.5">
                                <Star className="w-3 h-3" aria-hidden="true" /> Favoritos
                            </span>
                            <button
                                onClick={toggleFavorites}
                                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 btn-icon-inline px-1 rounded"
                                aria-expanded={showFavorites}
                            >
                                {showFavorites ? 'Ocultar' : `Mostrar (${favoriteViews.length})`}
                            </button>
                        </div>
                        {showFavorites && <div className="space-y-0.5">{favoriteViews.map(v => navLink(v, 'fav-'))}</div>}
                    </div>
                )}

                {grouped.map(({ section, views: sectionViews }) => {
                    const isExpanded = !!expanded[section.key];
                    const hasActive = sectionViews.some(v => isRouteActive(pathname, v.key));
                    const listId = `nav-section-${section.key}`;
                    return (
                        <div key={section.key}>
                            <button
                                onClick={() => setExpanded(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
                                aria-expanded={isExpanded}
                                aria-controls={listId}
                                className={cn(
                                    'w-full flex items-center justify-between gap-2 h-8 px-2.5 rounded-md eyebrow hover:text-slate-900 dark:hover:text-slate-100 transition-colors btn-icon-inline',
                                    hasActive && !isExpanded && 'text-brand-700 dark:text-brand-300'
                                )}
                            >
                                <span className="truncate">{section.label}</span>
                                <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform duration-150', isExpanded ? 'rotate-0' : '-rotate-90')} aria-hidden="true" />
                            </button>
                            {isExpanded && (
                                <div id={listId} className="space-y-0.5 mt-0.5">
                                    {sectionViews.map(v => navLink(v))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <UserBlock user={user} role={role} onLogout={onLogout} />
        </aside>
    );

    if (docked) return panel;
    if (!open) return null;
    return (
        <>
            <div className="scrim z-[100] animate-in fade-in duration-150" onClick={onClose} aria-hidden="true" />
            <div role="dialog" aria-modal="true" aria-label="Menú">
                {panel}
            </div>
        </>
    );
}

function UserBlock({ user, role, onLogout }: { user: any; role: string; onLogout: () => void }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [menuOpen]);

    const initials = (user?.nombreCompleto || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p[0]?.toUpperCase())
        .join('');

    return (
        <div ref={ref} className="relative shrink-0 border-t border-border p-3">
            {menuOpen && (
                <div role="menu" className="absolute left-3 right-3 bottom-[calc(100%-4px)] bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    <button
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); activatePushNotifications(); }}
                        className="nav-item w-full"
                    >
                        <BellRing /> Activar notificaciones
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); onLogout(); }}
                        className="nav-item w-full text-danger-700 hover:text-danger-700 hover:bg-danger-50 dark:text-danger-300 dark:hover:bg-danger-950"
                    >
                        <LogOut /> Cerrar sesión
                    </button>
                </div>
            )}
            <button
                onClick={() => setMenuOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="w-full flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-left"
            >
                <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-100 flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-100 truncate" title={user?.nombreCompleto}>
                        {user?.nombreCompleto}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{ROLE_LABEL[role] || user?.role}</span>
                </span>
                <MoreHorizontal className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            </button>
        </div>
    );
}
