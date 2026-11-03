'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Ban,
  RotateCcw,
  Boxes,
  Loader2,
  Mail,
  Phone,
  SearchX,
} from 'lucide-react';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import ProveedorVentasFormModal, { ProveedorVentas } from '@/components/ventas/proveedores/ProveedorVentasFormModal';
import { Badge, Button, ConfirmDialogBase, EmptyState, SegmentedControl } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { formatCuit } from '@/lib/ventas/proveedorVentas';

type Estado = 'activos' | 'inactivos' | 'todos';

type AccionPendiente =
  | { tipo: 'eliminar'; proveedor: ProveedorVentas }
  | { tipo: 'baja'; proveedor: ProveedorVentas };

export default function ProveedoresVentasPage() {
  const router = useRouter();

  const [proveedores, setProveedores] = useState<ProveedorVentas[]>([]);
  const [totales, setTotales] = useState({ activos: 0, inactivos: 0 });
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [estado, setEstado] = useState<Estado>('activos');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProveedorVentas | null>(null);

  const [accion, setAccion] = useState<AccionPendiente | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ estado });
      if (debouncedSearch) params.set('q', debouncedSearch);
      const res = await fetch(`/api/ventas/proveedores?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar proveedores');
      setProveedores(data.proveedores || []);
      setTotales(data.totales || { activos: 0, inactivos: 0 });
    } catch (err: any) {
      showToast(err.message || 'Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  }, [estado, debouncedSearch]);

  useEffect(() => {
    loadProveedores();
  }, [loadProveedores]);

  const abrirNuevo = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const abrirEdicion = (p: ProveedorVentas) => {
    setEditing(p);
    setIsFormOpen(true);
  };

  const cambiarEstado = async (p: ProveedorVentas, activo: boolean) => {
    const res = await fetch(`/api/ventas/proveedores/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo cambiar el estado');
    showToast(activo ? `${p.razonSocial} reactivado` : `${p.razonSocial} dado de baja`, 'success');
  };

  const handleReactivar = async (p: ProveedorVentas) => {
    try {
      await cambiarEstado(p, true);
      loadProveedores();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmarAccion = async () => {
    if (!accion) return;
    setProcesando(true);
    try {
      if (accion.tipo === 'baja') {
        await cambiarEstado(accion.proveedor, false);
      } else {
        const res = await fetch(`/api/ventas/proveedores/${accion.proveedor.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el proveedor');
        showToast(`${accion.proveedor.razonSocial} eliminado`, 'success');
      }
      setAccion(null);
      loadProveedores();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcesando(false);
    }
  };

  const totalVisible = estado === 'activos' ? totales.activos : estado === 'inactivos' ? totales.inactivos : totales.activos + totales.inactivos;

  const estadoOptions = useMemo(
    () => [
      { value: 'activos' as const, label: `Activos (${totales.activos})` },
      { value: 'inactivos' as const, label: `Inactivos (${totales.inactivos})` },
      { value: 'todos' as const, label: 'Todos' },
    ],
    [totales]
  );

  const dialogo = (() => {
    if (!accion) return null;
    const p = accion.proveedor;
    if (accion.tipo === 'eliminar') {
      return {
        tone: 'danger' as const,
        title: `¿Eliminar ${p.razonSocial}?`,
        message: 'El proveedor se borra definitivamente. No tiene productos vinculados, así que no afecta costos ni precios.',
        confirmLabel: 'Eliminar',
      };
    }
    const n = p.productosCount || 0;
    return {
      tone: 'warning' as const,
      title: `¿Dar de baja ${p.razonSocial}?`,
      message:
        n > 0
          ? `Tiene ${n} producto${n === 1 ? '' : 's'} vinculado${n === 1 ? '' : 's'}, por eso no se puede eliminar. Al darlo de baja deja de aparecer en los selectores; los productos conservan su costo y SKU de proveedor. Podés reactivarlo cuando quieras.`
          : 'Deja de aparecer en los selectores de productos. Podés reactivarlo cuando quieras.',
      confirmLabel: 'Dar de baja',
    };
  })();

  return (
    <div className="flex flex-col space-y-2">
      <VentasNavTabs currentTab="gestion" />

      {/* Toolbar */}
      <div className="bg-card px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/ventas/gestion')}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors shadow-sm"
              title="Volver a Gestión Comercial"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Volver</span>
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Building2 className="w-4 h-4" />
            </div>
            <h1 className="text-sm md:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Proveedores
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 whitespace-nowrap">
              {totalVisible} {totalVisible === 1 ? 'proveedor' : 'proveedores'}
            </span>
          </div>

          <button
            onClick={abrirNuevo}
            className="flex items-center gap-1 h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, código, CUIT o localidad..."
              aria-label="Buscar proveedores"
              className="w-full h-8 pl-8 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-card text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <SegmentedControl<Estado>
            label="Estado del proveedor"
            options={estadoOptions}
            value={estado}
            onChange={(v) => setEstado(v)}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="flex flex-col bg-card rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse sm:min-w-[760px]">
            <thead className="bg-slate-100/95 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">
              <tr>
                <th className="py-2 px-2.5 w-[90px] hidden sm:table-cell">Código</th>
                <th className="py-2 px-2.5">Proveedor</th>
                <th className="py-2 px-2.5 w-[120px] hidden sm:table-cell">CUIT</th>
                <th className="py-2 px-2.5 w-[150px] hidden lg:table-cell">Cond. IVA</th>
                <th className="py-2 px-2.5 hidden md:table-cell">Contacto</th>
                <th className="py-2 px-2.5 w-[140px] hidden xl:table-cell">Localidad</th>
                <th className="py-2 px-2.5 w-[72px] sm:w-[90px] text-right">
                  <span className="sm:hidden">Prod.</span>
                  <span className="hidden sm:inline">Productos</span>
                </th>
                <th className="py-2 px-2.5 w-[90px] hidden sm:table-cell">Estado</th>
                <th className="py-2 px-2 w-[96px] sm:w-[112px] text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
              {loading && proveedores.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    <span>Cargando proveedores...</span>
                  </td>
                </tr>
              ) : proveedores.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    {debouncedSearch ? (
                      <EmptyState
                        icon={<SearchX />}
                        title="Ningún proveedor coincide con la búsqueda"
                        description={`No hay resultados para "${debouncedSearch}" en ${estado === 'todos' ? 'el maestro' : `los ${estado}`}.`}
                        action={
                          <Button variant="secondary" size="sm" onClick={() => setSearchTerm('')}>
                            Limpiar búsqueda
                          </Button>
                        }
                      />
                    ) : estado === 'inactivos' ? (
                      <EmptyState
                        icon={<Building2 />}
                        title="No hay proveedores dados de baja"
                        description="Los proveedores que des de baja aparecen acá para reactivarlos."
                      />
                    ) : (
                      <EmptyState
                        icon={<Building2 />}
                        title="Todavía no hay proveedores"
                        description="Cargá los proveedores de ventas para asignarlos a los productos y registrar su costo y SKU."
                        action={
                          <Button size="sm" icon={<Plus />} onClick={abrirNuevo}>
                            Crear el primero
                          </Button>
                        }
                      />
                    )}
                  </td>
                </tr>
              ) : (
                proveedores.map((p) => {
                  const n = p.productosCount || 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => abrirEdicion(p)}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        p.activo ? '' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap hidden sm:table-cell">
                        {p.codigo || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-2.5 max-w-[280px]">
                        <div className={`truncate font-semibold ${p.activo ? 'text-slate-800 dark:text-slate-200' : ''}`} title={p.razonSocial}>
                          {p.razonSocial}
                        </div>
                        {p.nombreFantasia && p.nombreFantasia !== p.razonSocial && (
                          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={p.nombreFantasia}>
                            {p.nombreFantasia}
                          </div>
                        )}
                        {/* En móvil, código, CUIT y estado van debajo del nombre */}
                        <div className="sm:hidden flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {[p.codigo, p.cuit ? formatCuit(p.cuit) : null].filter(Boolean).join(' · ')}
                          {!p.activo && <Badge tone="neutral">Inactivo</Badge>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap hidden sm:table-cell">
                        {p.cuit ? formatCuit(p.cuit) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap hidden lg:table-cell">
                        {p.condicionIva || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-2.5 hidden md:table-cell max-w-[220px]">
                        {p.telefono || p.email ? (
                          <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                            {p.telefono && (
                              <div className="flex items-center gap-1 truncate">
                                <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                                <span className="truncate">{p.telefono}</span>
                              </div>
                            )}
                            {p.email && (
                              <div className="flex items-center gap-1 truncate" title={p.email}>
                                <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                                <span className="truncate">{p.email}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-400 truncate hidden xl:table-cell">
                        {[p.localidad, p.provincia].filter(Boolean).join(', ') || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">
                        {n > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/ventas/gestion?proveedorId=${p.id}`);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                            title="Ver productos de este proveedor"
                          >
                            <Boxes className="w-3 h-3" />
                            {n}
                          </button>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 hidden sm:table-cell">
                        {p.activo ? (
                          <Badge tone="success" dot>
                            Activo
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Inactivo</Badge>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => abrirEdicion(p)}
                            className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors"
                            title="Editar proveedor"
                            aria-label={`Editar ${p.razonSocial}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {p.activo ? (
                            <button
                              onClick={() => setAccion({ tipo: 'baja', proveedor: p })}
                              className="p-1 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                              title="Dar de baja (deja de aparecer en los selectores)"
                              aria-label={`Dar de baja ${p.razonSocial}`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivar(p)}
                              className="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                              title="Reactivar proveedor"
                              aria-label={`Reactivar ${p.razonSocial}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setAccion(n > 0 ? { tipo: 'baja', proveedor: p } : { tipo: 'eliminar', proveedor: p })}
                            disabled={n > 0 && !p.activo}
                            className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            title={n > 0 ? 'Tiene productos vinculados: solo se puede dar de baja' : 'Eliminar definitivamente'}
                            aria-label={`Eliminar ${p.razonSocial}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProveedorVentasFormModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        proveedor={editing}
        onSaved={() => loadProveedores()}
      />

      {dialogo && (
        <ConfirmDialogBase
          open={!!accion}
          onCancel={() => setAccion(null)}
          onConfirm={confirmarAccion}
          tone={dialogo.tone}
          title={dialogo.title}
          message={dialogo.message}
          confirmLabel={dialogo.confirmLabel}
          loading={procesando}
          loadingLabel="Procesando..."
        />
      )}
    </div>
  );
}
