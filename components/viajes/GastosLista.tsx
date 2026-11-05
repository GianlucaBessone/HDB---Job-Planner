'use client';

import React from 'react';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { categoriaLabel, formatFechaCorta, formatFechaHora } from '@/lib/viajes';
import { ICONO_CATEGORIA } from './GastoFormDialog';
import { ListaComprobantes, type Comprobante } from './Comprobantes';
import { money, VerificacionBadge } from './shared';

export interface GastoVista {
    id: string;
    fecha: string;
    categoria: string;
    monto: number;
    descripcion: string | null;
    comercio: string | null;
    numeroComprobante: string | null;
    alcance: string;
    medioPago: string;
    afectados: { participanteId: string }[];
    comprobantes: Comprobante[];
    estadoVerificacion: string;
    montoAprobado: number | null;
    observacion: string | null;
    registradoPorNombre?: string | null;
}

/** Datos de un gasto: categoría, detalle, a quién afecta, medio de pago y fotos. */
export function GastoInfo({
    gasto,
    nombres,
    mostrarVerificacion = true,
    actions,
}: {
    gasto: GastoVista;
    nombres: Record<string, string>;
    mostrarVerificacion?: boolean;
    actions?: React.ReactNode;
}) {
    const afectados = gasto.alcance === 'individual' ? gasto.afectados.map(a => nombres[a.participanteId] || '—') : [];
    const ajustado = gasto.estadoVerificacion === 'observado' && gasto.montoAprobado != null;
    return (
        <div className="flex gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4" aria-hidden="true">
                {ICONO_CATEGORIA[gasto.categoria] || ICONO_CATEGORIA.otros}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100 truncate">
                            {gasto.descripcion || categoriaLabel(gasto.categoria)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {[categoriaLabel(gasto.categoria), gasto.comercio, gasto.numeroComprobante && `N° ${gasto.numeroComprobante}`, formatFechaCorta(gasto.fecha, false)].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className={cn('text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100', (ajustado || gasto.estadoVerificacion === 'rechazado') && 'line-through text-slate-400 dark:text-slate-500 font-normal')}>
                            {money(gasto.monto)}
                        </p>
                        {ajustado && <p className="text-[13px] font-semibold tabular-nums text-warning-700 dark:text-warning-300">{money(gasto.montoAprobado)}</p>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {gasto.alcance === 'individual'
                        ? <Badge tone="neutral">{afectados.length === 1 ? afectados[0] : `${afectados.length} personas`}</Badge>
                        : <Badge tone="neutral">Global</Badge>}
                    {gasto.medioPago === 'propio' && <Badge tone="info">Medios propios</Badge>}
                    {gasto.comprobantes.length === 0 && <Badge tone="warning">Sin comprobante</Badge>}
                    {mostrarVerificacion && gasto.estadoVerificacion !== 'pendiente' && <VerificacionBadge estado={gasto.estadoVerificacion} />}
                </div>
                {gasto.alcance === 'individual' && afectados.length > 1 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{afectados.join(', ')}</p>
                )}
                {gasto.observacion && (
                    <p className="text-xs mt-1.5 text-warning-800 dark:text-warning-200 bg-warning-50 dark:bg-warning-950 rounded-md px-2 py-1">
                        Observación: {gasto.observacion}
                    </p>
                )}
                {gasto.comprobantes.length > 0 && <ListaComprobantes comprobantes={gasto.comprobantes} className="mt-2" />}
                {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
            </div>
        </div>
    );
}

/** Gastos agrupados por día, del más reciente al más antiguo. */
export function GastosPorDia({
    gastos,
    nombres,
    renderActions,
}: {
    gastos: GastoVista[];
    nombres: Record<string, string>;
    renderActions?: (g: GastoVista) => React.ReactNode;
}) {
    const grupos = gastos.reduce<Record<string, GastoVista[]>>((acc, g) => {
        (acc[g.fecha] ||= []).push(g);
        return acc;
    }, {});
    const fechas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    return (
        <div className="space-y-4">
            {fechas.map(f => {
                const total = grupos[f].reduce((s, g) => s + g.monto, 0);
                return (
                    <section key={f}>
                        <div className="flex items-center justify-between px-1 mb-1.5">
                            <h3 className="eyebrow">{formatFechaCorta(f)}</h3>
                            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{money(total)}</span>
                        </div>
                        <ul className="surface divide-y divide-border">
                            {grupos[f].map(g => (
                                <li key={g.id} className="p-3">
                                    <GastoInfo gasto={g} nombres={nombres} actions={renderActions?.(g)} />
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

const ACCION_LABEL: Record<string, string> = {
    creado: 'Viaje creado',
    editado: 'Configuración editada',
    iniciado: 'Viaje iniciado',
    gasto_registrado: 'Gasto registrado',
    gasto_editado: 'Gasto editado',
    gasto_eliminado: 'Gasto eliminado',
    extendido: 'Estadía extendida',
    concluido: 'Viaje concluido',
    devuelto: 'Devuelto al responsable',
    verificado: 'Gastos verificados',
    cerrado: 'Rendición cerrada',
    cancelado: 'Viaje cancelado',
};

export function HistorialViaje({ historial }: { historial: { id: string; accion: string; detalle: string | null; usuarioNombre: string; createdAt: string }[] }) {
    if (!historial.length) {
        return <p className="text-[13px] text-slate-500 dark:text-slate-400 flex items-center gap-2"><History className="w-4 h-4" /> Sin movimientos.</p>;
    }
    return (
        <ol className="relative border-l border-border ml-1.5 space-y-4">
            {historial.map(h => (
                <li key={h.id} className="pl-4 relative">
                    <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 ring-2 ring-card" aria-hidden="true" />
                    <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{ACCION_LABEL[h.accion] || h.accion}</p>
                    {h.detalle && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 break-words">{h.detalle}</p>}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {h.usuarioNombre} · {formatFechaHora(h.createdAt)}
                    </p>
                </li>
            ))}
        </ol>
    );
}
