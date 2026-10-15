'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  Calendar,
  Loader2,
  ArrowRight,
  Warehouse,
  Eye,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ConteoSession {
  id: string;
  numero: string;
  tipo: string;
  estado: string;
  almacen: { id: string; nombre: string; codigo: string };
  ubicacion: { id: string; codigo: string } | null;
  observaciones: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
  iniciadoEn: string | null;
  finalizadoEn: string | null;
  confirmadoEn: string | null;
  _count: { detalles: number };
}

interface MetaData {
  almacenes: Array<{ id: string; codigo: string; nombre: string; ubicaciones: Array<{ id: string; codigo: string }> }>;
  familias: Array<{ id: string; nombre: string }>;
}

interface ConteosViewProps {
  meta: MetaData;
}

export default function ConteosView({ meta }: ConteosViewProps) {
  const [conteos, setConteos] = useState<ConteoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEstado, setSelectedEstado] = useState('');
  const [selectedAlmacen, setSelectedAlmacen] = useState('');

  // Modal Crear Conteo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevoAlmacenId, setNuevoAlmacenId] = useState(meta.almacenes[0]?.id || '');
  const [nuevoUbicacionId, setNuevoUbicacionId] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<'GENERAL' | 'UBICACION' | 'FAMILIA' | 'CICLICO'>('GENERAL');
  const [nuevaFamiliaId, setNuevaFamiliaId] = useState('');
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(true);
  const [nuevasObservaciones, setNuevasObservaciones] = useState('');

  const fetchConteos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEstado) params.set('estado', selectedEstado);
      if (selectedAlmacen) params.set('almacenId', selectedAlmacen);

      const res = await fetch(`/api/almacen/conteos?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al listar conteos');
      setConteos(data.conteos || []);
    } catch (err: any) {
      showToast(err.message || 'Error cargando conteos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConteos();
  }, [selectedEstado, selectedAlmacen]);

  const handleCrearConteo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreando(true);
    try {
      const payload: any = {
        almacenId: nuevoAlmacenId,
        tipo: nuevoTipo,
        ubicacionId: nuevoTipo === 'UBICACION' ? nuevoUbicacionId || null : null,
        observaciones: nuevasObservaciones.trim() || undefined,
        alcance: {},
      };

      if (nuevoTipo === 'FAMILIA') {
        payload.alcance.familiaId = nuevaFamiliaId;
      } else if (nuevoTipo === 'CICLICO') {
        payload.alcance.bajoMinimo = soloBajoMinimo;
      }

      const res = await fetch('/api/almacen/conteos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear conteo');

      showToast(data.mensaje || 'Sesión de conteo creada', 'success');
      setIsModalOpen(false);
      fetchConteos();
    } catch (err: any) {
      showToast(err.message || 'Error creando conteo', 'error');
    } finally {
      setCreando(false);
    }
  };

  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'BORRADOR':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
      case 'EN_CONTEO':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-800';
      case 'PENDIENTE_REVISION':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'CONFIRMADO':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'CANCELADO':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const ubicacionesDelAlmacen =
    meta.almacenes.find((a) => a.id === nuevoAlmacenId)?.ubicaciones || [];

  return (
    <div className="space-y-3">
      {/* Barra de Controles */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <select
            value={selectedEstado}
            onChange={(e) => setSelectedEstado(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="">Todos los Estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="EN_CONTEO">En Conteo</option>
            <option value="PENDIENTE_REVISION">Pendiente de Revisión</option>
            <option value="CONFIRMADO">Confirmados</option>
            <option value="CANCELADO">Cancelados</option>
          </select>

          <select
            value={selectedAlmacen}
            onChange={(e) => setSelectedAlmacen(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="">Todos los Almacenes</option>
            {meta.almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Sesión de Conteo</span>
        </button>
      </div>

      {/* Lista de Sesiones de Conteo */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-black text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3">Número Conteo</th>
                <th className="py-2.5 px-3">Almacén / Ubicación</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3 text-center">Items</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3">Responsable</th>
                <th className="py-2.5 px-3">Fecha Creación</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Cargando sesiones de conteo...</span>
                  </td>
                </tr>
              ) : conteos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <ClipboardCheck className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No hay sesiones de conteo</p>
                    <p className="text-[11px] mt-0.5">Inicie una nueva sesión general, por ubicación o cíclica.</p>
                  </td>
                </tr>
              ) : (
                conteos.map((cnt) => (
                  <tr key={cnt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {cnt.numero}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cnt.almacen.nombre}</span>
                      {cnt.ubicacion && (
                        <span className="ml-1 text-[11px] font-mono text-slate-500 font-bold">
                          [{cnt.ubicacion.codigo}]
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                      {cnt.tipo}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {cnt._count.detalles}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getBadgeEstado(
                          cnt.estado
                        )}`}
                      >
                        {cnt.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[130px]">
                      {cnt.creadoPorNombre || 'Sistema'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(cnt.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Link
                        href={`/ventas/almacen/conteos/${cnt.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold text-xs transition-all"
                      >
                        <span>{cnt.estado === 'CONFIRMADO' ? 'Ver Resultado' : 'Operar Conteo'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Sesión de Conteo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    Nueva Sesión de Conteo Físico
                  </h3>
                  <p className="text-[11px] text-slate-500">Defina el alcance de auditoría física</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearConteo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Almacén <span className="text-rose-500">*</span>
                </label>
                <select
                  value={nuevoAlmacenId}
                  onChange={(e) => {
                    setNuevoAlmacenId(e.target.value);
                    setNuevoUbicacionId('');
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background font-bold"
                >
                  {meta.almacenes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Conteo
                </label>
                <select
                  value={nuevoTipo}
                  onChange={(e) => setNuevoTipo(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background font-semibold"
                >
                  <option value="GENERAL">Conteo General (Todos los productos)</option>
                  <option value="UBICACION">Por Ubicación Específica</option>
                  <option value="FAMILIA">Por Familia de Artículos</option>
                  <option value="CICLICO">Conteo Cíclico (Bajo Mínimo)</option>
                </select>
              </div>

              {nuevoTipo === 'UBICACION' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ubicación Específica
                  </label>
                  <select
                    value={nuevoUbicacionId}
                    onChange={(e) => setNuevoUbicacionId(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
                  >
                    <option value="">Seleccione ubicación...</option>
                    {ubicacionesDelAlmacen.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.codigo}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {nuevoTipo === 'FAMILIA' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Familia de Productos
                  </label>
                  <select
                    value={nuevaFamiliaId}
                    onChange={(e) => setNuevaFamiliaId(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
                  >
                    <option value="">Seleccione familia...</option>
                    {meta.familias.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones / Instrucciones de Conteo
                </label>
                <input
                  type="text"
                  value={nuevasObservaciones}
                  onChange={(e) => setNuevasObservaciones(e.target.value)}
                  placeholder="Ej: Auditoría mensual de estantería central..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50"
                >
                  {creando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
