'use client';

import { useState, useEffect } from "react";
import { Outfit } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import { Calendar, LayoutGrid, Users, ClipboardList, Menu, X, Landmark, LayoutDashboard, Timer, Clock, LogOut, Home, Settings, FileSignature, Package } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ToastContainer from "@/components/Toast";
import LoginScreen from "@/components/LoginScreen";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import OneSignalInit from "@/components/OneSignalInit";
import OneSignal from 'react-onesignal';
import SyncIndicator from "@/components/SyncIndicator";
import { Loader2, BellRing } from "lucide-react";

const outfit = Outfit({ subsets: ["latin"] });

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isOnline, setIsOnline] = useState(true);

    const router = useRouter();
    const pathname = usePathname();

    // Auto-close sidebar on navigation
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [pathname]);

    const handleLoginSuccess = (user: any) => {
        setCurrentUser(user);
        setIsSidebarOpen(false);
        if (user.role?.toLowerCase() === 'operador') {
            router.push('/timesheets');
        } else {
            router.push('/');
        }
    };

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                setCurrentUser(JSON.parse(stored));
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

    const isPublicPage = pathname ? (pathname.includes('/report') || pathname.startsWith('/os/')) : false;

    let content;
    if (isCheckingAuth) {
        content = (
            <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50/50">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    } else if (!currentUser && !isPublicPage) {
        content = <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    } else if (isPublicPage && !currentUser) {
        // Public view (No header/sidebar)
        content = (
            <div className="flex flex-col min-h-[100dvh] overflow-x-hidden bg-white">
                <main className="flex-1 w-full max-w-4xl mx-auto py-4">
                    {children}
                </main>
            </div>
        );
    } else {
        content = (
            <div className="flex flex-col min-h-[100dvh] overflow-x-hidden">
                <header className="sticky top-0 z-[60] w-full border-b bg-white/80 backdrop-blur-md safe-area-top">
                    <div className="max-w-[1800px] mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors mr-2"
                            >
                                <Menu className="w-6 h-6" />
                            </button>

                            <Link href="/" className="flex items-center gap-2 ml-4 hidden md:flex hover:opacity-80 transition-opacity">
                                <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
                                    <ClipboardList className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold tracking-tight text-slate-800">
                                    HDB<span className="text-primary">Planner</span>
                                </span>
                            </Link>
                        </div>
                        {/* Mobile Logo version if needed or right-aligned items can go here */}
                        <div className="flex items-center gap-2 md:gap-4">
                            <Link href="/" className="flex items-center gap-2 md:hidden hover:opacity-80 transition-opacity">
                                <span className="text-xl font-bold tracking-tight text-slate-800">
                                    HDB<span className="text-primary">Planner</span>
                                </span>
                            </Link>
                            <div className="flex items-center gap-2">
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
                    onLogout={() => {
                        localStorage.removeItem('currentUser');
                        setCurrentUser(null);
                    }}
                />

                <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 md:px-8 py-6 md:py-8 pb-32 md:pb-8">
                    {children}
                    <SpeedInsights />
                </main>

                <footer className="hidden md:block border-t bg-white py-6">
                    <div className="container mx-auto px-4 text-center text-sm text-slate-500">
                        © 2026 HDB Job Planner - Eficiencia en cada tarea
                    </div>
                </footer>

                <ToastContainer />
            </div>
        );
    }

    return (
        <html lang="es">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="HDB Planner" />
                <meta name="theme-color" content="#2563eb" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icon-192x192.png" />
                <title>HDB | Job Planner</title>
                <meta name="description" content="Sistema premium de planificación para técnicos" />
            </head>
            <body className={`${outfit.className} min-h-[100dvh] bg-slate-50/50 overscroll-none`}>
                {content}
            </body>
        </html>
    );
}

function Sidebar({ isOpen, onClose, user, onLogout }: { isOpen: boolean; onClose: () => void; user: any; onLogout: () => void }) {
    const pathname = usePathname();

    const menuItems = [
        { href: '/', icon: <Home className="w-5 h-5" />, label: 'Inicio', roles: ['operador', 'supervisor', 'admin', 'vendedor'] },
        { href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Panel de Análisis', roles: ['supervisor', 'admin'] },
        { href: '/planning', icon: <Calendar className="w-5 h-5" />, label: 'Planificación', roles: ['supervisor', 'admin'] },
        { href: '/timesheets', icon: <Clock className="w-5 h-5" />, label: 'Registro de Tiempos', roles: ['operador', 'supervisor', 'admin'] },
        { href: '/my-projects', icon: <ClipboardList className="w-5 h-5" />, label: 'Mis Proyectos (Resp.)', roles: ['operador', 'supervisor', 'admin'] },
        { href: '/projects', icon: <LayoutGrid className="w-5 h-5" />, label: 'Gestión de Proyectos', roles: ['supervisor', 'admin'] },
        { href: '/delays', icon: <Timer className="w-5 h-5" />, label: 'Demoras del Cliente', roles: ['operador', 'supervisor', 'admin'] },
        { href: '/operators', icon: <Users className="w-5 h-5" />, label: 'Gestión de Usuarios / Operadores', roles: ['operador', 'supervisor', 'admin'] },
        { href: '/clients', icon: <Landmark className="w-5 h-5" />, label: 'Gestión de Clientes', roles: ['supervisor', 'admin'] },
        { href: '/ordenes-servicio', icon: <FileSignature className="w-5 h-5" />, label: 'Órdenes de Servicio', roles: ['supervisor', 'admin'] },
        { href: '/provision-materiales', icon: <Package className="w-5 h-5" />, label: 'Provisión de Materiales', roles: ['vendedor', 'supervisor', 'admin'] },
        { href: '/configuracion', icon: <Settings className="w-5 h-5" />, label: 'Configuración', roles: ['admin', 'supervisor'] },

    ];

    const allowedMenu = menuItems.filter(item => item.roles.includes(user?.role?.toLowerCase() || 'operador'));

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
            <aside className={`fixed top-0 left-0 bottom-0 w-[240px] md:w-[280px] bg-white z-[110] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                        <ClipboardList className="w-6 h-6 shrink-0" />
                        <span className="font-extrabold text-xl tracking-tighter text-slate-800">HDB<span className="text-primary">Planner</span></span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {allowedMenu.map(item => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${isActive
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20 active:scale-95'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                                    }`}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-slate-100 space-y-4">
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 py-[2px] px-1.5 uppercase tracking-widest bg-white border border-slate-200 inline-block rounded-md mb-1">{user?.role}</p>
                            <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]" title={user?.nombreCompleto}>{user?.nombreCompleto}</p>
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
                        className="w-full flex items-center justify-center gap-2 bg-primary/5 text-primary py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/10 transition-all active:scale-95 border border-primary/10"
                    >
                        <BellRing className="w-4 h-4" />
                        Activar Notificaciones
                    </button>

                    <button
                        onClick={onLogout}
                        className="w-full flex items-center justify-center gap-2 bg-rose-50 text-rose-500 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                    </button>

                    <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400">v2.0.4 Premium</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
