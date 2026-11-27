'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardCheck, Copy, ExternalLink, FileSignature, LayoutGrid, QrCode, Wallet } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import type { ModuleAction } from '@/components/ModuleHeader';
import { Badge, Dialog, EmptyState, ErrorState, LoadingState, Panel, Stat } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { showToast } from '@/components/Toast';
import ProjectCostModal from '@/components/projects/ProjectCostModal';
import ProyectoPresupuestoPanel from '@/components/projects/ProyectoPresupuestoPanel';
import Bitacora from '@/components/projects/ficha/Bitacora';
import ChecklistProyecto, { avanceChecklist, type ItemChecklist } from '@/components/projects/ficha/ChecklistProyecto';
import MaterialesObra from '@/components/projects/ficha/MaterialesObra';
import { safeApiRequest } from '@/lib/offline';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { STATUS_CONFIG } from '@/lib/projectTypes';
import { TIPO_PROYECTO_INFO, esTipoProyecto } from '@/lib/proyectos/tipos';
import { formatDate } from '@/lib/formatDate';
import { unirBitacora, type EntradaBitacora } from '@/lib/bitacora';

type Pestana = 'resumen' | 'checklist' | 'bitacora' | 'materiales' | 'ordenes';

interface Proyecto {
    id: string;
    nombre: string;
    codigoProyecto: string | null;
    estado: string;
    alertaMotivo?: string | null;
    tipo?: string;
    activo: boolean;
    clientId: string | null;
    cliente: string | null;
    client: { id: string; nombre: string } | null;
    responsable: string | null;
    responsableId: string | null;
    responsableUser: { id: string; nombreCompleto: string } | null;
    fechaInicio: string | null;
    fechaFin: string | null;
    horasEstimadas: number;
    horasConsumidas: number;
    tags: string[];
    observaciones: string | null;
    generarOS: boolean;
    aprovisionamiento: boolean;
    publicToken: string | null;
    finalizadoConPendientes: boolean;
    listaPrecio: { nombre: string } | null;
}

interface Usuario { id: string; nombreCompleto: string }

const TONO_ESTADO: Record<string, BadgeTone> = {
    por_hacer: 'neutral', planificado: 'info', activo: 'success', en_riesgo: 'warning', atrasado: 'danger', finalizado: 'neutral', archivado: 'neutral',
};

const OS_CERRADA = ['firmada', 'cobrada', 'pagada'];
const ETIQUETA_OS: Record<string, string> = { firmada: 'Firmada', cobrada: 'OC emitida', pagada: 'Pagada' };

/**
 * Ficha del proyecto (auditoría, FU11): un solo lugar para el proyecto, con las
 * acciones habilitadas según el permiso. Reemplaza el detalle de Proyectos y la vista
 * del responsable de Mis proyectos, que repetían lo mismo con reglas distintas.
 */
