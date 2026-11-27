'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, KeyRound, Pencil, UserRound } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, EmptyState, ErrorState, LoadingState, Panel, Stat } from '@/components/ui';
import { api } from '@/components/presupuestosServicio/cliente';
import LegajoFicha from '@/components/personas/LegajoFicha';
import AccesosDialog from '@/components/operators/AccesosDialog';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { useAccessStore } from '@/lib/store/useAccessStore';
import { antiguedad } from '@/lib/legajoTipos';
import { ETIQUETA_SECCION, type FichaPersona, type SeccionFicha } from '@/lib/fichaPersonaTipos';

/**
 * Ficha única de la persona (auditoría, P16): legajo, accesos, EPP, formación, horas y viajes en un solo lugar. Cada
 * pestaña aparece solo si quien mira puede abrir ese módulo. `/personas/yo` es la propia ficha, en solo lectura.
 */
type Tab = 'resumen' | SeccionFicha;

const ROL: Record<string, string> = { admin: 'Administración', supervisor: 'Supervisión', qa: 'Calidad', vendedor: 'Ventas', operador: 'Operación' };
const fechaCorta = (f: string | null) => (f ? new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR') : '—');
const ESTADO_EPP = { vigente: { label: 'Vigente', tone: 'success' }, por_vencer: { label: 'Por vencer', tone: 'warning' }, vencido: { label: 'Vencido', tone: 'danger' } } as const;
const ESTADO_COMPETENCIA: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { vigente: 'success', pendiente: 'warning', vencida: 'danger' };
const ESTADO_CAPACITACION: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
    aprobado: { label: 'Aprobada', tone: 'success' },
    reprobado: { label: 'Reprobada', tone: 'danger' },
    en_progreso: { label: 'En curso', tone: 'info' },
    pendiente: { label: 'Pendiente', tone: 'warning' },
};
const ESTADO_VIAJE: Record<string, string> = { planificado: 'Planificado', en_curso: 'En curso', finalizado: 'Finalizado', cerrado: 'Cerrado', cancelado: 'Cancelado' };

export default function FichaPersonaPage() {
    return (
        <Suspense fallback={<LoadingState label="Cargando ficha…" />}>
            <Ficha />
        </Suspense>
    );
}

