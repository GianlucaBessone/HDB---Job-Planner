'use client';

import React from 'react';
import {
  Boxes,
  ArrowLeftRight,
  Sliders,
  ClipboardCheck,
  Warehouse,
  AlertTriangle,
} from 'lucide-react';

export type AlmacenTabId =
  | 'resumen'
  | 'movimientos'
  | 'ajuste'
  | 'conteos'
  | 'almacenes'
  | 'faltantes';

interface AlmacenSubNavProps {
  currentTab: AlmacenTabId;
  onChangeTab: (tab: AlmacenTabId) => void;
  conteosPendientesCount?: number;
  faltantesCount?: number;
}

export default function AlmacenSubNav({
  currentTab,
  onChangeTab,
  conteosPendientesCount = 0,
  faltantesCount = 0,
}: AlmacenSubNavProps) {
  const tabs = [
    {
      id: 'resumen' as AlmacenTabId,
      label: 'Resumen de Stock',
      icon: Boxes,
      badge: null,
    },
    {
      id: 'movimientos' as AlmacenTabId,
      label: 'Movimientos (Kardex)',
      icon: ArrowLeftRight,
      badge: null,
    },
    {
      id: 'ajuste' as AlmacenTabId,
      label: 'Ajuste Rápido',
      icon: Sliders,
      badge: null,
    },
    {
      id: 'conteos' as AlmacenTabId,
      label: 'Conteos de Inventario',
      icon: ClipboardCheck,
      badge: conteosPendientesCount > 0 ? `${conteosPendientesCount}` : null,
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      id: 'almacenes' as AlmacenTabId,
      label: 'Almacenes y Ubicaciones',
      icon: Warehouse,
      badge: null,
    },
    {
      id: 'faltantes' as AlmacenTabId,
      label: 'Stock Mínimo y Faltantes',
      icon: AlertTriangle,
      badge: faltantesCount > 0 ? `${faltantesCount}` : null,
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-900/80 rounded-xl border border-slate-300/80 dark:border-slate-800 overflow-x-auto hide-scrollbar w-full sm:w-fit">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap font-bold ${
              isActive
                ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-300 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-300/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full border border-current/20 leading-none ${
                  tab.badgeClass || 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
