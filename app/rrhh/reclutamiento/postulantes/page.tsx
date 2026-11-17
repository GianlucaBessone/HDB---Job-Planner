'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, RefreshCw, UserPlus, Users } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Button, EmptyState, ErrorState, LoadingState, Pagination, SegmentedControl } from '@/components/ui';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { nombreCompleto } from '@/lib/rrhh/reclutamiento';
import type { PostulanteFila } from '@/lib/rrhh/reclutamientoServer';
import NuevoPostulanteDialog from '@/components/rrhh/reclutamiento/NuevoPostulanteDialog';
import {
    API, apiJson, Avatar, EstadoCandidatoBadge, formatFecha, MatchBadge, useNavReclutamiento, VeracidadBadge, type Permisos,
} from '@/components/rrhh/reclutamiento/shared';

type Filtro = 'TODOS' | 'ACTIVO' | 'BASE_TALENTOS' | 'CONTRATADO' | 'RECHAZADO';
type Orden = 'recientes' | 'match' | 'veracidad' | 'nombre';
const POR_PAGINA = 25;

function BaseTalentosView() {
    const router = useRouter();
    const params = useSearchParams();
    const [postulantes, setPostulantes] = useState<PostulanteFila[] | null>(null);
    const [permisos, setPermisos] = useState<Permisos>({ gestionar: false, eliminar: false });
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [filtro, setFiltro] = useState<Filtro>('TODOS');
    const [orden, setOrden] = useState<Orden>('recientes');
    const [pagina, setPagina] = useState(1);
    const [nuevo, setNuevo] = useState(!!params.get('nuevo'));


    // Abierto desde un enlace (?nuevo=1): se limpia la URL para que cerrar o navegar no la reabra.
    useEffect(() => {
        if (params.get('nuevo')) router.replace('/rrhh/reclutamiento/postulantes');
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const r = await apiJson<{ postulantes: PostulanteFila[]; permisos: Permisos }>(`${API}/postulantes`);
            setPostulantes(r.postulantes);
            setPermisos(r.permisos);
        } catch (e: any) {
            setError(e.message);
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { setPagina(1); }, [q, filtro, orden]);

    const registerCommand = useCommandStore(s => s.registerCommand);
    const unregisterCommand = useCommandStore(s => s.unregisterCommand);
    const abrir = useRef(() => setNuevo(true));
    useEffect(() => {
        if (!permisos.gestionar) return;
        registerCommand({ id: 'rrhh-nuevo-postulante', label: 'Nuevo postulante', description: 'Cargar un CV y analizarlo con IA', category: 'Contextual', action: () => abrir.current() });
        return () => unregisterCommand('rrhh-nuevo-postulante');
    }, [registerCommand, unregisterCommand, permisos.gestionar]);

    const conteo = useMemo(() => {
        const c: Record<string, number> = {};
        (postulantes || []).forEach(p => { c[p.status] = (c[p.status] || 0) + 1; });
        return c;
    }, [postulantes]);

    const visibles = useMemo(() => {
        const t = q.trim().toLowerCase();
        const lista = (postulantes || [])
            .filter(p => filtro === 'TODOS' || p.status === filtro)
            .filter(p => !t || [nombreCompleto(p), p.email, p.phone, p.city, p.titular, ...p.habilidades, ...p.tags].some(x => x?.toLowerCase().includes(t)));
        const porNum = (k: 'mejorMatch' | 'veracidad') => (a: PostulanteFila, b: PostulanteFila) => (b[k] ?? -1) - (a[k] ?? -1);
        if (orden === 'match') lista.sort(porNum('mejorMatch'));
        else if (orden === 'veracidad') lista.sort(porNum('veracidad'));
        else if (orden === 'nombre') lista.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
        return lista;
    }, [postulantes, filtro, orden, q]);

    const pagina_ = visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
    const nav = useNavReclutamiento('postulantes', { postulantes: postulantes?.length });
    const hayFiltros = !!q || filtro !== 'TODOS';

    return (
        <div className="w-full space-y-4">
            <ModuleHeader
                title="Base de talentos"
                description="Todos los postulantes, actuales y de búsquedas anteriores"
                icon={<Users />}
                {...nav}
                searchValue={q}
                onSearchChange={setQ}
                searchPlaceholder="Nombre, perfil, habilidad, ciudad…"
                actions={[
                    { id: 'refresh', label: 'Actualizar', icon: <RefreshCw />, onClick: cargar, variant: 'ghost', hideLabelOnMobile: true },
                    ...(permisos.gestionar ? [{ id: 'nuevo', label: 'Nuevo postulante', icon: <UserPlus />, onClick: () => setNuevo(true), variant: 'primary' as const }] : []),
                ]}
            />

            <div className="flex flex-wrap items-center gap-2">
                <div className="max-w-full overflow-x-auto">
                    <SegmentedControl<Filtro>
                        label="Estado del postulante"
                        value={filtro}
                        onChange={setFiltro}
                        options={[
                            { value: 'TODOS', label: 'Todos' },
                            { value: 'ACTIVO', label: `En proceso (${conteo.ACTIVO || 0})` },
                            { value: 'BASE_TALENTOS', label: `Disponibles (${conteo.BASE_TALENTOS || 0})` },
                            { value: 'CONTRATADO', label: `Contratados (${conteo.CONTRATADO || 0})` },
                            { value: 'RECHAZADO', label: `No aptos (${conteo.RECHAZADO || 0})` },
                        ]}
                    />
                </div>
                <select className="input w-auto" aria-label="Ordenar por" value={orden} onChange={e => setOrden(e.target.value as Orden)}>
                    <option value="recientes">Más recientes</option>
                    <option value="match">Mejor match</option>
                    <option value="veracidad">Mayor veracidad</option>
                    <option value="nombre">Nombre</option>
                </select>
            </div>

            {error ? (
                <ErrorState description={error} onRetry={cargar} />
            ) : !postulantes ? (
                <LoadingState label="Cargando la base de talentos…" />
            ) : visibles.length === 0 ? (
                <EmptyState
                    icon={<Users />}
                    title={postulantes.length === 0 ? 'La base de talentos está vacía' : 'Sin resultados'}
                    description={postulantes.length === 0 ? 'Subí un CV en PDF: la IA completa los datos, las habilidades y el índice de veracidad.' : 'Probá con otra búsqueda o estado.'}
                    action={postulantes.length === 0 && permisos.gestionar
                        ? <Button icon={<UserPlus />} onClick={() => setNuevo(true)}>Cargar el primero</Button>
                        : hayFiltros ? <Button variant="secondary" onClick={() => { setQ(''); setFiltro('TODOS'); }}>Limpiar filtros</Button> : undefined}
                />
            ) : (
                <div className="surface overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="px-4 py-2">Postulante</th>
                                    <th className="px-4 py-2">Perfil</th>
                                    <th className="px-4 py-2 hidden lg:table-cell">Habilidades</th>
                                    <th className="px-4 py-2">Veracidad</th>
                                    <th className="px-4 py-2">Mejor match</th>
                                    <th className="px-4 py-2">Estado</th>
                                    <th className="px-4 py-2 hidden md:table-cell">Alta</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {pagina_.map(p => (
                                    <tr
                                        key={p.id}
                                        onClick={() => router.push(`/rrhh/reclutamiento/postulantes/${p.id}`)}
                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                    >
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2.5 min-w-[180px]">
                                                <Avatar persona={p} size="sm" />
                                                <div className="min-w-0">
                                                    <a
                                                        href={`/rrhh/reclutamiento/postulantes/${p.id}`}
                                                        onClick={e => { e.preventDefault(); router.push(`/rrhh/reclutamiento/postulantes/${p.id}`); }}
                                                        className="text-[13px] font-medium text-foreground hover:underline flex items-center gap-1"
                                                    >
                                                        {nombreCompleto(p)}
                                                        {p.tieneCv && <FileText className="w-3.5 h-3.5 text-muted-foreground" aria-label="Tiene CV" />}
                                                    </a>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">{p.email || p.phone || '—'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <p className="text-[13px] text-foreground truncate max-w-[220px]">{p.titular || '—'}</p>
                                            {p.city && <p className="text-xs text-muted-foreground truncate max-w-[220px]">{p.city}</p>}
                                        </td>
                                        <td className="px-4 py-2 hidden lg:table-cell">
                                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                                                {p.habilidades.slice(0, 3).map(h => <span key={h} className="badge badge-neutral">{h}</span>)}
                                                {p.habilidades.length > 3 && <span className="badge badge-neutral">+{p.habilidades.length - 3}</span>}
                                                {p.habilidades.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2"><VeracidadBadge puntaje={p.veracidad} /></td>
                                        <td className="px-4 py-2"><MatchBadge puntaje={p.mejorMatch} /></td>
                                        <td className="px-4 py-2">
                                            <div className="flex flex-col items-start gap-0.5">
                                                <EstadoCandidatoBadge estado={p.status} />
                                                {p.procesosActivos > 0 && <span className="text-xs text-muted-foreground">{p.procesosActivos} {p.procesosActivos === 1 ? 'proceso' : 'procesos'}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 hidden md:table-cell text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatFecha(p.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {visibles.length > POR_PAGINA && (
                        <div className="border-t border-border px-4 py-2">
                            <Pagination page={pagina} pageSize={POR_PAGINA} total={visibles.length} onPageChange={setPagina} />
                        </div>
                    )}
                </div>
            )}

            <NuevoPostulanteDialog
                open={nuevo}
                onClose={() => { setNuevo(false); }}
                onGuardado={id => router.push(`/rrhh/reclutamiento/postulantes/${id}`)}
            />
        </div>
    );
}

export default function BaseTalentosPage() {
    return (
        <Suspense fallback={<LoadingState label="Cargando la base de talentos…" />}>
            <BaseTalentosView />
        </Suspense>
    );
}
