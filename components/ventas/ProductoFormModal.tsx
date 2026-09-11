'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Info, Sparkles, RefreshCw, Check, Layers } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { formatARS } from '@/lib/formatCurrency';
import { calculateSuggestedPrice, doesRuleApply, ListaPrecioConfig } from '@/lib/ventas/priceRules';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { normalizeSku } from '@/lib/ventas/skuUtils';

interface MetaData {
  proveedores: Array<{ id: string; razonSocial: string; nombreFantasia?: string | null; cuit: string }>;
  marcas: Array<{ id: string; nombre: string }>;
  familias: Array<{ id: string; nombre: string; subfamilias: Array<{ id: string; nombre: string }> }>;
  almacenes: Array<{ id: string; codigo: string; nombre: string; ubicaciones: Array<{ id: string; codigo: string }> }>;
  alicuotasIva: Array<{ id: string; porcentaje: number; nombre: string; predeterminado: boolean }>;
  listasPrecios: ListaPrecioConfig[];
}

interface ProductoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  producto?: any | null; // If editing
  meta: MetaData;
}

export default function ProductoFormModal({
  isOpen,
  onClose,
  onSuccess,
  producto,
  meta,
}: ProductoFormModalProps) {
  const isEdit = !!producto;

  const [activeSection, setActiveSection] = useState<'identificacion' | 'proveedor' | 'comercial' | 'inventario'>('identificacion');
  const [isSaving, setIsSaving] = useState(false);

  // Form State - numbers allow string | number to eliminate the permanent "0" bug
  const [formData, setFormData] = useState({
    sku: '',
    codigoBarras: '',
    descripcion: '',
    marcaId: '',
    nuevaMarca: '',
    familiaId: '',
    nuevaFamilia: '',
    subFamiliaId: '',
    nuevaSubFamilia: '',
    ivaId: '',
    rentabilidad: '30' as string | number,

    // Proveedor
    proveedorId: '',
    skuProveedor: '',
    costo: '' as string | number,

    // Precio Base de Venta único del producto
    precioBase: '' as string | number,
    precios: {} as Record<string, string | number>,

    // Inventario
    almacenId: '',
    ubicacionId: '',
    stockMinimo: '5' as string | number,
    stockMaximo: '100' as string | number,
    stockInicial: '' as string | number,
  });

  // Populate form on edit or initial creation
  useEffect(() => {
    if (producto) {
      const initialPrecioBase =
        producto.precioBase !== undefined && producto.precioBase !== null
          ? producto.precioBase
          : producto.p1 ?? '';

      setFormData({
        sku: producto.sku || '',
        codigoBarras: producto.codigoBarras || '',
        descripcion: producto.descripcion || '',
        marcaId: producto.marcaId || '',
        nuevaMarca: '',
        familiaId: producto.familiaId || '',
        nuevaFamilia: '',
        subFamiliaId: producto.subFamiliaId || '',
        nuevaSubFamilia: '',
        ivaId: producto.ivaId || '',
        rentabilidad: producto.rentabilidad ?? 30,

        proveedorId: producto.proveedorId || '',
        skuProveedor: producto.skuProveedor || '',
        costo: producto.costo !== undefined && producto.costo !== null ? producto.costo : '',

        precioBase: initialPrecioBase,
        precios: {},

        almacenId: producto.almacenId || meta.almacenes[0]?.id || '',
        ubicacionId: producto.ubicacionId || '',
        stockMinimo: producto.stockMinimo ?? 5,
        stockMaximo: producto.stockMaximo ?? 100,
        stockInicial: producto.stockActual ?? '',
      });
    } else {
      // Default creation values
      const defaultIva = meta.alicuotasIva.find((a) => a.predeterminado)?.id || meta.alicuotasIva[0]?.id || '';
      const defaultAlm = meta.almacenes.find((a) => (a as any).esPredeterminado)?.id || meta.almacenes[0]?.id || '';

      setFormData({
        sku: '',
        codigoBarras: '',
        descripcion: '',
        marcaId: '',
        nuevaMarca: '',
        familiaId: '',
        nuevaFamilia: '',
        subFamiliaId: '',
        nuevaSubFamilia: '',
        ivaId: defaultIva,
        rentabilidad: '30',

        proveedorId: '',
        skuProveedor: '',
        costo: '',

        precioBase: '',
        precios: {},

        almacenId: defaultAlm,
        ubicacionId: '',
        stockMinimo: '5',
        stockMaximo: '100',
        stockInicial: '',
      });
    }
  }, [producto, meta, isOpen]);

  // Filter subfamilias based on selected familia
  const currentFamilia = meta.familias.find((f) => f.id === formData.familiaId);
  const availableSubFamilias = currentFamilia?.subfamilias || [];

  // Filter ubicaciones based on selected almacen
  const currentAlmacen = meta.almacenes.find((a) => a.id === formData.almacenId);
  const availableUbicaciones = currentAlmacen?.ubicaciones || [];

  // Auto-calculate suggested base price from Costo + Rentabilidad
  const handleAutoCalcPrecioBase = () => {
    const numCosto = parseFloat(String(formData.costo)) || 0;
    const numRentabilidad = parseFloat(String(formData.rentabilidad)) || 30;

    if (numCosto <= 0) {
      showToast('Ingresá primero un costo de adquisición mayor a 0', 'info');
      return;
    }

    const calc = Math.round(numCosto * (1 + numRentabilidad / 100) * 100) / 100;
    setFormData((prev) => ({ ...prev, precioBase: calc }));
    showToast(`Precio base calculado: ${formatARS(calc)}`, 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sku.trim()) {
      showToast('El SKU interno es obligatorio', 'info');
      setActiveSection('identificacion');
      return;
    }
    if (!formData.descripcion.trim()) {
      showToast('La descripción del producto es obligatoria', 'info');
      setActiveSection('identificacion');
      return;
    }

    setIsSaving(true);
    try {
      const url = isEdit ? `/api/ventas/productos/${producto.id}` : '/api/ventas/productos';
      const method = isEdit ? 'PUT' : 'POST';

      // Clean numeric inputs to avoid NaN / nulls
      const parsedCosto = parseFloat(String(formData.costo)) || 0;
      const parsedRentabilidad = parseFloat(String(formData.rentabilidad)) || 0;
      const parsedPrecioBase = parseFloat(String(formData.precioBase)) || 0;
      const parsedStockMin = parseFloat(String(formData.stockMinimo)) || 0;
      const parsedStockMax = parseFloat(String(formData.stockMaximo)) || 0;
      const parsedStockInicial = parseFloat(String(formData.stockInicial)) || 0;

      const payload = {
        sku: normalizeSku(formData.sku),
        codigoBarras: formData.codigoBarras ? formData.codigoBarras.trim() : null,
        descripcion: formData.descripcion.trim(),
        marcaId: formData.marcaId || null,
        nuevaMarca: formData.nuevaMarca?.trim() || null,
        familiaId: formData.familiaId || null,
        nuevaFamilia: formData.nuevaFamilia?.trim() || null,
        subFamiliaId: formData.subFamiliaId || null,
        nuevaSubFamilia: formData.nuevaSubFamilia?.trim() || null,
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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al guardar producto');
      }

      showToast(isEdit ? 'Producto actualizado con éxito' : 'Producto creado con éxito', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error en la operación', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {isEdit ? 'Editar Producto Comercial' : 'Nuevo Producto Comercial'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEdit ? `Modificando SKU: ${producto.sku}` : 'Carga de datos maestros, comercial e inventario inicial'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-100 dark:border-slate-800 flex gap-2 overflow-x-auto bg-slate-50/30 dark:bg-slate-900/20">
          <button
            type="button"
            onClick={() => setActiveSection('identificacion')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeSection === 'identificacion'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            1. Identificación
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('proveedor')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeSection === 'proveedor'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            2. Proveedor & Costo
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('comercial')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeSection === 'comercial'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            3. Comercial & Precios
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('inventario')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeSection === 'inventario'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            4. Inventario & Stock
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: IDENTIFICACIÓN */}
          {activeSection === 'identificacion' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SKU Interno <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    onBlur={() => {
                      if (formData.sku) {
                        setFormData((prev) => ({ ...prev, sku: normalizeSku(prev.sku) }));
                      }
                    }}
                    placeholder="Ej: 00025"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 uppercase"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Identificador único (los códigos numéricos se completan a 5 dígitos con ceros).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código de Barras (Scanner / PDV)
                  </label>
                  <input
                    type="text"
                    value={formData.codigoBarras}
                    onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                    placeholder="Ej: 7791234567890"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Acepta escaneo directo con lector láser o pistola USB.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción Comercial <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ej: Cable Unipolar 2.5mm Normalizado IRAM Celeste"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Marca */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Marca ({meta.marcas.length})
                  </label>
                  <SearchableSelect
                    options={meta.marcas.map((m) => ({ id: m.id, nombre: m.nombre }))}
                    value={formData.marcaId}
                    onChange={(val) => setFormData({ ...formData, marcaId: val, nuevaMarca: '' })}
                    placeholder="Seleccionar marca..."
                    searchPlaceholder="Buscar marca..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaMarca}
                    onChange={(e) => setFormData({ ...formData, nuevaMarca: e.target.value, marcaId: '' })}
                    placeholder="O escribir nueva marca..."
                    className="w-full h-8 px-2.5 mt-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
                    placeholder="Seleccionar familia..."
                    searchPlaceholder="Buscar familia..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaFamilia}
                    onChange={(e) => setFormData({ ...formData, nuevaFamilia: e.target.value, familiaId: '', subFamiliaId: '' })}
                    placeholder="O escribir nueva familia..."
                    className="w-full h-8 px-2.5 mt-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* SubFamilia (Cascading from selected Familia) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sub-Familia
                  </label>
                  <SearchableSelect
                    options={availableSubFamilias.map((sf) => ({ id: sf.id, nombre: sf.nombre }))}
                    value={formData.subFamiliaId}
                    onChange={(val) => setFormData({ ...formData, subFamiliaId: val, nuevaSubFamilia: '' })}
                    disabled={!formData.familiaId || availableSubFamilias.length === 0}
                    placeholder={
                      !formData.familiaId
                        ? 'Elegí familia primero'
                        : availableSubFamilias.length === 0
                        ? 'Sin subfamilias'
                        : 'Seleccionar subfamilia...'
                    }
                    searchPlaceholder="Buscar subfamilia..."
                  />
                  <input
                    type="text"
                    value={formData.nuevaSubFamilia}
                    onChange={(e) => setFormData({ ...formData, nuevaSubFamilia: e.target.value, subFamiliaId: '' })}
                    placeholder="O escribir nueva subfamilia..."
                    className="w-full h-8 px-2.5 mt-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-background/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: PROVEEDOR */}
          {activeSection === 'proveedor' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Configuración del <strong>Proveedor Principal</strong> de ventas y su costo neto de adquisición.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor Ventas (Principal)
                  </label>
                  <SearchableSelect
                    options={meta.proveedores.map((p) => ({
                      id: p.id,
                      nombre: `${p.razonSocial}${p.nombreFantasia ? ` (${p.nombreFantasia})` : ''} - CUIT: ${p.cuit}`,
                    }))}
                    value={formData.proveedorId}
                    onChange={(val) => setFormData({ ...formData, proveedorId: val })}
                    placeholder="Buscar o seleccionar proveedor..."
                    searchPlaceholder="Buscar por nombre o CUIT..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SKU Proveedor 1
                  </label>
                  <input
                    type="text"
                    value={formData.skuProveedor}
                    onChange={(e) => setFormData({ ...formData, skuProveedor: e.target.value })}
                    placeholder="Ej: ART-FAB-9921"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Costo de Adquisición ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.costo}
                      onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-10 pl-8 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-slate-400">Costo neto antes de IVA.</span>
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
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                      onClick={handleAutoCalcPrecioBase}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Calcular Precio Base
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.rentabilidad}
                      onChange={(e) => setFormData({ ...formData, rentabilidad: e.target.value })}
                      placeholder="30"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="absolute right-3.5 top-2.5 text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Highlight Card: PRECIO BASE DE VENTA */}
              <div className="p-4 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Precio Base de Venta ($ ARS) <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Precio central del producto sobre el cual el sistema y el PDV aplican las listas de precios.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoCalcPrecioBase}
                    className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Costo + Margen
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.precioBase}
                      onChange={(e) => setFormData({ ...formData, precioBase: e.target.value })}
                      placeholder="0.00"
                      className="w-full h-11 pl-8 pr-3.5 rounded-xl border border-primary/30 bg-background text-base font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-background/80 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Formato ARS:</div>
                    <div className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {formData.precioBase !== '' ? formatARS(formData.precioBase) : '$ 0,00'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Rules Preview */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Listas de Precios Configuradas ({meta.listasPrecios.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Calculadas dinámicamente en PDV</span>
                </div>

                {meta.listasPrecios.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No hay listas de precios configuradas. Podés crearlas desde "Precios ▾ → Configurar Listas".
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {meta.listasPrecios.map((lp) => {
                      const numBase = parseFloat(String(formData.precioBase)) || 0;
                      const numCosto = parseFloat(String(formData.costo)) || 0;
                      let simPrice = numBase;
                      if (lp.tipoAjuste === 'PORCENTAJE_COSTO') {
                        simPrice = Math.round(numCosto * (1 + lp.valorAjuste / 100) * 100) / 100;
                      } else if (lp.tipoAjuste === 'MARGEN_COSTO') {
                        const m = Math.min(99.9, lp.valorAjuste);
                        simPrice = Math.round((numCosto / (1 - m / 100)) * 100) / 100;
                      } else if (lp.tipoAjuste === 'DESCUENTO_BASE') {
                        simPrice = Math.round(numBase * (1 - lp.valorAjuste / 100) * 100) / 100;
                      } else if (lp.tipoAjuste === 'RECARGO_BASE') {
                        simPrice = Math.round(numBase * (1 + lp.valorAjuste / 100) * 100) / 100;
                      }

                      return (
                        <div
                          key={lp.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {lp.nombre}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-semibold">
                              {lp.codigo}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {lp.tipoAjuste === 'MANUAL'
                                ? 'Base'
                                : lp.tipoAjuste === 'DESCUENTO_BASE'
                                ? `-${lp.valorAjuste}% Base`
                                : lp.tipoAjuste === 'RECARGO_BASE'
                                ? `+${lp.valorAjuste}% Base`
                                : `Costo +${lp.valorAjuste}%`}
                            </span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {formatARS(simPrice)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 4: INVENTARIO & STOCK */}
          {activeSection === 'inventario' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong>Regla de Integridad de Stock:</strong> El stock actual <strong>NO</strong> se altera libremente desde este formulario.
                  Las modificaciones pasan por operaciones auditadas de movimiento (Ajuste Rápido de Stock o conteo).
                  {!isEdit && ' Para el alta inicial, se creará un movimiento auditable por el stock indicado.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Almacén Asignado
                  </label>
                  <select
                    value={formData.almacenId}
                    onChange={(e) => setFormData({ ...formData, almacenId: e.target.value, ubicacionId: '' })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
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
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Dispara alerta visual de "Stock Bajo".</p>
                </div>

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
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Dispara alerta visual de "Sobre Stock".</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isEdit ? 'Stock Actual (Informativo)' : 'Stock Inicial de Apertura'}
                  </label>
                  <input
                    type="number"
                    disabled={isEdit}
                    min="0"
                    value={formData.stockInicial}
                    onChange={(e) => setFormData({ ...formData, stockInicial: e.target.value })}
                    placeholder="0"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isEdit ? 'Modificar mediante acción "Stock ▾ → Ajuste Rápido"' : 'Se registrará como movimiento inicial.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
