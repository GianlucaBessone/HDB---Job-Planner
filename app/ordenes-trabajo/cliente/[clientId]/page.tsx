'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FolderGit2,
  Search,
  ArrowLeft,
  FileText,
  Plus,
  Building2,
  ChevronRight,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ExportClientModal from '@/components/ot/ExportClientModal';

interface ProjectWithMetrics {
  id: string;
  nombre: string;
  codigoProyecto?: string;
  observaciones?: string;
  estado: string;
  totalOts: number;
  abiertas: number;
  pendientesFirma: number;
  cerradas: number;
}

export default function ClienteProyectosPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<{ id: string; nombre: string } | null>(null);
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  const userRole = (currentUser?.role || 'admin').toLowerCase();
  const isSupervisorOrAdmin = userRole === 'supervisor' || userRole === 'admin';

  const handleCopyPortalLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      const portalUrl = `${window.location.origin}/portal-clientes/login?clienteId=${clientId}`;
      await navigator.clipboard.writeText(portalUrl);
      setCopiedLink(true);
      showToast('Enlace al portal del cliente copiado al portapapeles', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('No se pudo copiar el enlace', 'error');
    }
  };

  useEffect(() => {
    if (clientId) loadClientProjects();
  }, [clientId]);

  const loadClientProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/cliente/${clientId}/proyectos`);
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setProjects(data.projects);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigoProyecto && p.codigoProyecto.toLowerCase().includes(q)) ||
        (p.observaciones && p.observaciones.toLowerCase().includes(q))
    );
  }, [projects, search]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-6">
      {/* Top breadcrumb & back */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Link href="/ordenes-trabajo" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Clientes
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-bold">{client?.nombre || 'Cliente'}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>{client?.nombre}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Proyectos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Seleccione un proyecto para consultar sus órdenes de trabajo o cree una nueva OT.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {/* Botón Exportar Datos del Cliente (Admin y Supervisor) */}
          {isSupervisorOrAdmin && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all hover:border-emerald-300 dark:hover:border-emerald-700"
              title="Exportar datos del cliente a Excel o CSV con filtros"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Exportar Datos</span>
            </button>
          )}

          {/* Botón Ingresar al Portal del Cliente */}
          <Link
            href={`/portal-clientes/login?clienteId=${clientId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700"
            title="Ingresar al portal del cliente (abre en nueva pestaña)"
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            <span>Portal del Cliente</span>
          </Link>

          {/* Pequeño botón para copiar el link */}
          <button
            type="button"
            onClick={handleCopyPortalLink}
            className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center justify-center shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700 active:scale-95"
            title="Copiar enlace de acceso al portal del cliente"
            aria-label="Copiar enlace al portal del cliente"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Nueva OT */}
          <Link
            href={`/ordenes-trabajo/nueva?clienteId=${clientId}`}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva OT
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar proyecto por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-bold">Cargando proyectos del cliente...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
          No se encontraron proyectos para este cliente.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
            >
              <div>
                {/* Top card bar */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors line-clamp-1">
                        {project.nombre}
                      </h3>
                      {project.codigoProyecto && (
                        <span className="text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">
                          {project.codigoProyecto}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {project.observaciones && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 my-2 font-normal">
                    {project.observaciones}
                  </p>
                )}

                {/* Counters strip */}
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800/80 my-3">
                  <div className="text-center p-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100/50 dark:border-blue-900/30">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block mb-0.5">
                      Abiertas
                    </span>
                    <span className="text-lg font-black text-blue-700 dark:text-blue-300">
                      {project.abiertas}
                    </span>
                  </div>

                  <div className="text-center p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100/50 dark:border-amber-900/30">
                    <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                      Ptes. Firma
                    </span>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-300">
                      {project.pendientesFirma}
                    </span>
                  </div>

                  <div className="text-center p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100/50 dark:border-emerald-900/30">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                      Cerradas
                    </span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      {project.cerradas}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <Link
                  href={`/ordenes-trabajo/nueva?clienteId=${clientId}&proyectoId=${project.id}`}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva OT
                </Link>

                <Link
                  href={`/ordenes-trabajo/cliente/${clientId}/proyecto/${project.id}`}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  Ver OTs ({project.totalOts})
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Exportación con filtros */}
      {isSupervisorOrAdmin && (
        <ExportClientModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          clientId={clientId}
          clientName={client?.nombre || 'Cliente'}
          projects={projects}
        />
      )}
    </div>
  );
}
