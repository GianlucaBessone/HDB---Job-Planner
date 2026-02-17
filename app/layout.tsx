'use client';

import { useEffect } from "react";
import { Outfit } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutGrid, Users, ClipboardList } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ToastContainer from "@/components/Toast";

const outfit = Outfit({ subsets: ["latin"] });

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
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
                <div className="flex flex-col min-h-screen">
                    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md safe-area-top">
                        <div className="max-w-[1800px] mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
                                    <ClipboardList className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold tracking-tight text-slate-800">
                                    HDB<span className="text-primary">Planner</span>
                                </span>
                            </div>

                            <DesktopNav />
                        </div>
                    </header>

                    <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
                        {children}
                        <SpeedInsights />
                    </main>

                    <footer className="hidden md:block border-t bg-white py-6">
                        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
                            © 2026 HDB Job Planner - Eficiencia en cada tarea
                        </div>
                    </footer>

                    {/* Mobile Bottom Tab Bar */}
                    <MobileBottomNav />
                    <ToastContainer />
                </div>
            </body>
        </html>
    );
}

function DesktopNav() {
    const pathname = usePathname();

    return (
        <nav className="hidden md:flex items-center space-x-1">
            <NavLink href="/" icon={<Calendar className="w-4 h-4" />} label="Planificación" active={pathname === '/'} />
            <NavLink href="/projects" icon={<LayoutGrid className="w-4 h-4" />} label="Proyectos" active={pathname === '/projects'} />
            <NavLink href="/operators" icon={<Users className="w-4 h-4" />} label="Operadores" active={pathname === '/operators'} />
        </nav>
    );
}

function MobileBottomNav() {
    const pathname = usePathname();

    const tabs = [
        { href: '/', icon: Calendar, label: 'Planning' },
        { href: '/projects', icon: LayoutGrid, label: 'Proyectos' },
        { href: '/operators', icon: Users, label: 'Operadores' },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-bottom">
            <div className="flex items-center justify-around h-16">
                {tabs.map(tab => {
                    const isActive = pathname === tab.href;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200 relative ${isActive
                                ? 'text-primary'
                                : 'text-slate-400 active:text-slate-600'
                                }`}
                        >
                            {isActive && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                            )}
                            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                            <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'font-bold' : ''}`}>
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${active
                ? 'text-primary bg-primary/10 font-semibold'
                : 'text-slate-600 hover:text-primary hover:bg-primary/5'
                }`}
        >
            {icon}
            {label}
        </Link>
    );
}

