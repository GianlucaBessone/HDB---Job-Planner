'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, HardHat, Package, ShieldCheck, Sparkles, Users, Wrench } from 'lucide-react';
import { Badge, EmptyState, SegmentedControl, Tabs } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
    ALERTA_TIPO_LABEL, EVALUACION_LABEL, EVALUACION_TONE, HYS_CATEGORIAS, HYS_LABEL, SEVERIDAD_LABEL, SEVERIDAD_TONE,
    type AlertaPliego, type ContenidoAnalisis, type HysCategoria, type MaterialPliego, type Severidad,
} from '@/lib/pliegos';
import TareaItem, { type TareaPliego } from './TareaItem';
import { ItemCard, OrigenBadge, SeccionTitulo } from './shared';

export interface AnalisisVista {
    id: string;
    version: number;
    soloLectura: boolean;
    modelo: string;
    createdAt: string;
    creadoPorNombre: string;
    resumen: string;
    razonamiento: string;
    contenido: ContenidoAnalisis;
    tareas: TareaPliego[];
}

type Pestania = 'resumen' | 'tareas' | 'materiales' | 'herramientas' | 'personal' | 'hys' | 'alertas';
type FiltroTareas = 'todas' | 'sin_marcar' | 'fuera';

const ORDEN_SEVERIDAD: Record<Severidad, number> = { alta: 0, media: 1, baja: 2 };

