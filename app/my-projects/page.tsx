'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Package } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, EmptyState, Panel, SegmentedControl, Skeleton } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useViewState } from '@/lib/hooks/useViewState';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { STATUS_CONFIG } from '@/lib/projectTypes';

interface ProyectoLista {
    id: string;
    nombre: string;
    codigoProyecto?: string | null;
    tags: string[];
    estado: string;
    client?: { nombre: string } | null;
    responsableUser?: { nombreCompleto: string } | null;
    checklistItems: { completed: boolean }[];
    miRol: 'responsable' | 'equipo' | null;
}

interface Delegacion {
    id: string;
    cantidadADevolver: number;
    delegadoPorNombre: string;
    material: { nombre: string; unidad: string; proyecto: { nombre: string } };
}

const TONO_ESTADO: Record<string, BadgeTone> = {
    por_hacer: 'neutral', planificado: 'info', activo: 'success', en_riesgo: 'warning', atrasado: 'danger', finalizado: 'neutral', archivado: 'neutral',
};

const normalizar = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mis proyectos (auditoría, FU11): la lista de proyectos filtrada a los de la persona
 * (responsable o en el equipo asignado). Cada proyecto se abre en su ficha, la misma
 * que usa Proyectos. Antes esta pantalla tenía su propia versión del detalle.
 */
