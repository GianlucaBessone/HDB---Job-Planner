'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plane, Plus, RefreshCw, Settings } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { showToast } from '@/components/Toast';
import { EmptyState, ErrorState, LoadingState, Stat, Tooltip } from '@/components/ui';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { esGestorViajes, formatRangoFechas, MODALIDAD_CORTA, type ModalidadFondos } from '@/lib/viajes';
import ViajeFormDialog from '@/components/viajes/ViajeFormDialog';
import TarifasDialog from '@/components/viajes/TarifasDialog';
import { apiJson, BarraConsumo, EstadoViajeBadge, money, Ruta } from '@/components/viajes/shared';

type Tab = 'activos' | 'por_rendir' | 'cerrados' | 'cancelados';

const TAB_ESTADOS: Record<Tab, string[]> = {
    activos: ['planificado', 'en_curso'],
    por_rendir: ['finalizado'],
    cerrados: ['cerrado'],
    cancelados: ['cancelado'],
};

export default function ViajesAdminPage() {
    const router = useRouter();
    const [role, setRole] = useState<string | null>(null);
    const [viajes, setViajes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [q, setQ] = useState('');
    const [tab, setTab] = useState<Tab>('activos');
    const [nuevoOpen, setNuevoOpen] = useState(false);
    const [tarifasOpen, setTarifasOpen] = useState(false);

    useEffect(() => {
        try { setRole((JSON.parse(localStorage.getItem('currentUser') || '{}').role || 'operador').toLowerCase()); } catch { setRole('operador'); }
    }, []);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
            setViajes(await apiJson(`/api/viajes${qs}`));
        } catch (e: any) {
            setError(true);
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [q]);

    useEffect(() => {
        if (role === null || !esGestorViajes(role)) return;
        const t = setTimeout(cargar, 250);
        return () => clearTimeout(t);
    }, [cargar, role]);

    const registerCommand = useCommandStore(s => s.registerCommand);
    const unregisterCommand = useCommandStore(s => s.unregisterCommand);
    const abrirNuevo = useRef(() => setNuevoOpen(true));
    useEffect(() => {
        registerCommand({
            id: 'viajes-nuevo',
            label: 'Nuevo viaje',
            description: 'Planificar un viaje y sus viáticos',
            category: 'Contextual',
            keywords: ['viático', 'viaje', 'anticipo', 'rendición'],
            action: () => abrirNuevo.current(),
        });
        return () => unregisterCommand('viajes-nuevo');
    }, [registerCommand, unregisterCommand]);

    const porTab = useMemo(() => {
        const r: Record<Tab, any[]> = { activos: [], por_rendir: [], cerrados: [], cancelados: [] };
        for (const v of viajes) {
            (Object.keys(TAB_ESTADOS) as Tab[]).forEach(t => { if (TAB_ESTADOS[t].includes(v.estado)) r[t].push(v); });
        }
        return r;
    }, [viajes]);

    const activos = porTab.activos;
    const stats = useMemo(() => ({
        enCurso: viajes.filter(v => v.estado === 'en_curso').length,
        porRendir: porTab.por_rendir.length,
        estimado: activos.reduce((s, v) => s + v.resumen.estimado, 0),
        gastado: activos.reduce((s, v) => s + v.resumen.gastado, 0),
    }), [viajes, porTab, activos]);

    if (role !== null && !esGestorViajes(role)) {
        return (
            <EmptyState
                icon={<Plane />}
                title="Esta vista es de administración"
                description="Tus viajes y gastos están en Mis Viajes."
                action={<Link href="/mis-viajes" className="btn btn-primary">Ir a Mis Viajes</Link>}
            />
        );
    }

    const lista = porTab[tab];

    return (
        <div>
            <ModuleHeader
                title="Viajes y Viáticos"
                description="Planificación de viajes, fondos entregados y rendición de gastos"
                icon={<Plane />}
                searchValue={q}
                onSearchChange={setQ}
                searchPlaceholder="Buscar por código, destino o responsable…"
                toolbar={
                    <Tooltip content="Valores de referencia">
                        <button type="button" className="btn btn-secondary btn-icon" onClick={() => setTarifasOpen(true)} aria-label="Valores de referencia de viáticos">
                            <Settings />
                        </button>
                    </Tooltip>
                }
                actions={[
                    { id: 'refresh', label: 'Actualizar', icon: <RefreshCw />, onClick: cargar, variant: 'outline', hideLabelOnMobile: true },
                    { id: 'nuevo', label: 'Nuevo viaje', icon: <Plus />, onClick: () => setNuevoOpen(true), variant: 'primary' },
                ]}
                tabs={[
                    { id: 'activos', label: 'Activos', count: porTab.activos.length },
                    { id: 'por_rendir', label: 'Por rendir', count: porTab.por_rendir.length },
                    { id: 'cerrados', label: 'Cerrados', count: porTab.cerrados.length },
                    { id: 'cancelados', label: 'Cancelados', count: porTab.cancelados.length },
                ]}
                activeTabId={tab}
                onTabChange={id => setTab(id as Tab)}
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <Stat label="En curso" value={stats.enCurso} />
                <Stat label="Por rendir" value={stats.porRendir} tone={stats.porRendir > 0 ? 'warning' : 'neutral'} />
                <Stat label="Estimado activos" value={money(stats.estimado)} />
                <Stat label="Gastado activos" value={money(stats.gastado)} hint={stats.estimado > 0 ? `${Math.round((stats.gastado / stats.estimado) * 100)}% del estimado` : undefined} />
            </div>

            {loading && viajes.length === 0 ? (
                <LoadingState label="Cargando viajes…" />
            ) : error && viajes.length === 0 ? (
                <ErrorState onRetry={cargar} />
            ) : lista.length === 0 ? (
                <div className="surface">
                    <EmptyState
                        icon={<Plane />}
                        title={q ? 'Sin resultados' : tab === 'activos' ? 'No hay viajes activos' : tab === 'por_rendir' ? 'No hay viajes por rendir' : 'Sin viajes en esta pestaña'}
                        description={q ? 'Probá con otro código, destino o responsable.' : tab === 'activos' ? 'Planificá un viaje para asignarle un responsable y sus viáticos.' : undefined}
                        action={q
                            ? <button className="btn btn-secondary" onClick={() => setQ('')}>Limpiar búsqueda</button>
                            : tab === 'activos' ? <button className="btn btn-primary" onClick={() => setNuevoOpen(true)}><Plus /> Nuevo viaje</button> : undefined}
                    />
                </div>
            ) : (
                <>
                    {/* Escritorio */}
                    <div className="surface overflow-x-auto hidden md:block">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className="text-left">Viaje</th>
                                    <th className="text-left">Fechas</th>
                                    <th className="text-left">Responsable</th>
                                    <th className="text-left">Fondos</th>
                                    <th className="text-right">Gastado / estimado</th>
                                    <th className="text-left">Estado</th>
                                    <th><span className="sr-only">Abrir</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lista.map(v => (
                                    <tr key={v.id} className="cursor-pointer" onClick={() => router.push(`/viajes/${v.id}`)}>
                                        <td className="max-w-[320px]">
                                            <Link href={`/viajes/${v.id}`} className="block" onClick={e => e.stopPropagation()}>
                                                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v.codigo}</span>
                                                <span className="block font-medium text-slate-900 dark:text-slate-100 truncate">{v.motivo}</span>
                                                <Ruta origen={v.origen} destino={v.destino} className="text-xs text-slate-500 dark:text-slate-400 max-w-full" />
                                            </Link>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            {formatRangoFechas(v.fechaInicio, v.fechaFin)}
                                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                {v.resumen.dias} días · {v.resumen.personas} pers.
                                                {v.fechaFin !== v.fechaFinOriginal && ' · extendido'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap">{v.responsable?.nombreCompleto}</td>
                                        <td className="whitespace-nowrap">
                                            {MODALIDAD_CORTA[v.modalidadFondos as ModalidadFondos]}
                                            {v.modalidadFondos === 'anticipo' && <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums">{money(v.montoAnticipo)}</span>}
                                        </td>
                                        <td className="text-right min-w-[180px]">
                                            <span className="tabular-nums">{money(v.resumen.gastado)}</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums"> / {money(v.resumen.estimado)}</span>
                                            {v.resumen.estimado > 0 && <BarraConsumo porcentaje={v.resumen.porcentajeConsumo} className="mt-1" />}
                                        </td>
                                        <td>
                                            <EstadoViajeBadge estado={v.estado} />
                                            {v.estado === 'finalizado' && v.resumen.pendientes > 0 && (
                                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{v.resumen.pendientes} por verificar</span>
                                            )}
                                        </td>
                                        <td className="w-8 text-slate-400"><ChevronRight className="w-4 h-4" aria-hidden="true" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Móvil */}
                    <ul className="md:hidden space-y-2">
                        {lista.map(v => (
                            <li key={v.id}>
                                <Link href={`/viajes/${v.id}`} className="surface block p-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v.codigo}</span>
                                            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100 truncate">{v.motivo}</p>
                                        </div>
                                        <EstadoViajeBadge estado={v.estado} />
                                    </div>
                                    <Ruta origen={v.origen} destino={v.destino} className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-full" />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatRangoFechas(v.fechaInicio, v.fechaFin)} · {v.responsable?.nombreCompleto}</p>
                                    <div className="flex items-center justify-between text-xs mt-2.5 mb-1">
                                        <span className="tabular-nums text-slate-700 dark:text-slate-200">{money(v.resumen.gastado)}</span>
                                        <span className="tabular-nums text-slate-500 dark:text-slate-400">de {money(v.resumen.estimado)}</span>
                                    </div>
                                    <BarraConsumo porcentaje={v.resumen.porcentajeConsumo} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <TarifasDialog open={tarifasOpen} onClose={() => setTarifasOpen(false)} />

            <ViajeFormDialog
                open={nuevoOpen}
                onClose={() => setNuevoOpen(false)}
                onSaved={(v) => router.push(`/viajes/${v.id}`)}
            />
        </div>
    );
}
