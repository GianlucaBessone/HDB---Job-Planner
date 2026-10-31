'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandMark } from '@/components/shell/BrandMark';
import {

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
      <div role="status" className="min-h-screen flex flex-col items-center justify-center bg-background text-slate-500 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <p className="text-[13px]">Verificando sesión del portal…</p>
      </div>
    );
  }

  const navLinks = [
    { href: '/portal-clientes', label: 'Mis Proyectos', icon: FolderGit2 },
    { href: '/portal-clientes/ordenes-trabajo', label: 'Órdenes de Trabajo', icon: FileText },
    { href: '/portal-clientes/dashboard', label: 'Dashboard & Métricas', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Portal Navbar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[var(--topbar-h)] flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <BrandMark className="w-8 h-8" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                  HDB
                </span>
                <span className="badge badge-brand">Portal de clientes</span>
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
                  aria-current={isActive ? 'page' : undefined}
                  className="nav-item"
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
              <span className="text-[11px] text-slate-400 font-medium">
                {session?.cargo || 'Responsable Autorizado'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="btn btn-ghost btn-icon btn-icon-inline"
            >
              <LogOut />
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden btn btn-ghost btn-icon btn-icon-inline"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card p-3 space-y-1">
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
                  aria-current={isActive ? 'page' : undefined}
                  className="nav-item h-10"
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
      <footer className="border-t border-border py-4 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        HDB Servicios Eléctricos · Portal Privado para Clientes · Documentos e Integridad SHA-256
      </footer>
    </div>
  );
}
