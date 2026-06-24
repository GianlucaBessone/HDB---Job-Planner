'use client';

import { useState, useEffect } from "react";
import { ViewConfig, isViewAllowed, DEFAULT_VIEWS, DEFAULT_SECTIONS, groupViewsBySection, getViewConfig } from '@/lib/viewAccess';
import { trackRecentView, getFavorites, getSidebarFavorites, setSidebarFavorites } from '@/lib/viewPreferences';
import { renderIcon } from '@/lib/iconRegistry';
import "./globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import { ClipboardList, Menu, X, LogOut, Home, ChevronDown, Star, Search } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import ToastContainer from "@/components/Toast";
import LoginScreen from "@/components/LoginScreen";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import OneSignalInit from "@/components/OneSignalInit";
import OneSignal from 'react-onesignal';
import SyncIndicator from "@/components/SyncIndicator";
import { Loader2, BellRing } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import ViewSearch from "@/components/ViewSearch";


export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isOnline, setIsOnline] = useState(true);

    const [viewConfig, setViewConfig] = useState<ViewConfig[] | null>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('cachedViewConfig');
            if (cached) {
                try { return getViewConfig(JSON.parse(cached)); } catch { return null; }
            }
        }
        return null;
    });

    const router = useRouter();
    const pathname = usePathname();

    // Auto-close sidebar on navigation
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    // Track recent views
    useEffect(() => {
        if (currentUser?.legajo && pathname) {
            trackRecentView(pathname, currentUser.legajo);
        }
    }, [pathname, currentUser?.legajo]);

    const handleLoginSuccess = (user: any) => {
        setCurrentUser(user);
        setIsSidebarOpen(false);
        router.push('/');
    };

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const parsedUser = JSON.parse(stored);
                setCurrentUser(parsedUser);
                
                // Silently refresh DNI if missing
                if (!parsedUser.dni) {
                    const fetchDni = async () => {
                        try {
                            const res = await fetch('/api/operators');
                            const ops = await res.json();
                            if (Array.isArray(ops)) {
                                const me = ops.find((o: any) => o.id === parsedUser.id);
                                if (me && me.dni) {
                                    const updatedUser = { ...parsedUser, dni: me.dni };
                                    setCurrentUser(updatedUser);
                                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                                }
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    };
                    fetchDni();
                }
            } catch (e) {
                localStorage.removeItem('currentUser');
            }
        }
        setIsCheckingAuth(false);

        // Network status listeners
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Fetch view config from API
    useEffect(() => {
        fetch('/api/config/views')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setViewConfig(data);
                    localStorage.setItem('cachedViewConfig', JSON.stringify(data));
                }
            })
            .catch(() => {});
    }, []);



    const isPublicPage = pathname ? (
        pathname.includes('/report') || 
        pathname.startsWith('/os/') || 
        pathname.startsWith('/ideas-sugerencias-reclamos') ||
        pathname.startsWith('/public/')
    ) : false;

    const role = currentUser?.role?.toLowerCase() || 'operador';
    const effectiveViews = viewConfig && viewConfig.length > 0 ? viewConfig : DEFAULT_VIEWS;

    let content;
    if (isCheckingAuth) {
        content = (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-white via-slate-50/50 to-white dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950 transition-colors duration-300">
                <div className="flex flex-col items-center text-center px-4 animate-in fade-in zoom-in-95 duration-700">
                    {/* Logo directly rounded (zoomed in to hide baked-in white padding) */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 mb-8 rounded-[1.25rem] overflow-hidden shadow-xl shadow-slate-300/50 dark:shadow-slate-900/50 flex items-center justify-center">
                        <img 
                            src="/images/android/launchericon-192x192.png" 
                            alt="Logo HDB SGI" 
                            className="w-full h-full object-cover scale-[1.4]"
                        />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                        HDB<span className="text-primary">SGI</span>
                    </h1>
                    <div className="h-[2px] w-16 bg-gradient-to-r from-transparent via-primary/40 to-transparent my-5 rounded-full" />
                    <p className="text-[11px] font-black text-primary/80 tracking-[0.3em] uppercase mb-1">
                        Sistema de Gestión Integral
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Plataforma Operativa
                    </p>
                    {/* Loader */}
                    <div className="mt-14 flex gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                    </div>
                </div>
            </div>
        );
    } else if (!currentUser && !isPublicPage) {
        content = <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    } else if (isPublicPage && !currentUser) {
        // Public view (No header/sidebar) — light by default, with compact toggle
        content = (
            <div className="flex flex-col min-h-[100dvh] overflow-x-hidden bg-white dark:bg-slate-900">
                {/* Compact public header with theme toggle */}
                <div className="fixed top-3 right-3 z-50">
                    <ThemeToggle />
                </div>
                <main className="flex-1 w-full max-w-4xl mx-auto py-4">
                    {children}
                </main>
            </div>
        );
    } else {
        content = (
            <div className="flex flex-col min-h-[100dvh] overflow-x-hidden">
                <header className="sticky top-0 z-[60] w-full border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-md safe-area-top">
                    <div className="w-full px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors mr-2"
                            >
                                <Menu className="w-6 h-6" />
                            </button>

                            <Link href="/" className="flex items-center gap-2 ml-4 hidden md:flex hover:opacity-80 transition-opacity">
                                <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
                                    <ClipboardList className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                                    HDB<span className="text-primary">SGI</span>
                                </span>
                            </Link>
                        </div>
                        {/* Mobile Logo version if needed or right-aligned items can go here */}
                        <div className="flex items-center gap-2 md:gap-4">
                            {/* SAP-style Search trigger */}
                            <button
                                onClick={() => {
                                    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-400 dark:text-slate-500 transition-all"
                            >
                                <Search className="w-4 h-4" />
                                <span className="hidden sm:inline font-medium text-xs">Buscar…</span>
                                <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded text-[10px] font-bold shadow-sm">⌘K</kbd>
                            </button>

                            <Link href="/" className="flex items-center gap-2 md:hidden hover:opacity-80 transition-opacity">
                                <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                                    HDB<span className="text-primary">SGI</span>
                                </span>
                            </Link>
                            <div className="flex items-center gap-2">
                                <ThemeToggle />
                                <SyncIndicator />
                                <OneSignalInit
                                    appId={process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "35ce6a9c-c4c7-4645-98dc-b363dc91642b"}
                                    user={currentUser}
                                />
                                <NotificationsDropdown user={currentUser} />
                            </div>
                        </div>
                    </div>
                </header>

                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    user={currentUser}
                    views={effectiveViews}
                    onLogout={() => {
                        localStorage.removeItem('currentUser');
                        setCurrentUser(null);
                    }}
                />

                <main className="flex-1 w-full px-4 md:px-6 py-6 md:py-8 pb-32 md:pb-8">
                    {children}
                    <SpeedInsights />
                </main>

                <footer className="hidden md:block border-t bg-white dark:bg-slate-800 py-6">
                    <div className="container mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        © 2026 HDB SGI - Sistema de Gestión Integral
                    </div>
                </footer>

                <ToastContainer />
            </div>
        );
    }

    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="HDB SGI" />
                <meta name="theme-color" content="#2563eb" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/images/ios/180.png" />
                
                {/* Manual Font Loading to prevent next/font/google build crash in local environments */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

                <title>HDB | SGI</title>
                <meta name="description" content="Sistema de Gestión Integral" />
            </head>
            <body className="font-sans min-h-[100dvh] bg-slate-50/50 dark:bg-slate-900 overscroll-none text-slate-900 dark:text-slate-100" style={{ fontFamily: '"Outfit", sans-serif' }}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    {content}
                    {/* Global View Search — available when logged in */}
                    {currentUser && (
                        <ViewSearch
                            views={effectiveViews}
                            role={role}
                        />
                    )}
                    <Analytics />
                </ThemeProvider>
            </body>
        </html>
    );
}

// ── Sidebar ────────────────────────────────────────────────────────

function Sidebar({ isOpen, onClose, user, views, onLogout }: {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    views: ViewConfig[];
    onLogout: () => void;
}) {
    const pathname = usePathname();
    const role = user?.role?.toLowerCase() || 'operador';
    const userId = user?.legajo || 'default';

    const [showFavorites, setShowFavorites] = useState(() => getSidebarFavorites(userId));
    const [favorites, setFavoritesState] = useState<string[]>(() => getFavorites(userId));

    // Refresh favorites when sidebar opens
    useEffect(() => {
        if (isOpen) {
            setFavoritesState(getFavorites(userId));
            setShowFavorites(getSidebarFavorites(userId));
        }
    }, [isOpen, userId]);

    const toggleFavorites = () => {
        const next = !showFavorites;
        setShowFavorites(next);
        setSidebarFavorites(userId, next);
    };

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        DEFAULT_SECTIONS.forEach((s, i) => { initial[s.key] = i === 0; });
        return initial;
    });

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Build groups from centralized config — NO hardcoded roles
    const grouped = groupViewsBySection(views, role, 'sidebar');

    // Favorite views
    const favoriteViews = favorites
        .map(key => views.find(v => v.key === key))
        .filter((v): v is ViewConfig => !!v && isViewAllowed(v.key, role, 'home', views));

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 bottom-0 w-[240px] bg-white dark:bg-slate-800 z-[110] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                        <ClipboardList className="w-6 h-6 shrink-0" />
                        <span className="font-extrabold text-xl tracking-tighter text-slate-800 dark:text-slate-100">HDB<span className="text-primary">SGI</span></span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {/* Inicio — always visible at top */}
                    <Link
                        href="/"
                        onClick={onClose}
                        className={`flex items-center gap-3 h-[40px] px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                            pathname === '/'
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Home className="w-[18px] h-[18px]" />
                        Inicio
                    </Link>

                    {/* Favorites section */}
                    {showFavorites && favoriteViews.length > 0 && (
                        <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between px-4 py-2">
                                <div className="flex items-center gap-2">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Favoritos</span>
                                </div>
                                <button
                                    onClick={toggleFavorites}
                                    className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-wider"
                                >
                                    Ocultar
                                </button>
                            </div>
                            <div className="pl-2 pr-1 space-y-0.5">
                                {favoriteViews.map(item => {
                                    const isActive = pathname === item.key;
                                    return (
                                        <Link
                                            key={`fav-${item.key}`}
                                            href={item.key}
                                            onClick={onClose}
                                            className={`flex items-center gap-3 h-[40px] px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                                                isActive
                                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            {renderIcon(item.iconName, 'w-[18px] h-[18px]')}
                                            <span className="truncate">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Show favorites toggle when hidden but has favorites */}
                    {!showFavorites && favorites.length > 0 && (
                        <button
                            onClick={toggleFavorites}
                            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-amber-500 uppercase tracking-wider transition-colors"
                        >
                            <Star className="w-3.5 h-3.5" />
                            Mostrar Favoritos ({favorites.length})
                        </button>
                    )}

                    {/* Dynamic section groups — all from config */}
                    {grouped.map(({ section, views: sectionViews }) => {
                        const isExpanded = expandedGroups[section.key];
                        const hasActiveChild = sectionViews.some(item => pathname === item.key);

                        return (
                            <div key={section.key} className="space-y-1">
                                <button
                                    onClick={() => toggleGroup(section.key)}
                                    className={`w-full flex items-center justify-between gap-3 h-[40px] px-3 rounded-xl text-[13px] font-bold transition-all duration-200 ${hasActiveChild && !isExpanded
                                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-primary'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {renderIcon(section.iconName, 'w-[18px] h-[18px]')}
                                        {section.label}
                                    </div>
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isExpanded && (
                                    <div className="pl-4 pr-2 space-y-1 mt-1 animate-in slide-in-from-top-2 duration-200">
                                        {sectionViews.map(item => {
                                            const isActive = pathname === item.key;
                                            return (
                                                <Link
                                                    key={item.key}
                                                    href={item.key}
                                                    onClick={onClose}
                                                    className={`flex items-center gap-3 h-[40px] px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive
                                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                                                    }`}
                                                >
                                                    {renderIcon(item.iconName, 'w-[18px] h-[18px]')}
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="bg-gradient-to-br from-slate-100 to-white dark:from-slate-800/80 dark:to-slate-900/50 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-black text-sm shrink-0 border border-primary/20 shadow-inner">
                            {user?.nombreCompleto?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black text-primary py-0.5 px-2 uppercase tracking-widest bg-primary/10 rounded-md inline-block mb-1 leading-none">{user?.role}</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate w-full" title={user?.nombreCompleto}>
                                {user?.nombreCompleto}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            try {
                                await OneSignal.Notifications.requestPermission();
                            } catch (e) {
                                console.error("Error al solicitar permiso:", e);
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 bg-primary/5 text-primary py-2.5 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-primary/10 transition-all active:scale-95 border border-primary/10"
                    >
                        <BellRing className="w-4 h-4 shrink-0" />
                        <span className="text-center leading-tight">Activar Notificaciones</span>
                    </button>

                    <button
                        onClick={onLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 bg-rose-50 text-rose-500 py-2.5 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Cerrar Sesión</span>
                    </button>

                    <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">HDB SGI v2.0</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
