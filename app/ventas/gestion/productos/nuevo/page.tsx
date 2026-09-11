'use client';

import React, { useState, useEffect } from 'react';
import ProductoFormView, { MetaData } from '@/components/ventas/ProductoFormView';
import { Loader2 } from 'lucide-react';

export default function NuevoProductoPage() {
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ventas/meta')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setMeta(data);
        }
      })
      .catch((err) => console.error('Error fetching meta:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !meta) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
        <span className="text-xs font-semibold">Cargando formulario de alta...</span>
      </div>
    );
  }

  return <ProductoFormView mode="nuevo" meta={meta} />;
}
