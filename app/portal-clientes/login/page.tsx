'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  KeyRound,
  User,
  Building2,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ResponsableOption {
  id: string;
  nombre: string;
  cargo?: string;
  hasPassword?: boolean;
  mustChangePassword?: boolean;
  client: { id: string; nombre: string };
}

function PortalLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteId = searchParams.get('clienteId') || searchParams.get('clientId');

  const [responsables, setResponsables] = useState<ResponsableOption[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [existingSession, setExistingSession] = useState<any | null>(null);

  // Check if session is already active in browser without blind auto-redirect
  useEffect(() => {
    fetch('/api/portal-clientes/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.responsable) {
          setExistingSession(data.responsable);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadResponsables();
  }, [clienteId]);

  const loadResponsables = async () => {
    setLoadingList(true);
    try {
      const url = clienteId
        ? `/api/portal-clientes/auth/responsables?clientId=${encodeURIComponent(clienteId)}`
        : '/api/portal-clientes/auth/responsables';
      const res = await fetch(url);
      if (res.ok) {
        const data: ResponsableOption[] = await res.json();
        setResponsables(data);
        if (data.length === 1) {
          setSelectedResponsibleId(data[0].id);
        }
      }
    } catch {
      setErrorMsg('Error al conectar con el servidor');
    } finally {
      setLoadingList(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResponsibleId || !password) {
      setErrorMsg('Seleccione su nombre e ingrese su clave');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/portal-clientes/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responsibleId: selectedResponsibleId,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Acceso autorizado', 'success');
        if (data.mustChangePassword) {
          router.push('/portal-clientes/primer-acceso');
        } else {
          router.push('/portal-clientes');
        }
      } else {
        setErrorMsg(data.error || 'Credenciales inválidas');
      }
    } catch {
      setErrorMsg('Error de red al intentar iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedResp = responsables.find((r) => r.id === selectedResponsibleId);
  const detectedClient = responsables.length > 0 ? responsables[0].client : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-1">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Portal de Clientes
          </h1>
          {clienteId && detectedClient ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{detectedClient.nombre}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              HDB Servicios Eléctricos · Acceso Seguro a Órdenes de Trabajo
            </p>
          )}
        </div>

        {/* Active session banner if user already has an active cookie in browser */}
        {existingSession && (
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block mb-0.5">
                  Sesión Activa en este equipo
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {existingSession.nombre} ·{' '}
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    {existingSession.cliente?.nombre}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/portal-clientes')}
                className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-sm transition-colors shrink-0 flex items-center gap-1"
              >
                <span>Continuar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-blue-100 dark:border-blue-900/40 text-[11px]">
              <span className="text-slate-500">¿Desea ingresar con otra persona?</span>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/portal-clientes/auth/logout', { method: 'POST' });
                  setExistingSession(null);
                  showToast('Sesión cerrada. Ingrese con sus credenciales.', 'info');
                }}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Cerrar sesión actual
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {clienteId && !loadingList && responsables.length === 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-2">
            <span>No hay responsables activos configurados para este cliente.</span>
            <button
              type="button"
              onClick={() => router.push('/portal-clientes/login')}
              className="text-xs font-bold underline shrink-0 hover:text-amber-800 dark:hover:text-amber-300"
            >
              Ver todos
            </button>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Dropdown Responsable */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Responsable Autorizado
            </label>
            <div className="relative">
              <select
                value={selectedResponsibleId}
                onChange={(e) => {
                  setSelectedResponsibleId(e.target.value);
                  setErrorMsg('');
                }}
                disabled={loadingList}
                required
                className="w-full px-3.5 py-3 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">
                  {loadingList
                    ? 'Cargando responsables...'
                    : responsables.length === 0
                    ? 'No hay responsables registrados'
                    : 'Seleccione su nombre de la lista...'}
                </option>
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} {r.cargo ? `· ${r.cargo}` : ''} {!clienteId ? `(${r.client.nombre})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {selectedResp && !clienteId && (
              <p className="text-[11px] text-primary font-bold mt-1 px-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {selectedResp.client.nombre}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>
                {selectedResp && selectedResp.hasPassword === false
                  ? 'Crear Contraseña (Primer Acceso)'
                  : 'Contraseña'}
              </span>
              {selectedResp && selectedResp.hasPassword === false && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                  Primer Acceso
                </span>
              )}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="password"
                placeholder={
                  selectedResp && selectedResp.hasPassword === false
                    ? 'Cree su contraseña personal (mín. 6 caracteres)...'
                    : 'Ingrese su contraseña...'
                }
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                required
                className="w-full pl-10 pr-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {selectedResp && selectedResp.hasPassword === false && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Al ser su primer ingreso, la clave que digite aquí quedará guardada como su contraseña personal de acceso.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedResponsibleId || !password}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando...
              </>
            ) : selectedResp && selectedResp.hasPassword === false ? (
              <>
                Guardar Contraseña e Ingresar
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Ingresar al Portal
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center">
          <p className="text-[11px] text-slate-400">
            ¿No dispone de clave o no aparece en la lista? Solicite acceso al supervisor asignado de HDB.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <PortalLoginForm />
    </Suspense>
  );
}
