'use client';

import { useState, useEffect } from 'react';
import {
  X,
  DollarSign,
  Clock,
  Users,
  Plus,
  Trash2,
  KeyRound,
  Check,
  Copy,
  AlertCircle,
  Loader2,
  Edit2,
  CheckCircle2,
  XCircle,
  MapPin,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SearchableCombobox from '@/components/ui/SearchableCombobox';

interface ClientConfigModalProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
}

export default function ClientConfigModal({
  clientId,
  clientName,
  isOpen,
  onClose,
  currentUserRole = 'admin',
}: ClientConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'comercial' | 'valoresHora' | 'responsables' | 'sectores'>('comercial');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [effectiveRole, setEffectiveRole] = useState(currentUserRole || 'admin');

  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed.role) setEffectiveRole(parsed.role.toLowerCase());
      }
    } catch {}
  }, []);

  const isVendedor = effectiveRole === 'vendedor';
  const isSupervisorOrAdmin = !isVendedor && effectiveRole !== 'operador';

  // Config state
  const [porcentajeInput, setPorcentajeInput] = useState<string>('');
  const [operatorRates, setOperatorRates] = useState<any[]>([]);
  const [responsables, setResponsables] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [operatorsList, setOperatorsList] = useState<any[]>([]);
  const [sectoresList, setSectoresList] = useState<any[]>([]);

  // Add Sector Sub-state
  const [newSectorNombre, setNewSectorNombre] = useState('');
  const [newSectorProjectId, setNewSectorProjectId] = useState('');
  const [confirmDeleteSector, setConfirmDeleteSector] = useState<any | null>(null);

  // Add Rate Sub-state
  const [newRateOperatorId, setNewRateOperatorId] = useState('');
  const [newRateValue, setNewRateValue] = useState('');

  // Edit Rate Sub-state
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>('');
  const [editingRateActivo, setEditingRateActivo] = useState<boolean>(true);

  // Responsable sub-modal/form
  const [editingResp, setEditingResp] = useState<any | null>(null);
  const [respForm, setRespForm] = useState({
    nombre: '',
    email: '',
    cargo: '',
    portalHabilitado: true,
    proyectosIds: [] as string[],
  });
  const [generatedKeyInfo, setGeneratedKeyInfo] = useState<{ nombre: string; key: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Native confirmation modals state
  const [confirmDeleteRate, setConfirmDeleteRate] = useState<any | null>(null);
  const [confirmRegenKey, setConfirmRegenKey] = useState<{ id: string; nombre: string } | null>(null);

  useEffect(() => {
    if (isOpen && clientId) {
      loadAllConfig();
    }
  }, [isOpen, clientId]);

  const loadAllConfig = async () => {
    setLoading(true);
    try {
      const [resConfig, resOps] = await Promise.all([
        fetch(`/api/clients/${clientId}/config`),
        fetch('/api/operators'),
      ]);

      if (resConfig.ok) {
        const data = await resConfig.json();
        const p = data.configuracion?.porcentajeMateriales;
        if (p === null || p === undefined || p === 0) {
          setPorcentajeInput('');
        } else {
          setPorcentajeInput(String(p));
        }

        setOperatorRates(data.operatorRates || []);
        setResponsables(data.responsables || []);
        setProjects(data.projects || []);
        setSectoresList(data.sectores || []);
      }

      if (resOps.ok) {
        const ops = await resOps.json();
        if (Array.isArray(ops)) setOperatorsList(ops);
      }
    } catch (err) {
      console.error(err);
      showToast('Error al cargar configuración del cliente', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePorcentaje = async () => {
    setSaving(true);
    try {
      let numVal = 0;
      if (porcentajeInput.trim() !== '') {
        numVal = parseFloat(porcentajeInput);
        if (isNaN(numVal)) {
          showToast('El porcentaje debe ser un número válido', 'error');
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/clients/${clientId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ porcentajeMateriales: numVal }),
      });
      if (res.ok) {
        showToast('Porcentaje de materiales guardado con éxito', 'success');
        if (numVal === 0) {
          setPorcentajeInput('');
        }
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al guardar', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRate = async () => {
    if (!newRateOperatorId || !newRateValue.trim()) return;
    const numVal = parseFloat(newRateValue);
    if (isNaN(numVal) || numVal < 0) {
      showToast('El valor hora debe ser un número positivo', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: newRateOperatorId,
          valorHora: numVal,
        }),
      });
      if (res.ok) {
        showToast('Valor hora registrado exitosamente', 'success');
        setNewRateOperatorId('');
        setNewRateValue('');
        loadAllConfig();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al guardar valor hora', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEditRate = (rate: any) => {
    setEditingRateId(rate.id);
    setEditingRateValue(String(rate.valorHora));
    setEditingRateActivo(rate.activo !== false);
  };

  const cancelEditRate = () => {
    setEditingRateId(null);
    setEditingRateValue('');
  };

  const handleSaveEditRate = async () => {
    if (!editingRateId) return;
    const numVal = parseFloat(editingRateValue);
    if (isNaN(numVal) || numVal < 0) {
      showToast('El valor hora debe ser un número positivo', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/rates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rateId: editingRateId,
          valorHora: numVal,
          activo: editingRateActivo,
        }),
      });
      if (res.ok) {
        showToast('Valor hora actualizado con éxito', 'success');
        setEditingRateId(null);
        loadAllConfig();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al actualizar valor hora', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteRate = async () => {
    if (!confirmDeleteRate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/rates?rateId=${confirmDeleteRate.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Operación completada', 'success');
        setConfirmDeleteRate(null);
        loadAllConfig();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al procesar eliminación', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openNewResponsable = () => {
    setEditingResp('NEW');
    setRespForm({
      nombre: '',
      email: '',
      cargo: '',
      portalHabilitado: true,
      proyectosIds: projects.map((p) => p.id),
    });
  };

  const openEditResponsable = (resp: any) => {
    setEditingResp(resp.id);
    setRespForm({
      nombre: resp.nombre,
      email: resp.email || '',
      cargo: resp.cargo || '',
      portalHabilitado: resp.portalHabilitado,
      proyectosIds: resp.proyectos.map((p: any) => p.proyectoId || p.project?.id),
    });
  };

  const handleSaveResponsable = async () => {
    if (!respForm.nombre.trim()) {
      showToast('El nombre del responsable es obligatorio', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ...respForm,
      };
      if (editingResp !== 'NEW') {
        payload.responsableId = editingResp;
      }

      const res = await fetch(`/api/clients/${clientId}/responsables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        showToast('Responsable guardado con éxito', 'success');
        if (data.initialPassword) {
          setGeneratedKeyInfo({
            nombre: respForm.nombre,
            key: data.initialPassword,
          });
        }
        setEditingResp(null);
        loadAllConfig();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al guardar responsable', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const executeRegenerarClave = async () => {
    if (!confirmRegenKey) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/responsables/${confirmRegenKey.id}/regenerar-clave`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKeyInfo({
          nombre: confirmRegenKey.nombre,
          key: data.initialPassword,
        });
        showToast('Contraseña regenerada exitosamente', 'success');
        setConfirmRegenKey(null);
      } else {
        showToast('Error al regenerar contraseña', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleProjectSelection = (pId: string) => {
    setRespForm((prev) => {
      const exists = prev.proyectosIds.includes(pId);
      return {
        ...prev,
        proyectosIds: exists ? prev.proyectosIds.filter((id) => id !== pId) : [...prev.proyectosIds, pId],
      };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    showToast('Clave copiada al portapapeles', 'info');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Configuración de Cliente
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

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 gap-2 shrink-0 overflow-x-auto bg-slate-50/30 dark:bg-slate-900/30">
          <button
            onClick={() => setActiveTab('comercial')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'comercial'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Materiales (%)
          </button>

          {isSupervisorOrAdmin && (
            <>
              <button
                onClick={() => setActiveTab('valoresHora')}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'valoresHora'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                Valores Hora
              </button>
              <button
                onClick={() => setActiveTab('responsables')}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'responsables'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                Responsables del Cliente
              </button>
              <button
                onClick={() => setActiveTab('sectores')}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === 'sectores'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4" />
                Sectores / Ubicaciones
              </button>
            </>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-semibold tracking-wide">Cargando configuración...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: COMERCIAL (% MATERIALES) */}
              {activeTab === 'comercial' && (
                <div className="space-y-6 max-w-xl">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      Ajuste de Precios de Materiales
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Configura el porcentaje de incremento (+) o descuento (-) que se aplicará automáticamente
                      sobre el precio base de los materiales de inventario utilizados en las OTs de este cliente.
                    </p>
                    <div className="flex items-center gap-4 pt-2">
                      <div className="relative w-44">
                        <input
                          type="number"
                          step="any"
                          placeholder="Ej: 5 o -5"
                          value={porcentajeInput}
                          onChange={(e) => setPorcentajeInput(e.target.value)}
                          className="w-full px-3 py-2 pr-8 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                      <button
                        onClick={handleSavePorcentaje}
                        disabled={saving}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                      >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Guardar Porcentaje
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>Nota de integridad:</strong> Este porcentaje solo se aplicará a nuevas cargas en ciclos
                      abiertos. Los ciclos históricos y las OTs ya firmadas mantendrán inalterable su precio congelado.
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: VALORES HORA POR OPERADOR */}
              {activeTab === 'valoresHora' && (
                <div className="space-y-6">
                  {/* Form to Assign Rate */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex-1">
                      <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                        Operador / Técnico
                      </label>
                      <SearchableCombobox
                        options={operatorsList.map((op) => ({
                          value: op.id,
                          label: op.nombreCompleto,
                          sublabel: op.role,
                        }))}
                        value={newRateOperatorId}
                        onChange={(val) => setNewRateOperatorId(val)}
                        placeholder="Buscar operador..."
                        searchPlaceholder="Escriba para filtrar operadores..."
                      />
                    </div>
                    <div className="w-36">
                      <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                        Valor / Hora ($)
                      </label>
                      <input
                        type="number"
                        placeholder="Ej: 12500"
                        value={newRateValue}
                        onChange={(e) => setNewRateValue(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 h-[38px]"
                      />
                    </div>
                    <div>
                      <button
                        onClick={handleAddRate}
                        disabled={saving || !newRateOperatorId || !newRateValue.trim()}
                        className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm h-[38px] disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Asignar
                      </button>
                    </div>
                  </div>

                  {/* Operator Rates Table with Edit & Delete */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2.5 px-4 font-bold text-slate-600 dark:text-slate-300">Operador</th>
                          <th className="py-2.5 px-4 font-bold text-slate-600 dark:text-slate-300">Rol</th>
                          <th className="py-2.5 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Valor Hora</th>
                          <th className="py-2.5 px-4 font-bold text-slate-600 dark:text-slate-300 text-center">Estado</th>
                          <th className="py-2.5 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {operatorRates.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No hay valores hora configurados para este cliente
                            </td>
                          </tr>
                        ) : (
                          operatorRates.map((r) => {
                            const isEditing = editingRateId === r.id;
                            const isActivo = r.activo !== false;

                            return (
                              <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                                  {r.operator?.nombreCompleto}
                                </td>
                                <td className="py-3 px-4 text-slate-500 capitalize">
                                  {r.operator?.role}
                                </td>
                                <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editingRateValue}
                                      onChange={(e) => setEditingRateValue(e.target.value)}
                                      className="w-28 px-2 py-1 text-xs font-bold rounded border border-primary text-right bg-white dark:bg-slate-800"
                                      autoFocus
                                    />
                                  ) : (
                                    `$${r.valorHora.toLocaleString('es-AR')} / h`
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isEditing ? (
                                    <button
                                      type="button"
                                      onClick={() => setEditingRateActivo(!editingRateActivo)}
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                                        editingRateActivo
                                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      {editingRateActivo ? 'Activo' : 'Inactivo'}
                                    </button>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isActivo
                                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                                      }`}
                                    >
                                      {isActivo ? 'Activo' : 'Inactivo'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={handleSaveEditRate}
                                        disabled={saving}
                                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                                        title="Guardar cambios"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={cancelEditRate}
                                        disabled={saving}
                                        className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                        title="Cancelar"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2 text-xs font-semibold">
                                      <button
                                        onClick={() => startEditRate(r)}
                                        className="text-primary hover:underline flex items-center gap-1"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                        Editar
                                      </button>
                                      <span className="text-slate-300 dark:text-slate-700">·</span>
                                      <button
                                        onClick={() => setConfirmDeleteRate(r)}
                                        className="text-rose-600 hover:underline flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Eliminar
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: RESPONSABLES DEL CLIENTE */}
              {activeTab === 'responsables' && (
                <div className="space-y-6">
                  {/* Generated Password Modal info */}
                  {generatedKeyInfo && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-black text-xs">
                          <KeyRound className="w-4 h-4" />
                          <span>Contraseña Temporal Generada para {generatedKeyInfo.nombre}</span>
                        </div>
                        <button
                          onClick={() => setGeneratedKeyInfo(null)}
                          className="p-1 rounded hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Entregue esta clave única de 8 caracteres al responsable. En su primer acceso al portal, el
                        sistema le solicitará obligatoriamente cambiarla por una contraseña definitiva.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-lg text-sm font-black font-mono tracking-wider text-emerald-600 dark:text-emerald-400">
                          {generatedKeyInfo.key}
                        </span>
                        <button
                          onClick={() => copyToClipboard(generatedKeyInfo.key)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey ? 'Copiada' : 'Copiar Clave'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Form Header */}
                  {!editingResp && (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Responsables con Acceso al Portal
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Configure los usuarios autorizados para consultar y firmar OTs de este cliente.
                        </p>
                      </div>
                      {/* Fixed: Single + icon, no "+ +" duplication */}
                      <button
                        onClick={openNewResponsable}
                        className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Nuevo Responsable
                      </button>
                    </div>
                  )}

                  {/* List of Responsables */}
                  {!editingResp && (
                    <div className="space-y-3">
                      {responsables.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                          No hay responsables configurados para este cliente. Presione &quot;Nuevo Responsable&quot; para agregar uno.
                        </div>
                      ) : (
                        responsables.map((r) => (
                          <div
                            key={r.id}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                  {r.nombre}
                                </span>
                                {r.cargo && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                                    {r.cargo}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    r.portalHabilitado
                                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                                  }`}
                                >
                                  {r.portalHabilitado ? 'Portal Habilitado' : 'Acceso Bloqueado'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {r.email || 'Sin correo electrónico'}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[10px] font-bold text-slate-400">Proyectos permitidos:</span>
                                {r.proyectos.length === 0 ? (
                                  <span className="text-[10px] text-amber-500 font-semibold">Ninguno asignado</span>
                                ) : (
                                  r.proyectos.map((p: any) => (
                                    <span
                                      key={p.id}
                                      className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium"
                                    >
                                      {p.project?.nombre}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setConfirmRegenKey({ id: r.id, nombre: r.nombre })}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                                Clave
                              </button>
                              <button
                                onClick={() => openEditResponsable(r)}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors"
                              >
                                Configurar
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Form Create/Edit Responsable */}
                  {editingResp && (
                    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {editingResp === 'NEW' ? 'Nuevo Responsable de Cliente' : 'Configurar Responsable'}
                        </h4>
                        <button
                          onClick={() => setEditingResp(null)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                            Nombre y Apellido *
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Ing. Carlos Gómez"
                            value={respForm.nombre}
                            onChange={(e) => setRespForm({ ...respForm, nombre: e.target.value })}
                            className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                            Email (Opcional)
                          </label>
                          <input
                            type="email"
                            placeholder="carlos.gomez@cliente.com"
                            value={respForm.email}
                            onChange={(e) => setRespForm({ ...respForm, email: e.target.value })}
                            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                            Cargo / Función
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Gerente de Mantenimiento"
                            value={respForm.cargo}
                            onChange={(e) => setRespForm({ ...respForm, cargo: e.target.value })}
                            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                            Estado de Acceso
                          </label>
                          <select
                            value={respForm.portalHabilitado ? 'true' : 'false'}
                            onChange={(e) => setRespForm({ ...respForm, portalHabilitado: e.target.value === 'true' })}
                            className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          >
                            <option value="true">Habilitado para ingresar al portal</option>
                            <option value="false">Acceso bloqueado / Desactivado</option>
                          </select>
                        </div>
                      </div>

                      {/* Granular Project Permissions */}
                      <div className="pt-2">
                        <label className="text-[11px] font-bold uppercase text-slate-400 mb-2 block">
                          Proyectos Autorizados (Permisos Granulares)
                        </label>
                        <p className="text-[11px] text-slate-500 mb-3">
                          El responsable solo podrá visualizar, consultar y firmar OTs correspondientes a los proyectos
                          tildados a continuación:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                          {projects.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 col-span-2 text-center">
                              No hay proyectos activos registrados para este cliente.
                            </p>
                          ) : (
                            projects.map((p) => {
                              const isChecked = respForm.proyectosIds.includes(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                    isChecked
                                      ? 'bg-primary/10 text-primary font-bold'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleProjectSelection(p.id)}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600"
                                  />
                                  <span className="truncate">{p.nombre}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setEditingResp(null)}
                          className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveResponsable}
                          disabled={saving}
                          className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
                        >
                          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Guardar Responsable
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SECTORES / UBICACIONES */}
              {activeTab === 'sectores' && isSupervisorOrAdmin && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Sectores y Ubicaciones de Planta
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Administre los sectores o áreas operativas de {clientName} para sugerir automáticamente al crear OTs.
                      </p>
                    </div>
                  </div>

                  {/* Add Sector Form */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Agregar Nuevo Sector
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                          Nombre del Sector / Ubicación *
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Fermentación, Sala de Máquinas, Planta 2..."
                          value={newSectorNombre}
                          onChange={(e) => setNewSectorNombre(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase text-slate-400 mb-1 block">
                          Proyecto (Opcional)
                        </label>
                        <select
                          value={newSectorProjectId}
                          onChange={(e) => setNewSectorProjectId(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        >
                          <option value="">General (Todos los proyectos)</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newSectorNombre.trim()) {
                            showToast('Ingrese el nombre del sector', 'error');
                            return;
                          }
                          setSaving(true);
                          try {
                            const res = await fetch(`/api/clients/${clientId}/sectores`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                nombre: newSectorNombre.trim(),
                                projectId: newSectorProjectId || null,
                              }),
                            });
                            if (res.ok) {
                              const created = await res.json();
                              setSectoresList((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                              setNewSectorNombre('');
                              setNewSectorProjectId('');
                              showToast('Sector guardado exitosamente', 'success');
                            } else {
                              const errData = await res.json();
                              showToast(errData.error || 'Error al guardar sector', 'error');
                            }
                          } catch {
                            showToast('Error de conexión', 'error');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving || !newSectorNombre.trim()}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar Sector
                      </button>
                    </div>
                  </div>

                  {/* Sectores List */}
                  <div className="space-y-2">
                    {sectoresList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        No hay sectores registrados para este cliente.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sectoresList.map((s) => (
                          <div
                            key={s.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 flex items-center justify-between gap-2 shadow-sm"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <MapPin className="w-4 h-4 text-primary shrink-0" />
                              <div className="truncate">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                                  {s.nombre}
                                </span>
                                {s.project && (
                                  <span className="text-[10px] text-slate-400 truncate block">
                                    Proyecto: {s.project.nombre}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setConfirmDeleteSector(s)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                              title="Eliminar sector"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Rate Delete */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteRate)}
        onClose={() => setConfirmDeleteRate(null)}
        onConfirm={executeDeleteRate}
        loading={saving}
        title="Eliminar valor horario"
        message={`¿Desea eliminar la tarifa horaria para ${confirmDeleteRate?.operator?.nombreCompleto}?`}
        submessage="Si el operador ya posee horas registradas en órdenes de trabajo de este cliente, la tarifa se desactivará automáticamente para preservar intactos los costos y registros históricos."
        confirmText="Eliminar / Desactivar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Confirmation Modal for Sector Delete */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteSector)}
        onClose={() => setConfirmDeleteSector(null)}
        onConfirm={async () => {
          if (!confirmDeleteSector) return;
          setSaving(true);
          try {
            const res = await fetch(`/api/clients/${clientId}/sectores?sectorId=${confirmDeleteSector.id}`, {
              method: 'DELETE',
            });
            if (res.ok) {
              setSectoresList((prev) => prev.filter((s) => s.id !== confirmDeleteSector.id));
              showToast('Sector eliminado', 'success');
              setConfirmDeleteSector(null);
            } else {
              const errData = await res.json();
              showToast(errData.error || 'Error al eliminar sector', 'error');
            }
          } catch {
            showToast('Error de conexión', 'error');
          } finally {
            setSaving(false);
          }
        }}
        loading={saving}
        title="Eliminar sector / ubicación"
        message={`¿Desea eliminar la ubicación "${confirmDeleteSector?.nombre}"?`}
        submessage="Las órdenes de trabajo existentes que hayan registrado este sector conservarán su texto histórico."
        confirmText="Eliminar Sector"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Confirmation Modal for Password Regeneration */}
      <ConfirmModal
        isOpen={Boolean(confirmRegenKey)}
        onClose={() => setConfirmRegenKey(null)}
        onConfirm={executeRegenerarClave}
        loading={saving}
        title="Regenerar contraseña de acceso"
        message={`¿Desea regenerar la contraseña inicial para ${confirmRegenKey?.nombre}?`}
        submessage="Se creará una nueva clave temporal de 8 caracteres y se obligará al usuario a cambiarla en su próximo acceso al portal de clientes."
        confirmText="Regenerar Clave"
        cancelText="Cancelar"
        variant="warning"
      />
    </div>
  );
}
