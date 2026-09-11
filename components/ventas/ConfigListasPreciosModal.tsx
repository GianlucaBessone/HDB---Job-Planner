'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Layers,
  Percent,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Settings2,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

export interface ListaPrecioItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  tipoAjuste: 'MANUAL' | 'PORCENTAJE_COSTO' | 'MARGEN_COSTO' | 'DESCUENTO_BASE' | 'RECARGO_BASE';
  valorAjuste: number;
  listaBaseId?: string | null;
  listaBase?: { id: string; codigo: string; nombre: string } | null;
  aplicaA: 'TODOS' | 'FAMILIA' | 'MARCA';
  familiaId?: string | null;
  familia?: { id: string; nombre: string } | null;
  marcaId?: string | null;
  marca?: { id: string; nombre: string } | null;
  activo?: boolean;
  _count?: { precios: number };
}

interface MetaData {
  marcas: Array<{ id: string; nombre: string }>;
  familias: Array<{ id: string; nombre: string }>;
}

interface ConfigListasPreciosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListasUpdated: () => void;
  meta: MetaData;
}

export default function ConfigListasPreciosModal({
  isOpen,
  onClose,
  onListasUpdated,
  meta,
}: ConfigListasPreciosModalProps) {
  const [listas, setListas] = useState<ListaPrecioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingLista, setDeletingLista] = useState<ListaPrecioItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    tipoAjuste: 'MANUAL' as 'MANUAL' | 'PORCENTAJE_COSTO' | 'MARGEN_COSTO' | 'DESCUENTO_BASE' | 'RECARGO_BASE',
    valorAjuste: '' as string | number,
    listaBaseId: '',
    aplicaA: 'TODOS' as 'TODOS' | 'FAMILIA' | 'MARCA',
    familiaId: '',
    marcaId: '',
    orden: '' as string | number,
    sincronizarProductos: true,
  });

  const fetchListas = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/ventas/listas-precios');
      if (!res.ok) throw new Error('Error al cargar listas de precio');
      const data = await res.json();
      setListas(data);
    } catch (err: any) {
      showToast(err.message || 'Error al obtener listas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchListas();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setIsEditing(false);
    setSelectedId(null);
    setFormData({
      nombre: '',
      codigo: '',
      descripcion: '',
      tipoAjuste: 'MANUAL',
      valorAjuste: '',
      listaBaseId: '',
      aplicaA: 'TODOS',
      familiaId: '',
      marcaId: '',
      orden: (listas.length + 1).toString(),
      sincronizarProductos: true,
    });
  };

  const handleStartEdit = (lista: ListaPrecioItem) => {
    setIsEditing(true);
    setSelectedId(lista.id);
    setFormData({
      nombre: lista.nombre,
      codigo: lista.codigo,
      descripcion: lista.descripcion || '',
      tipoAjuste: lista.tipoAjuste || 'MANUAL',
      valorAjuste: lista.valorAjuste !== 0 ? lista.valorAjuste.toString() : '',
      listaBaseId: lista.listaBaseId || '',
      aplicaA: lista.aplicaA || 'TODOS',
      familiaId: lista.familiaId || '',
      marcaId: lista.marcaId || '',
      orden: lista.orden.toString(),
      sincronizarProductos: false,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      showToast('El nombre de la lista es obligatorio', 'info');
      return;
    }
    if (!formData.codigo.trim()) {
      showToast('El código identificador es obligatorio', 'info');
      return;
    }

    if (
      (formData.tipoAjuste === 'DESCUENTO_BASE' || formData.tipoAjuste === 'RECARGO_BASE') &&
      !formData.listaBaseId
    ) {
      showToast('Debe seleccionar la lista base sobre la cual calcular el ajuste', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        codigo: formData.codigo.trim().toUpperCase().replace(/\s+/g, '_'),
        descripcion: formData.descripcion.trim() || null,
        tipoAjuste: formData.tipoAjuste,
        valorAjuste: parseFloat(String(formData.valorAjuste)) || 0,
        listaBaseId:
          formData.tipoAjuste === 'DESCUENTO_BASE' || formData.tipoAjuste === 'RECARGO_BASE'
            ? formData.listaBaseId || null
            : null,
        aplicaA: formData.aplicaA,
        familiaId: formData.aplicaA === 'FAMILIA' ? formData.familiaId || null : null,
        marcaId: formData.aplicaA === 'MARCA' ? formData.marcaId || null : null,
        orden: parseInt(String(formData.orden), 10) || listas.length + 1,
        sincronizarProductos: formData.sincronizarProductos,
      };

      const url = isEditing
        ? `/api/ventas/listas-precios/${selectedId}`
        : '/api/ventas/listas-precios';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al guardar lista de precios');
      }

      showToast(
        isEditing
          ? 'Lista de precios actualizada con éxito'
          : `Lista de precios creada${json.sincronizados ? ` (${json.sincronizados} precios sincronizados)` : ''}`,
        'success'
      );

      resetForm();
      fetchListas();
      onListasUpdated();
    } catch (err: any) {
      showToast(err.message || 'Error en la operación', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalcular = async (listaId: string) => {
    try {
      setRecalculatingId(listaId);
      const res = await fetch(`/api/ventas/listas-precios/${listaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...listas.find((l) => l.id === listaId),
          sincronizarProductos: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al recalcular');

      showToast(
        `Precios recalculados con éxito: ${json.sincronizados ?? 0} productos actualizados`,
        'success'
      );
      fetchListas();
      onListasUpdated();
    } catch (err: any) {
      showToast(err.message || 'Error al recalcular', 'error');
    } finally {
      setRecalculatingId(null);
    }
  };

  const handleDelete = (lista: ListaPrecioItem) => {
    setDeletingLista(lista);
  };

  const handleConfirmDelete = async () => {
    if (!deletingLista) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/ventas/listas-precios/${deletingLista.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error al eliminar lista');
      }

      showToast('Lista de precios desactivada', 'success');
      fetchListas();
      onListasUpdated();
      if (selectedId === deletingLista.id) resetForm();
      setDeletingLista(null);
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar lista', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Configuración de Listas de Precios
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Creá y configurá listas dinámicas con reglas automáticas (% sobre costo, margen o descuentos sobre listas base)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Split View (List left, Form right) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {/* Left Panel: Existing Lists (7 cols) */}
          <div className="lg:col-span-7 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Listas de Precios Activas ({listas.length})
              </h4>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Lista
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-xs">Cargando listas...</span>
              </div>
            ) : listas.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No hay listas configuradas actualmente.
              </div>
            ) : (
              <div className="space-y-3">
                {listas.map((l) => {
                  const isSelected = selectedId === l.id;
                  const isManual = l.tipoAjuste === 'MANUAL';

                  return (
                    <div
                      key={l.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary'
                          : 'border-slate-200 dark:border-slate-800 bg-background hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                              #{l.orden}
                            </span>
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                              {l.nombre}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              ({l.codigo})
                            </span>
                          </div>

                          {/* Rule Badge */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {isManual ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                                Manual (Precios fijos)
                              </span>
                            ) : l.tipoAjuste === 'PORCENTAJE_COSTO' ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/40">
                                Costo +{l.valorAjuste}%
                              </span>
                            ) : l.tipoAjuste === 'MARGEN_COSTO' ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-200 dark:border-blue-800/40">
                                Margen {l.valorAjuste}% s/ Venta
                              </span>
                            ) : l.tipoAjuste === 'DESCUENTO_BASE' ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800/40">
                                -{l.valorAjuste}% s/ {l.listaBase?.nombre || 'Base'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold border border-purple-200 dark:border-purple-800/40">
                                +{l.valorAjuste}% s/ {l.listaBase?.nombre || 'Base'}
                              </span>
                            )}

                            {/* Scope Badge */}
                            {l.aplicaA === 'TODOS' ? (
                              <span className="text-[10px] text-slate-400">Aplica: Todo el Catálogo</span>
                            ) : l.aplicaA === 'FAMILIA' ? (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                Solo Familia: {l.familia?.nombre || 'Definida'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                Solo Marca: {l.marca?.nombre || 'Definida'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isManual && (
                            <button
                              type="button"
                              onClick={() => handleRecalcular(l.id)}
                              disabled={recalculatingId === l.id}
                              title="Recalcular precios de esta lista ahora"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${
                                  recalculatingId === l.id ? 'animate-spin text-primary' : ''
                                }`}
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(l)}
                            title="Editar configuración"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(l)}
                            title="Desactivar lista"
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Create/Edit Form (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-slate-50/50 dark:bg-slate-900/20">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-4 flex items-center gap-2">
              {isEditing ? <Edit2 className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
              {isEditing ? 'Editar Lista de Precio' : 'Nueva Lista de Precio'}
            </h4>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nombre y Código */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de la Lista <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Mayorista VIP, Mostrador, Distribuidor"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código Único <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.codigo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        codigo: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                      })
                    }
                    placeholder="Ej: LISTA_VIP"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Orden de Visualización
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.orden}
                    onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Tipo de Ajuste */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Ajuste o Cálculo <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.tipoAjuste}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipoAjuste: e.target.value as any,
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="MANUAL">Manual (Carga de precio individual)</option>
                  <option value="PORCENTAJE_COSTO">% sobre Costo (Costo + X%)</option>
                  <option value="MARGEN_COSTO">Margen s/ Venta (Costo / (1 - X%))</option>
                  <option value="DESCUENTO_BASE">Descuento sobre Lista Base (-X%)</option>
                  <option value="RECARGO_BASE">Recargo sobre Lista Base (+X%)</option>
                </select>
              </div>

              {/* Valor de Ajuste (%) */}
              {formData.tipoAjuste !== 'MANUAL' && (
                <div className="p-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Porcentaje de Ajuste (%) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.valorAjuste}
                        onChange={(e) =>
                          setFormData({ ...formData, valorAjuste: e.target.value })
                        }
                        placeholder="Ej: 35"
                        className="w-full h-9 pl-3.5 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs">%</span>
                    </div>
                  </div>

                  {/* Lista Base si es descuento o recargo */}
                  {(formData.tipoAjuste === 'DESCUENTO_BASE' ||
                    formData.tipoAjuste === 'RECARGO_BASE') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Lista Base de Referencia <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.listaBaseId}
                        onChange={(e) => setFormData({ ...formData, listaBaseId: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="">-- Seleccionar Lista Base --</option>
                        {listas
                          .filter((l) => l.id !== selectedId)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nombre} ({l.codigo})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Alcance / Aplica A */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alcance de Aplicación
                </label>
                <select
                  value={formData.aplicaA}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      aplicaA: e.target.value as any,
                      familiaId: '',
                      marcaId: '',
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="TODOS">Todo el Catálogo de Productos</option>
                  <option value="FAMILIA">Solo Productos de una Familia específica</option>
                  <option value="MARCA">Solo Productos de una Marca específica</option>
                </select>
              </div>

              {formData.aplicaA === 'FAMILIA' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Familia Asignada <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.familiaId}
                    onChange={(e) => setFormData({ ...formData, familiaId: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">-- Seleccionar Familia --</option>
                    {meta.familias.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.aplicaA === 'MARCA' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Marca Asignada <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.marcaId}
                    onChange={(e) => setFormData({ ...formData, marcaId: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">-- Seleccionar Marca --</option>
                    {meta.marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Checkbox Sincronizar */}
              {formData.tipoAjuste !== 'MANUAL' && (
                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sincronizarProductos}
                    onChange={(e) =>
                      setFormData({ ...formData, sincronizarProductos: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Recalcular y actualizar precios automáticamente para los productos existentes que coincidan con la regla.
                  </span>
                </label>
              )}

              {/* Botones */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Lista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingLista}
        title="¿Desactivar lista de precios?"
        message={`¿Seguro que deseas desactivar la lista "${deletingLista?.nombre}"? Los precios existentes quedarán guardados pero no se mostrará como activa.`}
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        loadingLabel="Desactivando..."
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setDeletingLista(null)}
      />
    </div>
  );
}