export default function FichaProyectoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { puede, puedeVer, cargado } = useAcceso();
    const gestiona = puede('proyectos.crear');

    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reintento, setReintento] = useState(0);
    const [pestana, setPestana] = useState<Pestana>('resumen');

    const [checklist, setChecklist] = useState<ItemChecklist[]>([]);
    const [cargandoChecklist, setCargandoChecklist] = useState(true);
    const [bitacora, setBitacora] = useState<EntradaBitacora[]>([]);
    const [cargandoBitacora, setCargandoBitacora] = useState(true);
    const [equipo, setEquipo] = useState<{ operatorId: string }[]>([]);
    const [verCostos, setVerCostos] = useState<'costo' | 'pvr' | null>(null);
    const [presupuesto, setPresupuesto] = useState<{ id: string; numero: string } | null>(null);
    const [operadores, setOperadores] = useState<{ id: string; nombreCompleto: string; activo?: boolean }[]>([]);

    // ?tab=bitacora abre directamente una pestaña (enlaces desde Bloqueos, Mi día, etc.)
    useEffect(() => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (tab && ['resumen', 'checklist', 'bitacora', 'materiales', 'ordenes'].includes(tab)) setPestana(tab as Pestana);
        try {
            const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (u?.id) setUsuario({ id: u.id, nombreCompleto: u.nombreCompleto });
        } catch { /* sin usuario local: la API usa la sesión */ }
    }, []);

    const cargarProyecto = useCallback(async () => {
        setError(null);
        try {
            const res = await safeApiRequest(`/api/projects/${id}`);
            if (res.status === 404) return setError('El proyecto no existe o fue eliminado.');
            if (!res.ok) throw new Error();
            setProyecto(await res.json());
        } catch {
            setError('No se pudo cargar el proyecto.');
        }
    }, [id]);

    const cargarChecklist = useCallback(async () => {
        setCargandoChecklist(true);
        try {
            const data = await safeApiRequest(`/api/projects/${id}/checklist`).then(r => r.json());
            setChecklist(Array.isArray(data) ? data : []);
        } catch {
            setChecklist([]);
        } finally {
            setCargandoChecklist(false);
        }
    }, [id]);

    const cargarBitacora = useCallback(async () => {
        setCargandoBitacora(true);
        try {
            const [logs, demoras] = await Promise.all([
                safeApiRequest(`/api/projects/${id}/logs`).then(r => r.json()).catch(() => []),
                safeApiRequest(`/api/delays?projectId=${id}`).then(r => r.json()).catch(() => []),
            ]);
            setBitacora(unirBitacora(Array.isArray(logs) ? logs : [], Array.isArray(demoras) ? demoras : []));
        } finally {
            setCargandoBitacora(false);
        }
    }, [id]);

    useEffect(() => {
        cargarProyecto();
        cargarChecklist();
        cargarBitacora();
        safeApiRequest(`/api/projects/${id}/asignaciones`).then(r => r.json()).then(d => Array.isArray(d) && setEquipo(d)).catch(() => undefined);
        fetch('/api/presupuestos-servicio/vinculos', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : {}))
            .then((m: Record<string, { id: string; numero: string }>) => setPresupuesto(m?.[id] || null))
            .catch(() => undefined);
        safeApiRequest('/api/operators').then(r => r.json()).then(d => Array.isArray(d) && setOperadores(d)).catch(() => undefined);
    }, [id, reintento, cargarProyecto, cargarChecklist, cargarBitacora]);

    // Migas de pan: "Proyectos › <nombre>"
    const setTitle = useHistoryStore(s => s.setTitle);
    useEffect(() => {
        if (!proyecto) return;
        const t = setTimeout(() => {
            setTitle('/projects/ficha', 'Ficha');
            setTitle(`/projects/ficha/${id}`, proyecto.nombre);
        }, 0);
        return () => clearTimeout(t);
    }, [id, proyecto, setTitle]);

    const esResponsable = !!usuario && !!proyecto && (proyecto.responsableId === usuario.id || (!proyecto.responsableId && proyecto.responsable === usuario.nombreCompleto));
    const enEquipo = !!usuario && equipo.some(a => a.operatorId === usuario.id);
    const veLista = puedeVer('/projects');

    if (error) return <ErrorState description={error} onRetry={() => setReintento(n => n + 1)} />;
    if (!proyecto || !cargado) return <LoadingState label="Cargando proyecto…" />;

    // La ficha es de quien gestiona proyectos, del responsable y del equipo de la obra
    if (!veLista && !gestiona && !esResponsable && !enEquipo) {
        return (
            <EmptyState
                title="No tenés acceso a este proyecto"
                description="La ficha la ven quienes gestionan proyectos, el responsable y el equipo asignado."
                action={<Link href="/my-projects" className="btn btn-secondary">Ir a Mis proyectos</Link>}
            />
        );
    }

    const avance = avanceChecklist(checklist);
    const bloqueantes = bitacora.filter(e => e.tipo === 'Bloqueante').length;
    const demoras = bitacora.filter(e => e.tipo === 'Demora');
    const horasDemora = Math.round(demoras.reduce((a, d) => a + (d.demora?.duracion || 0), 0) * 10) / 10;
    const finalizado = proyecto.estado === 'finalizado';

    const pestanas: { id: Pestana; label: string; count?: number }[] = [
        { id: 'resumen', label: 'Resumen' },
        { id: 'checklist', label: 'Checklist', count: avance.total ? avance.total - avance.hechos : undefined },
        { id: 'bitacora', label: 'Bitácora', count: bitacora.length || undefined },
        ...(proyecto.aprovisionamiento ? [{ id: 'materiales' as Pestana, label: 'Materiales' }] : []),
        { id: 'ordenes', label: 'Órdenes' },
    ];

    const acciones: ModuleAction[] = [];
    if (veLista) acciones.push({ id: 'lista', label: 'Volver a la lista', variant: 'ghost', onClick: () => router.push('/projects'), hideLabelOnMobile: true });
    if (puede('proyectos.costos')) acciones.push({ id: 'costos', label: 'Costos', icon: <Wallet />, variant: 'outline', onClick: () => setVerCostos('costo') });
    if (gestiona) acciones.push({ id: 'editar', label: 'Editar', variant: 'outline', onClick: () => router.push(`/projects?editar=${proyecto.id}`) });

    return (
        <div className="w-full space-y-6">
            <ModuleHeader
                title={proyecto.nombre}
                description={[
                    proyecto.codigoProyecto,
                    proyecto.client?.nombre || proyecto.cliente || 'Sin cliente',
                    STATUS_CONFIG[proyecto.estado as keyof typeof STATUS_CONFIG]?.label ?? proyecto.estado,
                ].filter(Boolean).join(' · ')}
                icon={<LayoutGrid />}
                tabs={pestanas}
                activeTabId={pestana}
                onTabChange={t => setPestana(t as Pestana)}
                actions={acciones}
            />

            {pestana === 'resumen' && (
                <Resumen
                    proyecto={proyecto}
                    avance={avance}
                    bloqueantes={bloqueantes}
                    demoras={demoras.length}
                    horasDemora={horasDemora}
                    presupuesto={presupuesto}
                    operadores={operadores}
                    onIr={setPestana}
                    onVerReporte={() => setVerCostos('pvr')}
                />
            )}

            {pestana === 'checklist' && (
                <ChecklistProyecto
                    projectId={proyecto.id}
                    items={checklist}
                    setItems={setChecklist}
                    gestiona={gestiona}
                    esResponsable={esResponsable}
                    cargando={cargandoChecklist}
                />
            )}

            {pestana === 'bitacora' && (
                <Bitacora
                    proyecto={proyecto}
                    entradas={bitacora}
                    cargando={cargandoBitacora}
                    onRecargar={cargarBitacora}
                    puedeBorrarEntradas={gestiona}
                    puedeBorrarDemoras={puede('demoras.gestionar')}
                />
            )}

            {pestana === 'materiales' && proyecto.aprovisionamiento && usuario && (
                <MaterialesObra proyecto={proyecto} usuario={usuario} />
            )}

            {pestana === 'ordenes' && <Ordenes proyecto={proyecto} />}

            {!finalizado && (gestiona || esResponsable || puede('proyectos.finalizar')) && (
                <Finalizar proyecto={proyecto} puedeFinalizar={puede('proyectos.finalizar')} onFinalizado={() => setReintento(n => n + 1)} />
            )}

            {verCostos && <ProjectCostModal projectId={proyecto.id} tabInicial={verCostos} onClose={() => setVerCostos(null)} />}
        </div>
    );
}

