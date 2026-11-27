'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, CreditCard, Warehouse, Receipt, FileSignature } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

type Seccion = 'gestion' | 'pdv' | 'cotizaciones' | 'almacen' | 'cuentas-corrientes';

interface VentasNavTabsProps {
  currentTab?: Seccion;
  className?: string;
  /** Título del encabezado (ModuleHeader); por defecto, el de la sección. */
  titulo?: string;
  descripcion?: string;
  /** Sin encabezado: para pantallas con diseño propio, como el punto de venta. */
  sinEncabezado?: boolean;
}

/** Encabezado por defecto de cada sección de Ventas: el título de la pantalla es el único h1. */
const ENCABEZADO: Record<Seccion, { titulo: string; descripcion: string; Icono: typeof Boxes }> = {
  gestion: { titulo: 'Gestión comercial', descripcion: 'Catálogo de productos, precios, stock y proveedores', Icono: Boxes },
  pdv: { titulo: 'Punto de venta', descripcion: 'Ventas de mostrador y cobro', Icono: CreditCard },
  cotizaciones: { titulo: 'Presupuestos de productos', descripcion: 'Cotizador e historial de presupuestos de productos', Icono: FileSignature },
  almacen: { titulo: 'Almacén y stock', descripcion: 'Existencias, movimientos, ajustes y conteos', Icono: Warehouse },
  'cuentas-corrientes': { titulo: 'Cuentas corrientes', descripcion: 'Saldos de clientes, comprobantes y cobros', Icono: Receipt },
};

export default function VentasNavTabs({ currentTab, className, titulo, descripcion, sinEncabezado }: VentasNavTabsProps) {
  const pathname = usePathname();

  const tabs = [
    {
      id: 'gestion',
      label: 'Gestión Comercial',
      href: '/ventas/gestion',
      icon: Boxes,
      badge: null,
      isActive: currentTab === 'gestion' || pathname?.includes('/ventas/gestion'),
    },
    {
      id: 'pdv',
      label: 'Punto de Venta (PDV)',
      href: '/ventas/pdv',
      icon: CreditCard,
      badge: null,
      isActive: currentTab === 'pdv' || pathname === '/ventas/pdv',
    },
    {
      id: 'cotizaciones',
      label: 'Cotizaciones',
      href: '/ventas/cotizaciones',
      icon: FileSignature,
      badge: null,
      isActive: currentTab === 'cotizaciones' || pathname?.startsWith('/ventas/cotizaciones'),
    },
    {
      id: 'almacen',
      label: 'Almacén y Stock',
      href: '/ventas/almacen',
      icon: Warehouse,
      badge: null,
      isActive: currentTab === 'almacen' || pathname?.startsWith('/ventas/almacen'),
    },
    {
      id: 'cuentas-corrientes',
      label: 'Cuentas Corrientes',
      href: '/ventas/cuentas-corrientes',
      icon: Receipt,
      badge: null,
      isActive:
        currentTab === 'cuentas-corrientes' || pathname?.startsWith('/ventas/cuentas-corrientes'),
    },
  ];

  const enc = currentTab ? ENCABEZADO[currentTab] : null;

  return (
    <>
    {enc && !sinEncabezado && (
      <ModuleHeader
        title={titulo ?? enc.titulo}
        description={descripcion ?? enc.descripcion}
        icon={<enc.Icono className="w-5 h-5" />}
        className="mb-3 shrink-0"
      />
    )}
    <div className={`flex items-center gap-1 p-1 bg-slate-100/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto hide-scrollbar w-fit max-w-full ${className ?? 'mb-2.5'}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
              tab.isActive
                ? 'bg-card text-primary shadow-xs font-bold ring-1 ring-slate-200/80 dark:ring-slate-700/80'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 font-semibold'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${tab.isActive ? 'text-primary' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="text-[11px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/30 leading-none">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
    </>
  );
}
