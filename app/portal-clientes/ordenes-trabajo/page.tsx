'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  Clock,
  PauseCircle,
  FileSignature,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Loader2,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { showToast } from '@/components/Toast';

export default function PortalOrdenesTrabajoPage() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('proyectoId') || '';

  const [ots, setOts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [estadoFilter, setEstadoFilter] = useState('TODAS');
  const [search, setSearch] = useState('');

  // Multi-selection for signing
  const [selectedOtIds, setSelectedOtIds] = useState<string[]>([]);

  // Signing Modal State
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [tipoCierre, setTipoCierre] = useState<'PARCIAL' | 'INCOMPLETO'>('PARCIAL');
  const [password, setPassword] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [signSuccessResult, setSignSuccessResult] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedProjectId, estadoFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      let url = `/api/portal-clientes/ordenes-trabajo?limit=100`;
      if (selectedProjectId) url += `&proyectoId=${selectedProjectId}`;
      if (estadoFilter !== 'TODAS') url += `&estado=${estadoFilter}`;

      const [resOts, resProj] = await Promise.all([
        fetch(url),
        fetch('/api/portal-clientes/proyectos'),
      ]);

      if (resOts.ok) {
        const data = await resOts.json();
        setOts(data.data || []);
      }

      if (resProj.ok) {
        const pData = await resProj.json();
        setProjects(pData);
      }
    } catch (err) {
      console.error(err);
      showToast('Error al cargar órdenes de trabajo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredOts = useMemo(() => {
    if (!search.trim()) return ots;
    const q = search.toLowerCase();
    return ots.filter((ot) => {
      const matchOT = ot.numeroOT.toLowerCase().includes(q);
      const matchRef = ot.refCliente ? ot.refCliente.toLowerCase().includes(q) : false;
      const matchProj = ot.proyecto?.nombre.toLowerCase().includes(q);
      const matchSector = ot.sector ? ot.sector.toLowerCase().includes(q) : false;
      return matchOT || matchRef || matchProj || matchSector;
    });
  }, [ots, search]);

  // Can only select non-closed OTs
  const signableOts = useMemo(() => {
    return filteredOts.filter((ot) => ot.estado !== 'CERRADA');
  }, [filteredOts]);

  const toggleSelectOt = (id: string) => {
    setSelectedOtIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllSignable = () => {
    if (selectedOtIds.length === signableOts.length) {
      setSelectedOtIds([]);
    } else {
      setSelectedOtIds(signableOts.map((ot) => ot.id));
    }
  };

  // Summary for selected OTs
  const selectedSummary = useMemo(() => {
    const selectedList = ots.filter((ot) => selectedOtIds.includes(ot.id));
    let totalHoras = 0;
    let totalMO = 0;
    let totalMat = 0;
    let totalCosto = 0;

    for (const ot of selectedList) {
      for (const c of ot.ciclos || []) {
        totalHoras += c.totalHoras || 0;
        totalMO += c.totalManoObra || 0;
        totalMat += c.totalMateriales || 0;
        totalCosto += c.totalGeneral || 0;
      }
    }

    return {
      count: selectedList.length,
      totalHoras: totalHoras.toFixed(1),
      totalMO: Math.round(totalMO),
      totalMat: Math.round(totalMat),
      totalCosto: Math.round(totalCosto),
    };
  }, [ots, selectedOtIds]);

  const handleConfirmSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setSignError('Ingrese su contraseña para confirmar la firma');
      return;
    }

    setSigning(true);
    setSignError('');

    try {
      const res = await fetch('/api/portal-clientes/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otIds: selectedOtIds,
          tipoCierre,
          password,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Firma y cierre procesados con éxito', 'success');
        setSignSuccessResult(data);
        setSelectedOtIds([]);
        loadData();
      } else {
        setSignError(data.error || 'Error al procesar la firma');
      }
    } catch {
      setSignError('Error de red al procesar la firma');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Órdenes de Trabajo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consulte el estado, revise materiales y mano de obra, o firme y cierre ciclos de trabajo.
          </p>
        </div>

        {/* Firmar y Cerrar Ciclo Trigger Button */}
        {selectedOtIds.length > 0 && (
          <button
            onClick={() => {
              setIsSignModalOpen(true);
              setSignError('');
              setSignSuccessResult(null);
              setPassword('');
            }}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in transition-all"
          >
            <FileSignature className="w-4 h-4" />
            Firmar y cerrar ciclo ({selectedOtIds.length})
          </button>
        )}
      </div>

      {/* Quick Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2">
        {['TODAS', 'ABIERTA', 'PAUSADA', 'PENDIENTE_FIRMA', 'CERRADA'].map((st) => (
          <button
            key={st}
            onClick={() => setEstadoFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              estadoFilter === st
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
            }`}
          >
            {st === 'TODAS'
              ? 'Todas'
              : st === 'ABIERTA'
              ? 'Abiertas'
              : st === 'PAUSADA'
              ? 'Pausadas'
              : st === 'PENDIENTE_FIRMA'
              ? 'Pendientes de Firma'
              : 'Cerradas'}
          </button>
        ))}
      </div>

      {/* Filters Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por OT (ej: OT-2026-0001), Ref. Cliente o Sector..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="">Todos los Proyectos Autorizados</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {signableOts.length > 0 && (
          <button
            onClick={selectAllSignable}
            className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap transition-colors"
          >
            {selectedOtIds.length === signableOts.length ? 'Deseleccionar todas' : 'Seleccionar visibles'}
          </button>
        )}
      </div>

      {/* OTs List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-bold">Cargando órdenes...</p>
        </div>
      ) : filteredOts.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
          No se encontraron órdenes de trabajo con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOts.map((ot) => {
            const isSelected = selectedOtIds.includes(ot.id);
            const isClosed = ot.estado === 'CERRADA';
            const totalHoras = ot.ciclos.reduce((acc: number, c: any) => acc + (c.totalHoras || 0), 0);
            const totalCosto = ot.ciclos.reduce((acc: number, c: any) => acc + (c.totalGeneral || 0), 0);

            return (
              <div
                key={ot.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-primary bg-primary/5 dark:bg-primary/5 ring-1 ring-primary'
                    : 'border-slate-200/90 dark:border-slate-800/90'
                }`}
              >
                {/* Selection checkbox and primary OT info */}
                <div className="flex items-start sm:items-center gap-3.5">
                  {!isClosed ? (
                    <button
                      type="button"
                      onClick={() => toggleSelectOt(ot.id)}
                      className={`w-5 h-5 mt-0.5 sm:mt-0 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-primary border-primary text-white'
                          : 'border-slate-300 dark:border-slate-700 hover:border-primary'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  ) : (
                    <div className="w-5 h-5 mt-0.5 sm:mt-0 flex items-center justify-center text-slate-300 dark:text-slate-700 shrink-0">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <Link
                        href={`/portal-clientes/ordenes-trabajo/${ot.id}`}
                        className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 font-mono hover:text-primary transition-colors"
                      >
                        {ot.numeroOT}
                      </Link>

                      {ot.refCliente && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                          Ref: {ot.refCliente}
                        </span>
                      )}

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ot.estado === 'ABIERTA'
                            ? 'bg-blue-500/10 text-blue-600'
                            : ot.estado === 'PAUSADA'
                            ? 'bg-amber-500/10 text-amber-600'
                            : ot.estado === 'PENDIENTE_FIRMA'
                            ? 'bg-purple-500/10 text-purple-600'
                            : 'bg-emerald-500/10 text-emerald-600'
                        }`}
                      >
                        {ot.estado}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        Proyecto: <strong>{ot.proyecto?.nombre}</strong>
                      </span>
                      {ot.sector && <span>· Sector: {ot.sector}</span>}
                      <span>· Fecha: {formatDate(ot.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Metrics and Link */}
                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {totalHoras.toFixed(1)} h
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 font-mono">
                        ${totalCosto.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/portal-clientes/ordenes-trabajo/${ot.id}`}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    Detalle
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: FIRMAR Y CERRAR CICLO */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <FileSignature className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Cierre de Ciclo y Firma
                  </h3>
                  <p className="text-xs text-slate-500">Autorización y firma digital</p>
                </div>
              </div>
              <button
                onClick={() => setIsSignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {signSuccessResult ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                  ¡Firma Criptográfica Registrada!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {signSuccessResult.mensaje}. Se generaron los hashes SHA-256 inalterables correspondientes.
                </p>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-left space-y-1.5 text-xs font-mono">
                  {signSuccessResult.firmadas.map((f: any) => (
                    <div key={f.otId} className="flex justify-between items-center text-[11px]">
                      <span>{f.numeroOT} (C{f.cicloNumero}):</span>
                      <code className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {f.hash.slice(0, 16)}...
                      </code>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setIsSignModalOpen(false)}
                  className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl"
                >
                  Aceptar
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmSignature} className="space-y-4">
                {/* Summary Strip */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Resumen de Selección
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Órdenes</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {selectedSummary.count} OTs
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Horas</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {selectedSummary.totalHoras} h
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Materiales</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-slate-100">
                        ${selectedSummary.totalMat.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Costo Total</span>
                      <strong className="text-sm font-black text-primary font-mono">
                        ${selectedSummary.totalCosto.toLocaleString('es-AR')}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Choice of closure type */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Modalidad de Cierre
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTipoCierre('PARCIAL')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        tipoCierre === 'PARCIAL'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-black mb-1">Cierre Parcial</div>
                      <p className="text-[11px] opacity-80 leading-relaxed font-normal">
                        Cierra y congela el período actual. La OT continúa abierta abriendo un nuevo ciclo.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoCierre('INCOMPLETO')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        tipoCierre === 'INCOMPLETO'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-black mb-1">Cerrar OT Incompleta</div>
                      <p className="text-[11px] opacity-80 leading-relaxed font-normal">
                        Cierra la OT en su estado actual. Para continuar el trabajo se deberá abrir una nueva OT.
                      </p>
                    </button>
                  </div>
                </div>

                {signError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{signError}</span>
                  </div>
                )}

                {/* Password Authorization */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Para confirmar ingrese su contraseña *
                  </label>
                  <input
                    type="password"
                    placeholder="Contraseña del portal..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-400">
                    Su clave autoriza la operación y genera un registro criptográfico SHA-256 inalterable.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSignModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={signing || !password}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    {signing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Firmando y Sellando...
                      </>
                    ) : (
                      <>
                        <FileSignature className="w-4 h-4" />
                        Firmar y Confirmar
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
