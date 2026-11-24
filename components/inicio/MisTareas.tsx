'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Badge, Panel } from '@/components/ui';
import { safeApiRequest } from '@/lib/offline';
import { useAcceso } from '@/lib/store/useAccessStore';
import { ETIQUETA_ORIGEN, VISTA_ORIGEN, type MiTarea } from '@/lib/misTareasTipos';

const MAXIMO = 8;
const fechaCorta = (f: string) => f.split('-').reverse().slice(0, 2).join('/');

/**
 * "Mis tareas" de Inicio (auditoría, P31 / FU9): tareas, acciones de mejora y planes de acción de KPI de la
 * persona, juntos, con su origen y vencimiento. Cada uno se abre en su módulo.
 */
export function MisTareas() {
    const { puedeVer } = useAcceso();
    const [tareas, setTareas] = useState<MiTarea[] | null>(null);

    useEffect(() => {
        let cancelado = false;
        safeApiRequest('/api/mis-tareas')
            .then(async (res) => (res.ok ? res.json() : { tareas: [] }))
            .then((d) => { if (!cancelado) setTareas(Array.isArray(d.tareas) ? d.tareas : []); })
            .catch(() => { if (!cancelado) setTareas([]); });
        return () => { cancelado = true; };
    }, []);

    if (!tareas) return null;
    const visibles = tareas.filter((t) => puedeVer(VISTA_ORIGEN[t.origen]));
    const vencidas = visibles.filter((t) => t.vencida).length;

    return (
        <Panel
            className="lg:col-span-3"
            title="Mis tareas"
            description={
                visibles.length
                    ? `${visibles.length} abierta${visibles.length === 1 ? '' : 's'}${vencidas ? `, ${vencidas} vencida${vencidas === 1 ? '' : 's'}` : ''}: tareas, acciones de mejora y planes de KPI`
                    : undefined
            }
            padded={false}
        >
            {visibles.length === 0 ? (
                <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-300" aria-hidden="true" />
                    No tenés tareas abiertas.
                </p>
            ) : (
                <>
                    <ul className="divide-y divide-border">
                        {visibles.slice(0, MAXIMO).map((t) => (
                            <li key={`${t.origen}-${t.id}`}>
                                <Link href={t.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken transition-colors">
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-medium text-foreground truncate">{t.titulo}</span>
                                        <span className="block text-xs text-muted-foreground truncate">
                                            {ETIQUETA_ORIGEN[t.origen]}{t.origenDetalle !== ETIQUETA_ORIGEN[t.origen] ? ` · ${t.origenDetalle}` : ''}
                                        </span>
                                    </span>
                                    {t.estado === 'en_curso' && <Badge tone="info">En curso</Badge>}
                                    {t.vence && (
                                        <Badge tone={t.vencida ? 'danger' : 'neutral'} className="tabular-nums">
                                            {t.vencida ? 'Vencida ' : 'Vence '}{fechaCorta(t.vence)}
                                        </Badge>
                                    )}
                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {visibles.length > MAXIMO && (
                        <p className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
                            Y {visibles.length - MAXIMO} más en sus módulos.
                        </p>
                    )}
                </>
            )}
        </Panel>
    );
}
