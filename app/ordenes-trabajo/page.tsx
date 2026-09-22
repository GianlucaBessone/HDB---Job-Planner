'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Plus,
  Settings,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileSignature,
  Building2,
  FolderGit2,
  Loader2,
  UserCheck,
  UserX,
} from 'lucide-react';
import ClientConfigModal from '@/components/ot/ClientConfigModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SearchableCombobox from '@/components/ui/SearchableCombobox';
import { showToast } from '@/components/Toast';

interface ClientSummary {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  totalProyectos: number;
  abiertas: number;
  pendientesFirma: number;
  cerradas: number;
  totalOts: number;
  responsablesActivos: number;
}

export default function OrdenesTrabajoClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Config modal state
  const [selectedConfigClient, setSelectedConfigClient] = useState<{ id: string; nombre: string } | null>(null);

  // Add Client to OT state
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [selectedAddClientId, setSelectedAddClientId] = useState('');
  const [addingClient, setAddingClient] = useState(false);

  // Disable Client from OT state
  const [confirmDisableClient, setConfirmDisableClient] = useState<ClientSummary | null>(null);
  const [disablingClient, setDisablingClient] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ordenes-trabajo/clientes');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      } else {
        showToast('Error al cargar clientes habilitados', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddClientModal = async () => {
    setIsAddClientOpen(true);
    setSelectedAddClientId('');
    try {
      const res = await fetch('/api/ordenes-trabajo/clientes/disponibles');
      if (res.ok) {
        const data = await res.json();
        setAvailableClients(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnableClient = async () => {
    if (!selectedAddClientId) {
      showToast('Seleccione un cliente para habilitar', 'error');
      return;
    }
    setAddingClient(true);
    try {
      const res = await fetch('/api/ordenes-trabajo/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedAddClientId }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Cliente habilitado exitosamente', 'success');
        setIsAddClientOpen(false);
        loadClients();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al habilitar cliente', 'error');
      }
    } catch {
      showToast('Error de red al habilitar cliente', 'error');
    } finally {
      setAddingClient(false);
    }
  };

  const handleDisableClient = async () => {
    if (!confirmDisableClient) return;
    setDisablingClient(true);
    try {
      const res = await fetch(`/api/ordenes-trabajo/clientes?clientId=${confirmDisableClient.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Cliente deshabilitado', 'success');
        setConfirmDisableClient(null);
        loadClients();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al deshabilitar cliente', 'error');
      }
    } catch {
      showToast('Error de red al deshabilitar cliente', 'error');
    } finally {
      setDisablingClient(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [clients, search]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Módulo de Órdenes de Trabajo</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Clientes Habilitados para OT
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Gestiona los clientes habilitados para el ciclo de órdenes de trabajo, mano de obra y portal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Button: Agregar Cliente */}
          <button
            onClick={openAddClientModal}
            className="px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 text-primary" />
            Agregar Cliente
          </button>

          {/* Button: Nueva OT (Fixed: single + icon) */}
          <Link
            href="/ordenes-trabajo/nueva"
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva OT
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar cliente habilitado por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-bold">Cargando clientes habilitados y órdenes...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 p-8 space-y-3">
          <p className="font-semibold text-slate-600 dark:text-slate-300">
            No hay clientes habilitados para el módulo de Órdenes de Trabajo.
          </p>
          <p className="text-slate-400">
            Presione el botón &quot;Agregar Cliente&quot; para seleccionar clientes de SGI y habilitarlos para OTs.
          </p>
          <button
            onClick={openAddClientModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar Cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative"
            >
              <div>
                {/* Client Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors line-clamp-1">
                        {client.nombre}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {client.direccion || 'Sin dirección registrada'}
                      </p>
                    </div>
                  </div>

                  {/* Config & Options Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedConfigClient({ id: client.id, nombre: client.nombre })}
                      title="Configuración comercial y de portal"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDisableClient(client)}
                      title="Quitar cliente del módulo OT"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-info Badges */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <FolderGit2 className="w-3 h-3 text-slate-400" />
                    {client.totalProyectos} {client.totalProyectos === 1 ? 'Proyecto' : 'Proyectos'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <UserCheck className="w-3 h-3 text-slate-400" />
                    {client.responsablesActivos} {client.responsablesActivos === 1 ? 'Responsable' : 'Responsables'}
                  </span>
                </div>

                {/* OTs Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-100 dark:border-slate-800/80 mb-4 text-center">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3 text-blue-500" />
                      Abiertas
                    </div>
                    <div className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {client.abiertas}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <FileSignature className="w-3 h-3 text-purple-500" />
                      Firma
                    </div>
                    <div className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5">
                      {client.pendientesFirma}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Cerradas
                    </div>
                    <div className="text-base font-black text-slate-700 dark:text-slate-300 mt-0.5">
                      {client.cerradas}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Link
                href={`/ordenes-trabajo/cliente/${client.id}`}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-between transition-colors mt-1"
              >
                <span>Ver Proyectos y OTs ({client.totalOts})</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Modal Agregar Cliente a OT */}
      {isAddClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>Habilitar Cliente para OTs</span>
              </div>
              <button
                onClick={() => setIsAddClientOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seleccione un cliente registrado en SGI para habilitarlo en el módulo de Órdenes de Trabajo:
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 mb-1.5 block">
                Cliente SGI
              </label>
              <SearchableCombobox
                options={availableClients.map((c) => ({
                  value: c.id,
                  label: c.nombre,
                  sublabel: `${c._count?.projects || 0} proyectos en SGI`,
                }))}
                value={selectedAddClientId}
                onChange={(val) => setSelectedAddClientId(val)}
                placeholder="Buscar cliente en SGI..."
                searchPlaceholder="Escriba el nombre del cliente..."
                emptyText="No hay clientes de SGI disponibles para agregar"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddClientOpen(false)}
                disabled={addingClient}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnableClient}
                disabled={addingClient || !selectedAddClientId}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {addingClient && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Habilitar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Disable Client */}
      <ConfirmModal
        isOpen={Boolean(confirmDisableClient)}
        onClose={() => setConfirmDisableClient(null)}
        onConfirm={handleDisableClient}
        loading={disablingClient}
        title="Quitar cliente del módulo OT"
        message={`¿Desea quitar a "${confirmDisableClient?.nombre}" del listado de clientes habilitados para OT?`}
        submessage="El cliente no será eliminado de SGI y todas sus órdenes de trabajo históricas permanecerán intactas en el sistema. Podrá volver a habilitarlo en cualquier momento."
        confirmText="Quitar de OT"
        cancelText="Cancelar"
        variant="warning"
      />

      {/* Client Configuration Modal */}
      {selectedConfigClient && (
        <ClientConfigModal
          clientId={selectedConfigClient.id}
          clientName={selectedConfigClient.nombre}
          isOpen={true}
          onClose={() => {
            setSelectedConfigClient(null);
            loadClients();
          }}
        />
      )}
    </div>
  );
}
