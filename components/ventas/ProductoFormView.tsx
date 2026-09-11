'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Barcode,
  Sparkles,
  AlertCircle,
  Info,
  Layers,
  Copy,
  Check,
  X,
  PackageCheck,
  Building2,
  Tag,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { formatARS } from '@/lib/formatCurrency';
import SearchableSelect from '@/components/ui/SearchableSelect';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import { normalizeSku } from '@/lib/ventas/skuUtils';

export interface MetaData {
  proveedores: Array<{ id: string; razonSocial: string; nombreFantasia?: string | null; cuit: string }>;
  marcas: Array<{ id: string; nombre: string }>;
  categorias: Array<{ id: string; nombre: string }>;
  familias: Array<{ id: string; nombre: string; subfamilias: Array<{ id: string; nombre: string }> }>;
  unidades: Array<{ id: string; codigo: string; nombre: string }>;
  almacenes: Array<{ id: string; codigo: string; nombre: string; ubicaciones: Array<{ id: string; codigo: string }> }>;
  alicuotasIva: Array<{ id: string; porcentaje: number; nombre: string; predeterminado: boolean }>;
  listasPrecios: Array<{
    id: string;
    codigo: string;
    nombre: string;
    orden: number;
    tipoAjuste?: string | null;
    valorAjuste?: number | null;
  }>;
}

interface ProductoFormViewProps {
  mode: 'nuevo' | 'editar';
  productoId?: string;
  meta: MetaData;
  initialProducto?: any;
}

