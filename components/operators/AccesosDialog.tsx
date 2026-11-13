'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, ErrorState, Input, LoadingState, SegmentedControl, Tabs } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import {
    EfectoPermiso,
    agruparFunciones,
    claveFuncion,
    claveVista,
    normalizarRol,
} from '@/lib/permisos';
import { DEFAULT_SECTIONS, DEFAULT_VIEWS, VISTAS_DESACTIVADAS, ViewConfig } from '@/lib/viewAccess';
import { useAccessStore } from '@/lib/store/useAccessStore';

interface AccesosDialogProps {
    /** Usuario cuyos accesos se editan; null cierra el diálogo. */
    operator: { id: string; nombreCompleto: string; role?: string | null } | null;
    currentUserId?: string;
    onClose: () => void;
}

type Modo = 'rol' | EfectoPermiso;

interface Item {
    clave: string;
    label: string;
    description: string;
    /** Lo que da el rol del usuario sin permisos especiales. */
    porRol: boolean;
}

interface Grupo {
    titulo: string;
    items: Item[];
}

const ROLE_LABEL: Record<string, string> = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    operador: 'Operador',
    qa: 'Calidad',
    vendedor: 'Vendedor',
};

const CLAVE_ADMINISTRAR_ACCESOS = claveFuncion('usuarios.accesos');

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Editor de accesos de un usuario: parte de lo que le da su rol y permite
 * otorgarle o quitarle vistas y funciones puntuales (lib/permisos.ts).
 */