export default function MisProyectosPage() {
    const { puede } = useAcceso();
    const verTodosPermitido = puede('proyectos.crear');
    const [usuarioId, setUsuarioId] = useState<string | null>(null);
    const [proyectos, setProyectos] = useState<ProyectoLista[]>([]);
    const [cargando, setCargando] = useState(true);
    const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
    const [procesando, setProcesando] = useState(false);

    const [filtros, setFiltros] = useViewState('my-projects-filters', { searchTerm: '', viewAll: false });
    const verTodos = verTodosPermitido && filtros.viewAll;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const search = params.get('search');
        if (search) setFiltros({ searchTerm: search, ...(params.get('all') === 'true' ? { viewAll: true } : {}) });
        try {
            const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (u?.id) setUsuarioId(u.id);
        } catch { /* la API usa la sesión */ }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const res = await safeApiRequest(`/api/projects/my-projects${verTodos ? '?all=true' : ''}`);
            const data = await res.json();
            setProyectos(Array.isArray(data) ? data : []);
        } catch {
            showToast('No se pudieron cargar los proyectos', 'error');
        } finally {
            setCargando(false);
        }
    }, [verTodos]);

    const cargarDelegaciones = useCallback(async () => {
        if (!usuarioId) return;
        try {
            const data = await safeApiRequest(`/api/materiales-proyecto/delegaciones?userId=${usuarioId}`).then(r => r.json());
            setDelegaciones(Array.isArray(data) ? data : []);
        } catch { /* sin delegaciones */ }
    }, [usuarioId]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { cargarDelegaciones(); }, [cargarDelegaciones]);

    // Atajo "r" del buscador global: actualizar
    const registerCommand = useCommandStore(s => s.registerCommand);
    const unregisterCommand = useCommandStore(s => s.unregisterCommand);
    const recargar = useRef(cargar);
    useEffect(() => { recargar.current = cargar; });
    useEffect(() => {
        registerCommand({ id: 'my-projects-refresh', label: 'Actualizar Mis proyectos', category: 'Contextual', keys: ['r'], action: () => recargar.current() });
        return () => unregisterCommand('my-projects-refresh');
    }, [registerCommand, unregisterCommand]);

    const responder = async (ids: string[], estado: 'pendiente' | 'delegacion_rechazada') => {
        setProcesando(true);
        let errores = 0;
        for (const id of ids) {
            const res = await safeApiRequest('/api/materiales-proyecto/devolucion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, estado, operatorId: usuarioId }),
            }).catch(() => null);
            if (!res?.ok) errores++;
        }
        setProcesando(false);
        if (errores) showToast(`No se pudieron procesar ${errores} delegaciones`, 'error');
        else showToast(estado === 'pendiente' ? (ids.length > 1 ? 'Delegaciones aceptadas' : 'Delegación aceptada') : 'Delegación rechazada', 'success');
        cargarDelegaciones();
    };

    const visibles = useMemo(() => {
        const q = normalizar(filtros.searchTerm);
        if (!q) return proyectos;
        return proyectos.filter(p =>
            normalizar(p.nombre).includes(q) || normalizar(p.client?.nombre || '').includes(q) || normalizar(p.codigoProyecto || '').includes(q)
        );
    }, [proyectos, filtros.searchTerm]);

    return (
        <div className="w-full space-y-6">
            <ModuleHeader
                title="Mis proyectos"
                description={verTodos ? 'Todos los proyectos en curso' : 'Donde sos responsable o estás en el equipo asignado'}
                icon={<ClipboardList />}
                searchValue={filtros.searchTerm}
                onSearchChange={v => setFiltros({ searchTerm: v })}
                searchPlaceholder="Buscar por nombre, cliente o código…"
                toolbar={verTodosPermitido ? (
                    <SegmentedControl<'mios' | 'todos'>
                        label="Proyectos a mostrar"
                        value={verTodos ? 'todos' : 'mios'}
                        onChange={v => setFiltros({ viewAll: v === 'todos' })}
                        options={[{ value: 'mios', label: 'Míos' }, { value: 'todos', label: 'Todos' }]}
                    />
                ) : undefined}
            />

            {delegaciones.length > 0 && (
                <Panel
                    title="Materiales que te delegaron"
                    description="Aceptalos para hacerte cargo de devolverlos al depósito"
                    actions={
                        <button type="button" className="btn btn-primary btn-sm" disabled={procesando} onClick={() => responder(delegaciones.map(d => d.id), 'pendiente')}>
                            {procesando ? 'Procesando…' : 'Aceptar todas'}
                        </button>
                    }
                >
                    <ul className="divide-y divide-border">
                        {delegaciones.map(d => (
                            <li key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                        <Package className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                        {d.material.nombre} <span className="text-muted-foreground">({d.cantidadADevolver} {d.material.unidad})</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">De {d.delegadoPorNombre} · {d.material.proyecto.nombre}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button type="button" className="btn btn-secondary btn-sm" disabled={procesando} onClick={() => responder([d.id], 'delegacion_rechazada')}>Rechazar</button>
                                    <button type="button" className="btn btn-primary btn-sm" disabled={procesando} onClick={() => responder([d.id], 'pendiente')}>Aceptar</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}

            {cargando ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
                </div>
            ) : visibles.length === 0 ? (
                <EmptyState
                    title={filtros.searchTerm ? 'Sin resultados' : 'No tenés proyectos en curso'}
                    description={filtros.searchTerm ? 'Probá con otro nombre, cliente o código.' : 'Acá aparecen los proyectos donde sos responsable o estás en el equipo asignado.'}
                />
            ) : (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibles.map(p => {
                        const total = p.checklistItems.length;
                        const hechos = p.checklistItems.filter(i => i.completed).length;
                        const avance = total ? Math.round((hechos / total) * 100) : 0;
                        return (
                            <li key={p.id}>
                                <Link
                                    href={`/projects/ficha/${p.id}`}
                                    className="block h-full rounded-xl border border-border bg-card p-4 space-y-3 hover:border-brand-400 hover:shadow-sm transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-mono text-muted-foreground">{p.codigoProyecto || 'Sin código'}</p>
                                            <h2 className="text-base font-semibold text-foreground truncate">{p.nombre}</h2>
                                            <p className="text-sm text-muted-foreground truncate">{p.client?.nombre || 'Sin cliente'}</p>
                                        </div>
                                        <Badge tone={TONO_ESTADO[p.estado] || 'neutral'}>{STATUS_CONFIG[p.estado as keyof typeof STATUS_CONFIG]?.label ?? p.estado}</Badge>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                            <span>Checklist</span>
                                            <span className="tabular-nums">{total ? `${avance}%` : 'Sin ítems'}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance del checklist de ${p.nombre}`}>
                                            <div className={`h-full ${avance === 100 ? 'bg-success-500' : 'bg-brand-500'}`} style={{ width: `${avance}%` }} />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {p.miRol === 'responsable' && <Badge tone="brand">Responsable</Badge>}
                                        {p.miRol === 'equipo' && <Badge tone="info">En el equipo</Badge>}
                                        {verTodos && p.responsableUser && <span className="text-xs text-muted-foreground">Responsable: {p.responsableUser.nombreCompleto}</span>}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
