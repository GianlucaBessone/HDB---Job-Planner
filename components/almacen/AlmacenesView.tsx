'use client';

import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  MapPin,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  Boxes,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface UbicacionItem {
  id: string;
  codigo: string;
  nombre: string | null;
  tipo: string | null;
  activo: boolean;
  _count?: { stocks: number; movimientos: number };
}

interface AlmacenItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  responsableNombre: string | null;
  esPredeterminado: boolean;
  activo: boolean;
  createdAt: string;
  _count: {
    ubicaciones: number;
    stocks: number;
    movimientos: number;
  };
  ubicaciones: UbicacionItem[];
}

export default function AlmacenesView() {
  const [almacenes, setAlmacenes] = useState<AlmacenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlmacen, setSelectedAlmacen] = useState<AlmacenItem | null>(null);

  // Modal Almacén (Crear/Editar)
  const [isAlmacenModalOpen, setIsAlmacenModalOpen] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<AlmacenItem | null>(null);
  const [formCodigo, setFormCodigo] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formDireccion, setFormDireccion] = useState('');
  const [formResponsable, setFormResponsable] = useState('');
  const [formPredeterminado, setFormPredeterminado] = useState(false);
  const [formActivo, setFormActivo] = useState(true);
  const [savingAlmacen, setSavingAlmacen] = useState(false);

  // Modal Ubicación (Crear/Editar)
  const [isUbicacionModalOpen, setIsUbicacionModalOpen] = useState(false);
  const [editingUbicacion, setEditingUbicacion] = useState<UbicacionItem | null>(null);
  const [ubiCodigo, setUbiCodigo] = useState('');
  const [ubiNombre, setUbiNombre] = useState('');
  const [ubiTipo, setUbiTipo] = useState('ESTANTERIA');
  const [ubiActivo, setUbiActivo] = useState(true);
  const [savingUbicacion, setSavingUbicacion] = useState(false);

  const fetchAlmacenes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/almacen/almacenes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error cargando almacenes');
      const list: AlmacenItem[] = data.almacenes || [];
      setAlmacenes(list);

      // Si había uno seleccionado, refrescarlo
      if (selectedAlmacen) {
        const found = list.find((a) => a.id === selectedAlmacen.id) || list[0] || null;
        setSelectedAlmacen(found);
      } else if (list.length > 0) {
        setSelectedAlmacen(list[0]);
      }
    } catch (err: any) {
      showToast(err.message || 'Error cargando almacenes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlmacenes();
  }, []);

  // Abrir Modal Almacén para Crear o Editar
  const handleOpenAlmacenModal = (alm?: AlmacenItem) => {
    if (alm) {
      setEditingAlmacen(alm);
      setFormCodigo(alm.codigo);
      setFormNombre(alm.nombre);
      setFormDescripcion(alm.descripcion || '');
      setFormDireccion(alm.direccion || '');
      setFormResponsable(alm.responsableNombre || '');
      setFormPredeterminado(alm.esPredeterminado);
      setFormActivo(alm.activo);
    } else {
      setEditingAlmacen(null);
      setFormCodigo('');
      setFormNombre('');
      setFormDescripcion('');
      setFormDireccion('');
      setFormResponsable('');
      setFormPredeterminado(false);
      setFormActivo(true);
    }
    setIsAlmacenModalOpen(true);
  };

  const handleSaveAlmacen = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAlmacen(true);
    try {
      const payload = {
        codigo: formCodigo.trim().toUpperCase(),
        nombre: formNombre.trim(),
        descripcion: formDescripcion.trim() || null,
        direccion: formDireccion.trim() || null,
        responsableNombre: formResponsable.trim() || null,
        esPredeterminado: formPredeterminado,
        activo: formActivo,
      };

      const url = editingAlmacen ? `/api/almacen/almacenes/${editingAlmacen.id}` : '/api/almacen/almacenes';
      const method = editingAlmacen ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando almacén');

      showToast(editingAlmacen ? 'Almacén actualizado' : 'Almacén creado exitosamente', 'success');
      setIsAlmacenModalOpen(false);
      fetchAlmacenes();
    } catch (err: any) {
      showToast(err.message || 'Error guardando almacén', 'error');
    } finally {
      setSavingAlmacen(false);
    }
  };

  const handleDeactivateAlmacen = async (alm: AlmacenItem) => {
    if (!confirm(`¿Desea desactivar el almacén "${alm.nombre}"?`)) return;

    try {
      const res = await fetch(`/api/almacen/almacenes/${alm.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al desactivar almacén');

      showToast(data.mensaje || 'Almacén desactivado', 'info');
      fetchAlmacenes();
    } catch (err: any) {
      showToast(err.message || 'Error al desactivar', 'error');
    }
  };

  // Abrir Modal Ubicación
  const handleOpenUbicacionModal = (ubi?: UbicacionItem) => {
    if (!selectedAlmacen) return;
    if (ubi) {
      setEditingUbicacion(ubi);
      setUbiCodigo(ubi.codigo);
      setUbiNombre(ubi.nombre || '');
      setUbiTipo(ubi.tipo || 'ESTANTERIA');
      setUbiActivo(ubi.activo);
    } else {
      setEditingUbicacion(null);
      setUbiCodigo('');
      setUbiNombre('');
      setUbiTipo('ESTANTERIA');
      setUbiActivo(true);
    }
    setIsUbicacionModalOpen(true);
  };

  const handleSaveUbicacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlmacen) return;
    setSavingUbicacion(true);
    try {
      const payload = {
        almacenId: selectedAlmacen.id,
        codigo: ubiCodigo.trim().toUpperCase(),
        nombre: ubiNombre.trim() || null,
        tipo: ubiTipo,
        activo: ubiActivo,
      };

      const url = editingUbicacion
        ? `/api/almacen/ubicaciones/${editingUbicacion.id}`
        : '/api/almacen/ubicaciones';
      const method = editingUbicacion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando ubicación');

      showToast(editingUbicacion ? 'Ubicación actualizada' : 'Ubicación creada con éxito', 'success');
      setIsUbicacionModalOpen(false);
      fetchAlmacenes();
    } catch (err: any) {
      showToast(err.message || 'Error guardando ubicación', 'error');
    } finally {
      setSavingUbicacion(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado y Creación */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Maestro de Almacenes y Ubicaciones Físicas
          </h2>
          <p className="text-xs text-slate-500">
            Administre depósitos independientes y la distribución física de pasillos o estanterías
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAlmacenModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Almacén</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de Almacenes */}
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Almacenes ({almacenes.length})
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              <span className="text-xs">Cargando almacenes...</span>
            </div>
          ) : almacenes.length === 0 ? (
            <div className="p-6 text-center text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
              Sin almacenes registrados
            </div>
          ) : (
            almacenes.map((alm) => {
              const isSelected = selectedAlmacen?.id === alm.id;
              return (
                <div
                  key={alm.id}
                  onClick={() => setSelectedAlmacen(alm)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-card border-primary ring-2 ring-primary/20 shadow-sm'
                      : 'bg-card border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                        <Warehouse className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{alm.nombre}</span>
                          {alm.esPredeterminado && (
                            <span className="text-[11px] font-semibold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Predeterminado
                            </span>
                          )}
                          {!alm.activo && (
                            <span className="text-[11px] font-semibold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-slate-400 font-bold block">{alm.codigo}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAlmacenModal(alm);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        title="Editar almacén"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {alm.activo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivateAlmacen(alm);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Desactivar almacén"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {alm.direccion && (
                    <p className="text-[11px] text-slate-500 mt-2 truncate">
                      {alm.direccion}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-1 pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-mono">
                    <div>
                      Ubicaciones: <strong className="text-slate-700 dark:text-slate-300">{alm._count.ubicaciones}</strong>
                    </div>
                    <div>
                      Artículos: <strong className="text-slate-700 dark:text-slate-300">{alm._count.stocks}</strong>
                    </div>
                    <div>
                      Movimientos: <strong className="text-slate-700 dark:text-slate-300">{alm._count.movimientos}</strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel de Ubicaciones del Almacén Seleccionado */}
        <div className="lg:col-span-2 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>Ubicaciones de:</span>
              <strong className="text-slate-800 dark:text-slate-200">{selectedAlmacen?.nombre || 'Seleccione un almacén'}</strong>
            </div>

            {selectedAlmacen && (
              <button
                type="button"
                onClick={() => handleOpenUbicacionModal()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Nueva Ubicación</span>
              </button>
            )}
          </div>

          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 w-32">Código</th>
                    <th className="py-2.5 px-3">Descripción / Referencia</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-right w-20">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!selectedAlmacen || selectedAlmacen.ubicaciones.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        <MapPin className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-600 dark:text-slate-300">Sin ubicaciones físicas creadas</p>
                        <p className="text-[11px] mt-0.5">Agregue estanterías, pasillos o depósitos para organizar el stock.</p>
                      </td>
                    </tr>
                  ) : (
                    selectedAlmacen.ubicaciones.map((ubi) => (
                      <tr key={ubi.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {ubi.codigo}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          {ubi.nombre || '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {ubi.tipo || 'ESTANTERIA'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              ubi.activo
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {ubi.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenUbicacionModal(ubi)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100"
                            title="Editar ubicación"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Almacén */}
      {isAlmacenModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/50-xs animate-in fade-in duration-150">
          <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Warehouse className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingAlmacen ? 'Editar Almacén' : 'Nuevo Almacén'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAlmacenModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAlmacen} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    placeholder="ALM-01"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Depósito Central"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección o Referencia Física
                </label>
                <input
                  type="text"
                  value={formDireccion}
                  onChange={(e) => setFormDireccion(e.target.value)}
                  placeholder="Calle, Nave, Parque Industrial..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Responsable Operativo
                </label>
                <input
                  type="text"
                  value={formResponsable}
                  onChange={(e) => setFormResponsable(e.target.value)}
                  placeholder="Nombre del encargado..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción Adicional
                </label>
                <input
                  type="text"
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Notas operativas..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
                />
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formPredeterminado}
                    onChange={(e) => setFormPredeterminado(e.target.checked)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span>Almacén Predeterminado (para altas y PDV)</span>
                </label>

                {editingAlmacen && (
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formActivo}
                      onChange={(e) => setFormActivo(e.target.checked)}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span>Almacén Activo</span>
                  </label>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAlmacenModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAlmacen}
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {savingAlmacen ? 'Guardando...' : 'Guardar Almacén'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ubicación */}
      {isUbicacionModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/50-xs animate-in fade-in duration-150">
          <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-primary font-bold">
                <MapPin className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingUbicacion ? 'Editar Ubicación' : 'Nueva Ubicación'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUbicacionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUbicacion} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Código de Ubicación <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ubiCodigo}
                  onChange={(e) => setUbiCodigo(e.target.value)}
                  placeholder="Ej: A-01-01, ESTANTE-B3"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción / Referencia
                </label>
                <input
                  type="text"
                  value={ubiNombre}
                  onChange={(e) => setUbiNombre(e.target.value)}
                  placeholder="Pasillo 1 - Nivel Medio"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Ubicación
                </label>
                <select
                  value={ubiTipo}
                  onChange={(e) => setUbiTipo(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background font-semibold"
                >
                  <option value="ESTANTERIA">Estantería</option>
                  <option value="PASILLO">Pasillo</option>
                  <option value="DEPOSITO">Depósito / General</option>
                  <option value="PISO">Piso / Pallet</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              {editingUbicacion && (
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={ubiActivo}
                    onChange={(e) => setUbiActivo(e.target.checked)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span>Ubicación Activa</span>
                </label>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUbicacionModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUbicacion}
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {savingUbicacion ? 'Guardando...' : 'Guardar Ubicación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
