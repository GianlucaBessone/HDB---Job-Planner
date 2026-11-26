'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight, CheckCircle2 } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, EmptyState, ErrorState, LoadingState, Panel, SegmentedControl } from '@/components/ui';
import { safeApiRequest } from '@/lib/offline';
import { ETIQUETA_VENCIMIENTO, type TipoVencimiento, type Vencimiento } from '@/lib/vencimientosTipos';

/**
 * Calendario único de vencimientos (auditoría, faltante): EPP, competencias, documentos y presupuestos en una
 * sola lista por fecha. Cada ítem abre su módulo; solo aparecen los tipos de las vistas que la persona puede abrir.
 */
type Rango = 'vencidos' | '30' | '90';
const TABS: { id: Rango; label: string }[] = [
    { id: 'vencidos', label: 'Vencidos' },
    { id: '30', label: 'Próximos 30 días' },
    { id: '90', label: 'Próximos 90 días' },
];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (f: string) => {
    const [a, m, d] = f.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
};
const diasHasta = (f: string) => Math.round((new Date(`${f}T12:00:00`).getTime() - new Date(new Date().toDateString()).getTime() - 12 * 3600_000) / 86_400_000);

export default function VencimientosPage() {
    const [datos, setDatos] = useState<Vencimiento[] | null>(null);
    const [error, setError] = useState(false);
    const [rango, setRango] = useState<Rango>('30');
    const [tipo, setTipo] = useState<'todos' | TipoVencimiento>('todos');

    useEffect(() => {
        safeApiRequest('/api/vencimientos?desde=-365&hasta=90')
            .then(async (r) => {
                if (!r.ok) throw new Error();
                setDatos((await r.json()).vencimientos);
            })
            .catch(() => setError(true));
    }, []);

    const conteos = useMemo(() => {
        const l = datos || [];
        return {
            vencidos: l.filter((v) => v.vencido).length,
            '30': l.filter((v) => !v.vencido && diasHasta(v.fecha) <= 30).length,
            '90': l.filter((v) => !v.vencido).length,
        } as Record<Rango, number>;
    }, [datos]);

    const enRango = useMemo(
        () =>
            (datos || []).filter((v) =>
                rango === 'vencidos' ? v.vencido : !v.vencido && (rango === '90' || diasHasta(v.fecha) <= 30)
            ),
        [datos, rango]
    );
    const tiposPresentes = useMemo(() => Array.from(new Set(enRango.map((v) => v.tipo))), [enRango]);
    const lista = useMemo(() => {
        const l = enRango.filter((v) => tipo === 'todos' || v.tipo === tipo);
        // Vencidos: el más reciente primero
        return rango === 'vencidos' ? [...l].reverse() : l;
    }, [enRango, tipo, rango]);

    const porFecha = useMemo(() => {
        const m = new Map<string, Vencimiento[]>();
        for (const v of lista) m.set(v.fecha, [...(m.get(v.fecha) || []), v]);
        return Array.from(m.entries());
    }, [lista]);

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Vencimientos"
                description="EPP, legajos, competencias, documentos, presupuestos y entregas que vencen, en una sola lista"
                icon={<CalendarClock className="w-5 h-5" />}
                tabs={TABS.map((t) => ({ ...t, count: datos ? conteos[t.id] : undefined }))}
                activeTabId={rango}
                onTabChange={(id) => {
                    setRango(id as Rango);
                    setTipo('todos');
                }}
            />

            {error ? (
                <ErrorState title="No se pudo cargar el calendario" description="Probá de nuevo en un momento." />
            ) : !datos ? (
                <LoadingState label="Cargando vencimientos…" />
            ) : (
                <>
                    {tiposPresentes.length > 1 && (
                        <SegmentedControl<'todos' | TipoVencimiento>
                            label="Tipo de vencimiento"
                            options={[
                                { value: 'todos', label: `Todos (${enRango.length})` },
                                ...tiposPresentes.map((t) => ({ value: t, label: `${ETIQUETA_VENCIMIENTO[t]} (${enRango.filter((v) => v.tipo === t).length})` })),
                            ]}
                            value={tipo}
                            onChange={setTipo}
                        />
                    )}

                    {porFecha.length === 0 ? (
                        <EmptyState
                            icon={<CheckCircle2 />}
                            title={rango === 'vencidos' ? 'No hay nada vencido' : 'No vence nada en este período'}
                            description="Se muestran EPP, competencias, documentos, presupuestos y entregas de compras de las pantallas que podés abrir."
                        />
                    ) : (
                        <div className="space-y-4">
                            {porFecha.map(([fecha, items]) => {
                                const dias = diasHasta(fecha);
                                return (
                                    <Panel
                                        key={fecha}
                                        title={fechaLarga(fecha)}
                                        actions={
                                            <Badge tone={dias < 0 ? 'danger' : dias <= 7 ? 'warning' : 'neutral'}>
                                                {dias < 0 ? `Venció hace ${-dias} día${dias === -1 ? '' : 's'}` : dias === 0 ? 'Vence hoy' : `En ${dias} día${dias === 1 ? '' : 's'}`}
                                            </Badge>
                                        }
                                        padded={false}
                                    >
                                        <ul className="divide-y divide-border">
                                            {items.map((v) => (
                                                <li key={v.id}>
                                                    <Link href={v.url} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken transition-colors">
                                                        <Badge tone="info" className="shrink-0">{ETIQUETA_VENCIMIENTO[v.tipo]}</Badge>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-[13px] font-medium text-foreground truncate">{v.titulo}</span>
                                                            <span className="block text-xs text-muted-foreground truncate">{v.detalle}</span>
                                                        </span>
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </Panel>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
