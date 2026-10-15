'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  RotateCcw,
  Eye,
  Calendar,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface MovimientoItem {
  id: string;
  numero: string;
  fecha: string;
  productoId: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  unidad: string;
  tipo: string;
  almacenNombre: string;
  almacenCodigo: string;
  ubicacionCodigo: string | null;
  almacenOrigenNombre: string | null;
  almacenDestinoNombre: string | null;
  cantidad: number;
  variacion: number;
  stockAnterior: number;
  stockPosterior: number;
  motivo: string | null;
  observaciones: string | null;
  referencia: string | null;
  referenciaTipo: string | null;
  usuarioNombre: string;
  estado: string;
  esRevertido: boolean;
  reversadoPorNumero: string | null;
  esReversa: boolean;
  reversaDeNumero: string | null;
}

interface MetaData {
  almacenes: Array<{ id: string; codigo: string; nombre: string }>;
}

interface MovimientosViewProps {
  meta: MetaData;
  initialSku?: string;
}

export default function MovimientosView({ meta, initialSku }: MovimientosViewProps) {
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [skuSearch, setSkuSearch] = useState(initialSku || '');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [selectedAlmacen, setSelectedAlmacen] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [motivoSearch, setMotivoSearch] = useState('');

  // Detalle & Reversión
  const [selectedMov, setSelectedMov] = useState<MovimientoItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [reversarMov, setReversarMov] = useState<MovimientoItem | null>(null);
  const [motivoReversa, setMotivoReversa] = useState('');
  const [isReverting, setIsReverting] = useState(false);

  const fetchMovimientos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (skuSearch.trim()) params.set('sku', skuSearch.trim());
      if (selectedTipo) params.set('tipo', selectedTipo);
      if (selectedAlmacen) params.set('almacenId', selectedAlmacen);
      if (fechaDesde) params.set('fechaDesde', fechaDesde);
      if (fechaHasta) params.set('fechaHasta', fechaHasta);
      if (motivoSearch.trim()) params.set('motivo', motivoSearch.trim());
      params.set('page', String(page));
      params.set('limit', '50');

      const res = await fetch(`/api/almacen/movimientos?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al listar movimientos');

      setMovimientos(data.movimientos || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      showToast(err.message || 'Error cargando historial de movimientos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovimientos();
  }, [page, selectedTipo, selectedAlmacen, fechaDesde, fechaHasta]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMovimientos();
  };

  // Reversión
  const handleConfirmReversion = async () => {
    if (!reversarMov) return;
    if (!motivoReversa.trim()) {
      showToast('Debe ingresar un motivo obligatorio para la reversión', 'info');
      return;
    }

    setIsReverting(true);
    try {
      const res = await fetch(`/api/almacen/movimientos/${reversarMov.id}/revertir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoReversa.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al revertir movimiento');

      showToast(data.mensaje || 'Movimiento revertido correctamente', 'success');
      setReversarMov(null);
      setMotivoReversa('');
      fetchMovimientos();
    } catch (err: any) {
      showToast(err.message || 'Error en reversión', 'error');
    } finally {
      setIsReverting(false);
    }
  };

  // Exportar CSV exacto
  const handleExportCSV = () => {
    if (movimientos.length === 0) {
      showToast('No hay movimientos para exportar con los filtros actuales', 'info');
      return;
    }

    const headers = [
      'N° Movimiento',
      'Fecha',
      'SKU',
      'Producto',
      'Tipo',
      'Almacén',
      'Ubicación',
      'Cantidad',
      'Variación Saldo',
      'Stock Anterior',
      'Stock Posterior',
      'Usuario',
      'Motivo',
      'Referencia',
      'Estado',
    ];

    const rows = movimientos.map((m) => [
      `"${m.numero || m.id}"`,
      `"${new Date(m.fecha).toLocaleString()}"`,
      `"${m.sku}"`,
      `"${m.descripcion.replace(/"/g, '""')}"`,
      `"${m.tipo}"`,
      `"${m.almacenNombre}"`,
      `"${m.ubicacionCodigo || ''}"`,
      m.cantidad,
      m.variacion,
      m.stockAnterior,
      m.stockPosterior,
      `"${m.usuarioNombre}"`,
      `"${(m.motivo || '').replace(/"/g, '""')}"`,
      `"${(m.referencia || '').replace(/"/g, '""')}"`,
      `"${m.estado}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Movimientos_Kardex_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte de movimientos exportado exitosamente', 'success');
  };

  return (
    <div className="space-y-3">
      {/* Filtros Compactos */}
      <form onSubmit={handleSearchSubmit} className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          {/* Búsqueda por SKU o Producto */}
          <div className="sm:col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              placeholder="Filtrar por SKU o Producto..."
              className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          {/* Tipo de Movimiento */}
          <div>
            <select
              value={selectedTipo}
              onChange={(e) => {
                setSelectedTipo(e.target.value);
                setPage(1);
              }}
              className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos los Tipos</option>
              <option value="STOCK_INICIAL">Stock Inicial</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SALIDA">Salida</option>
              <option value="AJUSTE_POSITIVO">Ajuste (+)</option>
              <option value="AJUSTE_NEGATIVO">Ajuste (-)</option>
              <option value="TRANSFERENCIA_ENTRADA">Transf. Entrada</option>
              <option value="TRANSFERENCIA_SALIDA">Transf. Salida</option>
              <option value="CONTEO">Conteo Físico</option>
              <option value="REVERSA">Reversa</option>
            </select>
          </div>

          {/* Almacén */}
          <div>
            <select
              value={selectedAlmacen}
              onChange={(e) => {
                setSelectedAlmacen(e.target.value);
                setPage(1);
              }}
              className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos Almacenes</option>
              {meta.almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Fechas */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPage(1);
              }}
              className="w-full h-8 px-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-background font-mono"
              title="Fecha Desde"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPage(1);
              }}
              className="w-full h-8 px-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-background font-mono"
              title="Fecha Hasta"
            />
            <button
              type="button"
              onClick={handleExportCSV}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Exportar CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fetchMovimientos}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Refrescar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </form>

      {/* Tabla Kardex */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-black text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-2.5">Comprobante</th>
                <th className="py-2.5 px-2.5">SKU</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-2.5 text-center">Tipo</th>
                <th className="py-2.5 px-2.5">Almacén</th>
                <th className="py-2.5 px-2 text-right">Variación</th>
                <th className="py-2.5 px-2 text-right hidden sm:table-cell">Ant.</th>
                <th className="py-2.5 px-2 text-right">Nuevo</th>
                <th className="py-2.5 px-2.5 hidden md:table-cell">Usuario</th>
                <th className="py-2.5 px-2.5 hidden lg:table-cell">Motivo</th>
                <th className="py-2.5 px-2 text-right w-16">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Cargando movimientos de inventario...</span>
                  </td>
                </tr>
              ) : movimientos.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400">
                    <AlertCircle className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Sin movimientos registrados</p>
                    <p className="text-[11px] mt-0.5">No se encontraron movimientos para los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => {
                  const isPositivo = m.variacion > 0;
                  const isNegativo = m.variacion < 0;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {new Date(m.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {m.numero || 'LEGACY'}
                        {m.esRevertido && (
                          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 font-extrabold uppercase">
                            Revertido
                          </span>
                        )}
                        {m.esReversa && (
                          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-extrabold uppercase">
                            Reversa
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {m.sku}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate" title={m.descripcion}>
                        {m.descripcion}
                      </td>
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                          {m.tipo.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {m.almacenNombre}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 font-mono text-xs font-black">
                          {isPositivo ? (
                            <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center">
                              <ArrowDownLeft className="w-3.5 h-3.5 inline mr-0.5" />
                              +{m.variacion} {m.unidad}
                            </span>
                          ) : isNegativo ? (
                            <span className="text-rose-600 dark:text-rose-400 inline-flex items-center">
                              <ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5" />
                              {m.variacion} {m.unidad}
                            </span>
                          ) : (
                            <span className="text-slate-500">0 {m.unidad}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-500 hidden sm:table-cell">
                        {m.stockAnterior}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {m.stockPosterior}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 hidden md:table-cell truncate max-w-[120px]">
                        {m.usuarioNombre}
                      </td>
                      <td className="py-2 px-2.5 text-slate-500 hidden lg:table-cell truncate max-w-xs" title={m.motivo || ''}>
                        {m.motivo || '—'}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedMov(m);
                              setIsDetailOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!m.esRevertido && !m.esReversa && m.tipo !== 'STOCK_INICIAL' && (
                            <button
                              onClick={() => {
                                setReversarMov(m);
                                setMotivoReversa('');
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Revertir este movimiento"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
          <span>
            Total: <strong>{total}</strong> movimientos auditados
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-background disabled:opacity-40 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Anterior
            </button>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-background disabled:opacity-40 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detalle de Movimiento */}
      {isDetailOpen && selectedMov && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    Comprobante {selectedMov.numero}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {new Date(selectedMov.fecha).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Producto</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedMov.sku}</span>
                <p className="text-slate-600 dark:text-slate-300 truncate font-medium">{selectedMov.descripcion}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Almacén y Ubicación</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{selectedMov.almacenNombre}</p>
                <p className="text-slate-500 font-mono text-[11px]">{selectedMov.ubicacionCodigo || 'Sin ubicación específica'}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tipo y Variación</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMov.tipo}</span>
                <p className="font-mono font-black text-sm text-primary mt-0.5">
                  {selectedMov.variacion > 0 ? `+${selectedMov.variacion}` : selectedMov.variacion} {selectedMov.unidad}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldos Auditados</span>
                <p className="font-mono text-slate-600 dark:text-slate-300">Anterior: <strong>{selectedMov.stockAnterior}</strong></p>
                <p className="font-mono text-slate-900 dark:text-slate-100 font-black">Posterior: <strong>{selectedMov.stockPosterior}</strong></p>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Motivo / Justificación</span>
              <p className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-medium">
                {selectedMov.motivo || 'Sin motivo especificado'}
              </p>
            </div>

            {selectedMov.referencia && (
              <div className="space-y-1 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Referencia Documental</span>
                <p className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 font-mono text-slate-700 dark:text-slate-300">
                  {selectedMov.referencia} {selectedMov.referenciaTipo ? `(${selectedMov.referenciaTipo})` : ''}
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reversión */}
      {reversarMov && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Revertir Movimiento {reversarMov.numero}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Esta acción creará un contra-movimiento de tipo <strong>REVERSA</strong> que revertirá el impacto de{' '}
              <strong className="text-foreground">{reversarMov.variacion > 0 ? `+${reversarMov.variacion}` : reversarMov.variacion} {reversarMov.unidad}</strong>{' '}
              sobre el producto <strong>{reversarMov.sku}</strong> en <strong>{reversarMov.almacenNombre}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Motivo Obligatorio de Reversión <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={motivoReversa}
                onChange={(e) => setMotivoReversa(e.target.value)}
                placeholder="Indique claramente por qué se revierte este movimiento..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-background focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isReverting}
                onClick={() => setReversarMov(null)}
                className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReverting || !motivoReversa.trim()}
                onClick={handleConfirmReversion}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                {isReverting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Revirtiendo...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Confirmar Reversión
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
