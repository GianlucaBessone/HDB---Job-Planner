'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, FileSearch, Plus, RefreshCw } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { showToast } from '@/components/Toast';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useCommandStore } from '@/lib/store/useCommandStore';
import NuevoPliegoDialog from '@/components/pliegos/NuevoPliegoDialog';
import { apiJson, EstadoPliegoBadge, formatFechaHora } from '@/components/pliegos/shared';

interface PliegoFila {
    id: string;
    codigo: string;
    titulo: string;
    estado: string;
    createdAt: string;
    creadoPorNombre: string;
    project: { nombre: string; codigoProyecto: string | null } | null;
    client: { nombre: string } | null;
    ultimoAnalisis: {
        version: number;
        tareas: number;
        tareasFuera: number;
        tareasSinMarcar: number;
        alertas: number;
        alertasAltas: number;
    } | null;
}

export default function PliegosPage() {
    const router = useRouter();
    const [pliegos, setPliegos] = useState<PliegoFila[]>([]);
    const [puedeGestionar, setPuedeGestionar] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [nuevoOpen, setNuevoOpen] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
            const data = await apiJson<{ pliegos: PliegoFila[]; puedeGestionar: boolean }>(`/api/pliegos${qs}`);
            setPliegos(data.pliegos);
            setPuedeGestionar(data.puedeGestionar);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [q]);

    useEffect(() => {
        const t = setTimeout(cargar, 250);
        return () => clearTimeout(t);
    }, [cargar]);

    const registerCommand = useCommandStore(s => s.registerCommand);
    const unregisterCommand = useCommandStore(s => s.unregisterCommand);
    const abrirNuevo = useRef(() => setNuevoOpen(true));
    useEffect(() => {
        if (!puedeGestionar) return;
        registerCommand({
            id: 'pliegos-nuevo',
            label: 'Nuevo pliego',
            description: 'Subir el PDF de un pliego para analizarlo con IA',
            category: 'Contextual',
            keywords: ['pliego', 'especificaciones', 'licitación', 'cotización', 'análisis'],
            action: () => abrirNuevo.current(),
        });
        return () => unregisterCommand('pliegos-nuevo');
    }, [registerCommand, unregisterCommand, puedeGestionar]);

    const acciones = [
        { id: 'refresh', label: 'Actualizar', icon: <RefreshCw />, onClick: cargar, variant: 'outline' as const, hideLabelOnMobile: true },
        ...(puedeGestionar ? [{ id: 'nuevo', label: 'Nuevo pliego', icon: <Plus />, onClick: () => setNuevoOpen(true), variant: 'primary' as const }] : []),
    ];

    return (
        <div>
            <ModuleHeader
                title="Análisis de Pliegos"
                description="Pliegos de clientes analizados con IA: tareas, materiales, H&S y alertas"
                icon={<FileSearch />}
                searchValue={q}
                onSearchChange={setQ}
                searchPlaceholder="Buscar por código, título, cliente o proyecto…"
                actions={acciones}
            />

            {loading && pliegos.length === 0 ? (
                <LoadingState label="Cargando pliegos…" />
            ) : error && pliegos.length === 0 ? (
                <ErrorState description={error} onRetry={cargar} />
            ) : pliegos.length === 0 ? (
                <div className="surface">
                    <EmptyState
                        icon={<FileSearch />}
                        title={q ? 'Sin resultados' : 'Todavía no hay pliegos'}
                        description={q ? 'Probá con otro código, título o cliente.' : puedeGestionar ? 'Subí el PDF de un pliego para que la IA lo analice.' : 'Cuando administración suba un pliego lo vas a ver acá.'}
                        action={q
                            ? <button className="btn btn-secondary" onClick={() => setQ('')}>Limpiar búsqueda</button>
                            : puedeGestionar ? <button className="btn btn-primary btn-lg" onClick={() => setNuevoOpen(true)}><Plus /> Nuevo pliego</button> : undefined}
                    />
                </div>
            ) : (
                <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {pliegos.map(p => {
                        const a = p.ultimoAnalisis;
                        return (
                            <li key={p.id}>
                                <Link href={`/pliegos/${p.id}`} className="surface block p-4 h-full hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="font-mono text-xs text-muted-foreground">{p.codigo}{a ? ` · v${a.version}` : ''}</span>
                                            <p className="text-heading text-foreground break-words">{p.titulo}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 shrink-0 mt-1 text-muted-foreground" aria-hidden="true" />
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 truncate">
                                        {[p.client?.nombre, p.project ? `${p.project.codigoProyecto ? `${p.project.codigoProyecto} · ` : ''}${p.project.nombre}` : null].filter(Boolean).join(' — ') || 'Sin cliente ni proyecto'}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-sm">
                                        <EstadoPliegoBadge estado={p.estado} />
                                        {a && (
                                            <>
                                                <span className="text-muted-foreground tabular-nums">{a.tareas} tareas · {a.tareasSinMarcar} sin marcar{a.tareasFuera > 0 ? ` · ${a.tareasFuera} fuera` : ''}</span>
                                                {a.alertasAltas > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-danger-700 dark:text-danger-300 tabular-nums">
                                                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{a.alertasAltas} alertas altas
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">{p.creadoPorNombre} · {formatFechaHora(p.createdAt)}</p>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}

            {puedeGestionar && (
                <NuevoPliegoDialog
                    open={nuevoOpen}
                    onClose={() => setNuevoOpen(false)}
                    onCreado={id => { setNuevoOpen(false); router.push(`/pliegos/${id}`); }}
                />
            )}
        </div>
    );
}
