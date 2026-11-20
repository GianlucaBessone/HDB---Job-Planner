'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calculator, Plus, RefreshCw, ChevronRight, HardHat, FileText } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { EmptyState, ErrorState, LoadingState, Pagination, Stat } from '@/components/ui';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { api, pesos, horasTxt, fechaCorta, EstadoPresupuestoBadge } from '@/components/presupuestosServicio/cliente';

interface Fila {
    id: string;
    numero: string;
    clienteNombre: string;
    titulo: string;
    estado: string;
    versionActual: number;
    fechaVencimiento: string | null;
    proyecto: { id: string; codigoProyecto: string | null; nombre: string } | null;
    versionVigente: { total: number; neto: number; horasTotales: number; fechaInicioTentativa: string | null; fechaFinTentativa: string | null } | null;
}

interface Respuesta {
    presupuestos: Fila[];
    total: number;
    page: number;
    totalPages: number;
    conteos: Record<string, number>;
    aceptadosSinConvertir: number;
}

const TABS = [
    { id: 'todos', label: 'Todos' },
    { id: 'borrador', label: 'Borradores' },
    { id: 'enviado', label: 'Enviados' },
    { id: 'aceptado', label: 'Aceptados' },
    { id: 'rechazado', label: 'Rechazados' },
    { id: 'vencido', label: 'Vencidos' },
];

const POR_PAGINA = 25;

