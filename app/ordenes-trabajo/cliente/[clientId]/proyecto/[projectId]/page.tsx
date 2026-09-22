'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  Search,
  ArrowLeft,
  Plus,
  Filter,
  Calendar,
  User,
  MapPin,
  Clock,
  DollarSign,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  FileSignature,
  FileSpreadsheet,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { showToast } from '@/components/Toast';
import ExportClientModal from '@/components/ot/ExportClientModal';

interface OtListItem {
  id: string;
  numeroOT: string;
  refCliente?: string | null;
  sector?: string | null;
  estado: string;
  createdAt: string;
  responsable: { id: string; nombreCompleto: string };
  creador: { id: string; nombreCompleto: string };
  ciclos: {
    id: string;
    numeroCiclo: number;
    periodo: string;
    estado: string;
    totalHoras: number;
    totalManoObra: number;
    totalMateriales: number;
    totalGeneral: number;
    hashIntegridad?: string | null;
  }[];
}

export default function ProyectoOtsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const projectId = params.projectId as string;

  const [client, setClient] = useState<{ id: string; nombre: string } | null>(null);
  const [project, setProject] = useState<{ id: string; nombre: string; codigoProyecto?: string } | null>(null);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [ots, setOts] = useState<OtListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyPortalLink = () => {
    if (typeof window === 'undefined') return;
    const portalUrl = `${window.location.origin}/portal-clientes/login?clienteId=${clientId}`;
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    showToast('Enlace al portal del cliente copiado al portapapeles', 'info');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  const userRole = (currentUser?.role || 'admin').toLowerCase();
  const isOperador = userRole === 'operador';
  const isVendedor = userRole === 'vendedor';
  const isSupervisorOrAdmin = userRole === 'supervisor' || userRole === 'admin';

  // Filter states
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODAS');
  const [sectorFilter, setSectorFilter] = useState('TODOS');
  const [responsableFilter, setResponsableFilter] = useState('TODOS');
  const [sectoresList, setSectoresList] = useState<string[]>([]);
  const [responsablesList, setResponsablesList] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    if (clientId && projectId) {
      loadProjectOts();
    }
  }, [clientId, projectId]);

  const loadProjectOts = async () => {
    setLoading(true);
    try {
      const [resOts, resProj] = await Promise.all([
        fetch(`/api/ordenes-trabajo?clienteId=${clientId}&proyectoId=${projectId}&limit=100`),
        fetch(`/api/ordenes-trabajo/cliente/${clientId}/proyectos`),
      ]);

      if (resOts.ok) {
        const data = await resOts.json();
        const otData: OtListItem[] = data.data || [];
        setOts(otData);

        // Extract distinct sectors and responsibles
        const sSet = new Set<string>();
        const rMap = new Map<string, string>();
        otData.forEach((ot) => {
          if (ot.sector) sSet.add(ot.sector);
          if (ot.responsable) rMap.set(ot.responsable.id, ot.responsable.nombreCompleto);
        });
        setSectoresList(Array.from(sSet));
        setResponsablesList(Array.from(rMap.entries()).map(([id, nombre]) => ({ id, nombre })));
      }

      if (resProj.ok) {
        const pData = await resProj.json();
        setClient(pData.client);
        setAllProjects(pData.projects || []);
        const curProj = (pData.projects || []).find((p: any) => p.id === projectId);
        if (curProj) setProject(curProj);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOts = useMemo(() => {
    return ots.filter((ot) => {
      // Estado filter
      if (estadoFilter !== 'TODAS' && ot.estado !== estadoFilter) return false;

      // Sector filter
      if (sectorFilter !== 'TODOS' && ot.sector !== sectorFilter) return false;

      // Responsable filter
      if (responsableFilter !== 'TODOS' && ot.responsable?.id !== responsableFilter) return false;

      // Search (matches numeroOT, refCliente, or sector)
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchOT = ot.numeroOT.toLowerCase().includes(q);
        const matchRef = ot.refCliente ? ot.refCliente.toLowerCase().includes(q) : false;
        const matchSector = ot.sector ? ot.sector.toLowerCase().includes(q) : false;
        const matchResp = ot.responsable?.nombreCompleto.toLowerCase().includes(q);
        if (!matchOT && !matchRef && !matchSector && !matchResp) return false;
      }

      return true;
    });
  }, [ots, estadoFilter, sectorFilter, responsableFilter, search]);

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'ABIERTA':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Abierta
          </span>
        );
      case 'PAUSADA':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
            <PauseCircle className="w-3 h-3" />
            Pausada
          </span>
        );
      case 'PENDIENTE_FIRMA':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center gap-1">
            <FileSignature className="w-3 h-3" />
            Pendiente Firma
          </span>
        );
      case 'CERRADA':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Cerrada
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-500">
            {estado}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Link href="/ordenes-trabajo" className="hover:text-primary transition-colors">
          Clientes
        </Link>
        <span>/</span>
        <Link href={`/ordenes-trabajo/cliente/${clientId}`} className="hover:text-primary transition-colors">
          {client?.nombre || 'Cliente'}
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-bold">{project?.nombre || 'Proyecto'}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>{client?.nombre} · {project?.codigoProyecto ? `[${project.codigoProyecto}]` : ''}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Órdenes de Trabajo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Proyecto: <strong>{project?.nombre}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Botón Exportar Datos (Admin y Supervisor) */}
          {isSupervisorOrAdmin && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all hover:border-emerald-300 dark:hover:border-emerald-700"
              title="Exportar datos del cliente y proyecto a Excel o CSV"
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

          <Link
            href={`/ordenes-trabajo/nueva?clienteId=${clientId}&proyectoId=${projectId}`}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva OT
          </Link>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por OT (ej: OT-2026-0001) o Ref. Cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status selector */}
        <div className="w-full md:w-44">
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100"
          >
            <option value="TODAS">Todos los Estados</option>
            <option value="ABIERTA">Abierta</option>
            <option value="PAUSADA">Pausada</option>
            <option value="PENDIENTE_FIRMA">Pendiente Firma</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </div>

        {/* Sector selector */}
        {sectoresList.length > 0 && (
          <div className="w-full md:w-44">
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100"
            >
              <option value="TODOS">Todos los Sectores</option>
              {sectoresList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Responsable selector */}
        {responsablesList.length > 0 && (
          <div className="w-full md:w-48">
            <select
              value={responsableFilter}
              onChange={(e) => setResponsableFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100"
            >
              <option value="TODOS">Todos los Responsables</option>
              {responsablesList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* OTs List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-bold">Cargando órdenes de trabajo...</p>
        </div>
      ) : filteredOts.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl space-y-2">
          <p>No se encontraron órdenes de trabajo con los filtros aplicados.</p>
          <Link
            href={`/ordenes-trabajo/nueva?clienteId=${clientId}&proyectoId=${projectId}`}
            className="text-primary font-bold hover:underline inline-block"
          >
            Crear la primera OT para este proyecto →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOts.map((ot) => {
            // Aggregate totals across all cycles
            const totalHoras = ot.ciclos.reduce((acc, c) => acc + c.totalHoras, 0);
            const totalMateriales = ot.ciclos.reduce((acc, c) => acc + c.totalMateriales, 0);

            return (
              <Link
                key={ot.id}
                href={`/ordenes-trabajo/${ot.id}`}
                className="block bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-primary/40 dark:hover:border-primary/40 transition-all group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left block */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors font-mono">
                        {ot.numeroOT}
                      </span>

                      {ot.refCliente && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Ref: {ot.refCliente}
                        </span>
                      )}

                      {getStatusBadge(ot.estado)}

                      {ot.ciclos.length > 1 && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {ot.ciclos.length} Ciclos
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {ot.sector && (
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          {ot.sector}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {ot.responsable?.nombreCompleto || 'Sin asignar'}
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(ot.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Right metrics block */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-5">
                      {!isVendedor && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                            {totalHoras.toFixed(1)} h
                          </span>
                        </div>
                      )}

                      {!isOperador && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Materiales</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                            ${totalMateriales.toLocaleString('es-AR')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-primary group-hover:text-white flex items-center justify-center text-slate-400 transition-colors shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal de Exportación con filtros */}
      {isSupervisorOrAdmin && (
        <ExportClientModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          clientId={clientId}
          clientName={client?.nombre || 'Cliente'}
          projects={allProjects}
          initialProjectId={projectId}
        />
      )}
    </div>
  );
}
