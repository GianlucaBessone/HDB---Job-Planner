'use client';

import React from 'react';
import Link from 'next/link';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import { CreditCard, ShoppingBag, Barcode, ArrowRight, ShieldCheck } from 'lucide-react';

export default function PdvPlaceholderPage() {
  return (
    <div className="space-y-6">
      <VentasNavTabs currentTab="pdv" />

      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-800">
          <CreditCard className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 mb-3">
          Fase 3 — Próximamente
        </span>

        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
          Punto de Venta (PDV)
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          El módulo de facturación rápida y mostrador se encuentra preparado en la arquitectura actual.
          Utilizará el maestro de productos, los códigos de barras y las listas de precios configuradas en la fase de Gestión.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <Barcode className="w-5 h-5 text-indigo-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Lector de Barras</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Escaneo directo y búsqueda rápida por EAN-13 o SKU.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <ShoppingBag className="w-5 h-5 text-emerald-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Carrito y Cobro</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Múltiples medios de pago y emisión de comprobantes.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <ShieldCheck className="w-5 h-5 text-cyan-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Stock en Tiempo Real</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Descuento automático de inventario del almacén asignado.</p>
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