export default function PliegoVista({
    analisis,
    onTareaCambio,
}: {
    analisis: AnalisisVista;
    onTareaCambio: (t: TareaPliego) => void;
}) {
    const [tab, setTab] = useState<Pestania>('resumen');
    const [filtro, setFiltro] = useState<FiltroTareas>('todas');
    const c = analisis.contenido;

    const alertas = useMemo(
        () => [...(c.alertas || [])].sort((a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]),
        [c.alertas],
    );
    const sinMarcar = analisis.tareas.filter(t => !t.alcance).length;
    const fuera = analisis.tareas.filter(t => t.alcance === 'fuera').length;
    const tareas = analisis.tareas.filter(t => filtro === 'todas' || (filtro === 'fuera' ? t.alcance === 'fuera' : !t.alcance));
    const materiales = (c.materiales?.delPliego?.length || 0) + (c.materiales?.sugeridos?.length || 0);
    const materialesRevisar = (c.materiales?.delPliego || []).filter(m => m.evaluacion !== 'adecuado').length;
    const altas = alertas.filter(a => a.severidad === 'alta');

    return (
        <div>
            <Tabs
                label="Secciones del análisis"
                value={tab}
                onChange={id => setTab(id as Pestania)}
                className="mb-4"
                tabs={[
                    { id: 'resumen', label: 'Resumen', icon: <Sparkles /> },
                    { id: 'tareas', label: 'Tareas', icon: <ClipboardList />, count: analisis.tareas.length },
                    { id: 'alertas', label: 'Alertas', icon: <AlertTriangle />, count: alertas.length },
                    { id: 'materiales', label: 'Materiales', icon: <Package />, count: materiales },
                    { id: 'herramientas', label: 'Herramientas', icon: <Wrench />, count: c.herramientas?.length || 0 },
                    { id: 'personal', label: 'Personal', icon: <Users />, count: c.personal?.length || 0 },
                    { id: 'hys', label: 'H&S', icon: <HardHat />, count: c.higieneSeguridad?.length || 0 },
                ]}
            />

            {tab === 'resumen' && (
                <div className="grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_1fr] lg:items-start">
                    <section className="surface p-4 lg:p-5 lg:col-span-2">
                        <h2 className="text-heading text-foreground mb-2">Resumen</h2>
                        <p className="text-body text-foreground whitespace-pre-line">{analisis.resumen}</p>
                    </section>

                    <aside className="space-y-4 lg:row-span-2" aria-label="Totales del análisis">
                        <div className="grid grid-cols-2 gap-2">
                            <Total label="Tareas" valor={analisis.tareas.length} detalle={`${sinMarcar} sin marcar · ${fuera} fuera`} onClick={() => setTab('tareas')} />
                            <Total label="Alertas" valor={alertas.length} detalle={`${altas.length} de severidad alta`} tono={altas.length > 0 ? 'danger' : undefined} onClick={() => setTab('alertas')} />
                            <Total label="Materiales" valor={materiales} detalle={`${materialesRevisar} a revisar`} onClick={() => setTab('materiales')} />
                            <Total label="Herramientas" valor={c.herramientas?.length || 0} onClick={() => setTab('herramientas')} />
                            <Total label="Personal" valor={c.personal?.length || 0} onClick={() => setTab('personal')} />
                            <Total label="H&S" valor={c.higieneSeguridad?.length || 0} onClick={() => setTab('hys')} />
                        </div>
                        {altas.length > 0 && (
                            <section className="surface p-4">
                                <h2 className="text-heading text-foreground mb-2">Alertas de severidad alta</h2>
                                <ul className="space-y-2.5">
                                    {altas.map((a, i) => (
                                        <li key={i} className="border-l-2 border-danger-500 pl-2.5">
                                            <p className="text-body font-medium text-foreground break-words">{a.titulo}</p>
                                            {a.referencia && <p className="text-xs text-muted-foreground">{a.referencia}</p>}
                                        </li>
                                    ))}
                                </ul>
                                <button type="button" className="btn btn-ghost btn-sm mt-2 -ml-2" onClick={() => setTab('alertas')}>Ver todas las alertas</button>
                            </section>
                        )}
                    </aside>

                    <section className="surface p-4 lg:p-5 lg:col-span-2">
                        <h2 className="text-heading text-foreground mb-2">Razonamiento de la IA</h2>
                        <p className="text-body text-muted-foreground whitespace-pre-line">{analisis.razonamiento}</p>
                    </section>
                </div>
            )}

            {tab === 'tareas' && (
                <div>
                    <SegmentedControl
                        label="Filtrar tareas"
                        className="mb-3"
                        value={filtro}
                        onChange={v => setFiltro(v as FiltroTareas)}
                        options={[
                            { value: 'todas', label: `Todas (${analisis.tareas.length})` },
                            { value: 'sin_marcar', label: `Sin marcar (${sinMarcar})` },
                            { value: 'fuera', label: `Fuera (${fuera})` },
                        ]}
                    />
                    {tareas.length === 0 ? (
                        <EmptyState compact icon={<ClipboardList />} title="No hay tareas con este filtro" />
                    ) : (
                        <ol className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                            {tareas.map(t => (
                                <TareaItem key={t.id} tarea={t} soloLectura={analisis.soloLectura} onCambio={onTareaCambio} />
                            ))}
                        </ol>
                    )}
                </div>
            )}

            {tab === 'alertas' && (
                alertas.length === 0
                    ? <EmptyState compact icon={<ShieldCheck />} title="La IA no encontró alertas" />
                    : <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{alertas.map((a, i) => <AlertaCard key={i} alerta={a} />)}</ul>
            )}

            {tab === 'materiales' && (
                <div>
                    <SeccionTitulo count={c.materiales?.delPliego?.length || 0}>Del pliego (evaluados)</SeccionTitulo>
                    <ListaMateriales items={c.materiales?.delPliego || []} vacio="El pliego no lista materiales." />
                    <SeccionTitulo count={c.materiales?.sugeridos?.length || 0}>Sugeridos</SeccionTitulo>
                    <ListaMateriales items={c.materiales?.sugeridos || []} vacio="Sin sugerencias de materiales." sinEvaluacion />
                </div>
            )}

            {tab === 'herramientas' && (
                <Lista vacio="Sin herramientas informadas." icon={<Wrench />}>
                    {(c.herramientas || []).map((h, i) => (
                        <ItemCard
                            key={i}
                            titulo={h.descripcion}
                            meta={h.cantidad}
                            detalle={h.observacion}
                            badges={<OrigenBadge origen={h.origen} referencia={h.referencia} />}
                        />
                    ))}
                </Lista>
            )}

            {tab === 'personal' && (
                <Lista vacio="Sin personal informado." icon={<Users />}>
                    {(c.personal || []).map((p, i) => (
                        <ItemCard
                            key={i}
                            titulo={p.rol}
                            meta={p.cantidad}
                            detalle={p.competencias}
                            badges={<OrigenBadge origen={p.origen} referencia={p.referencia} />}
                        />
                    ))}
                </Lista>
            )}

            {tab === 'hys' && <HigieneSeguridad items={c.higieneSeguridad || []} />}
        </div>
    );
}

