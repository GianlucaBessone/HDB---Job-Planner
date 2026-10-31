'use client';

import { useState, useEffect, useCallback } from "react";
import { ViewConfig, DEFAULT_VIEWS, getViewConfig } from '@/lib/viewAccess';
import { trackRecentView } from '@/lib/viewPreferences';
import "./globals.css";
import { usePathname, useRouter } from "next/navigation";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import ToastContainer from "@/components/Toast";
import LoginScreen from "@/components/LoginScreen";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ColorThemeProvider } from "@/components/ColorThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import TicketQuickAction from "@/components/tickets/TicketQuickAction";
import { ERPProviders } from "@/components/providers/ERPProviders";
import { GlobalDrawer } from "@/components/drawers/GlobalDrawer";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { AppTopbar } from "@/components/shell/AppTopbar";
import { BrandMark } from "@/components/shell/BrandMark";

const SIDEBAR_PINNED_KEY = 'sgi:sidebar-pinned';

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarPinned, setSidebarPinned] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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

    // El panel deslizante se cierra al navegar
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
        try {
            if (localStorage.getItem(SIDEBAR_PINNED_KEY) === 'false') setSidebarPinned(false);
        } catch { /* sin almacenamiento: queda fija */ }

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

    const setPinned = useCallback((value: boolean) => {
        setSidebarPinned(value);
        try { localStorage.setItem(SIDEBAR_PINNED_KEY, String(value)); } catch { /* noop */ }
    }, []);

    const isPublicPage = pathname ? (
        pathname.includes('/report') ||
        pathname.startsWith('/os/') ||
        pathname.startsWith('/ideas-sugerencias-reclamos') ||
        pathname.startsWith('/public/') ||
        pathname.startsWith('/portal-clientes')
    ) : false;

    // Pantallas de mostrador: ocupan todo el alto y no llevan barra lateral fija
    const isPdvPage = pathname ? (
        pathname === '/ventas/pdv' ||
        pathname.startsWith('/ventas/pdv/') ||
        pathname === '/ventas/cotizaciones' ||
        pathname.startsWith('/ventas/cotizaciones/')
    ) : false;

    const role = currentUser?.role?.toLowerCase() || 'operador';
    const effectiveViews = viewConfig && viewConfig.length > 0 ? viewConfig : DEFAULT_VIEWS;
    const sidebarDocked = sidebarPinned && !isPdvPage;

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
    };

    let content;
    if (isCheckingAuth) {
        content = (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 bg-background" role="status" aria-label="Cargando HDB SGI">
                <BrandMark className="w-12 h-12 rounded-xl" />
                <div className="h-1 w-24 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-primary animate-[shellLoad_1s_ease-in-out_infinite]" />
                </div>
                <style>{`@keyframes shellLoad{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
            </div>
        );
    } else if (!currentUser && !isPublicPage) {
        content = <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    } else if (isPublicPage) {
        // Vistas públicas (sin barra lateral) — claras por defecto, con selector de tema compacto
        content = (
            <div className="flex flex-col min-h-[100dvh] w-full overflow-x-hidden bg-background">
                <div className="fixed top-3 right-3 z-50 bg-card/90 backdrop-blur rounded-lg shadow-sm border border-border">
                    <ThemeToggle />
                </div>
                <main className="flex-1 w-full min-w-0">
                    {children}
                </main>
                <ToastContainer />
            </div>
        );
    } else {
        content = (
            <div className={isPdvPage ? "flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden" : "flex flex-col min-h-[100dvh]"}>
                <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] btn btn-primary">
                    Saltar al contenido
                </a>

                {sidebarDocked && (
                    <div className="hidden lg:block">
                        <AppSidebar
                            docked
                            open
                            onClose={() => {}}
                            onUndock={() => setPinned(false)}
                            user={currentUser}
                            views={effectiveViews}
                            onLogout={handleLogout}
                        />
                    </div>
                )}
                <AppSidebar
                    docked={false}
                    open={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    user={currentUser}
                    views={effectiveViews}
                    onLogout={handleLogout}
                />

                <div className={`flex flex-col flex-1 min-w-0 ${isPdvPage ? 'min-h-0' : ''} ${sidebarDocked ? 'lg:pl-[var(--sidebar-w)]' : ''}`}>
                    <AppTopbar
                        user={currentUser}
                        sidebarDocked={sidebarDocked}
                        onOpenMenu={() => {
                            // En escritorio, el botón vuelve a fijar la barra; en móvil y PDV abre el panel
                            if (!isPdvPage && !sidebarPinned && window.matchMedia('(min-width: 1024px)').matches) setPinned(true);
                            else setIsSidebarOpen(true);
                        }}
                        showBreadcrumbs={!isPdvPage}
                    />

                    <main
                        id="contenido"
                        className={isPdvPage
                            ? "flex-1 w-full p-2 h-full min-h-0 max-h-full overflow-hidden flex flex-col"
                            : "flex-1 w-full max-w-page mx-auto px-4 md:px-6 xl:px-8 pt-5 md:pt-6 pb-28 md:pb-10 min-w-0"}
                    >
                        {children}
                        <SpeedInsights />
                    </main>
                </div>

                <ToastContainer />
            </div>
        );
    }

    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="HDB SGI" />
                <meta name="theme-color" content="#1f60c1" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/images/ios/180.png" />

                {/* Carga manual de fuentes (next/font/google falla en builds locales sin red) */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />

                <script dangerouslySetInnerHTML={{ __html: `!function(){try{var e=localStorage.getItem("color-theme");if(e){document.documentElement.setAttribute("data-color-theme",e)}}catch(e){}}();` }} />
                <title>HDB | SGI</title>
                <meta name="description" content="Sistema de Gestión Integral" />
            </head>
            <body className="font-sans min-h-[100dvh] bg-background text-foreground overscroll-none">
                <ColorThemeProvider>
                    <ThemeProvider attribute="class" defaultTheme={isPublicPage ? "light" : "system"} enableSystem={!isPublicPage}>
                        <ERPProviders>
                            {content}
                            {/* Global Command Palette — available when logged in */}
                            {currentUser && (
                                <CommandPalette
                                    views={effectiveViews}
                                    role={role}
                                />
                            )}
                            {currentUser && <TicketQuickAction />}
                            <GlobalDrawer />
                            <Analytics />
                        </ERPProviders>
                    </ThemeProvider>
                </ColorThemeProvider>
            </body>
        </html>
    );
}
