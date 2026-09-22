'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  FolderGit2,
  FileText,
  LayoutDashboard,
  LogOut,
  User,
  Building2,
  Menu,
  X,
  Loader2,
} from 'lucide-react';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute =
    pathname === '/portal-clientes/login' || pathname === '/portal-clientes/primer-acceso';

  const [session, setSession] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isAuthRoute);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAuthRoute) {
      loadSession();
    }
  }, [pathname, isAuthRoute]);

  const loadSession = async () => {
    try {
      const res = await fetch('/api/portal-clientes/auth/me');
      if (res.ok) {
        const data = await res.json();
        setSession(data.responsable);
        if (data.responsable.mustChangePassword && pathname !== '/portal-clientes/primer-acceso') {
          router.push('/portal-clientes/primer-acceso');
        }
      } else {
        router.push('/portal-clientes/login');
      }
    } catch {
      router.push('/portal-clientes/login');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/portal-clientes/auth/logout', { method: 'POST' });
    } finally {
      router.push('/portal-clientes/login');
    }
  };

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-bold">Verificando sesión del portal...</p>
      </div>
    );
  }

  const navLinks = [
    { href: '/portal-clientes', label: 'Mis Proyectos', icon: FolderGit2 },
    { href: '/portal-clientes/ordenes-trabajo', label: 'Órdenes de Trabajo', icon: FileText },
    { href: '/portal-clientes/dashboard', label: 'Dashboard & Métricas', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Portal Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  HDB
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase">
                  Portal Clientes
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">
                {session?.cliente?.nombre}
              </p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === '/portal-clientes'
                  ? pathname === '/portal-clientes'
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* User profile & logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {session?.nombre}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {session?.cargo || 'Responsable Autorizado'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === '/portal-clientes'
                  ? pathname === '/portal-clientes'
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-4 text-center text-xs text-slate-400">
        HDB Servicios Eléctricos · Portal Privado para Clientes · Documentos e Integridad SHA-256
      </footer>
    </div>
  );
}
