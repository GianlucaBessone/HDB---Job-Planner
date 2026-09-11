'use client';

import React from 'react';
import Link from 'next/link';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import { Warehouse, ArrowLeftRight, CheckCircle2, History, ArrowRight } from 'lucide-react';

export default function AlmacenPlaceholderPage() {
  return (
    <div className="space-y-6">
      <VentasNavTabs currentTab="almacen" />

      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-100 dark:border-amber-800">
          <Warehouse className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 mb-3">
          Fase 2 — Próximamente
        </span>

        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
          Almacén y Gestión de Inventario
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          La gestión avanzada de stock (entradas, salidas, transferencias y conteos cíclicos) se implementará en la siguiente fase.
          La estructura de datos de almacenes, ubicaciones y movimientos auditables ya se encuentra integrada.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <ArrowLeftRight className="w-5 h-5 text-indigo-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Movimientos</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Entradas por remito, salidas operativas y transferencias entre depósitos.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Conteos Cíclicos</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Auditoría física de inventario por pasillo y estante.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <History className="w-5 h-5 text-cyan-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Kardex y Trazabilidad</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Historial completo con usuario, fecha, motivo y balance.</p>
          </div>
        </div>

        <Link
          href="/ventas/gestion"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          Ir a Gestión Comercial
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
