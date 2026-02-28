'use client';

import { useState, useEffect } from "react";
import { Outfit } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutGrid, Users, ClipboardList, Menu, X, Landmark, LayoutDashboard, Timer, Clock, LogOut } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ToastContainer from "@/components/Toast";
import LoginScreen from "@/components/LoginScreen";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import OneSignalInit from "@/components/OneSignalInit";
import { Loader2 } from "lucide-react";

const outfit = Outfit({ subsets: ["latin"] });

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
    }, []);

    // OneSignal handles service worker registration
    /*
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(
                    registration => console.log('SW registered: ', registration),
                    error => console.log('SW registration failed: ', error)
                );
            });
        }
    }, []);
    */

    let content;
    if (isCheckingAuth) {
        content = (
            <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    } else if (!currentUser) {
        content = <LoginScreen onLoginSuccess={setCurrentUser} />;
    } else {
        content = (
            <div className="flex flex-col min-h-screen">
                <header className="sticky top-0 z-[60] w-full border-b bg-white/80 backdrop-blur-md safe-area-top">
                    <div className="max-w-[1800px] mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors mr-2"
                            >
                                <Menu className="w-6 h-6" />
                            </button>

                            <div className="flex items-center gap-2 ml-4 hidden md:flex">
                                <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
                                    <ClipboardList className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold tracking-tight text-slate-800">
                                    HDB<span className="text-primary">Planner</span>
                                </span>
                            </div>
                        </div>
                        {/* Mobile Logo version if needed or right-aligned items can go here */}
                        <div className="flex items-center gap-2 md:gap-4">
                            <div className="flex items-center gap-2 md:hidden">
                                <span className="text-xl font-bold tracking-tight text-slate-800">
                                    HDB<span className="text-primary">Planner</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <OneSignalInit appId={process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "180b43cd-8aef-4131-b844-482457816ecd"} />
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

                <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
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
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="HDB Planner" />
                <meta name="theme-color" content="#2563eb" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icon-192x192.png" />
                <title>HDB | Job Planner</title>
                <meta name="description" content="Sistema premium de planificación para técnicos" />
            </head>
            <body className={`${outfit.className} min-h-screen bg-slate-50/50`}>
                {content}
            </body>
        </html>
    );
}

function Sidebar({ isOpen, onClose, user, onLogout }: { isOpen: boolean; onClose: () => void; user: any; onLogout: () => void }) {
    const pathname = usePathname();

    const menuItems = [
        { href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Panel de Análisis', roles: ['supervisor', 'admin'] },
        { href: '/', icon: <Calendar className="w-5 h-5" />, label: 'Planificación', roles: ['supervisor', 'admin'] },
        { href: '/timesheets', icon: <Clock className="w-5 h-5" />, label: 'Registro de Tiempos', roles: ['operador', 'supervisor', 'admin'] },
        { href: '/projects', icon: <LayoutGrid className="w-5 h-5" />, label: 'Gestión de Proyectos', roles: ['supervisor', 'admin'] },
        { href: '/delays', icon: <Timer className="w-5 h-5" />, label: 'Demoras del Cliente', roles: ['supervisor', 'admin'] },
        { href: '/operators', icon: <Users className="w-5 h-5" />, label: 'Gestión de Usuarios / Operadores', roles: ['operador', 'supervisor', 'admin'] },
        { href: '/clients', icon: <Landmark className="w-5 h-5" />, label: 'Gestión de Clientes', roles: ['supervisor', 'admin'] },
    ];

    const allowedMenu = menuItems.filter(item => item.roles.includes(user?.role || 'operador'));

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
