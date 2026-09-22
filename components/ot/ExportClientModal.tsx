'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  FolderGit2,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ExportClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  projects?: { id: string; nombre: string; codigoProyecto?: string }[];
  initialProjectId?: string;
}

export default function ExportClientModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  projects = [],
  initialProjectId = 'TODOS',
}: ExportClientModalProps) {
  const [estado, setEstado] = useState('TODAS');
  const [proyectoId, setProyectoId] = useState(initialProjectId);
  const [periodoPreset, setPeriodoPreset] = useState<'historico' | 'mesActual' | 'mesAnterior' | 'ultimos3Meses' | 'personalizado'>('historico');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (initialProjectId) {
      setProyectoId(initialProjectId);
    }
  }, [initialProjectId]);

  const handlePresetChange = (preset: typeof periodoPreset) => {
    setPeriodoPreset(preset);
    const now = new Date();

    if (preset === 'historico') {
      setFechaDesde('');
      setFechaHasta('');
    } else if (preset === 'mesActual') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setFechaDesde(`${year}-${month}-01`);
      setFechaHasta(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'mesAnterior') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, prevDate.getMonth() + 1, 0).getDate();
      setFechaDesde(`${year}-${month}-01`);
      setFechaHasta(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'ultimos3Meses') {
      const pastDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const year = pastDate.getFullYear();
      const month = String(pastDate.getMonth() + 1).padStart(2, '0');
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      setFechaDesde(`${year}-${month}-01`);
      setFechaHasta(`${now.getFullYear()}-${currentMonth}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (estado !== 'TODAS') params.set('estado', estado);
      if (proyectoId !== 'TODOS') params.set('proyectoId', proyectoId);
      if (fechaDesde) params.set('fechaDesde', fechaDesde);
      if (fechaHasta) params.set('fechaHasta', fechaHasta);

      const url = `/api/ordenes-trabajo/cliente/${clientId}/export?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al generar la exportación');
      }

      // Extract filename from header if present
      const disposition = res.headers.get('Content-Disposition');
      let filename = `OTs_${clientName.replace(/\s+/g, '_')}.${format}`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = decodeURIComponent(match[1]);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast('Reporte exportado exitosamente', 'success');
      onClose();
    } catch (err: any) {
      console.error('Error al exportar:', err);
      showToast(err.message || 'Error al exportar los datos', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Exportar Datos del Cliente
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {clientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
              Formato de Descarga
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  format === 'xlsx'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="text-left">
                  <span className="block">Excel (.xlsx)</span>
                  <span className="text-[10px] font-normal text-slate-400">Multi-hojas con detalles</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  format === 'csv'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Download className="w-4 h-4 text-blue-600" />
                <div className="text-left">
                  <span className="block">CSV (.csv)</span>
                  <span className="text-[10px] font-normal text-slate-400">Texto universal UTF-8</span>
                </div>
              </button>
            </div>
          </div>

          {/* Estado Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Estado de Órdenes de Trabajo
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="TODAS">Todos los estados</option>
              <option value="ABIERTA">Solo Abiertas</option>
              <option value="PAUSADA">Solo Pausadas</option>
              <option value="PENDIENTE_FIRMA">Solo Pendientes de Firma</option>
              <option value="CERRADA">Solo Cerradas</option>
            </select>
          </div>

          {/* Proyecto Filter (if projects available) */}
          {projects.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Proyecto
              </label>
              <select
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="TODOS">Todos los proyectos del cliente</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.codigoProyecto ? `(${p.codigoProyecto})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Period Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Período
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { key: 'historico', label: 'Todo' },
                { key: 'mesActual', label: 'Este mes' },
                { key: 'mesAnterior', label: 'Mes anterior' },
                { key: 'ultimos3Meses', label: 'Últimos 3m' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePresetChange(p.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    periodoPreset === p.key
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Dates range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Desde</span>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setPeriodoPreset('personalizado');
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Hasta</span>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setPeriodoPreset('personalizado');
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
