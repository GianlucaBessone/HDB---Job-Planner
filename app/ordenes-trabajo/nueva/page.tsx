'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Building2,
  FolderGit2,
  User,
  MapPin,
  Tag,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import SearchableCombobox from '@/components/ui/SearchableCombobox';

export default function NuevaOrdenTrabajoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preClienteId = searchParams.get('clienteId') || '';
  const preProyectoId = searchParams.get('proyectoId') || '';
  const preOtPreviaId = searchParams.get('otPreviaId') || '';

  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [clienteId, setClienteId] = useState(preClienteId);
  const [proyectoId, setProyectoId] = useState(preProyectoId);
  const [refCliente, setRefCliente] = useState('');
  const [sector, setSector] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [reporteTrabajo, setReporteTrabajo] = useState('');
  const [otPreviaId, setOtPreviaId] = useState(preOtPreviaId);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (u) {
        const parsed = JSON.parse(u);
        setCurrentUser(parsed);
        if (!responsableId) setResponsableId(parsed.id);
      }
    } catch {}

    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingInitial(true);
    try {
      const [resClients, resOps] = await Promise.all([
        fetch('/api/ordenes-trabajo/clientes'),
        fetch('/api/operators'),
      ]);

      if (resClients.ok) {
        const cData = await resClients.json();
        setClients(Array.isArray(cData) ? cData : []);
      }

      if (resOps.ok) {
        const oData = await resOps.json();
        setOperators(Array.isArray(oData) ? oData.filter((o: any) => o.activo) : []);
      }
    } catch (err) {
      console.error(err);
      showToast('Error al cargar datos iniciales', 'error');
    } finally {
      setLoadingInitial(false);
    }
  };

  // When client changes, load projects and existing sectors
  useEffect(() => {
    if (!clienteId) {
      setProjects([]);
      setSectors([]);
      return;
    }

    const fetchClientDetails = async () => {
      try {
        const [resProj, resSect] = await Promise.all([
          fetch(`/api/ordenes-trabajo/cliente/${clienteId}/proyectos`),
          fetch(`/api/clients/${clienteId}/sectores`),
        ]);

        if (resProj.ok) {
          const data = await resProj.json();
          setProjects(data.projects || []);
          if (preProyectoId && data.projects.some((p: any) => p.id === preProyectoId)) {
            setProyectoId(preProyectoId);
          }
        }

        if (resSect.ok) {
          const sData = await resSect.json();
          setSectors(Array.isArray(sData) ? sData : []);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchClientDetails();
  }, [clienteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteId) {
      showToast('Debe seleccionar un cliente', 'error');
      return;
    }
    if (!proyectoId) {
      showToast('Debe seleccionar un proyecto', 'error');
      return;
    }
    if (!responsableId) {
      showToast('Debe asignar un responsable técnico', 'error');
      return;
    }
    if (!reporteTrabajo.trim()) {
      showToast('El reporte de trabajo a realizar es obligatorio', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        clienteId,
        proyectoId,
        responsableId,
        reporteTrabajo: reporteTrabajo.trim(),
        refCliente: refCliente.trim() || undefined,
        sector: sector.trim() || undefined,
        creadorId: currentUser?.id,
      };

      if (otPreviaId) {
        payload.otPreviaId = otPreviaId;
      }

      const res = await fetch('/api/ordenes-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const nuevaOT = await res.json();
        showToast(`Orden de Trabajo ${nuevaOT.numeroOT} creada con éxito`, 'success');
        router.push(`/ordenes-trabajo/${nuevaOT.id}`);
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Error al crear la orden de trabajo', 'error');
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-semibold">Cargando formulario de orden de trabajo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-6">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/ordenes-trabajo"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al listado</span>
        </Link>
        <span className="text-[11px] font-mono text-slate-400">
          Ciclo de Vida: Alta → Horas → Materiales → Firma
        </span>
      </div>

      {/* Main Form container */}
      <div className="max-w-5xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Title */}
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
              <FileText className="w-4 h-4" />
              <span>Alta Operativa</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Nueva Orden de Trabajo
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Complete los datos iniciales. El número correlativo anual (ej: OT-2026-0001) y el primer ciclo se generarán automáticamente.
            </p>
          </div>

          {/* Continuation Alert if present */}
          {otPreviaId && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs flex items-center gap-2.5">
              <FileCheck className="w-4 h-4 shrink-0" />
              <span>
                Esta OT continuará el trabajo de una orden cerrada previamente de forma incompleta.
              </span>
            </div>
          )}

          {/* Section 1: Ubicación & Entidades */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              1. Cliente y Proyecto
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Cliente (SearchableCombobox) */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Cliente Habilitado <span className="text-rose-500">*</span>
                </label>
                <SearchableCombobox
                  options={clients.map((c) => ({
                    value: c.id,
                    label: c.nombre,
                    sublabel: `${c.totalProyectos} proyectos`,
                  }))}
                  value={clienteId}
                  onChange={(val) => {
                    setClienteId(val);
                    setProyectoId('');
                    setSector('');
                  }}
                  placeholder="Buscar y seleccionar cliente..."
                  searchPlaceholder="Escriba para filtrar clientes..."
                />
              </div>

              {/* Proyecto (SearchableCombobox) */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Proyecto <span className="text-rose-500">*</span>
                </label>
                <SearchableCombobox
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                    sublabel: p.codigoProyecto || undefined,
                  }))}
                  value={proyectoId}
                  onChange={(val) => setProyectoId(val)}
                  placeholder={
                    !clienteId
                      ? 'Primero seleccione un cliente...'
                      : projects.length === 0
                      ? 'No hay proyectos disponibles'
                      : 'Buscar y seleccionar proyecto...'
                  }
                  searchPlaceholder="Escriba para filtrar proyectos..."
                  disabled={!clienteId || projects.length === 0}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {/* Ref. Cliente */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Ref. Cliente</span>
                  <span className="text-[10px] font-normal text-slate-400">Manual / Alfanumérico</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ej: OS-45872, MNT-154..."
                    value={refCliente}
                    onChange={(e) => setRefCliente(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                  />
                </div>
              </div>

              {/* Sector / Ubicación / Planta (SearchableCombobox with allowCreate) */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Ubicación / Sector / Planta</span>
                  <span className="text-[10px] font-normal text-slate-400">Seleccione o escriba una nueva</span>
                </label>
                <SearchableCombobox
                  options={sectors
                    .map((s) => {
                      const name = typeof s === 'string' ? s : (s?.nombre || '');
                      return {
                        value: name,
                        label: name,
                        sublabel: typeof s === 'object' && s?.project?.nombre ? s.project.nombre : undefined,
                      };
                    })
                    .filter((opt) => opt.value.trim().length > 0)}
                  value={sector}
                  onChange={(val) => setSector(val)}
                  placeholder={
                    !clienteId
                      ? 'Primero seleccione un cliente...'
                      : sectors.length === 0
                      ? 'Escriba o busque una nueva ubicación...'
                      : 'Buscar ubicación o escribir una nueva...'
                  }
                  searchPlaceholder="Buscar o escribir nueva ubicación..."
                  emptyText="No hay ubicaciones registradas. Escriba el nombre para crear una nueva."
                  allowCreate={Boolean(clienteId)}
                  createLabel="Nueva ubicación"
                  onCreate={(newVal) => {
                    const trimmed = newVal.trim();
                    setSector(trimmed);
                    setSectors((prev) => {
                      const exists = prev.some((p) => (typeof p === 'string' ? p : p.nombre)?.toLowerCase() === trimmed.toLowerCase());
                      if (!exists) {
                        return [...prev, { id: `temp-${Date.now()}`, nombre: trimmed }];
                      }
                      return prev;
                    });
                  }}
                  disabled={!clienteId}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Responsable */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              2. Asignación Técnica
            </h2>

            <div className="max-w-md">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Técnico Responsable de la OT <span className="text-rose-500">*</span>
              </label>
              <SearchableCombobox
                options={operators.map((op) => ({
                  value: op.id,
                  label: op.nombreCompleto,
                  sublabel: op.role,
                }))}
                value={responsableId}
                onChange={(val) => setResponsableId(val)}
                placeholder="Buscar técnico responsable..."
                searchPlaceholder="Escriba para filtrar técnicos..."
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                El técnico responsable coordinará los trabajos y registrará horas y materiales del ciclo.
              </p>
            </div>
          </div>

          {/* Section 3: Reporte de Trabajo Inicial */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                3. Reporte de Trabajo a Realizar <span className="text-rose-500">*</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">Requerido</span>
            </div>

            <div>
              <textarea
                rows={5}
                placeholder="Describa en detalle el trabajo solicitado, alcance, tareas preliminares o fallas detectadas..."
                value={reporteTrabajo}
                onChange={(e) => setReporteTrabajo(e.target.value)}
                required
                className="w-full p-4 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/ordenes-trabajo"
              className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando Orden de Trabajo...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Crear y Abrir Ciclo 1</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
