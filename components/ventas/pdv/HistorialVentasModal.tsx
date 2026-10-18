'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Calendar,
  History,
  FileText,
  Ban,
  Printer,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  AlertTriangle,
  Receipt,
  User,
  Clock,
  RotateCcw,
  Truck,
  PackageCheck,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import GenerarRemitoModal from '@/components/ventas/pdv/GenerarRemitoModal';
import ImprimirRemitoModal from '@/components/ventas/pdv/ImprimirRemitoModal';
import PendientesEntregaModal from '@/components/ventas/pdv/PendientesEntregaModal';

interface HistorialVentasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerComprobante: (venta: any) => void;
  currentUserRole?: string;
  currentUserId?: string;
}

export default function HistorialVentasModal({
  isOpen,
  onClose,
  onVerComprobante,
  currentUserRole,
  currentUserId,
}: HistorialVentasModalProps) {
  const [ventas, setVentas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Ordenamiento de columnas
  const [sortBy, setSortBy] = useState<string>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Venta seleccionada para ver detalle
  const [ventaDetalle, setVentaDetalle] = useState<any | null>(null);

  // Remitos y Pendientes
  const [ventaParaRemito, setVentaParaRemito] = useState<any | null>(null);
  const [remitoParaImprimir, setRemitoParaImprimir] = useState<any | null>(null);
  const [showPendientesModal, setShowPendientesModal] = useState(false);

  // Anulación
  const [ventaAAnular, setVentaAAnular] = useState<any | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [isAnulando, setIsAnulando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchVentas();
  }, [isOpen, search, filtroEstado, filtroEstadoPago, fechaDesde, fechaHasta, page]);

  const fetchVentas = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroEstadoPago) params.set('estadoPago', filtroEstadoPago);
      if (fechaDesde) params.set('fechaDesde', fechaDesde);
      if (fechaHasta) params.set('fechaHasta', fechaHasta);
      params.set('page', String(page));
      params.set('limit', '15');

      const res = await fetch(`/api/ventas/pdv/ventas?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVentas(data.ventas || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
      showToast('Error al cargar historial de ventas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerDetalle = async (id: string) => {
    try {
      const res = await fetch(`/api/ventas/pdv/ventas/${id}`);
      if (res.ok) {
        const data = await res.json();
        setVentaDetalle(data);
      }
    } catch (e) {
      showToast('Error al obtener detalle de la venta', 'error');
    }
  };

  const handleConfirmarAnulacion = async () => {
    if (!ventaAAnular) return;
    if (!motivoAnulacion.trim() || motivoAnulacion.trim().length < 3) {
      showToast('Debe ingresar un motivo de anulación válido (mín. 3 caracteres)', 'error');
      return;
    }

    setIsAnulando(true);
    try {
      const res = await fetch(`/api/ventas/pdv/ventas/${ventaAAnular.id}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo: motivoAnulacion.trim(),
          supervisorPin: supervisorPin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al anular la venta');
      }

      showToast(`Venta ${ventaAAnular.numero} anulada correctamente`, 'success');
      setVentaAAnular(null);
      setMotivoAnulacion('');
      setSupervisorPin('');
      if (ventaDetalle?.id === ventaAAnular.id) {
        setVentaDetalle(data.venta);
      }
      fetchVentas();
    } catch (err: any) {
      showToast(err.message || 'Error al anular venta', 'error');
    } finally {
      setIsAnulando(false);
    }
  };

  const formatARS = (val: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(val || 0);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(['fecha', 'total', 'items'].includes(col) ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (col: string) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-30 shrink-0" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
    );
  };

  const sortedVentas = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...ventas].sort((a, b) => {
      switch (sortBy) {
        case 'numero':
          return (a.numero || '').localeCompare(b.numero || '', 'es', { numeric: true }) * dir;
        case 'fecha':
          return (new Date(a.fecha || a.createdAt || 0).getTime() - new Date(b.fecha || b.createdAt || 0).getTime()) * dir;
        case 'clienteNombre':
          return (a.clienteNombre || '').localeCompare(b.clienteNombre || '', 'es', { sensitivity: 'base' }) * dir;
        case 'vendedorNombre':
          return (a.vendedorNombre || '').localeCompare(b.vendedorNombre || '', 'es', { sensitivity: 'base' }) * dir;
        case 'items':
          return ((a.items?.length || 0) - (b.items?.length || 0)) * dir;
        case 'total':
          return ((a.total || 0) - (b.total || 0)) * dir;
        case 'estadoPago':
          return (a.estadoPago || '').localeCompare(b.estadoPago || '', 'es') * dir;
        case 'estadoEntrega':
          return (a.estadoEntrega || '').localeCompare(b.estadoEntrega || '', 'es') * dir;
        case 'estado':
          return (a.estado || '').localeCompare(b.estado || '', 'es') * dir;
        default:
          return 0;
      }
    });
  }, [ventas, sortBy, sortOrder]);

  // Atajo de teclado: Escape para cerrar submodales o el modal principal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (remitoParaImprimir) {
          setRemitoParaImprimir(null);
        } else if (ventaParaRemito) {
          setVentaParaRemito(null);
        } else if (showPendientesModal) {
          setShowPendientesModal(false);
        } else if (ventaDetalle) {
          setVentaDetalle(null);
        } else if (ventaAAnular) {
          setVentaAAnular(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    remitoParaImprimir,
    ventaParaRemito,
    showPendientesModal,
    ventaDetalle,
    ventaAAnular,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-card w-[98vw] max-w-none h-[96vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Historial y Consulta de Ventas
              </h3>
              <p className="text-[11px] text-slate-400">
                Registro histórico inmutable de ventas emitidas en el Punto de Venta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, vendedor o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && search) {
                  e.stopPropagation();
                  setSearch('');
                }
              }}
              className="w-full pl-9 pr-8 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-36">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="">Estado: Todos</option>
              <option value="CONFIRMADA">Confirmadas</option>
              <option value="ANULADA">Anuladas</option>
            </select>
          </div>

          <div className="w-36">
            <select
              value={filtroEstadoPago}
              onChange={(e) => setFiltroEstadoPago(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-card border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="">Pago: Todos</option>
              <option value="PAGADO">Pagado</option>
              <option value="PARCIAL">Pago Parcial</option>
              <option value="PENDIENTE">Pendiente (CC)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-2 py-1 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              title="Fecha Desde"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="px-2 py-1 bg-card border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              title="Fecha Hasta"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPendientesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs border border-amber-300/40 transition-colors shrink-0 whitespace-nowrap"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Pendientes de Entrega</span>
          </button>

          {(search || filtroEstado || filtroEstadoPago || fechaDesde || fechaHasta) && (
            <button
              onClick={() => {
                setSearch('');
                setFiltroEstado('');
                setFiltroEstadoPago('');
                setFechaDesde('');
                setFechaHasta('');
                setPage(1);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tabla / Lista de Ventas */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Cargando ventas...</span>
            </div>
          ) : sortedVentas.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No se encontraron ventas registradas con los filtros aplicados.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px] select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('numero')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Número</span>
                        {renderSortIcon('numero')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('fecha')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Fecha y Hora</span>
                        {renderSortIcon('fecha')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('clienteNombre')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Cliente</span>
                        {renderSortIcon('clienteNombre')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('vendedorNombre')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Vendedor</span>
                        {renderSortIcon('vendedorNombre')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('items')}
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Items</span>
                        {renderSortIcon('items')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('total')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center justify-end gap-1">
                        <span>Total</span>
                        {renderSortIcon('total')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('estadoPago')}
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Pago</span>
                        {renderSortIcon('estadoPago')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('estadoEntrega')}
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Entrega</span>
                        {renderSortIcon('estadoEntrega')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('estado')}
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Estado</span>
                        {renderSortIcon('estado')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {sortedVentas.map((v) => {
                    const fechaObj = new Date(v.fecha || v.createdAt);
                    return (
                      <tr
                        key={v.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {v.numero}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {fechaObj.toLocaleDateString('es-AR')}{' '}
                          <span className="text-[10px] text-slate-400">
                            {fechaObj.toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200 max-w-[160px] truncate">
                            {v.clienteNombre}
                          </div>
                          {v.clienteIdentificacion && (
                            <div className="text-[10px] text-slate-400">
                              {v.clienteIdentificacion}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                          {v.vendedorNombre || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {v.items?.length || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatARS(v.total)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {v.estadoPago === 'PAGADO' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Pagado
                            </span>
                          ) : v.estadoPago === 'PARCIAL' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Parcial ({formatARS(v.saldoPendiente)})
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                              Pendiente (CC)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {v.estadoEntrega === 'ENTREGADO' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Entregado
                            </span>
                          ) : v.estadoEntrega === 'PARCIAL' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                              Parcial
                            </span>
                          ) : v.estadoEntrega === 'CANCELADO' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Cancelado
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              v.estado === 'ANULADA'
                                ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {v.estado}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => handleVerDetalle(v.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onVerComprobante(v)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                            title="Imprimir Comprobante"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {v.estado !== 'ANULADA' && (
                            <button
                              onClick={() => {
                                const pend = (v.items || []).some((it: any) => {
                                  const e = it.cantidadEntregada || 0;
                                  const c = it.cantidadCancelada || 0;
                                  return it.cantidad - e - c > 0;
                                });
                                if (!pend && v.remitos && v.remitos.length > 0) {
                                  const rem0 = v.remitos[0];
                                  setRemitoParaImprimir({
                                    ...rem0,
                                    items: rem0.items || [],
                                    venta: rem0.venta || v,
                                    clienteNombre: rem0.clienteNombre || v.clienteNombre,
                                    clienteIdentificacion: rem0.clienteIdentificacion || v.clienteIdentificacion,
                                    clienteDireccion: rem0.clienteDireccion || v.clienteDireccion,
                                    clienteTelefono: rem0.clienteTelefono || v.clienteTelefono,
                                    vendedorNombre: rem0.vendedorNombre || v.vendedorNombre || v.vendedor?.nombreCompleto,
                                  });
                                } else {
                                  setVentaParaRemito(v);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                              title="Remito de Entrega (Conteo y Firma)"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </button>
                          )}
                          {v.estado !== 'ANULADA' && (
                            <button
                              onClick={() => {
                                setVentaAAnular(v);
                                setMotivoAnulacion('');
                                setSupervisorPin('');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                              title="Anular Venta"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal interno para Ver Detalle completo */}
        {ventaDetalle && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-card w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Detalle de Venta {ventaDetalle.numero}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Cliente: {ventaDetalle.clienteNombre} • Vendedor: {ventaDetalle.vendedorNombre || '—'}
                  </p>
                </div>
                <button
                  onClick={() => setVentaDetalle(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-4 flex-1 text-xs">
                {/* Tabla de ítems con cantidades entregadas */}
                <div>
                  <h5 className="text-[11px] font-black uppercase text-slate-500 mb-2">
                    Productos Registrados
                  </h5>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold text-[10px]">
                        <tr>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Descripción</th>
                          <th className="p-2 text-center">Cant</th>
                          <th className="p-2 text-center">Entregado</th>
                          <th className="p-2 text-right">P. Unit</th>
                          <th className="p-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {ventaDetalle.items?.map((it: any) => (
                          <tr key={it.id}>
                            <td className="p-2 font-mono text-slate-500">{it.sku}</td>
                            <td className="p-2 font-medium">{it.descripcion}</td>
                            <td className="p-2 text-center font-bold">
                              {it.cantidad} {it.unidad || ''}
                            </td>
                            <td className="p-2 text-center text-emerald-600 font-bold">
                              {it.cantidadEntregada || 0} {it.unidad || ''}
                            </td>
                            <td className="p-2 text-right">{formatARS(it.precioUnitario)}</td>
                            <td className="p-2 text-right font-black">{formatARS(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Remitos de Entrega emitidos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-[11px] font-black uppercase text-slate-500">
                      Remitos de Entrega de Materiales
                    </h5>
                    {ventaDetalle.estado !== 'ANULADA' && (
                      <button
                        type="button"
                        onClick={() => {
                          setVentaParaRemito(ventaDetalle);
                          setVentaDetalle(null);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Generar Nuevo Remito</span>
                      </button>
                    )}
                  </div>

                  {!ventaDetalle.remitos || ventaDetalle.remitos.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                      No se han emitido remitos de entrega física para esta venta aún.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {ventaDetalle.remitos.map((rem: any) => (
                        <div
                          key={rem.id}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {rem.numero}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Fecha: {rem.fecha ? new Date(rem.fecha).toLocaleDateString('es-AR') : '—'} • Retirado por: {rem.receptorNombre || '—'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRemitoParaImprimir({
                                ...rem,
                                items: rem.items || [],
                                venta: rem.venta || {
                                  id: ventaDetalle.id,
                                  numero: ventaDetalle.numero,
                                  fecha: ventaDetalle.fecha,
                                  estado: ventaDetalle.estado,
                                  items: ventaDetalle.items || [],
                                },
                                clienteNombre: rem.clienteNombre || ventaDetalle.clienteNombre || 'Consumidor Final',
                                clienteIdentificacion: rem.clienteIdentificacion || ventaDetalle.clienteIdentificacion,
                                clienteDireccion: rem.clienteDireccion || ventaDetalle.clienteDireccion,
                                clienteTelefono: rem.clienteTelefono || ventaDetalle.clienteTelefono,
                                vendedorNombre: rem.vendedorNombre || ventaDetalle.vendedorNombre || ventaDetalle.vendedor?.nombreCompleto,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir Remito</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagos */}
                <div>
                  <h5 className="text-[11px] font-black uppercase text-slate-500 mb-2">
                    Medios de Pago
                  </h5>
                  <div className="space-y-1.5">
                    {ventaDetalle.pagos?.map((p: any) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs"
                      >
                        <div>
                          <span className="font-bold capitalize">{p.metodo.replace(/_/g, ' ')}</span>
                          {p.referencia && (
                            <span className="text-[10px] text-slate-400 block">Ref: {p.referencia}</span>
                          )}
                        </div>
                        <span className="font-black">{formatARS(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cuenta Corriente */}
                {ventaDetalle.imputadoCuentaCorriente > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>Saldo Pendiente en Cuenta Corriente:</span>
                      <span>{formatARS(ventaDetalle.imputadoCuentaCorriente)}</span>
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                      Estado de conciliación: {ventaDetalle.cuentaCorrienteConciliada ? 'Conciliada' : 'Pendiente de conciliar'}
                    </div>
                  </div>
                )}

                {/* Si está anulada */}
                {ventaDetalle.estado === 'ANULADA' && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs">
                    <div className="font-bold flex items-center gap-1.5">
                      <Ban className="w-4 h-4 text-red-600" />
                      Venta Anulada
                    </div>
                    <div className="text-[11px] mt-1">
                      Motivo: {ventaDetalle.motivoAnulacion}
                    </div>
                    {ventaDetalle.anuladoEn && (
                      <div className="text-[10px] text-red-600/80 mt-0.5">
                        Fecha: {new Date(ventaDetalle.anuladoEn).toLocaleString('es-AR')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800 mt-4">
                <button
                  onClick={() => {
                    onVerComprobante(ventaDetalle);
                    setVentaDetalle(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Comprobante
                </button>
                <button
                  onClick={() => setVentaDetalle(null)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal interno para Confirmar Anulación */}
        {ventaAAnular && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-card w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <Ban className="w-5 h-5" />
                <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Anular Venta {ventaAAnular.numero}
                </h4>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Esta acción marcará la operación como <strong>ANULADA</strong> con fecha y usuario auditor. Los datos históricos se conservan para auditoría.
              </p>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Motivo de Anulación (obligatorio)
                  </label>
                  <textarea
                    rows={2}
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    placeholder="Ej: Error en cantidad facturada, devolución solicitada por el cliente..."
                    className="w-full px-3 py-2 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-500/30"
                  />
                </div>

                {/* Si el rol actual no es supervisor ni admin, pedir PIN */}
                {!['admin', 'supervisor'].includes((currentUserRole || '').toLowerCase()) && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      PIN de Supervisor Requerido
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={supervisorPin}
                      onChange={(e) => setSupervisorPin(e.target.value)}
                      placeholder="••••"
                      className="w-full px-3 py-2 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-base font-black tracking-widest focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVentaAAnular(null)}
                  disabled={isAnulando}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAnulacion}
                  disabled={isAnulando || !motivoAnulacion.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                >
                  {isAnulando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Anulación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500">
            Total de ventas registradas: <strong>{ventas.length}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal para Generar Remito */}
      {ventaParaRemito && (
        <GenerarRemitoModal
          isOpen={!!ventaParaRemito}
          onClose={() => setVentaParaRemito(null)}
          venta={ventaParaRemito}
          onRemitoGenerado={(nuevoRemito) => {
            setRemitoParaImprimir(nuevoRemito);
            fetchVentas();
          }}
        />
      )}

      {/* Modal para Imprimir Remito */}
      {remitoParaImprimir && (
        <ImprimirRemitoModal
          isOpen={!!remitoParaImprimir}
          onClose={() => setRemitoParaImprimir(null)}
          remito={remitoParaImprimir}
        />
      )}

      {/* Modal de Pendientes de Entrega */}
      {showPendientesModal && (
        <PendientesEntregaModal
          isOpen={showPendientesModal}
          onClose={() => setShowPendientesModal(false)}
          onEntregar={(v) => {
            setShowPendientesModal(false);
            setVentaParaRemito(v);
          }}
          onVerRemito={(rem) => {
            setRemitoParaImprimir(rem);
          }}
        />
      )}
    </div>
  );
}
