'use client';

import React from 'react';
import Link from 'next/link';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import { Receipt, UserCheck, CalendarDays, FileText, ArrowRight } from 'lucide-react';

export default function CuentasCorrientesPlaceholderPage() {
  return (
    <div className="space-y-6">
      <VentasNavTabs currentTab="cuentas-corrientes" />

      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-4 border border-cyan-100 dark:border-cyan-800">
          <Receipt className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 mb-3">
          Fase 4 — Próximamente
        </span>

        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
          Cuentas Corrientes y Créditos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          El módulo de saldos comerciales de clientes, límites de crédito, imputación de cobranzas y vencimientos se habilitará en la Fase 4.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <UserCheck className="w-5 h-5 text-indigo-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Límites y Plazos</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Control de margen crediticio por cliente con alertas tempranas.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <CalendarDays className="w-5 h-5 text-emerald-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Vencimientos</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Seguimiento de facturas pendientes, recibos y fechas de cobro.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <FileText className="w-5 h-5 text-cyan-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Estado de Cuenta</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Resumen descargable en PDF con saldo histórico detallado.</p>
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
