'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, ChevronRight, Clock, MapPin } from 'lucide-react';
import { Badge, Panel, Skeleton } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { safeApiRequest } from '@/lib/offline';
import { useAcceso } from '@/lib/store/useAccessStore';
import type { MiDiaRespuesta, PendienteInicio } from '@/lib/inicio';

const TONO: Record<PendienteInicio['tono'], BadgeTone> = {
    warning: 'warning',
    danger: 'danger',
    info: 'info',
    brand: 'brand',
};

/** Ruta base de un enlace, para chequear si la persona puede abrir esa vista. */
function vistaDe(href: string) {
    return href.split('?')[0];
}

/**
 * Inicio "Mi día": la jornada, la agenda de hoy y lo que la persona tiene que
 * atender, sin recorrer módulos (auditoría, FU12 / P11).
 */
export function MiDia() {
    const { puedeVer } = useAcceso();
    const [datos, setDatos] = useState<MiDiaRespuesta | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelado = false;
        safeApiRequest('/api/inicio/pendientes')
            .then(async res => {
                if (!res.ok) throw new Error();
                const data = await res.json();
                if (!cancelado) setDatos(data);
            })
            .catch(() => { if (!cancelado) setError(true); });
        return () => { cancelado = true; };
    }, []);

    if (error) return null; // Inicio sigue funcionando con los módulos
    if (!datos) {
        return (
            <div className="grid gap-4 lg:grid-cols-3" aria-hidden="true">
                <Skeleton className="h-36" />
                <Skeleton className="h-36 lg:col-span-2" />
            </div>
        );
    }

    const pendientes = datos.pendientes.filter(p => puedeVer(vistaDe(p.href)));
    const puedeFichar = puedeVer('/fichado');
    const proyectosHoy = [
        ...datos.agenda.map(b => ({ clave: `a-${b.proyectoId}-${b.inicio}`, proyecto: b.proyecto, horario: b.inicio ? `${b.inicio}${b.fin ? `–${b.fin}` : ''}` : null, nota: b.nota })),
        ...datos.asignaciones
            .filter(a => !datos.agenda.some(b => b.proyectoId === a.proyectoId))
            .map(a => ({ clave: `e-${a.proyectoId}`, proyecto: a.proyecto, horario: null, nota: 'Equipo asignado' })),
    ];

    return (
        <section aria-labelledby="mi-dia" className="grid gap-4 lg:grid-cols-3 items-start">
            <h2 id="mi-dia" className="sr-only">Mi día</h2>

            <Panel title="Hoy" description={datos.jornada ? 'Tu jornada está en curso' : 'Tu jornada y tu agenda'}>
                <div className="space-y-3">
                    {datos.jornada ? (
                        <p className="flex items-start gap-2 text-[13px] text-foreground">
                            <Clock className="w-4 h-4 mt-0.5 text-success-600 dark:text-success-300 shrink-0" aria-hidden="true" />
                            <span>
                                Iniciada a las <strong>{datos.jornada.horaIngreso ?? '—'}</strong>
                                {datos.jornada.proyecto ? <> en {datos.jornada.proyecto}</> : <> en la base</>}
                                {datos.jornada.fecha !== datos.hoy && <span className="block text-xs text-warning-700 dark:text-warning-300">Quedó abierta desde el {datos.jornada.fecha.split('-').reverse().join('/')}</span>}
                            </span>
                        </p>
                    ) : puedeFichar ? (
                        <p className="text-[13px] text-muted-foreground">Todavía no iniciaste la jornada.</p>
                    ) : null}

                    {proyectosHoy.length > 0 ? (
                        <ul className="space-y-1.5">
                            {proyectosHoy.map(p => (
                                <li key={p.clave} className="flex items-start gap-2 text-[13px]">
                                    <CalendarDays className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
                                    <span className="min-w-0">
                                        <span className="font-medium text-foreground">{p.proyecto}</span>
                                        {(p.horario || p.nota) && (
                                            <span className="block text-xs text-muted-foreground">{[p.horario, p.nota].filter(Boolean).join(' · ')}</span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[13px] text-muted-foreground">No tenés trabajos en la agenda de hoy.</p>
                    )}

                    {puedeFichar && (
                        <Link href="/fichado" className="btn btn-primary btn-sm w-full">
                            <MapPin aria-hidden="true" />
                            {datos.jornada ? 'Cerrar jornada' : 'Fichar jornada'}
                        </Link>
                    )}
                </div>
            </Panel>

            <Panel
                className="lg:col-span-2"
                title="Pendientes"
                description={pendientes.length ? 'Lo que espera tu respuesta' : undefined}
                padded={false}
            >
                {pendientes.length === 0 ? (
                    <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-300" aria-hidden="true" />
                        No tenés pendientes. Todo al día.
                    </p>
                ) : (
                    <ul className="divide-y divide-border">
                        {pendientes.map(p => (
                            <li key={p.id}>
                                <Link href={p.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors">
                                    <Badge tone={TONO[p.tono]} className="tabular-nums min-w-[2rem] justify-center">{p.cantidad}</Badge>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-medium text-foreground">{p.titulo}</span>
                                        <span className="block text-xs text-muted-foreground">{p.detalle}</span>
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </section>
    );
}