function Resumen({ proyecto, avance, bloqueantes, demoras, horasDemora, presupuesto, operadores, onIr, onVerReporte }: {
    proyecto: Proyecto;
    avance: { hechos: number; total: number; porcentaje: number };
    bloqueantes: number;
    demoras: number;
    horasDemora: number;
    presupuesto: { id: string; numero: string } | null;
    operadores: { id: string; nombreCompleto: string; activo?: boolean }[];
    onIr: (p: Pestana) => void;
    onVerReporte: () => void;
}) {
    const [horas, setHoras] = useState<{ nombre: string; horas: number; ultima: string }[] | null>(null);

    useEffect(() => {
        safeApiRequest(`/api/time-entries?projectId=${proyecto.id}`)
            .then(r => r.json())
            .then((entries: any[]) => {
                if (!Array.isArray(entries)) return setHoras([]);
                const porPersona = new Map<string, { nombre: string; horas: number; ultima: string }>();
                for (const e of entries) {
                    const p = porPersona.get(e.operatorId) || { nombre: e.operator?.nombreCompleto || 'Sin nombre', horas: 0, ultima: e.fecha };
                    p.horas += Number(e.horasTrabajadas) || 0;
                    if (e.fecha > p.ultima) p.ultima = e.fecha;
                    porPersona.set(e.operatorId, p);
                }
                setHoras(Array.from(porPersona.values()).sort((a, b) => b.horas - a.horas));
            })
            .catch(() => setHoras([]));
    }, [proyecto.id]);

    const usoHoras = proyecto.horasEstimadas > 0 ? Math.round((proyecto.horasConsumidas / proyecto.horasEstimadas) * 100) : null;
    const enlacePublico = proyecto.publicToken ? `/projects/${proyecto.id}/report?token=${proyecto.publicToken}` : null;

    const copiarEnlace = () => {
        if (!enlacePublico) return;
        navigator.clipboard.writeText(`${window.location.origin}${enlacePublico}`)
            .then(() => showToast('Enlace copiado', 'success'))
            .catch(() => showToast('No se pudo copiar el enlace', 'error'));
    };

    const estado = STATUS_CONFIG[proyecto.estado as keyof typeof STATUS_CONFIG]?.label ?? proyecto.estado;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Stat
                    label="Horas"
                    value={`${proyecto.horasConsumidas} / ${proyecto.horasEstimadas || '—'}`}
                    hint={usoHoras === null ? 'Sin horas estimadas' : `${usoHoras}% de lo estimado`}
                    tone={usoHoras !== null && usoHoras > 100 ? 'danger' : usoHoras !== null && usoHoras >= 85 ? 'warning' : 'neutral'}
                />
                <button type="button" className="text-left" onClick={() => onIr('checklist')}>
                    <Stat label="Checklist" value={`${avance.porcentaje}%`} hint={`${avance.hechos} de ${avance.total} ítems`} tone={avance.total && avance.porcentaje === 100 ? 'success' : 'neutral'} />
                </button>
                <button type="button" className="text-left" onClick={() => onIr('bitacora')}>
                    <Stat label="Bloqueantes" value={bloqueantes} hint="En la bitácora" tone={bloqueantes ? 'danger' : 'neutral'} />
                </button>
                <button type="button" className="text-left" onClick={() => onIr('bitacora')}>
                    <Stat label="Demoras del cliente" value={demoras} hint={`${horasDemora} h perdidas`} tone={demoras ? 'warning' : 'neutral'} />
                </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Datos del proyecto">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">Estado</dt>
                        <dd>
                            <Badge tone={TONO_ESTADO[proyecto.estado] || 'neutral'}>{estado}</Badge>{proyecto.finalizadoConPendientes && <Badge tone="warning" className="ml-2">Con pendientes</Badge>}
                            {proyecto.alertaMotivo && <p className="mt-1 text-xs text-muted-foreground">{proyecto.alertaMotivo}</p>}
                        </dd>
                        <dt className="text-muted-foreground">Tipo</dt>
                        <dd>{esTipoProyecto(proyecto.tipo) ? TIPO_PROYECTO_INFO[proyecto.tipo].label : '—'}</dd>
                        <dt className="text-muted-foreground">Cliente</dt>
                        <dd>
                            {proyecto.client ? (
                                <Link href={`/clients/${proyecto.client.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{proyecto.client.nombre}</Link>
                            ) : (proyecto.cliente || '—')}
                        </dd>
                        <dt className="text-muted-foreground">Responsable</dt>
                        <dd>{proyecto.responsableUser?.nombreCompleto || proyecto.responsable || '—'}</dd>
                        <dt className="text-muted-foreground">Fechas</dt>
                        <dd>{proyecto.fechaInicio ? formatDate(proyecto.fechaInicio) : '—'} → {proyecto.fechaFin ? formatDate(proyecto.fechaFin) : '—'}</dd>
                        {proyecto.listaPrecio && (<><dt className="text-muted-foreground">Lista de precios</dt><dd>{proyecto.listaPrecio.nombre}</dd></>)}
                        <dt className="text-muted-foreground">Etiquetas</dt>
                        <dd className="flex flex-wrap gap-1">{proyecto.tags?.length ? proyecto.tags.map(t => <Badge key={t}>{t}</Badge>) : '—'}</dd>
                    </dl>
                    {proyecto.observaciones && (
                        <p className="mt-4 border-t border-border pt-3 text-sm text-foreground whitespace-pre-wrap">{proyecto.observaciones}</p>
                    )}
                </Panel>

                <Panel title="Horas por persona" description="Registros de horas cargados en el proyecto">
                    {horas === null ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Cargando horas…</p>
                    ) : horas.length === 0 ? (
                        <EmptyState title="Sin horas cargadas" />
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead><tr><th scope="col">Persona</th><th scope="col">Último registro</th><th scope="col" className="text-right">Horas</th></tr></thead>
                            <tbody>
                                {horas.map(h => (
                                    <tr key={h.nombre}>
                                        <td>{h.nombre}</td>
                                        <td className="whitespace-nowrap">{formatDate(h.ultima)}</td>
                                        <td className="text-right tabular-nums">{Math.round(h.horas * 10) / 10}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <Link href={`/timesheets?proyecto=${encodeURIComponent(proyecto.nombre)}`} className="btn btn-ghost btn-sm mt-3">
                        Ver registros de horas <ArrowRight aria-hidden="true" />
                    </Link>
                </Panel>
            </div>

            {/* Presupuesto de origen, tareas y equipo asignado (si el proyecto los tiene) */}
            <ProyectoPresupuestoPanel
                projectId={proyecto.id}
                presupuesto={presupuesto}
                fechaInicio={proyecto.fechaInicio}
                fechaFin={proyecto.fechaFin}
                operadores={operadores}
                onVerReporte={onVerReporte}
            />

            {enlacePublico && (
                <Panel title="Seguimiento para el cliente" description="Enlace público con el avance del proyecto">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input readOnly aria-label="Enlace público" className="input flex-1 text-xs" value={`${typeof window !== 'undefined' ? window.location.origin : ''}${enlacePublico}`} />
                        <button type="button" className="btn btn-secondary" onClick={copiarEnlace}><Copy aria-hidden="true" /> Copiar</button>
                        <Link href={enlacePublico} target="_blank" className="btn btn-secondary"><ExternalLink aria-hidden="true" /> Abrir</Link>
                    </div>
                </Panel>
            )}
        </div>
    );
}

function Ordenes({ proyecto }: { proyecto: Proyecto }) {
    const [os, setOs] = useState<{ id: string; estado: string; numero?: string | null } | null | undefined>(undefined);
    const [ots, setOts] = useState<{ id: string; numeroOT: string; estado: string; fecha?: string }[] | null>(null);

    useEffect(() => {
        if (proyecto.generarOS) {
            safeApiRequest(`/api/ordenes-servicio?projectId=${proyecto.id}`)
                .then(async r => (r.ok ? r.json() : []))
                .then(d => setOs(Array.isArray(d) && d.length ? d[0] : null))
                .catch(() => setOs(null));
        } else {
            setOs(null);
        }
        safeApiRequest(`/api/ordenes-trabajo?proyectoId=${proyecto.id}&limit=20`)
            .then(async r => (r.ok ? r.json() : { data: [] }))
            .then(d => setOts(Array.isArray(d?.data) ? d.data : []))
            .catch(() => setOts([]));
    }, [proyecto.id, proyecto.generarOS]);

    const cerrada = !!os && OS_CERRADA.includes(os.estado);

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Orden de servicio" description={proyecto.generarOS ? 'Trabajo certificado con firma del cliente' : 'Este proyecto no emite orden de servicio'}>
                {!proyecto.generarOS ? (
                    <p className="text-sm text-muted-foreground">Se habilita desde Editar → Configuración del proyecto.</p>
                ) : os === undefined ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                ) : os === null ? (
                    <Link href={`/ordenes-servicio/generar?projectId=${proyecto.id}`} className="btn btn-primary">
                        <FileSignature aria-hidden="true" /> Generar orden de servicio
                    </Link>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <FileSignature className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-sm font-medium">{os.numero || 'Orden de servicio'}</span>
                            <Badge tone={cerrada ? 'success' : 'warning'}>{ETIQUETA_OS[os.estado] || 'Pendiente de firma'}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {!cerrada && (
                                <Link href={`/ordenes-servicio/qr/${os.id}`} className="btn btn-primary"><QrCode aria-hidden="true" /> Ver QR para firmar</Link>
                            )}
                            <Link href={`/ordenes-servicio/generar?projectId=${proyecto.id}&editId=${os.id}`} className="btn btn-secondary">
                                {cerrada ? 'Ver orden' : 'Modificar orden'}
                            </Link>
                        </div>
                    </div>
                )}
            </Panel>

            <Panel title="Órdenes de trabajo" description="Órdenes por ciclos vinculadas a este proyecto">
                {ots === null ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                ) : ots.length === 0 ? (
                    <EmptyState title="Sin órdenes de trabajo" />
                ) : (
                    <ul className="divide-y divide-border">
                        {ots.map(ot => (
                            <li key={ot.id} className="flex items-center justify-between py-2">
                                <Link href={`/ordenes-trabajo/${ot.id}`} className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">{ot.numeroOT}</Link>
                                <Badge>{ot.estado.replace('_', ' ').toLowerCase()}</Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}

function Finalizar({ proyecto, puedeFinalizar, onFinalizado }: { proyecto: Proyecto; puedeFinalizar: boolean; onFinalizado: () => void }) {
    const [enviando, setEnviando] = useState(false);
    const [pendientes, setPendientes] = useState<{ tag: string; description: string }[] | null>(null);
    const porEtiqueta = useMemo(() => {
        const m = new Map<string, string[]>();
        (pendientes || []).forEach(p => m.set(p.tag, [...(m.get(p.tag) || []), p.description]));
        return Array.from(m.entries());
    }, [pendientes]);

    const pedir = async () => {
        setEnviando(true);
        try {
            // Solicitud con estado (F8): queda aprobada cuando alguien con permiso finaliza el proyecto
            const res = await safeApiRequest('/api/solicitudes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo: 'proyecto_finalizar', entidadId: proyecto.id, motivo: `Pedido de cierre del proyecto "${proyecto.nombre}". Revisar el avance para autorizar el cierre.` }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                return showToast(data?.error || 'No se pudo enviar el pedido', 'error');
            }
            showToast('Solicitud enviada: seguí su estado en Solicitudes', 'success');
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setEnviando(false);
        }
    };

    const finalizar = async (force = false) => {
        if (!puedeFinalizar) return pedir();
        setEnviando(true);
        try {
            const res = await safeApiRequest(`/api/projects/${proyecto.id}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                setPendientes(null);
                showToast('Proyecto finalizado', 'success');
                onFinalizado();
            } else if (data?.pendingItems) {
                setPendientes(data.pendingItems);
            } else {
                showToast(data?.error || 'No se pudo finalizar', 'error');
            }
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <>
            <Panel>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        {puedeFinalizar
                            ? 'Al finalizar se verifica el checklist; si quedan ítems pendientes podés cerrarlo igual y quedan registrados.'
                            : 'Cuando el trabajo esté terminado, pedí la finalización: le llega a los supervisores.'}
                    </p>
                    <button type="button" className="btn btn-primary shrink-0" onClick={() => finalizar()} disabled={enviando}>
                        <ClipboardCheck aria-hidden="true" /> {enviando ? 'Enviando…' : puedeFinalizar ? 'Finalizar proyecto' : 'Pedir finalización'}
                    </button>
                </div>
            </Panel>

            <Dialog
                open={!!pendientes}
                onClose={() => setPendientes(null)}
                dismissible={!enviando}
                title="Quedan ítems pendientes"
                description="El checklist no está completo. Si lo cerrás igual, los pendientes quedan registrados en el proyecto."
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setPendientes(null)} disabled={enviando}>Volver al checklist</button>
                        <button type="button" className="btn btn-danger" onClick={() => finalizar(true)} disabled={enviando}>Finalizar igual</button>
                    </>
                }
            >
                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                    {porEtiqueta.map(([tag, items]) => (
                        <section key={tag}>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tag}</h3>
                            <ul className="mt-1 list-disc pl-5 text-sm">{items.map((d, i) => <li key={i}>{d}</li>)}</ul>
                        </section>
                    ))}
                </div>
            </Dialog>
        </>
    );
}
