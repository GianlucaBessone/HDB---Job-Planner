'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProductoFormView, { MetaData } from '@/components/ventas/ProductoFormView';
import { Loader2 } from 'lucide-react';
import { showToast } from '@/components/Toast';

export default function EditarProductoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [meta, setMeta] = useState<MetaData | null>(null);
  const [producto, setProducto] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch('/api/ventas/meta').then((r) => r.json()),
      fetch(`/api/ventas/productos/${id}`).then((r) => r.json()),
    ])
      .then(([metaData, prodData]) => {
        if (metaData && !metaData.error) setMeta(metaData);
        if (prodData && !prodData.error) {
          setProducto(prodData);
        } else {
          showToast('Producto no encontrado', 'error');
          router.push('/ventas/gestion');
        }
      })
      .catch((err) => {
        console.error('Error fetching data:', err);
        showToast('Error al cargar datos del producto', 'error');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading || !meta || !producto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
        <span className="text-xs font-semibold">Cargando producto para edición...</span>
      </div>
    );
  }

  return (
    <ProductoFormView
      mode="editar"
      productoId={id}
      meta={meta}
      initialProducto={producto}
    />
  );
}