export default function PresupuestosServicioPage() {
    const router = useRouter();
    const { puede } = useAcceso();
    const [tab, setTab] = useState('todos');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Respuesta | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pedido = useRef(0);

    const cargar = useCallback(async () => {
        const n = ++pedido.current;
        setCargando(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(POR_PAGINA) });
            if (tab !== 'todos') params.set('estado', tab);
            if (q.trim()) params.set('q', q.trim());
            const r = await api<Respuesta>(`/api/presupuestos-servicio?${params}`);
            if (n === pedido.current) setData(r);
        } catch (e: any) {
            if (n === pedido.current) setError(e.message);
        } finally {
            if (n === pedido.current) setCargando(false);
        }
    }, [tab, q, page]);

    useEffect(() => {
        const t = setTimeout(cargar, q ? 250 : 0);
        return () => clearTimeout(t);
    }, [cargar, q]);

    useEffect(() => setPage(1), [tab, q]);

    const puedeGestionar = puede('presupuestos.gestionar');
    const puedeConvertir = puede('presupuestos.convertir');
    const nuevo = useCallback(() => router.push('/presupuestos-servicio/nuevo'), [router]);

    const registerCommand = useCommandStore((s) => s.registerCommand);
    const unregisterCommand = useCommandStore((s) => s.unregisterCommand);
    useEffect(() => {
        if (!puedeGestionar) return;
        registerCommand({ id: 'presupuesto-servicio-nuevo', label: 'Nuevo presupuesto de servicio', category: 'Contextual', action: nuevo, keywords: ['presupuesto', 'mano de obra', 'servicio'] });
        return () => unregisterCommand('presupuesto-servicio-nuevo');
    }, [puedeGestionar, nuevo, registerCommand, unregisterCommand]);

    const conteos = data?.conteos || {};
    const totalTodos = Object.values(conteos).reduce((a, b) => a + b, 0);
    const filas = data?.presupuestos || [];

    const acciones = [
        { id: 'refrescar', label: 'Actualizar', icon: <RefreshCw className="w-4 h-4" />, onClick: cargar, variant: 'outline' as const, hideLabelOnMobile: true },
        ...(puede('ventas.mano_obra_gestionar')
            ? [{ id: 'mano-obra', label: 'Mano de obra', icon: <HardHat className="w-4 h-4" />, onClick: () => router.push('/presupuestos-servicio/mano-obra'), variant: 'outline' as const, hideLabelOnMobile: true }]
            : []),
        ...(puedeGestionar ? [{ id: 'nuevo', label: 'Nuevo presupuesto', icon: <Plus className="w-4 h-4" />, onClick: nuevo, variant: 'primary' as const }] : []),
    ];

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Presupuestos de servicios"
                description="Mano de obra y materiales para obras. Un presupuesto aceptado se convierte en proyecto."
                icon={<Calculator className="w-5 h-5" />}
                searchValue={q}
                onSearchChange={setQ}
                searchPlaceholder="Buscar por número, cliente o título…"
                actions={acciones}
                tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: t.id === 'todos' ? totalTodos : conteos[t.id] ?? 0 }))}
                activeTabId={tab}
                onTabChange={setTab}
            />

            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Stat label="Borradores" value={conteos.borrador ?? 0} hint="Sin enviar al cliente" />
                    <Stat label="Enviados sin respuesta" value={conteos.enviado ?? 0} hint="Esperando aceptación o rechazo" tone={(conteos.enviado ?? 0) > 0 ? 'info' : 'neutral'} />
                    <Stat label="Aceptados sin convertir" value={data.aceptadosSinConvertir} hint="Listos para crear el proyecto" tone={data.aceptadosSinConvertir > 0 ? 'warning' : 'neutral'} />
                </div>
            )}

            {cargando && !data ? (
                <LoadingState label="Cargando presupuestos…" />
            ) : error && !data ? (
                <ErrorState description={error} onRetry={cargar} />
            ) : filas.length === 0 ? (
                <div className="surface">
                    <EmptyState
                        icon={<FileText />}
                        title={q ? 'Sin resultados' : tab === 'todos' ? 'Todavía no hay presupuestos de servicio' : 'No hay presupuestos en esta pestaña'}
                        description={q ? 'Probá con otro número, cliente o título.' : tab === 'todos' ? 'Armá el primero con sus tareas, mano de obra y materiales.' : undefined}
                        action={
                            q ? (
                                <button className="btn btn-secondary" onClick={() => setQ('')}>Limpiar búsqueda</button>
                            ) : tab === 'todos' && puedeGestionar ? (
                                <button className="btn btn-primary" onClick={nuevo}><Plus /> Nuevo presupuesto</button>
                            ) : undefined
                        }
                    />
                </div>
            ) : (
                <>
                    <div className="surface overflow-x-auto hidden md:block" aria-busy={cargando}>
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th className="text-left">Número</th>
                                    <th className="text-left">Cliente y obra</th>
                                    <th className="text-left">Rev.</th>
                                    <th className="text-right">Horas</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-left">Plazo tentativo</th>
                                    <th className="text-left">Estado</th>
                                    <th className="text-left">Proyecto</th>
                                    <th><span className="sr-only">Abrir</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map((p) => (
                                    <tr key={p.id} className="cursor-pointer" onClick={() => router.push(`/presupuestos-servicio/${p.id}`)}>
                                        <td className="whitespace-nowrap">
                                            <Link href={`/presupuestos-servicio/${p.id}`} className="font-mono text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                                {p.numero}
                                            </Link>
                                        </td>
                                        <td className="max-w-[320px]">
                                            <span className="block font-medium text-slate-900 dark:text-slate-100 truncate">{p.clienteNombre}</span>
                                            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{p.titulo}</span>
                                        </td>
                                        <td>v{p.versionActual}</td>
                                        <td className="text-right tabular-nums">{p.versionVigente ? horasTxt(p.versionVigente.horasTotales) : '—'}</td>
                                        <td className="text-right tabular-nums whitespace-nowrap">{p.versionVigente ? pesos(p.versionVigente.total, 0) : '—'}</td>
                                        <td className="whitespace-nowrap">
                                            {p.versionVigente?.fechaInicioTentativa
                                                ? `${fechaCorta(p.versionVigente.fechaInicioTentativa)} – ${fechaCorta(p.versionVigente.fechaFinTentativa)}`
                                                : '—'}
                                        </td>
                                        <td>
                                            <EstadoPresupuestoBadge estado={p.estado} />
                                            {p.estado === 'enviado' && p.fechaVencimiento && (
                                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">vence {fechaCorta(p.fechaVencimiento)}</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            {p.proyecto ? (
                                                <Link href={`/projects/ficha/${p.proyecto.id}`} className="font-mono text-xs text-primary hover:underline">
                                                    {p.proyecto.codigoProyecto || p.proyecto.nombre}
                                                </Link>
                                            ) : p.estado === 'aceptado' && puedeConvertir ? (
                                                <Link href={`/projects/nuevo?presupuestoId=${p.id}`} className="btn btn-tonal btn-sm">Convertir en proyecto</Link>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="w-8 text-slate-400"><ChevronRight className="w-4 h-4" aria-hidden="true" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <ul className="md:hidden space-y-2">
                        {filas.map((p) => (
                            <li key={p.id}>
                                <Link href={`/presupuestos-servicio/${p.id}`} className="surface block p-4 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{p.numero} · v{p.versionActual}</span>
                                        <EstadoPresupuestoBadge estado={p.estado} />
                                    </div>
                                    <div>
                                        <span className="block font-medium text-slate-900 dark:text-slate-100">{p.clienteNombre}</span>
                                        <span className="block text-sm text-slate-500 dark:text-slate-400">{p.titulo}</span>
                                    </div>
                                    <div className="flex justify-between text-sm tabular-nums">
                                        <span>{p.versionVigente ? horasTxt(p.versionVigente.horasTotales) : '—'}</span>
                                        <span className="font-medium">{p.versionVigente ? pesos(p.versionVigente.total, 0) : '—'}</span>
                                    </div>
                                    {p.proyecto && <span className="block text-xs text-slate-500 dark:text-slate-400">Proyecto {p.proyecto.codigoProyecto}</span>}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {data && data.total > POR_PAGINA && (
                        <Pagination page={page} pageSize={POR_PAGINA} total={data.total} onPageChange={setPage} />
                    )}
                </>
            )}
        </div>
    );
}
