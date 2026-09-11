'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, CreditCard, Warehouse, Receipt } from 'lucide-react';

interface VentasNavTabsProps {
  currentTab?: 'gestion' | 'pdv' | 'almacen' | 'cuentas-corrientes';
}

export default function VentasNavTabs({ currentTab }: VentasNavTabsProps) {
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
      badge: 'Próx.',
      isActive: currentTab === 'pdv' || pathname === '/ventas/pdv',
    },
    {
      id: 'almacen',
      label: 'Almacén y Stock',
      href: '/ventas/almacen',
      icon: Warehouse,
      badge: 'Próx.',
      isActive: currentTab === 'almacen' || pathname === '/ventas/almacen',
    },
    {
      id: 'cuentas-corrientes',
      label: 'Cuentas Corrientes',
      href: '/ventas/cuentas-corrientes',
      icon: Receipt,
      badge: 'Próx.',
      isActive: currentTab === 'cuentas-corrientes' || pathname === '/ventas/cuentas-corrientes',
    },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800 mb-2.5 overflow-x-auto hide-scrollbar w-fit max-w-full">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
              tab.isActive
                ? 'bg-card text-primary shadow-xs font-black ring-1 ring-slate-200/80 dark:ring-slate-700/80'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 font-semibold'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${tab.isActive ? 'text-primary' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/30 leading-none">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
