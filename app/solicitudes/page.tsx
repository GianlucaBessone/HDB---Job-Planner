'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ClipboardCheck, ExternalLink, Undo2, X } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, Button, Dialog, EmptyState, ErrorState, LoadingState, Panel, Textarea } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { api } from '@/components/presupuestosServicio/cliente';
import { ESTADO_SOLICITUD_INFO, TIPO_SOLICITUD_INFO, type SolicitudVista } from '@/lib/solicitudesTipos';

/**
 * Solicitudes y aprobaciones (auditoría, F8): los pedidos de autorización con su estado. "Para aprobar" muestra lo
 * que espera a quien tiene la función; "Mis solicitudes", lo pedido y cómo se resolvió.
 */
type Vista = 'para_aprobar' | 'mias' | 'resueltas';

const fechaHora = (f: string) => new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const CAMPOS: Record<string, string> = { horaIngreso: 'Ingreso', horaEgreso: 'Egreso', isExtra: 'Extra', isDevolucion: 'Devolución', descripcionDevolucion: 'Descripción' };
const valor = (v: unknown) => (v === true ? 'Sí' : v === false ? 'No' : v === null || v === '' ? '—' : String(v));

export default function SolicitudesPage() {
    return (
        <Suspense fallback={<LoadingState label="Cargando solicitudes…" />}>
            <Solicitudes />
        </Suspense>
    );
}