function Ficha() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const setTitle = useHistoryStore((s) => s.setTitle);
    const miId = useAccessStore((s) => s.userId) ?? undefined;
    const [ficha, setFicha] = useState<FichaPersona | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'resumen');
    const [accesosAbiertos, setAccesosAbiertos] = useState(false);

    useEffect(() => {
        setFicha(null);
        setError(null);
        api<{ ficha: FichaPersona }>(`/api/personas/${id}`)
            .then((r) => {
                setFicha(r.ficha);
                setTitle(`/personas/${id}`, r.ficha.propia ? 'Mi ficha' : r.ficha.persona.nombreCompleto);
            })
            .catch((e) => setError(e.message));
    }, [id, setTitle]);

    const tabs = useMemo(() => (ficha ? (['resumen', ...ficha.secciones] as Tab[]) : []), [ficha]);
    useEffect(() => {
        if (ficha && !tabs.includes(tab)) setTab('resumen');
    }, [ficha, tabs, tab]);

    const cambiarTab = (t: Tab) => {
        setTab(t);
        const sp = new URLSearchParams(searchParams.toString());
        if (t === 'resumen') sp.delete('tab');
        else sp.set('tab', t);
        router.replace(`/personas/${id}${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
    };

    if (error) return <ErrorState title="No se pudo abrir la ficha" description={error} />;
    if (!ficha) return <LoadingState label="Cargando ficha…" />;

    const p = ficha.persona;
    const ant = antiguedad(p.fechaIngreso);
    const r = ficha.resumen;

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title={ficha.propia ? `Mi ficha · ${p.nombreCompleto}` : p.nombreCompleto}
                description={[p.posicion || 'Sin puesto', ROL[p.role] || p.role, ant ? `${ant} en la empresa` : null, p.activo ? null : 'Inactivo', p.enVacaciones ? 'De vacaciones' : null]
                    .filter(Boolean)
                    .join(' · ')}
                icon={<UserRound className="w-5 h-5" />}
                tabs={tabs.map((t) => ({ id: t, label: ETIQUETA_SECCION[t] }))}
                activeTabId={tab}
                onTabChange={(t) => cambiarTab(t as Tab)}
            />

            {tab === 'resumen' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {ficha.secciones.includes('legajo') && (
                            <Stat
                                label="Documentos"
                                value={r.documentosVencidos + r.documentosPorVencer === 0 ? 'Al día' : `${r.documentosVencidos + r.documentosPorVencer} a atender`}
                                hint={`${r.documentosVencidos} vencidos · ${r.documentosPorVencer} por vencer`}
                                tone={r.documentosVencidos ? 'danger' : r.documentosPorVencer ? 'warning' : 'success'}
                            />
                        )}
                        {ficha.epp && (
                            <Stat
                                label="EPP"
                                value={`${ficha.epp.vigentes.length} elementos`}
                                hint={`${r.eppVencido} vencidos · ${r.eppPorVencer} por vencer${ficha.epp.actasPorFirmar ? ` · ${ficha.epp.actasPorFirmar} actas sin firmar` : ''}`}
                                tone={r.eppVencido ? 'danger' : r.eppPorVencer || ficha.epp.actasPorFirmar ? 'warning' : 'success'}
                            />
                        )}
                        {ficha.formacion && (
                            <Stat
                                label="Competencias"
                                value={ficha.formacion.competencias.length}
                                hint={r.competenciasPorVencer ? `${r.competenciasPorVencer} vencidas o por vencer` : 'Ninguna por vencer'}
                                tone={r.competenciasPorVencer ? 'warning' : 'neutral'}
                            />
                        )}
                        {ficha.horas && <Stat label="Horas en 30 días" value={`${ficha.horas.total} h`} hint={`${ficha.horas.dias} días trabajados${ficha.horas.porAprobar ? ` · ${ficha.horas.porAprobar} fichadas por aprobar` : ''}`} />}
                    </div>
                    <Panel title="Datos">
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <Dato titulo="Número de legajo" valor={p.legajo || '—'} />
                            <Dato titulo="Ingreso" valor={p.fechaIngreso ? `${fechaCorta(p.fechaIngreso)}${ant ? ` (${ant})` : ''}` : '—'} />
                            <Dato titulo="Rol" valor={ROL[p.role] || p.role} />
                            <Dato titulo="Categoría de mano de obra" valor={p.categoriaManoObra || '—'} />
                        </dl>
                    </Panel>
                    {ficha.viajes && r.viajesActivos > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {r.viajesActivos} {r.viajesActivos === 1 ? 'viaje planificado o en curso' : 'viajes planificados o en curso'}.{' '}
                            <button type="button" className="text-brand-600 hover:underline" onClick={() => cambiarTab('viajes')}>
                                Ver viajes
                            </button>
                        </p>
                    )}
                </div>
            )}

            {tab === 'legajo' && <LegajoFicha operatorId={p.id} gestiona={ficha.editaLegajo} propia={ficha.propia} />}

            {tab === 'accesos' && ficha.accesos && (
                <Panel title="Usuario y accesos" description="Rol, PIN y permisos especiales">
                    <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                        <Dato titulo="Rol" valor={ROL[p.role] || p.role} />
                        <Dato titulo="Estado" valor={p.activo ? 'Activo' : 'Inactivo'} />
                        <Dato titulo="Permisos especiales" valor={ficha.accesos.permisosEspeciales ? `${ficha.accesos.permisosEspeciales} (ganan sobre el rol)` : 'Ninguno'} />
                    </dl>
                    <div className="flex flex-wrap gap-2">
                        {ficha.accesos.puedeEditarUsuario && (
                            <Link href={`/operators?editar=${p.id}`} className="btn btn-secondary">
                                <Pencil className="w-4 h-4" aria-hidden="true" /> Editar usuario, rol y PIN
                            </Link>
                        )}
                        {ficha.accesos.puedeAdministrarAccesos && (
                            <button type="button" className="btn btn-secondary" onClick={() => setAccesosAbiertos(true)}>
                                <KeyRound className="w-4 h-4" aria-hidden="true" /> Accesos y permisos especiales
                            </button>
                        )}
                    </div>
                </Panel>
            )}

            {tab === 'epp' && ficha.epp && (
                <Panel
                    title="EPP entregado"
                    description={ficha.epp.actasPorFirmar ? `${ficha.epp.actasPorFirmar} actas de entrega sin firmar` : 'Elementos vigentes con su vencimiento'}
                    padded={false}
                    actions={
                        !ficha.propia && (
                            <Link href="/rrhh/personal/epp?tab=matriz" className="btn btn-secondary btn-sm">
                                Matriz de EPP <ArrowRight className="w-4 h-4" aria-hidden="true" />
                            </Link>
                        )
                    }
                >
                    {ficha.epp.vigentes.length === 0 ? (
                        <EmptyState title="Sin EPP vigente" description="No hay elementos entregados vigentes." />
                    ) : (
                        <Tabla
                            columnas={['Elemento', 'Entregado', 'Vence', 'Estado']}
                            filas={ficha.epp.vigentes.map((e) => [
                                `${e.nombre}${e.talle ? ` (talle ${e.talle})` : ''}`,
                                fechaCorta(e.entregado),
                                fechaCorta(e.vence),
                                <Badge key="e" tone={ESTADO_EPP[e.estado].tone}>
                                    {ESTADO_EPP[e.estado].label}
                                </Badge>,
                            ])}
                        />
                    )}
                </Panel>
            )}

            {tab === 'formacion' && ficha.formacion && (
                <div className="grid gap-5 lg:grid-cols-2 items-start">
                    <Panel title="Competencias" padded={false}>
                        {ficha.formacion.competencias.length === 0 ? (
                            <EmptyState title="Sin competencias cargadas" />
                        ) : (
                            <Tabla
                                columnas={['Competencia', 'Vence', 'Estado']}
                                filas={ficha.formacion.competencias.map((c) => [
                                    c.nombre,
                                    fechaCorta(c.vence),
                                    <Badge key="e" tone={ESTADO_COMPETENCIA[c.estado] || 'neutral'}>
                                        {c.estado.charAt(0).toUpperCase() + c.estado.slice(1)}
                                    </Badge>,
                                ])}
                            />
                        )}
                    </Panel>
                    <Panel title="Capacitaciones" padded={false}>
                        {ficha.formacion.capacitaciones.length === 0 ? (
                            <EmptyState title="Sin capacitaciones" />
                        ) : (
                            <Tabla
                                columnas={['Capacitación', 'Fin', 'Estado']}
                                filas={ficha.formacion.capacitaciones.map((c) => {
                                    const e = ESTADO_CAPACITACION[c.estado] || { label: c.estado, tone: 'neutral' as const };
                                    return [
                                        c.titulo,
                                        fechaCorta(c.fin),
                                        <Badge key="e" tone={e.tone}>
                                            {e.label}
                                            {c.puntaje !== null ? ` · ${c.puntaje}` : ''}
                                        </Badge>,
                                    ];
                                })}
                            />
                        )}
                    </Panel>
                </div>
            )}

            {tab === 'horas' && ficha.horas && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <Stat label="Horas" value={`${ficha.horas.total} h`} hint={`Del ${fechaCorta(ficha.horas.desde)} al ${fechaCorta(ficha.horas.hasta)}`} />
                        <Stat label="Días trabajados" value={ficha.horas.dias} />
                        <Stat label="Fichadas por aprobar" value={ficha.horas.porAprobar} tone={ficha.horas.porAprobar ? 'warning' : 'neutral'} />
                    </div>
                    <Panel title="Horas por proyecto" description="Últimos 30 días" padded={false}>
                        {ficha.horas.porProyecto.length === 0 ? (
                            <EmptyState title="Sin horas en los últimos 30 días" />
                        ) : (
                            <Tabla columnas={['Proyecto', 'Horas']} filas={ficha.horas.porProyecto.map((h) => [h.proyecto, `${h.horas} h`])} alinearUltima />
                        )}
                    </Panel>
                </div>
            )}

            {tab === 'viajes' && ficha.viajes && (
                <Panel title="Viajes" description="Como responsable o participante" padded={false}>
                    {ficha.viajes.length === 0 ? (
                        <EmptyState title="Sin viajes" />
                    ) : (
                        <Tabla
                            columnas={['Viaje', 'Fechas', 'Estado']}
                            filas={ficha.viajes.map((v) => [
                                <span key="v">
                                    <span className="font-medium">{v.codigo}</span> · {v.destino}
                                    <span className="block text-xs text-muted-foreground">
                                        {v.motivo}
                                        {v.responsable ? ' · responsable' : ''}
                                    </span>
                                </span>,
                                `${fechaCorta(v.inicio)} – ${fechaCorta(v.fin)}`,
                                ESTADO_VIAJE[v.estado] || v.estado,
                            ])}
                        />
                    )}
                </Panel>
            )}

            {accesosAbiertos && (
                <AccesosDialog operator={{ id: p.id, nombreCompleto: p.nombreCompleto, role: p.role }} currentUserId={miId} onClose={() => setAccesosAbiertos(false)} />
            )}
        </div>
    );
}

function Dato({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{titulo}</dt>
            <dd className="text-foreground">{valor}</dd>
        </div>
    );
}

function Tabla({ columnas, filas, alinearUltima }: { columnas: string[]; filas: React.ReactNode[][]; alinearUltima?: boolean }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-surface-sunken text-xs text-muted-foreground">
                    <tr>
                        {columnas.map((c, i) => (
                            <th key={c} className={`font-medium px-4 py-2 ${alinearUltima && i === columnas.length - 1 ? 'text-right' : 'text-left'}`}>
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {filas.map((f, i) => (
                        <tr key={i}>
                            {f.map((celda, j) => (
                                <td key={j} className={`px-4 py-2.5 ${alinearUltima && j === f.length - 1 ? 'text-right tabular-nums' : ''}`}>
                                    {celda}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
