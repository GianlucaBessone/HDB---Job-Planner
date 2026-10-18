'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck,
  Barcode,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Lock,
  XCircle,
  HelpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ConteoDetalleItem {
  id: string;
  productoId: string;
  sku: string;
  codigoBarras: string | null;
  descripcion: string;
  unidad: string;
  unidadDecimales: number;
  ubicacionCodigo: string | null;
  stockTeorico: number;
  cantidadContada: number | null;
  diferencia: number | null;
  estado: string;
  observaciones: string | null;
}

interface ConteoData {
  id: string;
  numero: string;
  almacenId: string;
  almacenNombre: string;
  almacenCodigo: string;
  ubicacionCodigo: string | null;
  tipo: string;
  estado: string;
  observaciones: string | null;
  acumularEscaneos: boolean;
  creadoPorNombre: string | null;
  iniciadoEn: string | null;
  finalizadoEn: string | null;
  confirmadoPorNombre: string | null;
  confirmadoEn: string | null;
  operacionNumero: string | null;
  estadisticas: {
    totalItems: number;
    contados: number;
    pendientes: number;
    conDiferencias: number;
    unidadesSobrantes: number;
    unidadesFaltantes: number;
    porcentajeAvance: number;
  };
}

export default function ConteoTerminalPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [conteo, setConteo] = useState<ConteoData | null>(null);
  const [items, setItems] = useState<ConteoDetalleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProgress, setSavingProgress] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Escáner y modo de conteo
  const [barcodeInput, setBarcodeInput] = useState('');
  const [acumularEscaneo, setAcumularEscaneo] = useState(true);
  const [filtroSoloDiferencias, setFiltroSoloDiferencias] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');

  // Modales
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [observacionesFinales, setObservacionesFinales] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');

  const scanInputRef = useRef<HTMLInputElement>(null);

  const fetchConteo = async () => {
    try {
      const res = await fetch(`/api/almacen/conteos/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener sesión de conteo');

      setConteo(data.conteo);
      setItems(data.items || []);
    } catch (err: any) {
      showToast(err.message || 'Error cargando sesión', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConteo();
  }, [params.id]);

  // Manejo de lectura de código de barras
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;

    // Buscar por código de barras o SKU exacto
    const targetIdx = items.findIndex(
      (it) =>
        (it.codigoBarras && it.codigoBarras.trim() === raw) ||
        it.sku.toUpperCase() === raw.toUpperCase()
    );

    if (targetIdx === -1) {
      showToast(`El código "${raw}" no corresponde a ningún producto en esta sesión de conteo`, 'error');
      setBarcodeInput('');
      return;
    }

    const item = items[targetIdx];
    const prevContada = item.cantidadContada ?? 0;
    const nuevaCantidad = acumularEscaneo ? prevContada + 1 : 1;
    const dif = Math.round((nuevaCantidad - item.stockTeorico) * 10000) / 10000;

    setItems((prev) => {
      const clone = [...prev];
      clone[targetIdx] = {
        ...clone[targetIdx],
        cantidadContada: nuevaCantidad,
        diferencia: dif,
        estado: 'CONTADO',
      };
      return clone;
    });

    showToast(`+1 ${item.sku} (Total: ${nuevaCantidad})`, 'info');
    setBarcodeInput('');
    scanInputRef.current?.focus();
  };

  // Modificación manual de cantidad
  const handleCantidadChange = (idx: number, valorStr: string) => {
    const valNum = valorStr === '' ? null : parseFloat(valorStr);
    setItems((prev) => {
      const clone = [...prev];
      const item = clone[idx];
      const dif = valNum !== null ? Math.round((valNum - item.stockTeorico) * 10000) / 10000 : null;

      clone[idx] = {
        ...item,
        cantidadContada: valNum,
        diferencia: dif,
        estado: valNum !== null ? 'CONTADO' : 'PENDIENTE',
      };
      return clone;
    });
  };

  // Guardar progreso
  const handleGuardarProgreso = async () => {
    setSavingProgress(true);
    try {
      const itemsPayload = items
        .filter((it) => it.cantidadContada !== null)
        .map((it) => ({
          productoId: it.productoId,
          cantidadContada: it.cantidadContada!,
          observaciones: it.observaciones || undefined,
        }));

      const res = await fetch(`/api/almacen/conteos/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar progreso');

      showToast('Progreso de conteo guardado exitosamente', 'success');
      fetchConteo();
    } catch (err: any) {
      showToast(err.message || 'Error guardando progreso', 'error');
    } finally {
      setSavingProgress(false);
    }
  };

  // Finalizar captura y pasar a PENDIENTE_REVISION
  const handleFinalizarCaptura = async () => {
    try {
      await handleGuardarProgreso();
      const res = await fetch(`/api/almacen/conteos/${params.id}/finalizar`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al finalizar captura');

      showToast(data.mensaje || 'Conteo pasado a Pendiente de Revisión', 'success');
      fetchConteo();
    } catch (err: any) {
      showToast(err.message || 'Error al finalizar captura', 'error');
    }
  };

  // Confirmar y aplicar ajustes atómicos
  const handleConfirmarAjuste = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/almacen/conteos/${params.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacionesFinales: observacionesFinales.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al confirmar conteo');

      showToast(data.mensaje || 'Conteo confirmado y existencias ajustadas', 'success');
      setIsConfirmModalOpen(false);
      fetchConteo();
    } catch (err: any) {
      showToast(err.message || 'Error al confirmar conteo', 'error');
    } finally {
      setConfirming(false);
    }
  };

  // Cancelar conteo
  const handleCancelarConteo = async () => {
    if (!motivoCancelacion.trim()) {
      showToast('Debe indicar un motivo de cancelación', 'info');
      return;
    }
    try {
      const res = await fetch(`/api/almacen/conteos/${params.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoCancelacion.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar');

      showToast(data.mensaje || 'Conteo cancelado', 'info');
      setIsCancelModalOpen(false);
      fetchConteo();
    } catch (err: any) {
      showToast(err.message || 'Error cancelando', 'error');
    }
  };

  // Filtrado y Ordenamiento de la grilla de conteo
  const [sortBy, setSortBy] = useState<'sku' | 'descripcion' | 'ubicacionCodigo' | 'stockTeorico' | 'cantidadContada' | 'diferencia' | 'estado'>('sku');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const itemsFiltrados = items
    .filter((it) => {
      if (filtroSoloDiferencias && (it.diferencia === null || it.diferencia === 0)) {
        return false;
      }
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase();
        return (
          it.sku.toLowerCase().includes(q) ||
          it.descripcion.toLowerCase().includes(q) ||
          (it.codigoBarras && it.codigoBarras.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortOrder === 'desc' ? -1 : 1;
      switch (sortBy) {
        case 'descripcion':
          return a.descripcion.localeCompare(b.descripcion) * dir;
        case 'ubicacionCodigo':
          return (a.ubicacionCodigo || '').localeCompare(b.ubicacionCodigo || '') * dir;
        case 'stockTeorico':
          return (a.stockTeorico - b.stockTeorico) * dir;
        case 'cantidadContada':
          return ((a.cantidadContada ?? -1) - (b.cantidadContada ?? -1)) * dir;
        case 'diferencia':
          return ((a.diferencia ?? 0) - (b.diferencia ?? 0)) * dir;
        case 'estado':
          return a.estado.localeCompare(b.estado) * dir;
        case 'sku':
        default:
          return a.sku.localeCompare(b.sku) * dir;
      }
    });

  if (loading || !conteo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <span className="text-xs font-semibold">Cargando terminal de conteo físico...</span>
      </div>
    );
  }

  const esBloqueado = conteo.estado === 'CONFIRMADO' || conteo.estado === 'CANCELADO';
  const esRevision = conteo.estado === 'PENDIENTE_REVISION';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Barra de Navegación y Estado Superior */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/ventas/almacen"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {conteo.numero}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {conteo.tipo}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                    conteo.estado === 'CONFIRMADO'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : conteo.estado === 'PENDIENTE_REVISION'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : conteo.estado === 'CANCELADO'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                  }`}
                >
                  {conteo.estado.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Almacén: <strong>{conteo.almacenNombre}</strong>
                {conteo.ubicacionCodigo && ` • Ubicación: ${conteo.ubicacionCodigo}`}
                {conteo.operacionNumero && ` • Operación vinculada: ${conteo.operacionNumero}`}
              </p>
            </div>
          </div>

          {/* Acciones del Conteo */}
          <div className="flex items-center gap-2">
            {!esBloqueado && (
              <>
                <button
                  type="button"
                  onClick={handleGuardarProgreso}
                  disabled={savingProgress}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-50 whitespace-nowrap"
                >
                  {savingProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Guardar Progreso</span>
                </button>

                {conteo.estado !== 'PENDIENTE_REVISION' ? (
                  <button
                    type="button"
                    onClick={handleFinalizarCaptura}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Finalizar Captura</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar y Ajustar Stock</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap"
                >
                  Cancelar Conteo
                </button>
              </>
            )}

            {conteo.estado === 'CONFIRMADO' && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                <Lock className="w-4 h-4" />
                <span>Sesión Confirmada e Inmutable</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel de Resumen de Impacto en Diferencias */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Artículos</span>
            <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">
              {conteo.estadisticas.totalItems}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Artículos Contados</span>
            <span className="font-mono text-sm font-black text-sky-600 dark:text-sky-400">
              {conteo.estadisticas.contados} ({conteo.estadisticas.porcentajeAvance}%)
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Con Diferencia</span>
            <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
              {conteo.estadisticas.conDiferencias} líneas
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Sobrantes</span>
            <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
              +{conteo.estadisticas.unidadesSobrantes} u.
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30">
            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">Faltantes (Merma)</span>
            <span className="font-mono text-sm font-black text-rose-700 dark:text-rose-400">
              -{conteo.estadisticas.unidadesFaltantes} u.
            </span>
          </div>
        </div>
      </div>

      {/* Terminal de Captura con Lector de Código de Barras */}
      {!esBloqueado && (
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <form onSubmit={handleBarcodeSubmit} className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={scanInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Escanee código de barras o escriba SKU y presione Enter..."
                autoFocus
                className="w-full pl-9 pr-3 h-10 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acumularEscaneo}
                onChange={(e) => setAcumularEscaneo(e.target.checked)}
                className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary"
              />
              <span>Acumular conteo al escanear (+1)</span>
            </label>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 whitespace-nowrap"
            >
              Registrar Scan
            </button>
          </form>
        </div>
      )}

      {/* Grilla de Ítems del Conteo */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {/* Filtros de la grilla */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && filtroTexto) setFiltroTexto('');
              }}
              placeholder="Filtrar en esta lista..."
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs"
            />
            <label className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={filtroSoloDiferencias}
                onChange={(e) => setFiltroSoloDiferencias(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary"
              />
              <span>Ver solo con diferencias ({conteo.estadisticas.conDiferencias})</span>
            </label>
          </div>

          <span className="text-slate-400 font-medium">
            Mostrando <strong>{itemsFiltrados.length}</strong> de {items.length} productos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-black text-slate-500 uppercase tracking-wider select-none whitespace-nowrap">
                {[
                  { key: 'sku', label: 'SKU', className: 'py-2.5 px-3 w-32', align: 'left' },
                  { key: 'descripcion', label: 'Producto', className: 'py-2.5 px-3', align: 'left' },
                  { key: 'ubicacionCodigo', label: 'Ubicación', className: 'py-2.5 px-3 w-28', align: 'left' },
                  { key: 'stockTeorico', label: 'Stock Teórico', className: 'py-2.5 px-3 text-right w-28', align: 'right' },
                  { key: 'cantidadContada', label: 'Cantidad Contada', className: 'py-2.5 px-3 text-center w-36', align: 'center' },
                  { key: 'diferencia', label: 'Diferencia', className: 'py-2.5 px-3 text-right w-28', align: 'right' },
                ].map((col) => {
                  const isSorted = sortBy === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => {
                        if (sortBy === col.key) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(col.key as any);
                          setSortOrder('asc');
                        }
                      }}
                      className={`${col.className} cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${
                        isSorted ? 'text-primary dark:text-primary bg-primary/[0.04]' : ''
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1 ${
                          col.align === 'right' ? 'justify-end w-full' : col.align === 'center' ? 'justify-center w-full' : ''
                        }`}
                      >
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-primary shrink-0" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-primary shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-35 shrink-0" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="py-2.5 px-2 text-center w-14">Unid</th>
                <th
                  onClick={() => {
                    if (sortBy === 'estado') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('estado');
                      setSortOrder('asc');
                    }
                  }}
                  className={`py-2.5 px-3 text-center w-24 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${
                    sortBy === 'estado' ? 'text-primary dark:text-primary bg-primary/[0.04]' : ''
                  }`}
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Estado</span>
                    {sortBy === 'estado' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-primary shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-primary shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-35 shrink-0" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {itemsFiltrados.map((item, idx) => {
                const originalIdx = items.findIndex((it) => it.id === item.id);
                const dif = item.diferencia;
                const tieneDif = dif !== null && dif !== 0;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                      tieneDif ? 'bg-amber-50/30 dark:bg-amber-950/15' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.sku}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 truncate max-w-sm" title={item.descripcion}>
                      {item.descripcion}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {item.ubicacionCodigo || '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                      {item.stockTeorico}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {esBloqueado ? (
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                          {item.cantidadContada !== null ? item.cantidadContada : '—'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.cantidadContada !== null ? item.cantidadContada : ''}
                          onChange={(e) => handleCantidadChange(originalIdx, e.target.value)}
                          placeholder="Sin contar"
                          className="w-28 h-8 px-2 text-right font-mono text-xs font-black rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs font-bold whitespace-nowrap">
                      {dif !== null ? (
                        dif > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center">
                            <TrendingUp className="w-3.5 h-3.5 mr-0.5 inline" />
                            +{dif}
                          </span>
                        ) : dif < 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 inline-flex items-center">
                            <TrendingDown className="w-3.5 h-3.5 mr-0.5 inline" />
                            {dif}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-[10px] text-slate-500 uppercase">
                      {item.unidad}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.estado === 'CONTADO'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmar y Ajustar */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-primary">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Confirmar Sesión de Conteo {conteo.numero}
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                Impacto en existencias:
              </div>
              <p className="text-amber-800 dark:text-amber-300">
                Se generarán movimientos automáticos e inmutables para las <strong>{conteo.estadisticas.conDiferencias} líneas con diferencia</strong>.
              </p>
              <div className="font-mono text-[11px] pt-1">
                Sobrantes: +{conteo.estadisticas.unidadesSobrantes} u. | Faltantes: -{conteo.estadisticas.unidadesFaltantes} u.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observaciones Finales de Cierre (Opcional)
              </label>
              <textarea
                rows={3}
                value={observacionesFinales}
                onChange={(e) => setObservacionesFinales(e.target.value)}
                placeholder="Observaciones de auditoría o causas identificadas..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={confirming}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Volver a revisar
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={handleConfirmarAjuste}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50"
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Aplicando Ajustes...
                  </>
                ) : (
                  'Confirmar y Ajustar Stock'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar Conteo */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Cancelar Conteo {conteo.numero}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              El conteo se marcará como <strong>CANCELADO</strong> y no tendrá ningún impacto sobre las existencias reales.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Motivo Obligatorio de Cancelación <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Indique la justificación para cancelar este conteo..."
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-background"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3 py-2 text-xs font-bold text-slate-600 rounded-xl"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={!motivoCancelacion.trim()}
                onClick={handleCancelarConteo}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