export default function ProductoFormView({
  mode,
  productoId,
  meta,
  initialProducto,
}: ProductoFormViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plantillaId = searchParams.get('plantillaId') || searchParams.get('from');

  const isEdit = mode === 'editar';
  const isPlantilla = !isEdit && !!plantillaId;

  const [activeSection, setActiveSection] = useState<'identificacion' | 'proveedor' | 'comercial' | 'inventario'>('identificacion');
  const [isSaving, setIsSaving] = useState(false);
  const [plantillaOriginal, setPlantillaOriginal] = useState<{ descripcion: string; sku: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    codigoBarras: '',
    descripcion: '',
    categoriaId: '',
    nuevaCategoria: '',
    marcaId: '',
    nuevaMarca: '',
    familiaId: '',
    nuevaFamilia: '',
    subFamiliaId: '',
    nuevaSubFamilia: '',
    unidadId: '',
    nuevaUnidad: '',
    ivaId: '',
    rentabilidad: '30' as string | number,

    // Proveedor
    proveedorId: '',
    skuProveedor: '',
    costo: '' as string | number,

    // Comercial (Precio Base propio del producto)
    precioBase: '' as string | number,

    // Inventario
    almacenId: '',
    ubicacionId: '',
    stockMinimo: '5' as string | number,
    stockMaximo: '100' as string | number,
    stockInicial: '' as string | number, // Solo para alta
    stockActual: 0, // Solo para lectura en edición
  });

  // Load defaults or existing data
  useEffect(() => {
    const defaultIva = meta.alicuotasIva.find((a) => a.predeterminado)?.id || meta.alicuotasIva[0]?.id || '';
    const defaultAlm = meta.almacenes.find((a) => (a as any).esPredeterminado)?.id || meta.almacenes[0]?.id || '';
    const defaultUnidad = meta.unidades.find((u) => u.codigo === 'UN')?.id || meta.unidades[0]?.id || '';

    if (isEdit && initialProducto) {
      // EDIT MODE: Populate all fields, stock actual is READ-ONLY
      const primaryStock = initialProducto.stocks?.[0] || null;
      const primaryProv = initialProducto.proveedores?.[0] || null;

      setFormData({
        sku: initialProducto.sku || '',
        codigoBarras: initialProducto.codigoBarras || '',
        descripcion: initialProducto.descripcion || '',
        categoriaId: initialProducto.categoriaId || '',
        nuevaCategoria: '',
        marcaId: initialProducto.marcaId || '',
        nuevaMarca: '',
        familiaId: initialProducto.familiaId || '',
        nuevaFamilia: '',
        subFamiliaId: initialProducto.subFamiliaId || '',
        nuevaSubFamilia: '',
        unidadId: initialProducto.unidadId || defaultUnidad,
        nuevaUnidad: '',
        ivaId: initialProducto.ivaId || defaultIva,
        rentabilidad: initialProducto.rentabilidad ?? 30,

        proveedorId: primaryProv?.proveedorId || '',
        skuProveedor: primaryProv?.skuProveedor || '',
        costo: primaryProv?.costo !== undefined ? primaryProv.costo : '',

        precioBase: initialProducto.precioBase ?? '',

        almacenId: primaryStock?.almacenId || defaultAlm,
        ubicacionId: primaryStock?.ubicacionId || '',
        stockMinimo: primaryStock?.stockMinimo ?? 5,
        stockMaximo: primaryStock?.stockMaximo ?? 100,
        stockInicial: '',
        stockActual: primaryStock?.stockActual ?? 0,
      });
    } else if (isPlantilla && plantillaId) {
      // TEMPLATE MODE: Fetch original product, copy ONLY masters. OMIT ID, SKU, Barcode, Stock!
      fetch(`/api/ventas/productos/${plantillaId}`)
        .then((r) => r.json())
        .then((prod) => {
          if (prod && !prod.error) {
            setPlantillaOriginal({ descripcion: prod.descripcion, sku: prod.sku });
            const primaryStock = prod.stocks?.[0] || null;
            const primaryProv = prod.proveedores?.[0] || null;

            setFormData({
              sku: '', // STRICT RULE: SKU empty to prevent conflicts
              codigoBarras: '', // STRICT RULE: Barcode empty
              descripcion: prod.descripcion || '',
              categoriaId: prod.categoriaId || '',
              nuevaCategoria: '',
              marcaId: prod.marcaId || '',
              nuevaMarca: '',
              familiaId: prod.familiaId || '',
              nuevaFamilia: '',
              subFamiliaId: prod.subFamiliaId || '',
              nuevaSubFamilia: '',
              unidadId: prod.unidadId || defaultUnidad,
              nuevaUnidad: '',
              ivaId: prod.ivaId || defaultIva,
              rentabilidad: prod.rentabilidad ?? 30,

              proveedorId: primaryProv?.proveedorId || '',
              skuProveedor: primaryProv?.skuProveedor || '',
              costo: primaryProv?.costo !== undefined ? primaryProv.costo : '',

              precioBase: prod.precioBase ?? '',

              almacenId: primaryStock?.almacenId || defaultAlm,
              ubicacionId: primaryStock?.ubicacionId || '',
              stockMinimo: primaryStock?.stockMinimo ?? 5,
              stockMaximo: primaryStock?.stockMaximo ?? 100,
              stockInicial: '', // STRICT RULE: Stock starts clean (0)
              stockActual: 0,
            });
            showToast(`Datos maestros precargados desde "${prod.descripcion}"`, 'info');
          }
        })
        .catch((err) => console.error('Error loading template product:', err));
    } else {
      // FRESH CREATION MODE
      setFormData((prev) => ({
        ...prev,
        ivaId: defaultIva,
        almacenId: defaultAlm,
        unidadId: defaultUnidad,
      }));
    }
  }, [isEdit, isPlantilla, plantillaId, initialProducto, meta]);

  // Dynamic subfamilies based on selected Familia
  const currentFamilia = meta.familias.find((f) => f.id === formData.familiaId);
  const availableSubFamilias = currentFamilia?.subfamilias || [];

  // Dynamic ubicaciones based on selected Almacén
  const currentAlmacen = meta.almacenes.find((a) => a.id === formData.almacenId);
  const availableUbicaciones = currentAlmacen?.ubicaciones || [];

  // Suggest Price Calculation: Costo + Rentabilidad -> Suggested Precio Base
  // User can manually edit, and later cost changes DO NOT overwrite manually set price
  const handleSugerirPrecioBase = () => {
    const numCosto = parseFloat(String(formData.costo)) || 0;
    const numRentabilidad = parseFloat(String(formData.rentabilidad)) || 30;

    if (numCosto <= 0) {
      showToast('Ingresá primero un costo de adquisición mayor a 0', 'info');
      return;
    }

    const sugerido = Math.round(numCosto * (1 + numRentabilidad / 100) * 100) / 100;
    setFormData((prev) => ({ ...prev, precioBase: sugerido }));
    showToast(`Precio base sugerido calculado: ${formatARS(sugerido)}`, 'success');
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sku.trim()) {
      showToast('El SKU interno es obligatorio', 'error');
      setActiveSection('identificacion');
      return;
    }
    if (!formData.descripcion.trim()) {
      showToast('La descripción del producto es obligatoria', 'error');
      setActiveSection('identificacion');
      return;
    }

    setIsSaving(true);
    try {
      const url = isEdit ? `/api/ventas/productos/${productoId}` : '/api/ventas/productos';
      const method = isEdit ? 'PUT' : 'POST';

      const parsedCosto = parseFloat(String(formData.costo)) || 0;
      const parsedRentabilidad = parseFloat(String(formData.rentabilidad)) || 0;
      const parsedPrecioBase = parseFloat(String(formData.precioBase)) || 0;
      const parsedStockMin = parseFloat(String(formData.stockMinimo)) || 0;
      const parsedStockMax = parseFloat(String(formData.stockMaximo)) || 0;
      const parsedStockInicial = parseFloat(String(formData.stockInicial)) || 0;

      const payload: any = {
        sku: normalizeSku(formData.sku),
        codigoBarras: formData.codigoBarras ? formData.codigoBarras.trim() : null,
        descripcion: formData.descripcion.trim(),
        categoriaId: formData.categoriaId || null,
        nuevaCategoria: formData.nuevaCategoria?.trim() || null,
        marcaId: formData.marcaId || null,
        nuevaMarca: formData.nuevaMarca?.trim() || null,
        familiaId: formData.familiaId || null,
        nuevaFamilia: formData.nuevaFamilia?.trim() || null,
        subFamiliaId: formData.subFamiliaId || null,
        nuevaSubFamilia: formData.nuevaSubFamilia?.trim() || null,
        unidadId: formData.unidadId || null,
        nuevaUnidad: formData.nuevaUnidad?.trim() || null,
        ivaId: formData.ivaId || null,
        rentabilidad: parsedRentabilidad,

        proveedorId: formData.proveedorId || null,
        skuProveedor: formData.skuProveedor?.trim() || null,
        costo: parsedCosto,

        precioBase: parsedPrecioBase,
        p1: parsedPrecioBase,

        almacenId: formData.almacenId || null,
        ubicacionId: formData.ubicacionId || null,
        stockMinimo: parsedStockMin,
        stockMaximo: parsedStockMax,
      };

      // In creation, pass stockInicial; in edit, it is strictly ignored
      if (!isEdit) {
        payload.stockInicial = parsedStockInicial;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el producto');
      }

      showToast(isEdit ? 'Producto actualizado con éxito' : 'Producto creado con éxito', 'success');
      router.push('/ventas/gestion');
    } catch (err: any) {
      showToast(err.message || 'Error en la operación', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col space-y-2 max-w-7xl mx-auto w-full pb-12">
      {/* 4-Area Navigation Tabs */}
      <VentasNavTabs currentTab="gestion" />

      {/* Main ERP Card */}
      <form onSubmit={handleSubmit} className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Compact ERP Header */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Back + Title + Template Badge */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push('/ventas/gestion')}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors shadow-sm"
              title="Volver a Gestión Comercial"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm md:text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
              </h1>

              {isEdit && formData.sku && (
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {formData.sku}
                </span>
              )}

              {/* Informative Template Badge */}
              {isPlantilla && plantillaOriginal && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-in fade-in">
                  <Copy className="w-3 h-3 text-indigo-500" />
                  <span>Basado en: <strong>{plantillaOriginal.descripcion}</strong> ({plantillaOriginal.sku})</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/ventas/gestion')}
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-white text-xs font-bold shadow-sm shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Guardar Producto'}</span>
            </button>
          </div>
        </div>

        {/* Section Tabs (Fast Jumping Navigation) */}
        <div className="px-4 py-1.5 bg-slate-100/60 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSection('identificacion')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'identificacion'
                ? 'bg-background text-primary font-bold shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            1. Identificación
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('proveedor')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'proveedor'
                ? 'bg-background text-primary font-bold shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            2. Proveedor & Costo
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('comercial')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'comercial'
                ? 'bg-background text-primary font-bold shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            3. Comercial & Precios
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('inventario')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'inventario'
                ? 'bg-background text-primary font-bold shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            4. Inventario
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 md:p-6 space-y-6">
          {/* SECTION 1: IDENTIFICACIÓN */}
          {activeSection === 'identificacion' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SKU Interno <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    onBlur={() => {
                      if (formData.sku) {
                        setFormData((prev) => ({ ...prev, sku: normalizeSku(prev.sku) }));
                      }
                    }}
                    placeholder="Ej: 00025"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary uppercase shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Identificador único (los códigos numéricos se completan a 5 dígitos con ceros).</p>
                </div>

                {/* Código de Barras */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código de Barras (Escáner / PDV)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.codigoBarras}
                      onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                      placeholder="Ej: 7791234567890"
                      className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                    />
                    <Barcode className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Acepta lectura directa con pistola de código de barras USB.</p>
                </div>
              </div>

              {/* Nombre / Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre / Descripción Comercial <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ej: Contactor Schneider LC1D18 220V 18A"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
              </div>

              {/* Categoría, Marca, Familia, SubFamilia, Unidad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
                {/* Categoría */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Categoría
                  </label>
                  <SearchableSelect
                    options={meta.categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
                    value={formData.categoriaId}
                    onChange={(val) => setFormData({ ...formData, categoriaId: val, nuevaCategoria: '' })}
                    placeholder="Seleccionar..."
                    searchPlaceholder="Buscar categoría..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaCategoria}
                    onChange={(e) => setFormData({ ...formData, nuevaCategoria: e.target.value, categoriaId: '' })}
                    placeholder="O nueva categoría..."
                    className="w-full h-7 px-2 mt-1 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Marca */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Marca
                  </label>
                  <SearchableSelect
                    options={meta.marcas.map((m) => ({ id: m.id, nombre: m.nombre }))}
                    value={formData.marcaId}
                    onChange={(val) => setFormData({ ...formData, marcaId: val, nuevaMarca: '' })}
                    placeholder="Seleccionar..."
                    searchPlaceholder="Buscar marca..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaMarca}
                    onChange={(e) => setFormData({ ...formData, nuevaMarca: e.target.value, marcaId: '' })}
                    placeholder="O nueva marca..."
                    className="w-full h-7 px-2 mt-1 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Familia */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Familia
                  </label>
                  <SearchableSelect
                    options={meta.familias.map((f) => ({ id: f.id, nombre: f.nombre }))}
                    value={formData.familiaId}
                    onChange={(val) => setFormData({ ...formData, familiaId: val, subFamiliaId: '', nuevaFamilia: '' })}
                    placeholder="Seleccionar..."
                    searchPlaceholder="Buscar familia..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaFamilia}
                    onChange={(e) => setFormData({ ...formData, nuevaFamilia: e.target.value, familiaId: '', subFamiliaId: '' })}
                    placeholder="O nueva familia..."
                    className="w-full h-7 px-2 mt-1 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* SubFamilia */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sub-Familia
                  </label>
                  <SearchableSelect
                    options={availableSubFamilias.map((sf) => ({ id: sf.id, nombre: sf.nombre }))}
                    value={formData.subFamiliaId}
                    onChange={(val) => setFormData({ ...formData, subFamiliaId: val, nuevaSubFamilia: '' })}
                    disabled={!formData.familiaId || availableSubFamilias.length === 0}
                    placeholder={!formData.familiaId ? 'Elige familia' : availableSubFamilias.length === 0 ? 'Sin subfamilias' : 'Seleccionar...'}
                    searchPlaceholder="Buscar subfamilia..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaSubFamilia}
                    onChange={(e) => setFormData({ ...formData, nuevaSubFamilia: e.target.value, subFamiliaId: '' })}
                    placeholder="O nueva subfamilia..."
                    className="w-full h-7 px-2 mt-1 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Unidad */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unidad
                  </label>
                  <SearchableSelect
                    options={meta.unidades.map((u) => ({ id: u.id, nombre: `${u.codigo} - ${u.nombre}` }))}
                    value={formData.unidadId}
                    onChange={(val) => setFormData({ ...formData, unidadId: val, nuevaUnidad: '' })}
                    placeholder="Seleccionar..."
                    searchPlaceholder="Buscar unidad..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaUnidad}
                    onChange={(e) => setFormData({ ...formData, nuevaUnidad: e.target.value, unidadId: '' })}
                    placeholder="O nueva unidad..."
                    className="w-full h-7 px-2 mt-1 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: PROVEEDOR & COSTO */}
          {activeSection === 'proveedor' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-blue-500" />
                <span>
                  Los <strong>Proveedores de Ventas</strong> corresponden al maestro comercial propio. No se vinculan con proveedores de compras generales ni se infieren de la marca.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor Ventas (Principal)
                  </label>
                  <SearchableSelect
                    options={meta.proveedores.map((p) => ({
                      id: p.id,
                      nombre: `${p.razonSocial}${p.nombreFantasia ? ` (${p.nombreFantasia})` : ''} — CUIT: ${p.cuit}`,
                    }))}
                    value={formData.proveedorId}
                    onChange={(val) => setFormData({ ...formData, proveedorId: val })}
                    placeholder="Seleccionar proveedor de ventas..."
                    searchPlaceholder="Buscar por razón social o CUIT..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SKU Proveedor
                  </label>
                  <input
                    type="text"
                    value={formData.skuProveedor}
                    onChange={(e) => setFormData({ ...formData, skuProveedor: e.target.value })}
                    placeholder="Ej: ART-FAB-9921"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Costo de Adquisición ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.costo}
                      onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-slate-400">Costo neto antes de impuestos.</span>
                    {formData.costo !== '' && (
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatARS(formData.costo)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: COMERCIAL & PRECIOS */}
          {activeSection === 'comercial' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alícuota de IVA
                  </label>
                  <select
                    value={formData.ivaId}
                    onChange={(e) => setFormData({ ...formData, ivaId: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {meta.alicuotasIva.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} {a.predeterminado ? '(Predeterminado)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Rentabilidad Esperada (%)
                    </label>
                    <button
                      type="button"
                      onClick={handleSugerirPrecioBase}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                      title="Calcula Precio Base Sugerido = Costo * (1 + Margen %)"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Sugerir Precio</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.rentabilidad}
                      onChange={(e) => setFormData({ ...formData, rentabilidad: e.target.value })}
                      placeholder="30"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
              </div>

              {/* PRECIO BASE DE VENTA CARD */}
              <div className="p-3.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Precio Base de Venta ($ ARS) <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Precio comercial único del producto. El botón "Sugerir Precio" calcula una sugerencia, pero podés modificar libremente este valor antes de guardar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSugerirPrecioBase}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-white text-[11px] font-bold shadow-xs hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Costo + Margen</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.precioBase}
                      onChange={(e) => setFormData({ ...formData, precioBase: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-10 pl-7 pr-3 rounded-lg border border-primary/40 bg-background text-sm font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-inner"
                    />
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-background/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500">Formato ARS:</span>
                    <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                      {formData.precioBase !== '' ? formatARS(formData.precioBase) : '$ 0,00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Price Lists Simulation */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-primary" />
                    Listas de Precios Configuradas ({meta.listasPrecios.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Calculadas dinámicamente en PDV</span>
                </div>

                {meta.listasPrecios.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay listas de precios activas.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {meta.listasPrecios.map((lp) => {
                      const numBase = parseFloat(String(formData.precioBase)) || 0;
                      const numCosto = parseFloat(String(formData.costo)) || 0;
                      let simPrice = numBase;
                      if (lp.tipoAjuste === 'PORCENTAJE_COSTO') {
                        simPrice = Math.round(numCosto * (1 + (lp.valorAjuste || 0) / 100) * 100) / 100;
                      } else if (lp.tipoAjuste === 'DESCUENTO_BASE') {
                        simPrice = Math.round(numBase * (1 - (lp.valorAjuste || 0) / 100) * 100) / 100;
                      } else if (lp.tipoAjuste === 'RECARGO_BASE') {
                        simPrice = Math.round(numBase * (1 + (lp.valorAjuste || 0) / 100) * 100) / 100;
                      }

                      return (
                        <div
                          key={lp.id}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                            {lp.nombre}
                          </span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatARS(simPrice)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 4: INVENTARIO */}
          {activeSection === 'inventario' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Almacén Asignado
                  </label>
                  <select
                    value={formData.almacenId}
                    onChange={(e) => setFormData({ ...formData, almacenId: e.target.value, ubicacionId: '' })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {meta.almacenes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} ({a.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ubicación en Almacén
                  </label>
                  <select
                    value={formData.ubicacionId}
                    onChange={(e) => setFormData({ ...formData, ubicacionId: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Sin Ubicación Específica --</option>
                    {availableUbicaciones.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.codigo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Stock Mínimo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                    placeholder="5"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Dispara alerta de Stock Bajo.</p>
                </div>

                {/* Stock Máximo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Stock Máximo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stockMaximo}
                    onChange={(e) => setFormData({ ...formData, stockMaximo: e.target.value })}
                    placeholder="100"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Dispara alerta de Sobre Stock.</p>
                </div>

                {/* Stock Inicial / Stock Actual (Strict Rule) */}
                <div>
                  {isEdit ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Stock Actual (Solo Lectura)
                        </label>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Protegido
                        </span>
                      </div>
                      <input
                        type="number"
                        disabled
                        value={formData.stockActual}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-500 cursor-not-allowed"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Modificar únicamente mediante <strong>Ajuste de Stock</strong> en Almacén.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Stock Inicial de Apertura
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.stockInicial}
                        onChange={(e) => setFormData({ ...formData, stockInicial: e.target.value })}
                        placeholder="0"
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Se registrará automáticamente como movimiento de ajuste inicial.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer Actions */}
        <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/ventas/gestion')}
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 h-8 px-5 rounded-lg bg-primary text-white text-xs font-bold shadow-sm shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Guardar Producto'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
