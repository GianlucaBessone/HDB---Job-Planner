'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileSearch, FileText, History, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { showToast } from '@/components/Toast';
import { Button, ConfirmDialogBase, EmptyState, ErrorState, LoadingState, Select } from '@/components/ui';
import PliegoVista, { type AnalisisVista } from '@/components/pliegos/PliegoVista';
import type { TareaPliego } from '@/components/pliegos/TareaItem';
import { apiJson, EstadoPliegoBadge, formatFechaHora } from '@/components/pliegos/shared';
import { formatTamanio } from '@/lib/pliegos';
import { useHistoryStore } from '@/lib/store/useHistoryStore';

interface PliegoDetalle {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    estado: string;
    ultimoError: string | null;
    createdAt: string;
    creadoPorNombre: string;
    project: { id: string; nombre: string; codigoProyecto: string | null } | null;
    client: { id: string; nombre: string } | null;
    archivo: { nombre: string; size: number; completo: boolean } | null;
    versiones: { id: string; version: number; createdAt: string; creadoPorNombre: string; modelo: string }[];
    ultimaVersion: number | null;
    analisis: AnalisisVista | null;
    puedeGestionar: boolean;
}

export default function PliegoDetallePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [pliego, setPliego] = useState<PliegoDetalle | null>(null);
    const [version, setVersion] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analizando, setAnalizando] = useState(false);
    const [confirmar, setConfirmar] = useState<'reanalizar' | 'borrar' | null>(null);
    const [borrando, setBorrando] = useState(false);

    const cargar = useCallback(async (v: number | null = version) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiJson<PliegoDetalle>(`/api/pliegos/${id}${v ? `?version=${v}` : ''}`);
            setPliego(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [id, version]);

    useEffect(() => { cargar(); }, [cargar]);

    // Título de la barra superior: el código en vez del id.
    const setTitle = useHistoryStore(s => s.setTitle);
    useEffect(() => {
        if (!pliego?.codigo) return;
        const t = setTimeout(() => setTitle(`/pliegos/${id}`, pliego.codigo), 0);
        return () => clearTimeout(t);
    }, [setTitle, id, pliego?.codigo]);

    const analizar = async () => {
        setConfirmar(null);
        setAnalizando(true);
        try {
            const r = await apiJson<{ version: number; arrastradas: number }>(`/api/pliegos/${id}/analizar`, { method: 'POST' });
            showToast(r.version > 1
                ? `Versión ${r.version} lista${r.arrastradas ? ` · ${r.arrastradas} marcas arrastradas` : ''}`
                : 'Pliego analizado');
            setVersion(null);
            await cargar(null);
        } catch (e: any) {
            showToast(e.message, 'error');
            await cargar();
        } finally {
            setAnalizando(false);
        }
    };

    const borrar = async () => {
        setBorrando(true);
        try {
            await apiJson(`/api/pliegos/${id}`, { method: 'DELETE' });
            showToast('Pliego borrado');
            router.push('/pliegos');
        } catch (e: any) {
            showToast(e.message, 'error');
            setBorrando(false);
            setConfirmar(null);
        }
    };

    const onTareaCambio = (t: TareaPliego) => {
        setPliego(p => (p && p.analisis ? { ...p, analisis: { ...p.analisis, tareas: p.analisis.tareas.map(x => (x.id === t.id ? t : x)) } } : p));
    };

    if (loading && !pliego) return <LoadingState label="Cargando pliego…" />;
    if (error && !pliego) {
        return (
            <ErrorState
                title="No pudimos abrir el pliego"
                description={error}
                onRetry={() => cargar()}
            />
        );
    }
    if (!pliego) return null;

    const a = pliego.analisis;
    const enCurso = analizando || pliego.estado === 'analizando';
    const acciones = [
        { id: 'volver', label: 'Pliegos', icon: <ArrowLeft />, onClick: () => router.push('/pliegos'), variant: 'ghost' as const, hideLabelOnMobile: true },
        ...(pliego.archivo?.completo
            ? [{ id: 'pdf', label: 'Ver PDF', icon: <FileText />, onClick: () => window.open(`/api/pliegos/${id}/archivo`, '_blank', 'noopener'), variant: 'outline' as const }]
            : []),
        ...(pliego.puedeGestionar && pliego.archivo?.completo
            ? [{
                id: 'analizar',
                label: a ? 'Re-analizar' : 'Analizar',
                icon: <Sparkles />,
                onClick: () => (a ? setConfirmar('reanalizar') : analizar()),
                variant: 'primary' as const,
                disabled: enCurso,
            }]
            : []),
    ];

    return (
        <div>
            <ModuleHeader
                title={pliego.titulo}
                description={[pliego.codigo, pliego.client?.nombre, pliego.project ? `${pliego.project.codigoProyecto ? `${pliego.project.codigoProyecto} · ` : ''}${pliego.project.nombre}` : null].filter(Boolean).join(' · ')}
                icon={<FileSearch />}
                className="[&_h1>span:last-of-type]:whitespace-normal"
                actions={acciones}
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm text-muted-foreground">
                <EstadoPliegoBadge estado={enCurso ? 'analizando' : pliego.estado} />
                {pliego.archivo && <span>{pliego.archivo.nombre} · {formatTamanio(pliego.archivo.size)}</span>}
                <span>Subido por {pliego.creadoPorNombre} · {formatFechaHora(pliego.createdAt)}</span>
                {pliego.versiones.length > 1 && (
                    <span className="inline-flex items-center gap-2">
                        <label htmlFor="pliego-version" className="inline-flex items-center gap-1 text-foreground font-medium">
                            <History className="w-4 h-4" aria-hidden="true" /> Versión
                        </label>
                        <Select
                            id="pliego-version"
                            className="w-auto min-w-[220px] h-8"
                            value={String(a?.version ?? '')}
                            onChange={e => { const v = Number(e.target.value); setVersion(v); cargar(v); }}
                        >
                            {pliego.versiones.map(v => (
                                <option key={v.id} value={v.version}>
                                    v{v.version}{v.version === pliego.ultimaVersion ? ' (vigente)' : ''} · {formatFechaHora(v.createdAt)}
                                </option>
                            ))}
                        </Select>
                    </span>
                )}
                {pliego.puedeGestionar && (
                    <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => setConfirmar('borrar')} className="text-danger-700 dark:text-danger-300">
                        Borrar
                    </Button>
                )}
            </div>

            {pliego.descripcion && <p className="text-body text-muted-foreground mb-4 whitespace-pre-line max-w-prose">{pliego.descripcion}</p>}

            {enCurso && (
                <div className="surface p-4 mb-4 flex items-center gap-3" aria-live="polite">
                    <RefreshCw className="w-5 h-5 animate-spin text-primary shrink-0" aria-hidden="true" />
                    <p className="text-body text-foreground">La IA está analizando el pliego. Puede tardar uno o dos minutos.</p>
                </div>
            )}

            {pliego.estado === 'error' && !enCurso && pliego.ultimoError && (
                <div className="surface p-4 mb-4 border-danger-300 dark:border-danger-800" role="alert">
                    <p className="text-body font-medium text-danger-700 dark:text-danger-300">El último análisis falló</p>
                    <p className="text-body text-muted-foreground mt-1 whitespace-pre-line">{pliego.ultimoError}</p>
                </div>
            )}

            {a?.soloLectura && (
                <div className="surface p-3 mb-4 bg-warning-50 dark:bg-warning-950/40 border-warning-200 dark:border-warning-900 flex flex-wrap items-center justify-between gap-2" role="status">
                    <p className="text-body text-foreground">Estás viendo la versión {a.version}: es de solo lectura. Las marcas se hacen en la versión vigente.</p>
                    <Button variant="secondary" size="sm" onClick={() => { setVersion(null); cargar(null); }}>Ir a la vigente</Button>
                </div>
            )}

            {a ? (
                <>
                    <PliegoVista key={a.id} analisis={a} onTareaCambio={onTareaCambio} />
                    <p className="text-xs text-muted-foreground mt-6">
                        Análisis v{a.version} · {a.modelo} · pedido por {a.creadoPorNombre} · {formatFechaHora(a.createdAt)}.
                        Revisá siempre contra el pliego original: la IA puede equivocarse.
                    </p>
                </>
            ) : !enCurso && (
                <div className="surface">
                    <EmptyState
                        icon={<Sparkles />}
                        title="Este pliego todavía no tiene análisis"
                        description={pliego.puedeGestionar ? 'Pedile a la IA que lo analice.' : 'Todavía no lo analizaron.'}
                        action={pliego.puedeGestionar && pliego.archivo?.completo
                            ? <Button size="lg" icon={<Sparkles />} onClick={analizar}>Analizar</Button>
                            : <Link href="/pliegos" className="btn btn-secondary">Volver a pliegos</Link>}
                    />
                </div>
            )}

            <ConfirmDialogBase
                open={confirmar === 'reanalizar'}
                onCancel={() => setConfirmar(null)}
                onConfirm={analizar}
                tone="primary"
                title="¿Re-analizar el pliego?"
                message="Se crea una versión nueva sobre el mismo PDF. Las versiones anteriores quedan de solo lectura y las marcas se arrastran a las tareas con el mismo título."
                confirmLabel="Re-analizar"
            />
            <ConfirmDialogBase
                open={confirmar === 'borrar'}
                onCancel={() => setConfirmar(null)}
                onConfirm={borrar}
                tone="danger"
                loading={borrando}
                title="¿Borrar el pliego?"
                message="Se borran el PDF, todas las versiones del análisis y el historial de marcas. No se puede deshacer."
                confirmLabel="Borrar"
            />
        </div>
    );
}
