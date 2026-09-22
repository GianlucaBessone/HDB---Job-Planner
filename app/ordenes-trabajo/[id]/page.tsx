'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Building2,
  FolderGit2,
  User,
  MapPin,
  Tag,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  FileSignature,
  ShieldCheck,
  ShieldAlert,
  Send,
  Download,
  Printer,
  History,
  MessageSquare,
  Lock,
  Loader2,
  Package,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { showToast } from '@/components/Toast';
import { OTPdfDocument } from '@/components/ot/OTPdfDocument';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SearchableCombobox from '@/components/ui/SearchableCombobox';

// Dynamic import of PDFDownloadLink to prevent SSR issues
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <span className="text-xs text-slate-400">Preparando PDF...</span> }
);

export default function DetalleOrdenTrabajoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ot, setOt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalle' | 'chat' | 'historial'>('detalle');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const userRole = (currentUser?.role || '').toLowerCase();
  const isOperador = userRole === 'operador';
  const isVendedor = userRole === 'vendedor';
  const isSupervisorOrAdmin = !isOperador && !isVendedor;

  const canSeeLaborCosts = isSupervisorOrAdmin;
  const canSeeMaterialCosts = isSupervisorOrAdmin || isVendedor;
  const canSeeTotalCosts = isSupervisorOrAdmin;

  // Edit general info modal
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({ refCliente: '', sector: '', reporteTrabajo: '', responsableId: '' });
  const [operatorsList, setOperatorsList] = useState<any[]>([]);

  // Modals for adding hours & materials
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [opFormData, setOpFormData] = useState({ operadorId: '', horas: '' });

  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [matFormData, setMatFormData] = useState({
    materialCodigo: '',
    descripcion: '',
    cantidad: '1',
    metros: '',
    precioFinal: '',
  });
  const [inventorySuggestions, setInventorySuggestions] = useState<any[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');

  // Chat comment
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Integrity Check result
  const [integrityModal, setIntegrityModal] = useState<any | null>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  // Native Confirm & Prompt replacement modals
  const [confirmDeleteHourItemId, setConfirmDeleteHourItemId] = useState<string | null>(null);
  const [confirmDeleteMaterialItemId, setConfirmDeleteMaterialItemId] = useState<string | null>(null);
  const [statusChangeModal, setStatusChangeModal] = useState<{ nuevoEstado: string; motivo: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [clientSectors, setClientSectors] = useState<any[]>([]);

  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (u) setCurrentUser(JSON.parse(u));
    } catch {}
    loadOt();
    loadOperators();
  }, [id]);

  const loadOt = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOt(data);
        setEditForm({
          refCliente: data.refCliente || '',
          sector: data.sector || '',
          reporteTrabajo: data.reporteTrabajo || '',
          responsableId: data.responsableId || '',
        });

        // Load sectors for this client
        if (data.clienteId) {
          fetch(`/api/clients/${data.clienteId}/sectores`)
            .then((r) => r.ok ? r.json() : [])
            .then((sData) => {
              if (Array.isArray(sData)) setClientSectors(sData);
            })
            .catch(() => {});
        }
      } else {
        showToast('Orden de trabajo no encontrada', 'error');
      }
    } catch {
      showToast('Error al cargar la orden de trabajo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadOperators = async () => {
    try {
      const res = await fetch('/api/operators');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setOperatorsList(data.filter((o: any) => o.activo));
      }
    } catch {}
  };

  const searchInventory = async (q: string) => {
    setInventorySearch(q);
    if (!q.trim() || q.trim() === '999999') {
      setInventorySuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/inventario`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const lower = q.toLowerCase();
          const matches = data.filter(
            (m: any) =>
              m.codigo.toLowerCase().includes(lower) || m.nombre.toLowerCase().includes(lower)
          ).slice(0, 10);
          setInventorySuggestions(matches);
        }
      }
    } catch {}
  };

  const handleOpenStatusModal = (nuevoEstado: string) => {
    setStatusChangeModal({ nuevoEstado, motivo: '' });
  };

  const handleExecuteStatusChange = async () => {
    if (!statusChangeModal) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nuevoEstado: statusChangeModal.nuevoEstado,
          motivo: statusChangeModal.motivo,
          usuarioId: currentUser?.id,
          usuarioNombre: currentUser?.nombreCompleto,
        }),
      });
      if (res.ok) {
        showToast(`Estado actualizado a ${statusChangeModal.nuevoEstado}`, 'success');
        setStatusChangeModal(null);
        loadOt();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al actualizar estado', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveInfo = async () => {
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        showToast('Información actualizada', 'success');
        setIsEditingInfo(false);
        loadOt();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al actualizar', 'error');
      }
    } catch {
      showToast('Error al guardar cambios', 'error');
    }
  };

  const handleAddOperatorHours = async (cicloId: string) => {
    if (!opFormData.operadorId || !opFormData.horas) {
      showToast('Seleccione operador e ingrese horas', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}/operadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cicloId,
          operadorId: opFormData.operadorId,
          horas: opFormData.horas,
        }),
      });
      if (res.ok) {
        showToast('Horas registradas', 'success');
        setIsAddOperatorOpen(false);
        setOpFormData({ operadorId: '', horas: '' });
        loadOt();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al registrar horas', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  const executeDeleteOperatorItem = async () => {
    if (!confirmDeleteHourItemId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}/operadores?itemId=${confirmDeleteHourItemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Registro de horas eliminado', 'success');
        setConfirmDeleteHourItemId(null);
        loadOt();
      } else {
        const err = await res.json();
        showToast(err.error || 'Error al eliminar', 'error');
      }
    } catch {
      showToast('Error de conexión al eliminar', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMaterial = async (cicloId: string) => {
    if (!matFormData.materialCodigo || !matFormData.cantidad) {
      showToast('Complete código y cantidad', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}/materiales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cicloId,
          ...matFormData,
        }),
      });
      if (res.ok) {
        showToast('Material agregado', 'success');
        setIsAddMaterialOpen(false);
        setMatFormData({ materialCodigo: '', descripcion: '', cantidad: '1', metros: '', precioFinal: '' });
        loadOt();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al registrar material', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  const executeDeleteMaterialItem = async () => {
    if (!confirmDeleteMaterialItemId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}/materiales?itemId=${confirmDeleteMaterialItemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Material eliminado', 'success');
        setConfirmDeleteMaterialItemId(null);
        loadOt();
      } else {
        const err = await res.json();
        showToast(err.error || 'Error al eliminar', 'error');
      }
    } catch {
      showToast('Error de conexión al eliminar', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: newComment.trim(),
          usuarioId: currentUser?.id,
          usuarioNombre: currentUser?.nombreCompleto || 'Operador',
          usuarioRol: currentUser?.role || 'operador',
        }),
      });
      if (res.ok) {
        setNewComment('');
        loadOt();
      }
    } catch {
      showToast('Error al enviar comentario', 'error');
    } finally {
      setSendingComment(false);
    }
  };

  const handleVerifyIntegrity = async (cicloId?: string) => {
    setCheckingIntegrity(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/${id}/verificar-integridad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cicloId }),
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrityModal(data);
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al verificar integridad', 'error');
      }
    } catch {
      showToast('Error al verificar integridad', 'error');
    } finally {
      setCheckingIntegrity(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-bold">Cargando orden de trabajo...</p>
      </div>
    );
  }

  if (!ot) return null;

  const isClosed = ot.estado === 'CERRADA';
  const activeCycle = ot.ciclos.find((c: any) => c.estado !== 'FIRMADO') || ot.ciclos[ot.ciclos.length - 1];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Link href="/ordenes-trabajo" className="hover:text-primary transition-colors">
            Clientes
          </Link>
          <span>/</span>
          <Link href={`/ordenes-trabajo/cliente/${ot.cliente.id}`} className="hover:text-primary transition-colors">
            {ot.cliente.nombre}
          </Link>
          <span>/</span>
          <Link
            href={`/ordenes-trabajo/cliente/${ot.cliente.id}/proyecto/${ot.proyecto.id}`}
            className="hover:text-primary transition-colors"
          >
            {ot.proyecto.nombre}
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-slate-100 font-mono font-bold">{ot.numeroOT}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Print / PDF Link */}
          <PDFDownloadLink
            document={<OTPdfDocument ot={ot} />}
            fileName={`${ot.numeroOT}_${ot.cliente.nombre.replace(/\s+/g, '_')}.pdf`}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Descargar PDF
          </PDFDownloadLink>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                {ot.numeroOT}
              </h1>

              {ot.refCliente && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                  Ref: {ot.refCliente}
                </span>
              )}

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  ot.estado === 'ABIERTA'
                    ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                    : ot.estado === 'PAUSADA'
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : ot.estado === 'PENDIENTE_FIRMA'
                    ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}
              >
                {ot.estado}
              </span>

              {ot.tipoCierre && (
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Cierre: {ot.tipoCierre}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ot.cliente.nombre} · {ot.proyecto.nombre} {ot.sector ? `· ${ot.sector}` : ''}
            </p>
          </div>

          {/* Action buttons on state */}
          <div className="flex flex-wrap items-center gap-2">
            {!isClosed && (
              <>
                {ot.estado === 'ABIERTA' ? (
                  <button
                    onClick={() => handleOpenStatusModal('PAUSADA')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-amber-600 flex items-center gap-1.5"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    Pausar
                  </button>
                ) : ot.estado === 'PAUSADA' ? (
                  <button
                    onClick={() => handleOpenStatusModal('ABIERTA')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-blue-600 flex items-center gap-1.5"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Reanudar
                  </button>
                ) : null}

                {ot.estado !== 'PENDIENTE_FIRMA' && (
                  <button
                    onClick={() => handleOpenStatusModal('PENDIENTE_FIRMA')}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    Enviar a Firma
                  </button>
                )}
              </>
            )}

            {/* Check integrity button if there are signed cycles */}
            {ot.ciclos.some((c: any) => c.estado === 'FIRMADO') && (
              <button
                onClick={() => handleVerifyIntegrity()}
                disabled={checkingIntegrity}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                {checkingIntegrity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Verificar Integridad
              </button>
            )}

            {!isClosed && (
              <button
                onClick={() => setIsEditingInfo(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar Datos
              </button>
            )}
          </div>
        </div>

        {/* Metadatos grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Responsable</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{ot.responsable?.nombreCompleto}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Fecha Creación</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(ot.createdAt)}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Creador</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{ot.creador?.nombreCompleto}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sector</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{ot.sector || 'Sin sector'}</span>
          </div>
        </div>
      </div>

      {/* Navigation tabs: Detalle / Chat / Historial */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('detalle')}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'detalle'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Detalle Operativo y Ciclos
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'chat'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Comentarios ({ot.comentarios?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'historial'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Historial y Auditoría
        </button>
      </div>

      {/* TAB 1: DETALLE */}
      {activeTab === 'detalle' && (
        <div className="space-y-6">
          {/* Reporte de Trabajo */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Reporte de Trabajo</h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {ot.reporteTrabajo}
            </p>
          </div>

          {/* Ciclos de Trabajo */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Ciclos de Ejecución y Trazabilidad
                </h2>
                <p className="text-xs text-slate-500">
                  Separación estricta entre períodos históricos firmados y el ciclo actualmente en ejecución.
                </p>
              </div>
            </div>

            {ot.ciclos.map((ciclo: any) => {
              const isSigned = ciclo.estado === 'FIRMADO';

              return (
                <div
                  key={ciclo.id}
                  className={`rounded-2xl border p-5 sm:p-6 transition-all space-y-5 ${
                    isSigned
                      ? 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-800 opacity-95'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  {/* Cycle Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                          isSigned
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        C{ciclo.numeroCiclo}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                            Ciclo {ciclo.numeroCiclo} ({ciclo.periodo})
                          </h3>
                          {isSigned ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              FIRMADO DIGITALMENTE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              ABIERTO
                            </span>
                          )}
                        </div>
                        {isSigned && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Firmado por <strong>{ciclo.firmanteNombre}</strong> el {formatDateTime(ciclo.fechaFirma)} · Cierre {ciclo.tipoCierre}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSigned && ciclo.hashIntegridad && (
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400 max-w-[160px] truncate" title={ciclo.hashIntegridad}>
                          SHA: {ciclo.hashIntegridad.slice(0, 16)}...
                        </code>
                        <button
                          onClick={() => handleVerifyIntegrity(ciclo.id)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-emerald-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Auditar Hash
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 1. Técnicos y Horas */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        Técnicos y Mano de Obra
                      </h4>
                      {!isSigned && !isClosed && (
                        <button
                          onClick={() => setIsAddOperatorOpen(true)}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Cargar Horas
                        </button>
                      )}
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300">Técnico</th>
                            <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Horas</th>
                            {canSeeLaborCosts && (
                              <>
                                <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Valor Hora</th>
                                <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Mano de Obra</th>
                              </>
                            )}
                            {!isSigned && !isClosed && <th className="py-2 px-3 text-right"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {ciclo.operadores?.length === 0 ? (
                            <tr>
                              <td colSpan={canSeeLaborCosts ? 5 : 3} className="py-4 text-center text-slate-400">
                                Sin registros de horas en este ciclo.
                              </td>
                            </tr>
                          ) : (
                            ciclo.operadores.map((op: any) => (
                              <tr key={op.id}>
                                <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                                  {op.operador?.nombreCompleto}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold">{op.horas.toFixed(2)} h</td>
                                {canSeeLaborCosts && (
                                  <>
                                    <td className="py-2.5 px-4 text-right text-slate-500 font-mono">
                                      ${op.valorHoraSnapshot.toLocaleString('es-AR')}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                                      ${op.costoManoObra.toLocaleString('es-AR')}
                                    </td>
                                  </>
                                )}
                                {!isSigned && !isClosed && (
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      onClick={() => setConfirmDeleteHourItemId(op.id)}
                                      className="p-1 text-slate-400 hover:text-rose-500 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. Materiales */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-primary" />
                        Materiales Utilizados
                      </h4>
                      {!isSigned && !isClosed && (
                        <button
                          onClick={() => setIsAddMaterialOpen(true)}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Cargar Material
                        </button>
                      )}
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300">Código</th>
                            <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300">Material</th>
                            <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Cantidad</th>
                            {canSeeMaterialCosts && (
                              <>
                                <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Precio Final</th>
                                <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Importe Total</th>
                              </>
                            )}
                            {!isSigned && !isClosed && <th className="py-2 px-3 text-right"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {ciclo.materiales?.length === 0 ? (
                            <tr>
                              <td colSpan={canSeeMaterialCosts ? 6 : 4} className="py-4 text-center text-slate-400">
                                Sin materiales registrados en este ciclo.
                              </td>
                            </tr>
                          ) : (
                            ciclo.materiales.map((m: any) => (
                              <tr key={m.id}>
                                <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {m.materialCodigo}{' '}
                                  {m.materialSource === 'MANUAL' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                      MANUAL
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">{m.descripcion}</td>
                                <td className="py-2.5 px-4 text-right font-semibold">{m.cantidad}</td>
                                {canSeeMaterialCosts && (
                                  <>
                                    <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                      ${m.precioFinalSnapshot.toLocaleString('es-AR')}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                                      ${m.importeTotal.toLocaleString('es-AR')}
                                    </td>
                                  </>
                                )}
                                {!isSigned && !isClosed && (
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      onClick={() => setConfirmDeleteMaterialItemId(m.id)}
                                      className="p-1 text-slate-400 hover:text-rose-500 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Cycle Totals Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas Ciclo</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {ciclo.totalHoras.toFixed(2)} h
                        </span>
                      </div>
                      {canSeeLaborCosts && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Mano de Obra</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            ${ciclo.totalManoObra.toLocaleString('es-AR')}
                          </span>
                        </div>
                      )}
                      {canSeeMaterialCosts ? (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Materiales</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            ${ciclo.totalMateriales.toLocaleString('es-AR')}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Items Materiales</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {ciclo.materiales?.length || 0}
                          </span>
                        </div>
                      )}
                    </div>

                    {canSeeTotalCosts && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-primary block">Total Ciclo</span>
                        <span className="text-sm font-black text-primary font-mono">
                          ${ciclo.totalGeneral.toLocaleString('es-AR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CHAT COMENTARIOS */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Conversación y Novedades de la Orden
            </h3>
            <p className="text-xs text-slate-500">
              Historial de observaciones técnicas entre técnicos, ventas y clientes.
            </p>
          </div>

          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            {ot.comentarios?.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-400">
                Aún no hay comentarios en esta orden. Escriba el primero a continuación.
              </p>
            ) : (
              ot.comentarios.map((c: any) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{c.usuarioNombre}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {c.usuarioRol}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{c.texto}</p>
                </div>
              ))
            )}
          </div>

          {/* New Comment Input */}
          <form onSubmit={handleSendComment} className="flex items-center gap-3 pt-2">
            <input
              type="text"
              placeholder="Escribir comentario o novedad..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={sendingComment || !newComment.trim()}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              {sendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: HISTORIAL & AUDITORÍA */}
      {activeTab === 'historial' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Historial de Transiciones y Auditoría
            </h3>
            <p className="text-xs text-slate-500">Registro de cambios de estado y autorizaciones.</p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ot.historialEstados?.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">Sin historial de cambios registrado.</p>
            ) : (
              ot.historialEstados.map((h: any) => (
                <div key={h.id} className="py-3 flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {h.estadoAnterior} → <strong className="text-primary">{h.estadoNuevo}</strong>
                      </span>
                    </div>
                    {h.motivo && <p className="text-slate-500 text-[11px] mt-0.5">{h.motivo}</p>}
                    <span className="text-[10px] text-slate-400 mt-1 block">Por: {h.usuarioNombre || 'Sistema'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatDateTime(h.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD OPERATOR HOURS */}
      {isAddOperatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Cargar Horas de Técnico
            </h3>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Técnico / Operador *</label>
              <SearchableCombobox
                options={operatorsList.map((op) => ({
                  value: op.id,
                  label: op.nombreCompleto,
                  sublabel: op.role,
                }))}
                value={opFormData.operadorId}
                onChange={(val) => setOpFormData({ ...opFormData, operadorId: val })}
                placeholder="Buscar técnico..."
                searchPlaceholder="Escriba para filtrar técnicos..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                Horas Trabajadas * (admite decimales: 4.5, 3.25)
              </label>
              <input
                type="number"
                step="0.25"
                placeholder="Ej: 4.5"
                value={opFormData.horas}
                onChange={(e) => setOpFormData({ ...opFormData, horas: e.target.value })}
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddOperatorOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAddOperatorHours(activeCycle.id)}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg"
              >
                Guardar Horas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD MATERIAL */}
      {isAddMaterialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Cargar Material en la OT
            </h3>

            {/* Code / Search */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                Código / SKU de Inventario (o digite <strong>999999</strong> para manual) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar en inventario o escribir 999999..."
                  value={matFormData.materialCodigo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMatFormData({ ...matFormData, materialCodigo: val });
                    searchInventory(val);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono"
                />

                {inventorySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {inventorySuggestions.map((s) => (
                      <button
                        key={s.codigo}
                        type="button"
                        onClick={() => {
                          setMatFormData({
                            ...matFormData,
                            materialCodigo: s.codigo,
                            descripcion: s.nombre,
                          });
                          setInventorySuggestions([]);
                        }}
                        className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs flex items-center justify-between border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-200">{s.nombre}</span>
                        <span className="font-mono text-slate-400">[{s.codigo}]</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Special rule for 999999: Manual Material */}
            {matFormData.materialCodigo.trim() === '999999' ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 space-y-3">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Material No Inventariado (Código 999999)
                </p>
                <p className="text-[11px] leading-relaxed">
                  El precio final que ingrese se aplicará directamente de forma neta sin recargo ni descuento de cliente.
                  No afectará el stock.
                </p>
                <div>
                  <label className="text-[11px] font-bold block mb-1">Descripción del Material *</label>
                  <input
                    type="text"
                    placeholder="Ej: Fuente switching 24V 5A..."
                    value={matFormData.descripcion}
                    onChange={(e) => setMatFormData({ ...matFormData, descripcion: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold block mb-1">Precio Final Directo ($) *</label>
                  <input
                    type="number"
                    placeholder="Ej: 85000"
                    value={matFormData.precioFinal}
                    onChange={(e) => setMatFormData({ ...matFormData, precioFinal: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción del material..."
                  value={matFormData.descripcion}
                  onChange={(e) => setMatFormData({ ...matFormData, descripcion: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                Cantidad *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ej: 1, 5, 25.5 (unidades, metros, etc.)"
                value={matFormData.cantidad}
                onChange={(e) => setMatFormData({ ...matFormData, cantidad: e.target.value })}
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddMaterialOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAddMaterial(activeCycle.id)}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg"
              >
                Guardar Material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT GENERAL INFO */}
      {isEditingInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Editar Datos de la Orden</h3>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Ref. Cliente</label>
              <input
                type="text"
                value={editForm.refCliente}
                onChange={(e) => setEditForm({ ...editForm, refCliente: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Sector / Ubicación</span>
                <span className="text-[10px] text-slate-400 font-normal">Buscar o crear</span>
              </label>
              <SearchableCombobox
                options={clientSectors.map((s) => ({
                  value: s.nombre,
                  label: s.nombre,
                }))}
                value={editForm.sector}
                onChange={(val) => setEditForm({ ...editForm, sector: val })}
                placeholder="Buscar ubicación o escribir nueva..."
                searchPlaceholder="Buscar o escribir nueva ubicación..."
                allowCreate={true}
                createLabel="Nueva ubicación"
                onCreate={(newVal) => setEditForm({ ...editForm, sector: newVal })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Responsable</label>
              <SearchableCombobox
                options={operatorsList.map((op) => ({
                  value: op.id,
                  label: op.nombreCompleto,
                  sublabel: op.role,
                }))}
                value={editForm.responsableId}
                onChange={(val) => setEditForm({ ...editForm, responsableId: val })}
                placeholder="Seleccionar responsable..."
                searchPlaceholder="Escriba para filtrar técnicos..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Reporte de Trabajo</label>
              <textarea
                rows={5}
                value={editForm.reporteTrabajo}
                onChange={(e) => setEditForm({ ...editForm, reporteTrabajo: e.target.value })}
                className="w-full p-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditingInfo(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveInfo}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INTEGRITY VERIFICATION RESULT */}
      {integrityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              {integrityModal.integridadTotal ? (
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {integrityModal.integridadTotal
                    ? 'INTEGRIDAD CRIPTOGRÁFICA VERIFICADA'
                    : 'ADVERTENCIA DE INCONSISTENCIA'}
                </h3>
                <p className="text-xs text-slate-500">
                  Verificación digital de integridad basada en algoritmo SHA-256.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {integrityModal.resultados.map((r: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    r.valido
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/30 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      Ciclo {r.numeroCiclo} ({r.tipoCierre || 'FIRMADO'})
                    </span>
                    <span>{r.valido ? '✓ Hash Coincide' : '✗ Hash No Coincide'}</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    Firmante: {r.firmanteNombre} el {formatDateTime(r.fechaFirma)}
                  </p>
                  <div className="font-mono text-[10px] break-all bg-white/60 dark:bg-slate-900/60 p-2 rounded">
                    <div>
                      <strong>Almacenado:</strong> {r.hashAlmacenado}
                    </div>
                    <div>
                      <strong>Calculado:</strong> {r.hashCalculado}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIntegrityModal(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR ESTADO DE LA OT (Reemplazo nativo de prompt) */}
      {statusChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Cambiar Estado a &quot;{statusChangeModal.nuevoEstado}&quot;
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ingrese el motivo u observación de este cambio de estado:
            </p>
            <div>
              <textarea
                rows={3}
                placeholder="Motivo del cambio de estado (opcional)..."
                value={statusChangeModal.motivo}
                onChange={(e) => setStatusChangeModal({ ...statusChangeModal, motivo: e.target.value })}
                className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusChangeModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteStatusChange}
                disabled={actionLoading}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar Cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: ELIMINAR REGISTRO DE HORAS */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteHourItemId)}
        onClose={() => setConfirmDeleteHourItemId(null)}
        onConfirm={executeDeleteOperatorItem}
        loading={actionLoading}
        title="Eliminar Registro de Mano de Obra"
        message="¿Está seguro de que desea eliminar este registro de horas del ciclo actual?"
        submessage="Los totales de horas y costo de mano de obra del ciclo se recalcularán automáticamente."
        confirmText="Eliminar Horas"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* CONFIRM MODAL: ELIMINAR MATERIAL */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteMaterialItemId)}
        onClose={() => setConfirmDeleteMaterialItemId(null)}
        onConfirm={executeDeleteMaterialItem}
        loading={actionLoading}
        title="Eliminar Material del Ciclo"
        message="¿Está seguro de que desea eliminar este material del ciclo actual?"
        submessage="El importe total de materiales del ciclo se actualizará automáticamente."
        confirmText="Eliminar Material"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}
