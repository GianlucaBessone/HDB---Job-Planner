'use client';

import { useMemo } from 'react';
import { format, startOfWeek, subWeeks, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react';
import { Badge, EmptyState, Panel, Stat } from '@/components/ui';
import { cn } from '@/lib/cn';
import { estaAbierta, estaVencida } from '@/lib/tareas/vencimiento';
import {
    PRIORIDADES, columnaDeEstado, compararAbiertas, getPrioridadConfig, getVencimientoInfo,
    type Tarea,
} from './tipos';

const DIA = 86_400_000;

export default function TareasDashboard({
    tareas,
    onOpen,
    onFiltrarPrioridad,
}: {
    tareas: Tarea[];
    onOpen: (t: Tarea) => void;
    onFiltrarPrioridad: (prioridad: string) => void;
}) {
    const datos = useMemo(() => {
        const ahora = new Date();
        const abiertas = tareas.filter(t => estaAbierta(t.estado));
        const vencidas = abiertas.filter(t => estaVencida(t, ahora));
        const proximas = abiertas.filter(t => {
            if (!t.fechaVencimiento || estaVencida(t, ahora)) return false;
            return new Date(t.fechaVencimiento).getTime() - ahora.getTime() <= 7 * DIA;
        });
        const completadas = tareas.filter(t => columnaDeEstado(t.estado) === 'completada');
        const completadas30 = completadas.filter(t => t.fechaCompletada && ahora.getTime() - new Date(t.fechaCompletada).getTime() <= 30 * DIA);
        const sinFecha = abiertas.filter(t => !t.fechaVencimiento).length;
        const enProgreso = abiertas.filter(t => t.estado === 'en_progreso').length;

        const porPrioridad = PRIORIDADES.map(p => ({
            ...p,
            total: abiertas.filter(t => t.prioridad === p.value).length,
            vencidas: vencidas.filter(t => t.prioridad === p.value).length,
        }));

        // Carga por persona: responsables (o cualquier involucrado si no hay responsable)
        const carga = new Map<string, { nombre: string; total: number; vencidas: number }>();
        for (const t of abiertas) {
            const resp = t.involucrados.filter(i => i.rol === 'responsable');
            const personas = resp.length ? resp : t.involucrados;
            const lista = personas.length ? personas.map(p => ({ id: p.operatorId, nombre: p.operator.nombreCompleto })) : [{ id: '_', nombre: 'Sin asignar' }];
            for (const p of lista) {
                const c = carga.get(p.id) || { nombre: p.nombre, total: 0, vencidas: 0 };
                c.total++;
                if (estaVencida(t, ahora)) c.vencidas++;
                carga.set(p.id, c);
            }
        }
        const porPersona = Array.from(carga.values()).sort((a, b) => b.total - a.total).slice(0, 8);

        // Completadas por semana (últimas 8)
        const inicio = startOfWeek(subWeeks(ahora, 7), { weekStartsOn: 1 });
        const semanas = Array.from({ length: 8 }, (_, i) => {
            const desde = addDays(inicio, i * 7);
            const hasta = addDays(desde, 7);
            return {
                label: format(desde, 'd MMM', { locale: es }),
                total: completadas.filter(t => {
                    if (!t.fechaCompletada) return false;
                    const f = new Date(t.fechaCompletada);
                    return f >= desde && f < hasta;
                }).length,
            };
        });

        const atencion = [...vencidas, ...proximas].sort(compararAbiertas).slice(0, 10);

        return { abiertas, vencidas, proximas, completadas30, sinFecha, enProgreso, porPrioridad, porPersona, semanas, atencion };
    }, [tareas]);

    const maxPrioridad = Math.max(1, ...datos.porPrioridad.map(p => p.total));
    const maxPersona = Math.max(1, ...datos.porPersona.map(p => p.total));
    const maxSemana = Math.max(1, ...datos.semanas.map(s => s.total));

    if (tareas.length === 0) {
        return <EmptyState icon={<ListTodo />} title="Todavía no hay tareas" description="Cargá la primera desde la barra de alta rápida." />;
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Abiertas" value={datos.abiertas.length} icon={<ListTodo />} hint={`${datos.enProgreso} en progreso · ${datos.sinFecha} sin fecha`} />
                <Stat label="Vencidas" value={datos.vencidas.length} icon={<AlertTriangle />} tone={datos.vencidas.length ? 'danger' : 'neutral'} hint="Pendientes o en progreso" />
                <Stat label="Vencen en 7 días" value={datos.proximas.length} icon={<CalendarClock />} tone={datos.proximas.length ? 'warning' : 'neutral'} />
                <Stat label="Completadas (30 días)" value={datos.completadas30.length} icon={<CheckCircle2 />} tone="success" />
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
                <Panel title="Requieren atención" description="Vencidas y por vencer en la semana" className="lg:col-span-2" padded={false}>
                    {datos.atencion.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-center text-muted-foreground">Nada vencido ni por vencer esta semana.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {datos.atencion.map(t => {
                                const v = getVencimientoInfo(t);
                                const p = getPrioridadConfig(t.prioridad);
                                const resp = t.involucrados.find(i => i.rol === 'responsable') || t.involucrados[0];
                                return (
                                    <li key={t.id}>
                                        <button type="button" onClick={() => onOpen(t)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 transition-colors">
                                            <span className={cn('w-1.5 h-8 rounded-full shrink-0', p.bar)} aria-hidden="true" />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm font-medium truncate">{t.titulo}</span>
                                                <span className="block text-xs text-muted-foreground truncate">
                                                    {resp ? resp.operator.nombreCompleto : 'Sin asignar'}
                                                    {t.project ? ` · ${t.project.codigoProyecto || t.project.nombre}` : ''}
                                                </span>
                                            </span>
                                            <Badge tone={p.tone} className="hidden sm:inline-flex">{p.label}</Badge>
                                            {v && <span className={cn('text-xs whitespace-nowrap', v.className)}>{v.text}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>

                <Panel title="Abiertas por prioridad" description="Tocá una barra para filtrar el tablero">
                    <ul className="space-y-3">
                        {datos.porPrioridad.slice().reverse().map(p => (
                            <li key={p.value}>
                                <button type="button" onClick={() => onFiltrarPrioridad(p.value)} className="w-full text-left group">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className={cn('font-medium', p.text)}>{p.label}</span>
                                        <span className="tabular-nums text-muted-foreground">
                                            {p.total}{p.vencidas > 0 && <span className="text-danger-600 dark:text-danger-400"> · {p.vencidas} vencida{p.vencidas === 1 ? '' : 's'}</span>}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div className={cn('h-full rounded-full transition-all group-hover:opacity-80', p.bar)} style={{ width: `${(p.total / maxPrioridad) * 100}%` }} />
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <Panel title="Carga por persona" description="Tareas abiertas como responsable">
                    {datos.porPersona.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin tareas abiertas.</p>
                    ) : (
                        <ul className="space-y-2.5">
                            {datos.porPersona.map(p => (
                                <li key={p.nombre} className="flex items-center gap-3">
                                    <span className="w-32 sm:w-40 text-sm truncate" title={p.nombre}>{p.nombre}</span>
                                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                                        <div className="h-full bg-danger-500" style={{ width: `${(p.vencidas / maxPersona) * 100}%` }} />
                                        <div className="h-full bg-brand-500" style={{ width: `${((p.total - p.vencidas) / maxPersona) * 100}%` }} />
                                    </div>
                                    <span className="w-16 text-right text-sm tabular-nums">
                                        {p.total}{p.vencidas > 0 && <span className="text-danger-600 dark:text-danger-400 text-xs"> ({p.vencidas})</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />En término</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-danger-500" />Vencidas</span>
                    </div>
                </Panel>

                <Panel title="Completadas por semana" description="Últimas 8 semanas">
                    <div className="flex items-end gap-2 h-36" role="img" aria-label={`Completadas por semana: ${datos.semanas.map(s => `${s.label}: ${s.total}`).join(', ')}`}>
                        {datos.semanas.map((s, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                <span className="text-xs tabular-nums text-muted-foreground">{s.total || ''}</span>
                                <div className="w-full max-w-[2.5rem] rounded-t-md bg-success-500" style={{ height: `${Math.max(s.total ? 4 : 0, (s.total / maxSemana) * 85)}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-1.5 border-t border-border pt-1.5">
                        {datos.semanas.map((s, i) => (
                            <span key={i} className="flex-1 text-center text-[11px] text-muted-foreground truncate">{s.label}</span>
                        ))}
                    </div>
                </Panel>
            </div>
        </div>
    );
}
