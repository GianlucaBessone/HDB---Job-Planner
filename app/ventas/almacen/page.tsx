'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import AlmacenSubNav, { AlmacenTabId } from '@/components/almacen/AlmacenSubNav';
import ResumenStockView from '@/components/almacen/ResumenStockView';
import MovimientosView from '@/components/almacen/MovimientosView';
import AjusteRapidoView from '@/components/almacen/AjusteRapidoView';
import ConteosView from '@/components/almacen/ConteosView';
import AlmacenesView from '@/components/almacen/AlmacenesView';
import FaltantesView from '@/components/almacen/FaltantesView';
import { Loader2 } from 'lucide-react';

export default function AlmacenPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = (searchParams.get('tab') as AlmacenTabId) || 'resumen';
  const [currentTab, setCurrentTab] = useState<AlmacenTabId>(initialTab);

  // Metadatos globales (almacenes, familias, marcas)
  const [meta, setMeta] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Estados cruzados entre vistas (e.g. desde Resumen a Ajuste Rápido o Movimientos)
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<any>(null);
  const [selectedSkuForMovimientos, setSelectedSkuForMovimientos] = useState<string>('');

  useEffect(() => {
    fetch('/api/ventas/meta')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setMeta(data);
        }
      })
      .catch((e) => console.error('Error fetching meta:', e))
      .finally(() => setLoadingMeta(false));
  }, []);

  const handleTabChange = (newTab: AlmacenTabId) => {
    setCurrentTab(newTab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', newTab);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  const handleNavigateToAjuste = (producto?: any) => {
    setSelectedProductForAdjust(producto || null);
    handleTabChange('ajuste');
  };

  const handleNavigateToMovimientos = (sku?: string) => {
    setSelectedSkuForMovimientos(sku || '');
    handleTabChange('movimientos');
  };

  if (loadingMeta || !meta) {
    return (
      <div className="space-y-4">
        <VentasNavTabs currentTab="almacen" />
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <span className="text-xs font-semibold">Cargando módulo de Almacén y Stock...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Barra de Pestañas Principal del Módulo Ventas */}
      <VentasNavTabs currentTab="almacen" />

      {/* Sub-navegación compacta de Almacén (6 Vistas) */}
      <AlmacenSubNav
        currentTab={currentTab}
        onChangeTab={handleTabChange}
      />

      {/* Contenido de la Vista Activa */}
      {currentTab === 'resumen' && (
        <ResumenStockView
          meta={meta}
          onNavigateToAjuste={handleNavigateToAjuste}
          onNavigateToMovimientos={handleNavigateToMovimientos}
        />
      )}

      {currentTab === 'movimientos' && (
        <MovimientosView
          meta={meta}
          initialSku={selectedSkuForMovimientos}
        />
      )}

      {currentTab === 'ajuste' && (
        <AjusteRapidoView
          meta={meta}
          initialProduct={selectedProductForAdjust}
          onSuccess={() => {
            setSelectedProductForAdjust(null);
            handleTabChange('resumen');
          }}
        />
      )}

      {currentTab === 'conteos' && (
        <ConteosView meta={meta} />
      )}

      {currentTab === 'almacenes' && (
        <AlmacenesView />
      )}

      {currentTab === 'faltantes' && (
        <FaltantesView
          meta={meta}
          onAdjustProduct={handleNavigateToAjuste}
        />
      )}
    </div>
  );
}