function Total({ label, valor, detalle, tono, onClick }: { label: string; valor: number; detalle?: string; tono?: 'danger'; onClick: () => void }) {
    return (
        <button type="button" className="surface p-3 text-left hover:shadow-md transition-shadow" onClick={onClick}>
            <span className="eyebrow block">{label}</span>
            <span className={cn('text-title tabular-nums', tono === 'danger' && 'text-danger-700 dark:text-danger-300')}>{valor}</span>
            {detalle && <span className="block text-xs text-muted-foreground">{detalle}</span>}
        </button>
    );
}

function Lista({ children, vacio, icon }: { children: React.ReactNode[]; vacio: string; icon: React.ReactNode }) {
    if (children.length === 0) return <EmptyState compact icon={icon} title={vacio} />;
    return <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{children}</ul>;
}

function ListaMateriales({ items, vacio, sinEvaluacion }: { items: MaterialPliego[]; vacio: string; sinEvaluacion?: boolean }) {
    if (items.length === 0) return <p className="text-body text-muted-foreground">{vacio}</p>;
    return (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {items.map((m, i) => (
                <ItemCard
                    key={i}
                    titulo={m.descripcion}
                    meta={[m.cantidad, m.unidad].filter(Boolean).join(' ') || null}
                    detalle={m.observacion}
                    badges={
                        <>
                            {!sinEvaluacion && <Badge tone={EVALUACION_TONE[m.evaluacion]}>{EVALUACION_LABEL[m.evaluacion]}</Badge>}
                            <OrigenBadge origen={m.origen} referencia={m.referencia} />
                        </>
                    }
                />
            ))}
        </ul>
    );
}

function HigieneSeguridad({ items }: { items: ContenidoAnalisis['higieneSeguridad'] }) {
    if (items.length === 0) return <EmptyState compact icon={<HardHat />} title="Sin requisitos de Higiene y Seguridad informados." />;
    const grupos = HYS_CATEGORIAS
        .map(cat => ({ cat, items: items.filter(i => i.categoria === cat) }))
        .filter(g => g.items.length > 0);
    return (
        <div>
            {grupos.map(g => (
                <div key={g.cat}>
                    <SeccionTitulo count={g.items.length}>{HYS_LABEL[g.cat as HysCategoria]}</SeccionTitulo>
                    <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {g.items.map((h, i) => (
                            <ItemCard key={i} titulo={h.descripcion} badges={<OrigenBadge origen={h.origen} referencia={h.referencia} />} />
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

function AlertaCard({ alerta }: { alerta: AlertaPliego }) {
    return (
        <li
            className={cn(
                'surface p-3.5 border-l-4',
                alerta.severidad === 'alta' ? 'border-l-danger-500' : alerta.severidad === 'media' ? 'border-l-warning-500' : 'border-l-info-500',
            )}
        >
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <Badge tone={SEVERIDAD_TONE[alerta.severidad]} dot>Severidad {SEVERIDAD_LABEL[alerta.severidad].toLowerCase()}</Badge>
                <Badge tone="neutral">{ALERTA_TIPO_LABEL[alerta.tipo]}</Badge>
                {alerta.referencia && <OrigenBadge origen="PLIEGO" referencia={alerta.referencia} />}
            </div>
            <p className="text-body font-medium text-foreground break-words">{alerta.titulo}</p>
            {alerta.descripcion && <p className="text-body text-muted-foreground mt-1 whitespace-pre-line break-words">{alerta.descripcion}</p>}
            {alerta.recomendacion && (
                <p className="text-body mt-2">
                    <span className="font-medium text-foreground">Recomendación: </span>
                    <span className="text-muted-foreground whitespace-pre-line">{alerta.recomendacion}</span>
                </p>
            )}
        </li>
    );
}
