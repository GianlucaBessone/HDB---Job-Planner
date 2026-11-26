'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, ExternalLink, PenLine } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from '@/components/ui';
import { fechaPortal, portalApi } from '@/components/portal/portalApi';

interface OsPortal {
    id: string;
    codigo: string | null;
    fecha: string;
    proyecto: { id: string; nombre: string; codigoProyecto: string | null };
    resumen: string;
    firmada: boolean;
    firma: { nombre: string; fecha: string } | null;
    url: string;
}

/** Órdenes de servicio de los proyectos autorizados: las pendientes se firman con el mismo link que envía HDB. */
export default function PortalOrdenesServicioPage() {
    const [ordenes, setOrdenes] = useState<OsPortal[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'pendientes' | 'firmadas'>('pendientes');

    useEffect(() => {
        portalApi<{ ordenes: OsPortal[] }>('/api/portal-clientes/ordenes-servicio')
            .then((r) => {
                setOrdenes(r.ordenes);
                if (!r.ordenes.some((o) => !o.firmada)) setTab('firmadas');
            })
            .catch((e) => setError(e.message));
    }, []);

    const pendientes = useMemo(() => (ordenes || []).filter((o) => !o.firmada), [ordenes]);
    const firmadas = useMemo(() => (ordenes || []).filter((o) => o.firmada), [ordenes]);
    const lista = tab === 'pendientes' ? pendientes : firmadas;

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Órdenes de servicio"
                description="Trabajos realizados en tus proyectos. Las pendientes se firman desde acá."
                icon={<ClipboardCheck className="w-5 h-5" />}
                tabs={[
                    { id: 'pendientes', label: 'Para firmar', count: ordenes ? pendientes.length : undefined },
                    { id: 'firmadas', label: 'Firmadas', count: ordenes ? firmadas.length : undefined },
                ]}
                activeTabId={tab}
                onTabChange={(id) => setTab(id as 'pendientes')}
            />
            {error ? (
                <ErrorState title="No se pudieron cargar las órdenes" description={error} />
            ) : !ordenes ? (
                <LoadingState label="Cargando órdenes de servicio…" />
            ) : lista.length === 0 ? (
                <EmptyState
                    icon={<ClipboardCheck />}
                    title={tab === 'pendientes' ? 'No hay órdenes para firmar' : 'Todavía no hay órdenes firmadas'}
                    description="Ves las órdenes de los proyectos que HDB te habilitó."
                />
            ) : (
                <Panel padded={false}>
                    <ul className="divide-y divide-border">
                        {lista.map((o) => (
                            <li key={o.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-medium text-foreground">
                                        {o.codigo || 'Orden de servicio'} · {o.proyecto.nombre}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{fechaPortal(o.fecha)} · {o.resumen}</p>
                                    {o.firma && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Firmada por {o.firma.nombre} el {fechaPortal(o.firma.fecha)}
                                        </p>
                                    )}
                                </div>
                                {o.firmada ? (
                                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm shrink-0">
                                        <ExternalLink className="w-4 h-4" aria-hidden="true" /> Ver
                                    </a>
                                ) : (
                                    <span className="flex items-center gap-2 shrink-0">
                                        <Badge tone="warning">Sin firmar</Badge>
                                        <a href={o.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                                            <PenLine className="w-4 h-4" aria-hidden="true" /> Revisar y firmar
                                        </a>
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
        </div>
    );
}