function Solicitudes() {
    const router = useRouter();
    const sp = useSearchParams();
    const [vista, setVista] = useState<Vista>((sp.get('vista') as Vista) || 'para_aprobar');
    const [lista, setLista] = useState<SolicitudVista[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cuentas, setCuentas] = useState<{ para_aprobar: number | null }>({ para_aprobar: null });
    const [resolviendo, setResolviendo] = useState<{ s: SolicitudVista; accion: 'aprobar' | 'rechazar' } | null>(null);
    const resaltada = sp.get('id');

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const [r, pa] = await Promise.all([
                api<{ solicitudes: SolicitudVista[] }>(`/api/solicitudes?vista=${vista}`),
                vista === 'para_aprobar' ? null : api<{ solicitudes: SolicitudVista[] }>('/api/solicitudes?vista=para_aprobar').catch(() => null),
            ]);
            setLista(r.solicitudes);
            setCuentas({ para_aprobar: vista === 'para_aprobar' ? r.solicitudes.length : pa?.solicitudes.length ?? null });
        } catch (e: any) {
            setError(e.message);
        }
    }, [vista]);
    useEffect(() => {
        setLista(null);
        cargar();
    }, [cargar]);

    // Sin nada para aprobar, abrir directamente "Mis solicitudes"
    useEffect(() => {
        if (!sp.get('vista') && vista === 'para_aprobar' && lista && lista.length === 0 && cuentas.para_aprobar === 0) setVista('mias');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lista]);

    const cancelar = async (s: SolicitudVista) => {
        try {
            await api(`/api/solicitudes/${s.id}`, { method: 'PATCH', json: { accion: 'cancelar' } });
            showToast('Solicitud cancelada');
            cargar();
        } catch (e: any) {
            showToast(e.message || 'No se pudo cancelar', 'error');
        }
    };

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Solicitudes"
                description="Pedidos de autorización: correcciones de horas y finalizaciones de proyecto"
                icon={<ClipboardCheck className="w-5 h-5" />}
                tabs={[
                    { id: 'para_aprobar', label: 'Para aprobar', count: cuentas.para_aprobar ?? undefined },
                    { id: 'mias', label: 'Mis solicitudes' },
                    { id: 'resueltas', label: 'Resueltas' },
                ]}
                activeTabId={vista}
                onTabChange={(id) => {
                    setVista(id as Vista);
                    router.replace(`/solicitudes?vista=${id}`, { scroll: false });
                }}
            />

            {error ? (
                <ErrorState title="No se pudieron cargar las solicitudes" description={error} />
            ) : !lista ? (
                <LoadingState label="Cargando solicitudes…" />
            ) : lista.length === 0 ? (
                <EmptyState
                    icon={<ClipboardCheck />}
                    title={vista === 'para_aprobar' ? 'No hay solicitudes para aprobar' : vista === 'mias' ? 'No hiciste solicitudes' : 'No hay solicitudes resueltas'}
                    description={
                        vista === 'mias'
                            ? 'La corrección de un registro de horas ya confirmado y el pedido de finalizar un proyecto se hacen desde sus pantallas y llegan acá.'
                            : 'Te llegan las de las funciones que tenés para aprobar.'
                    }
                />
            ) : (
                <Panel padded={false}>
                    <ul className="divide-y divide-border">
                        {lista.map((s) => {
                            const e = ESTADO_SOLICITUD_INFO[s.estado];
                            const cambios = s.datos ? Object.entries(s.datos).filter(([k]) => k in CAMPOS) : [];
                            return (
                                <li key={s.id} className={`px-4 py-3 space-y-2 ${resaltada === s.id ? 'bg-brand-50 dark:bg-brand-950/30' : ''}`}>
                                    <div className="flex flex-wrap items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-medium text-foreground">{s.resumen}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {TIPO_SOLICITUD_INFO[s.tipo].label} · pedida por {s.solicitante.nombre} el {fechaHora(s.createdAt)}
                                            </p>
                                        </div>
                                        <Badge tone={e.tone}>{e.label}</Badge>
                                    </div>
                                    <p className="text-sm text-foreground whitespace-pre-line">
                                        <span className="text-muted-foreground">Motivo: </span>
                                        {s.motivo}
                                    </p>
                                    {cambios.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Cambio pedido: {cambios.map(([k, v]) => `${CAMPOS[k]} ${valor(v)}`).join(' · ')}
                                        </p>
                                    )}
                                    {s.resueltoPor && s.resueltoAt && (
                                        <p className="text-xs text-muted-foreground">
                                            {e.label} por {s.resueltoPor.nombre} el {fechaHora(s.resueltoAt)}
                                            {s.comentario ? ` · ${s.comentario}` : ''}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link href={s.url} className="btn btn-ghost btn-sm">
                                            <ExternalLink className="w-4 h-4" aria-hidden="true" /> {s.tipo === 'proyecto_finalizar' ? 'Ver el proyecto' : 'Ver registros de horas'}
                                        </Link>
                                        <span className="flex-1" />
                                        {s.puedeCancelar && (
                                            <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => cancelar(s)}>
                                                Cancelar solicitud
                                            </Button>
                                        )}
                                        {s.puedeResolver && (
                                            <>
                                                <Button size="sm" variant="danger-ghost" icon={<X />} onClick={() => setResolviendo({ s, accion: 'rechazar' })}>
                                                    Rechazar
                                                </Button>
                                                {s.tipo === 'proyecto_finalizar' ? (
                                                    <Link href={s.url} className="btn btn-primary btn-sm">
                                                        <Check className="w-4 h-4" aria-hidden="true" /> Finalizar el proyecto
                                                    </Link>
                                                ) : (
                                                    <Button size="sm" icon={<Check />} onClick={() => setResolviendo({ s, accion: 'aprobar' })}>
                                                        Aprobar
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
            )}

            {resolviendo && (
                <ResolverDialog
                    s={resolviendo.s}
                    accion={resolviendo.accion}
                    onClose={() => setResolviendo(null)}
                    onListo={() => {
                        setResolviendo(null);
                        cargar();
                    }}
                />
            )}
        </div>
    );
}

function ResolverDialog({ s, accion, onClose, onListo }: { s: SolicitudVista; accion: 'aprobar' | 'rechazar'; onClose: () => void; onListo: () => void }) {
    const [comentario, setComentario] = useState('');
    const [enviando, setEnviando] = useState(false);
    const aprobar = accion === 'aprobar';

    const enviar = async () => {
        if (!aprobar && !comentario.trim()) return showToast('Contá por qué se rechaza', 'error');
        setEnviando(true);
        try {
            await api(`/api/solicitudes/${s.id}`, { method: 'PATCH', json: { accion, comentario: comentario.trim() || null } });
            showToast(aprobar ? 'Solicitud aprobada: el cambio quedó aplicado' : 'Solicitud rechazada');
            onListo();
        } catch (e: any) {
            showToast(e.message || 'No se pudo resolver', 'error');
            setEnviando(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            dismissible={!enviando}
            size="md"
            title={aprobar ? 'Aprobar solicitud' : 'Rechazar solicitud'}
            description={aprobar ? `${s.resumen}. Al aprobar se aplica el cambio y se avisa a ${s.solicitante.nombre}.` : `${s.resumen}. ${s.solicitante.nombre} recibe el motivo.`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={enviando}>
                        Volver
                    </Button>
                    <Button variant={aprobar ? 'primary' : 'danger'} onClick={enviar} isLoading={enviando}>
                        {aprobar ? 'Aprobar' : 'Rechazar'}
                    </Button>
                </>
            }
        >
            <Textarea label={aprobar ? 'Comentario (opcional)' : 'Motivo del rechazo'} required={!aprobar} rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={2000} />
        </Dialog>
    );
}
