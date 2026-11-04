'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Luggage, Users } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { showToast } from '@/components/Toast';
import { Badge, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRangoFechas, MODALIDAD_CORTA, type ModalidadFondos } from '@/lib/viajes';
import { apiJson, BarraConsumo, EstadoViajeBadge, money, Ruta } from '@/components/viajes/shared';

const ACTIVOS = ['en_curso', 'planificado', 'finalizado'];

export default function MisViajesPage() {
    const [viajes, setViajes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [verHistorial, setVerHistorial] = useState(false);

    const cargar = useCallback(async () => {
        setError(false);
        try {
            setViajes(await apiJson('/api/viajes?mios=1'));
        } catch (e: any) {
            setError(true);
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const { activos, historial } = useMemo(() => {
        const orden = (v: any) => ACTIVOS.indexOf(v.estado);
        return {
            activos: viajes.filter(v => ACTIVOS.includes(v.estado)).sort((a, b) => orden(a) - orden(b) || a.fechaInicio.localeCompare(b.fechaInicio)),
            historial: viajes.filter(v => !ACTIVOS.includes(v.estado)),
        };
    }, [viajes]);

    return (
        <div className="max-w-3xl mx-auto">
            <ModuleHeader
                title="Mis Viajes"
                description="Registrá los gastos de tus viajes y seguí el saldo"
                icon={<Luggage />}
            />

            {loading ? (
                <LoadingState label="Cargando tus viajes…" />
            ) : error && viajes.length === 0 ? (
                <ErrorState onRetry={cargar} />
            ) : viajes.length === 0 ? (
                <div className="surface">
                    <EmptyState
                        icon={<Luggage />}
                        title="No tenés viajes asignados"
                        description="Cuando administración te asigne un viaje vas a verlo acá para registrar los gastos."
                    />
                </div>
            ) : (
                <div className="space-y-6">
                    {activos.length > 0 ? (
                        <ul className="space-y-3">
                            {activos.map(v => <li key={v.id}><TarjetaViaje v={v} /></li>)}
                        </ul>
                    ) : (
                        <div className="surface">
                            <EmptyState compact title="Sin viajes activos" description="Tus viajes anteriores están en el historial." />
                        </div>
                    )}

                    {historial.length > 0 && (
                        <section>
                            <button
                                type="button"
                                onClick={() => setVerHistorial(h => !h)}
                                aria-expanded={verHistorial}
                                className="w-full flex items-center justify-between px-1 py-2 text-left"
                            >
                                <span className="eyebrow">Historial ({historial.length})</span>
                                <ChevronRight className={cn('w-4 h-4 text-slate-400 transition-transform', verHistorial && 'rotate-90')} aria-hidden="true" />
                            </button>
                            {verHistorial && (
                                <ul className="space-y-2 mt-1">
                                    {historial.map(v => <li key={v.id}><TarjetaViaje v={v} compacta /></li>)}
                                </ul>
                            )}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

function TarjetaViaje({ v, compacta }: { v: any; compacta?: boolean }) {
    const r = v.resumen;
    const anticipo = v.modalidadFondos === 'anticipo';
    return (
        <Link href={`/mis-viajes/${v.id}`} className="surface block p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <EstadoViajeBadge estado={v.estado} />
                        {!v.esResponsable && <Badge tone="neutral"><Users /> Participante</Badge>}
                    </div>
                    <p className="mt-2 text-heading text-slate-900 dark:text-slate-50 leading-snug">{v.motivo}</p>
                    <Ruta origen={v.origen} destino={v.destino} className="text-[13px] text-slate-600 dark:text-slate-300 mt-0.5 max-w-full" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                        {formatRangoFechas(v.fechaInicio, v.fechaFin)} · {r.dias} día{r.dias === 1 ? '' : 's'}
                        {v.fechaFin !== v.fechaFinOriginal && ' · extendido'}
                    </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" aria-hidden="true" />
            </div>

            {!compacta && (
                <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <span className="text-[13px] text-slate-600 dark:text-slate-300">
                            <b className="font-semibold text-slate-900 dark:text-slate-50 tabular-nums">{money(r.gastado)}</b>
                            {r.estimado > 0 && <span className="tabular-nums"> de {money(r.estimado)}</span>}
                        </span>
                        {r.estimado > 0 && <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{r.porcentajeConsumo}%</span>}
                    </div>
                    {r.estimado > 0 && <BarraConsumo porcentaje={r.porcentajeConsumo} grosor="h-2" />}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>{MODALIDAD_CORTA[v.modalidadFondos as ModalidadFondos]}</span>
                        {anticipo && (
                            <span className={cn(r.saldoFondos < 0 && 'text-danger-700 dark:text-danger-300')}>
                                Saldo de fondos <b className="font-medium tabular-nums">{money(r.saldoFondos)}</b>
                            </span>
                        )}
                        {r.gastadoPropio > 0 && <span>Medios propios <b className="font-medium tabular-nums">{money(r.gastadoPropio)}</b></span>}
                        <span>{v.cantidadGastos} gasto{v.cantidadGastos === 1 ? '' : 's'}</span>
                    </div>
                </div>
            )}
        </Link>
    );
}
