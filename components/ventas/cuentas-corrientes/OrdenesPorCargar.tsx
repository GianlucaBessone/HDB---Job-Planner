'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileSignature, Receipt } from 'lucide-react';
import { Badge, Panel } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { useAcceso } from '@/lib/store/useAccessStore';
import { formatARS } from '@/lib/formatCurrency';
import { formatDate } from '@/lib/formatDate';

interface Orden {
    origenTipo: 'OS' | 'OT_CICLO';
    origenId: string;
    clienteId: string;
    clienteNombre: string;
    numero: string;
    detalle: string;
    proyecto: { id: string; nombre: string; codigoProyecto: string | null } | null;
    fecha: string | null;
    monto: number;
}

const clave = (o: { origenTipo: string; origenId: string }) => `${o.origenTipo}:${o.origenId}`;

/**
 * Órdenes firmadas que todavía no están en la cuenta corriente (auditoría, P15): OS con el cobro
 * generado y ciclos de OT firmados por el cliente. Quien registra débitos (`ventas.cc_ajustar`)
 * las carga como "cargo por servicio"; cada orden se carga una sola vez.
 * Sin órdenes pendientes no muestra nada.
 */
export default function OrdenesPorCargar({ clienteId, onCargadas }: { clienteId?: string; onCargadas?: () => void }) {
    const { puede } = useAcceso();
    const puedeCargar = puede('ventas.cc_ajustar');
    const [ordenes, setOrdenes] = useState<Orden[] | null>(null);
    const [elegidas, setElegidas] = useState<Set<string>>(new Set());
    const [cargando, setCargando] = useState(false);

    const leer = useCallback(async () => {
        try {
            const res = await safeApiRequest(`/api/ventas/cuentas-corrientes/ordenes-por-cargar${clienteId ? `?clienteId=${clienteId}` : ''}`);
            const data = res.ok ? await res.json() : [];
            setOrdenes(Array.isArray(data) ? data : []);
            setElegidas(new Set());
        } catch {
            setOrdenes([]);
        }
    }, [clienteId]);

    useEffect(() => { leer(); }, [leer]);

    const total = useMemo(
        () => (ordenes || []).filter(o => elegidas.has(clave(o))).reduce((a, o) => a + o.monto, 0),
        [ordenes, elegidas]
    );

    if (!ordenes || ordenes.length === 0) return null;

    const todas = elegidas.size === ordenes.length;
    const alternar = (o: Orden) => setElegidas(prev => {
        const s = new Set(prev);
        if (s.has(clave(o))) s.delete(clave(o)); else s.add(clave(o));
        return s;
    });

    const cargar = async () => {
        const items = ordenes.filter(o => elegidas.has(clave(o))).map(o => ({ origenTipo: o.origenTipo, origenId: o.origenId }));
        if (!items.length) return;
        setCargando(true);
        try {
            const res = await safeApiRequest('/api/ventas/cuentas-corrientes/ordenes-por-cargar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return showToast(data?.error || 'No se pudieron cargar las órdenes', 'error');
            const fallidas = (data.resultados || []).filter((r: { ok: boolean }) => !r.ok);
            if (fallidas.length) showToast(`${data.cargadas} cargadas; ${fallidas.length} con error: ${fallidas[0].error}`, 'error');
            else showToast(data.cargadas === 1 ? 'Orden cargada en la cuenta corriente' : `${data.cargadas} órdenes cargadas en la cuenta corriente`, 'success');
            await leer();
            onCargadas?.();
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setCargando(false);
        }
    };

    return (
        <Panel
            title={<span className="flex items-center gap-2"><FileSignature className="w-4 h-4" aria-hidden="true" />Órdenes firmadas por cargar <Badge tone="warning">{ordenes.length}</Badge></span>}
            description="Trabajo firmado que todavía no es deuda del cliente: OS con el cobro generado y ciclos de OT firmados en el portal"
            actions={puedeCargar ? (
                <button type="button" className="btn btn-primary btn-sm" disabled={!elegidas.size || cargando} onClick={cargar}>
                    <Receipt aria-hidden="true" />
                    {cargando ? 'Cargando…' : elegidas.size ? `Cargar ${elegidas.size} (${formatARS(total)})` : 'Elegí órdenes para cargar'}
                </button>
            ) : undefined}
            padded={false}
        >
            <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr>
                            {puedeCargar && (
                                <th scope="col" className="w-10">
                                    <input
                                        type="checkbox"
                                        aria-label="Elegir todas"
                                        checked={todas}
                                        onChange={() => setElegidas(todas ? new Set() : new Set(ordenes.map(clave)))}
                                    />
                                </th>
                            )}
                            <th scope="col">Orden</th>
                            {!clienteId && <th scope="col">Cliente</th>}
                            <th scope="col">Proyecto</th>
                            <th scope="col">Firmada / cobrada</th>
                            <th scope="col" className="text-right">Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ordenes.map(o => (
                            <tr key={clave(o)}>
                                {puedeCargar && (
                                    <td>
                                        <input type="checkbox" aria-label={`Elegir ${o.numero}`} checked={elegidas.has(clave(o))} onChange={() => alternar(o)} />
                                    </td>
                                )}
                                <td>
                                    <span className="font-medium">{o.numero}</span>
                                    <span className="block text-xs text-muted-foreground">{o.detalle}</span>
                                </td>
                                {!clienteId && <td>{o.clienteNombre}</td>}
                                <td>
                                    {o.proyecto ? (
                                        <Link href={`/projects/ficha/${o.proyecto.id}`} className="text-brand-700 dark:text-brand-300 hover:underline">
                                            {o.proyecto.codigoProyecto ? `${o.proyecto.codigoProyecto} · ` : ''}{o.proyecto.nombre}
                                        </Link>
                                    ) : '—'}
                                </td>
                                <td className="whitespace-nowrap">{o.fecha ? formatDate(o.fecha) : '—'}</td>
                                <td className="text-right tabular-nums">{formatARS(o.monto)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!puedeCargar && (
                <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">Las carga quien registra débitos en cuenta corriente.</p>
            )}
        </Panel>
    );
}