export default function AccesosDialog({ operator, currentUserId, onClose }: AccesosDialogProps) {
    const [tab, setTab] = useState<'vistas' | 'funciones'>('vistas');
    const [busqueda, setBusqueda] = useState('');
    const [views, setViews] = useState<ViewConfig[]>(DEFAULT_VIEWS);
    const [especiales, setEspeciales] = useState<Record<string, EfectoPermiso>>({});
    const [guardados, setGuardados] = useState<Record<string, EfectoPermiso>>({});
    const [disponible, setDisponible] = useState(true);
    const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
    const [guardando, setGuardando] = useState(false);

    const operatorId = operator?.id;
    const role = normalizarRol(operator?.role) || 'operador';

    const cargar = async (id: string) => {
        setEstado('cargando');
        try {
            const [accesosRes, viewsRes] = await Promise.all([
                safeApiRequest(`/api/accesos/usuarios/${id}`),
                safeApiRequest('/api/config/views'),
            ]);
            if (!accesosRes.ok) throw new Error();
            const data = await accesosRes.json();
            const mapa: Record<string, EfectoPermiso> = {};
            for (const p of data.permisos || []) {
                if (p.efecto === 'permitir' || p.efecto === 'denegar') mapa[p.clave] = p.efecto;
            }
            setEspeciales(mapa);
            setGuardados(mapa);
            setDisponible(data.disponible !== false);
            if (viewsRes.ok) {
                const v = await viewsRes.json();
                if (Array.isArray(v) && v.length > 0) setViews(v);
            }
            setEstado('listo');
        } catch {
            setEstado('error');
        }
    };

    useEffect(() => {
        if (!operatorId) return;
        setTab('vistas');
        setBusqueda('');
        cargar(operatorId);
    }, [operatorId]);

    const gruposVistas = useMemo<Grupo[]>(() => {
        return DEFAULT_SECTIONS.map(section => ({
            titulo: section.label,
            items: views
                .filter(v => v.section === section.key && !VISTAS_DESACTIVADAS.includes(v.key))
                .map(v => ({
                    clave: claveVista(v.key),
                    label: v.label,
                    description: v.description,
                    porRol: v.roles.includes(role),
                })),
        })).filter(g => g.items.length > 0);
    }, [views, role]);

    const gruposFunciones = useMemo<Grupo[]>(() => {
        return agruparFunciones().map(g => ({
            titulo: g.grupo,
            items: g.funciones.map(f => ({
                clave: claveFuncion(f.id),
                label: f.label,
                description: f.description,
                porRol: f.roles.includes(role),
            })),
        }));
    }, [role]);

    const cantidad = (grupos: Grupo[]) =>
        grupos.reduce((n, g) => n + g.items.filter(i => especiales[i.clave]).length, 0);

    const grupos = tab === 'vistas' ? gruposVistas : gruposFunciones;
    const q = normalize(busqueda.trim());
    const gruposFiltrados = q
        ? grupos
            .map(g => ({ ...g, items: g.items.filter(i => normalize(`${i.label} ${i.description}`).includes(q)) }))
            .filter(g => g.items.length > 0)
        : grupos;

    const totalEspeciales = Object.keys(especiales).length;
    const hayCambios = useMemo(() => {
        const a = Object.keys(especiales);
        const b = Object.keys(guardados);
        return a.length !== b.length || a.some(k => especiales[k] !== guardados[k]);
    }, [especiales, guardados]);

    const setModo = (clave: string, modo: Modo) => {
        setEspeciales(prev => {
            const next = { ...prev };
            if (modo === 'rol') delete next[clave];
            else next[clave] = modo;
            return next;
        });
    };

    const guardar = async () => {
        if (!operator) return;
        setGuardando(true);
        try {
            const res = await safeApiRequest(`/api/accesos/usuarios/${operator.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    permisos: Object.entries(especiales).map(([clave, efecto]) => ({ clave, efecto })),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showToast(data?.error || 'No se pudieron guardar los accesos', 'error');
                return;
            }
            showToast(`Accesos de ${operator.nombreCompleto} actualizados`);
            // Si el usuario se editó a sí mismo, el menú se actualiza en el momento
            if (operator.id === currentUserId) {
                const store = useAccessStore.getState();
                store.cargar({ id: operator.id, role: store.role });
            }
            onClose();
        } catch {
            showToast('No se pudieron guardar los accesos', 'error');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog
            open={!!operator}
            onClose={onClose}
            dismissible={!guardando}
            size="xl"
            title={`Accesos de ${operator?.nombreCompleto ?? ''}`}
            description={`Rol: ${ROLE_LABEL[role] || role}. El rol define los accesos por defecto; acá podés otorgarle o quitarle accesos puntuales a este usuario.`}
            footer={
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                    <div className="flex items-center gap-3">
                        <span className="text-[13px] text-muted-foreground">
                            {totalEspeciales === 0
                                ? 'Sin permisos especiales: rige el rol'
                                : `${totalEspeciales} ${totalEspeciales === 1 ? 'permiso especial' : 'permisos especiales'}`}
                        </span>
                        {totalEspeciales > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={guardando}
                                onClick={() => setEspeciales(prev => {
                                    // El permiso propio de administrar accesos no se toca desde acá
                                    const propio = operator?.id === currentUserId ? prev[CLAVE_ADMINISTRAR_ACCESOS] : undefined;
                                    return propio ? { [CLAVE_ADMINISTRAR_ACCESOS]: propio } : {};
                                })}
                            >
                                Volver todo al rol
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                        <Button onClick={guardar} isLoading={guardando} disabled={!hayCambios || !disponible || estado !== 'listo'}>
                            Guardar accesos
                        </Button>
                    </div>
                </div>
            }
        >
            {estado === 'cargando' && <LoadingState label="Cargando accesos…" />}
            {estado === 'error' && (
                <ErrorState
                    title="No se pudieron cargar los accesos"
                    onRetry={operatorId ? () => cargar(operatorId) : undefined}
                />
            )}
            {estado === 'listo' && (
                <div className="space-y-4">
                    {!disponible && (
                        <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-300 px-3 py-2 text-[13px]">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                                El control de accesos todavía no está activo en la base de datos. Hasta que se
                                actualice, rigen solo los roles y no se pueden guardar permisos especiales.
                            </span>
                        </div>
                    )}

                    <Tabs
                        label="Tipo de acceso"
                        value={tab}
                        onChange={(id) => setTab(id as 'vistas' | 'funciones')}
                        tabs={[
                            { id: 'vistas', label: 'Vistas', count: cantidad(gruposVistas) || undefined },
                            { id: 'funciones', label: 'Funciones', count: cantidad(gruposFunciones) || undefined },
                        ]}
                    />

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder={tab === 'vistas' ? 'Buscar vista…' : 'Buscar función…'}
                            aria-label={tab === 'vistas' ? 'Buscar vista' : 'Buscar función'}
                            className="pl-9"
                        />
                    </div>

                    {gruposFiltrados.length === 0 ? (
                        <EmptyState compact title="Sin resultados" description="Probá con otro término de búsqueda." />
                    ) : (
                        gruposFiltrados.map(grupo => (
                            <section key={grupo.titulo} aria-label={grupo.titulo}>
                                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                                    {grupo.titulo}
                                </h3>
                                <ul className="rounded-xl border border-border divide-y divide-border bg-card">
                                    {grupo.items.map(item => {
                                        const especial = especiales[item.clave];
                                        const modo: Modo = especial ?? 'rol';
                                        const efectivo = especial ? especial === 'permitir' : item.porRol;
                                        const bloqueado = item.clave === CLAVE_ADMINISTRAR_ACCESOS && operator?.id === currentUserId;
                                        return (
                                            <li key={item.clave} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-3 py-2.5">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                                                        <Badge tone={efectivo ? 'success' : 'neutral'}>
                                                            {efectivo ? 'Con acceso' : 'Sin acceso'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[12px] text-muted-foreground truncate">
                                                        {bloqueado
                                                            ? 'No podés cambiar tu propio permiso de administrar accesos.'
                                                            : item.description}
                                                    </p>
                                                </div>
                                                <div className={bloqueado ? 'opacity-50 pointer-events-none' : undefined} aria-disabled={bloqueado || undefined}>
                                                    <SegmentedControl<Modo>
                                                        label={`Acceso a ${item.label}`}
                                                        value={modo}
                                                        onChange={(v) => setModo(item.clave, v)}
                                                        options={[
                                                            { value: 'rol', label: item.porRol ? 'Según rol (sí)' : 'Según rol (no)' },
                                                            { value: 'permitir', label: 'Permitir' },
                                                            { value: 'denegar', label: 'Denegar' },
                                                        ]}
                                                    />
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))
                    )}
                </div>
            )}
        </Dialog>
    );
}
