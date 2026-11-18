'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, FileDown } from 'lucide-react';
import { Badge, Panel, EmptyState } from '@/components/ui';
import { api, pesos, horasTxt, fechaCorta, fechaHora, EstadoVersionBadge } from './cliente';

interface Props {
    presupuesto: any;
}

type Cambio = { que: string; antes: string; despues: string };

const n2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Cambios entre dos revisiones, en lenguaje llano. */
export function diferencias(a: any, b: any): Cambio[] {
    const c: Cambio[] = [];
    const campo = (que: string, x: any, y: any, fmt: (v: any) => string = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))) => {
        if (fmt(x) !== fmt(y)) c.push({ que, antes: fmt(x), despues: fmt(y) });
    };
    campo('Lista de precios', a.listaPrecioNombre, b.listaPrecioNombre);
    campo('Inicio tentativo', a.fechaInicioTentativa, b.fechaInicioTentativa, fechaCorta);
    campo('Fin tentativo', a.fechaFinTentativa, b.fechaFinTentativa, fechaCorta);
    campo('Operarios en simultáneo', a.operariosSimultaneos, b.operariosSimultaneos);
    campo('Validez (días)', a.validezDias, b.validezDias);
    campo('Descuento', `${n2(a.descuentoPorcentaje)} %`, `${n2(b.descuentoPorcentaje)} %`);
    campo('Alcance', (a.alcance || '').trim(), (b.alcance || '').trim(), (v) => (v ? (v.length > 60 ? v.slice(0, 60) + '…' : v) : '—'));

    const tA = new Map<string, any>(a.tareas.map((t: any) => [t.descripcion.trim().toLowerCase(), t]));
    const tB = new Map<string, any>(b.tareas.map((t: any) => [t.descripcion.trim().toLowerCase(), t]));
    for (const [k, t] of Array.from(tB.entries())) {
        const prev = tA.get(k);
        if (!prev) c.push({ que: `Tarea agregada: ${t.descripcion}`, antes: '—', despues: `${horasTxt(t.horas)} · ${pesos(t.importe, 0)}` });
        else {
            if (n2(prev.horas) !== n2(t.horas) || n2(prev.importe) !== n2(t.importe)) {
                c.push({ que: `Tarea: ${t.descripcion}`, antes: `${horasTxt(prev.horas)} · ${pesos(prev.importe, 0)}`, despues: `${horasTxt(t.horas)} · ${pesos(t.importe, 0)}` });
            }
            const vhA = new Map<string, number>(prev.manoObra.map((l: any) => [l.categoriaNombre, n2(l.valorHora)]));
            for (const l of t.manoObra) {
                const vh = vhA.get(l.categoriaNombre);
                if (vh !== undefined && vh !== n2(l.valorHora)) c.push({ que: `Valor hora · ${l.categoriaNombre} (${t.descripcion})`, antes: pesos(vh, 0), despues: pesos(l.valorHora, 0) });
            }
        }
    }
    for (const [k, t] of Array.from(tA.entries())) if (!tB.has(k)) c.push({ que: `Tarea quitada: ${t.descripcion}`, antes: `${horasTxt(t.horas)} · ${pesos(t.importe, 0)}`, despues: '—' });

    const clave = (m: any) => (m.sku || m.descripcion).trim().toLowerCase();
    const mA = new Map<string, any>(a.materiales.map((m: any) => [clave(m), m]));
    const mB = new Map<string, any>(b.materiales.map((m: any) => [clave(m), m]));
    for (const [k, m] of Array.from(mB.entries())) {
        const prev = mA.get(k);
        if (!prev) c.push({ que: `Material agregado: ${m.descripcion}`, antes: '—', despues: `${n2(m.cantidad)} ${m.unidad || ''} · ${pesos(m.subtotal, 0)}` });
        else {
            if (n2(prev.cantidad) !== n2(m.cantidad)) c.push({ que: m.descripcion, antes: `${n2(prev.cantidad)} ${prev.unidad || ''}`, despues: `${n2(m.cantidad)} ${m.unidad || ''}` });
            if (n2(prev.precioUnitario) !== n2(m.precioUnitario)) c.push({ que: `Precio · ${m.descripcion}`, antes: pesos(prev.precioUnitario), despues: pesos(m.precioUnitario) });
        }
    }
    for (const [k, m] of Array.from(mA.entries())) if (!mB.has(k)) c.push({ que: `Material quitado: ${m.descripcion}`, antes: `${n2(m.cantidad)} ${m.unidad || ''}`, despues: '—' });

    if (n2(a.total) !== n2(b.total)) {
        const pct = a.total > 0 ? ((b.total - a.total) / a.total) * 100 : 0;
        c.push({ que: 'Total', antes: pesos(a.total, 0), despues: `${pesos(b.total, 0)} (${pct >= 0 ? '+' : ''}${pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %)` });
    }
    return c;
}

const EVENTOS: Record<string, string> = {
    CREATE: 'creó el presupuesto',
    APPROVE: 'registró la aceptación del cliente',
    REJECT: 'registró el rechazo del cliente',
    DELETE: 'descartó el presupuesto',
    CONVERT: 'lo convirtió en proyecto',
    ENVIO: 'lo envió al cliente',
    NUEVA_REVISION: 'abrió una nueva revisión',
    VENCIMIENTO: 'venció la validez',
};

function textoEvento(l: any): string {
    const ev = l.metadata?.evento;
    if (ev && EVENTOS[ev]) {
        if (ev === 'ENVIO') return `${EVENTOS[ev]} (revisión ${l.metadata?.version})`;
        if (ev === 'NUEVA_REVISION') return `${EVENTOS[ev]} (${l.newValue?.version})${l.metadata?.nota ? `: “${l.metadata.nota}”` : ''}`;
        return EVENTOS[ev];
    }
    if (l.action === 'UPDATE') return 'editó el borrador';
    if (l.action === 'REJECT' && l.newValue?.motivo) return `${EVENTOS.REJECT}: “${l.newValue.motivo}”`;
    if (l.action === 'CONVERT' && l.newValue?.codigoProyecto) return `${EVENTOS.CONVERT} ${l.newValue.codigoProyecto}`;
    return EVENTOS[l.action] || l.action;
}

export default function HistorialRevisiones({ presupuesto }: Props) {
    const [actividad, setActividad] = useState<any[] | null>(null);
    useEffect(() => {
        api<any[]>(`/api/presupuestos-servicio/${presupuesto.id}/actividad`).then(setActividad).catch(() => setActividad([]));
    }, [presupuesto.id, presupuesto.updatedAt]);

    const versiones: any[] = presupuesto.versiones || [];
    const cambios = useMemo(
        () => versiones.slice(0, -1).map((v, i) => ({ version: v.version, cambios: diferencias(versiones[i + 1], v), nota: v.notaRevision })),
        [versiones]
    );
    const snap = presupuesto.snapshot;

    return (
        <div className="space-y-4">
            {snap && (
                <Panel title="Copia congelada de la aceptación">
                    <div className="flex flex-wrap items-start gap-4">
                        {snap.integra ? (
                            <Badge tone="success"><ShieldCheck /> Íntegra</Badge>
                        ) : (
                            <Badge tone="danger"><ShieldAlert /> Alterada</Badge>
                        )}
                        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                            <dt className="text-slate-500 dark:text-slate-400">Revisión aceptada</dt><dd>{snap.numeroVersion}</dd>
                            <dt className="text-slate-500 dark:text-slate-400">Fecha de aceptación</dt><dd>{fechaCorta(snap.fechaAceptacion)}</dd>
                            <dt className="text-slate-500 dark:text-slate-400">Registrada por</dt><dd>{snap.aceptadoPorNombre || '—'} · {fechaHora(snap.createdAt)}</dd>
                            {snap.referenciaCliente && (<><dt className="text-slate-500 dark:text-slate-400">Referencia del cliente</dt><dd>{snap.referenciaCliente}</dd></>)}
                            {snap.comentario && (<><dt className="text-slate-500 dark:text-slate-400">Comentario</dt><dd>{snap.comentario}</dd></>)}
                            <dt className="text-slate-500 dark:text-slate-400">SHA-256</dt><dd className="font-mono text-xs break-all">{snap.hashSha256}</dd>
                        </dl>
                    </div>
                    <p className="field-hint">La copia no se puede modificar ni borrar. El reporte presupuestado vs. real compara contra ella.</p>
                </Panel>
            )}

            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <div className="flex-1 min-w-0 space-y-4 w-full">
                    <Panel title="Revisiones" description="Las revisiones anteriores quedan guardadas sin cambios." bodyClassName="p-0">
                        <ul className="divide-y divide-border">
                            {versiones.map((v) => (
                                <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                    <span className="font-mono text-sm font-medium w-8">v{v.version}</span>
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Revisión {v.version}</span><EstadoVersionBadge estado={v.estado} /></div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {v.enviadaEn ? `Enviada el ${fechaHora(v.enviadaEn)}` : `Creada el ${fechaHora(v.createdAt)}`} por {v.creadoPorNombre || '—'} · {pesos(v.total, 0)} · {horasTxt(v.horasTotales)}
                                        </p>
                                    </div>
                                    <a className="btn btn-ghost btn-sm" href={`/api/presupuestos-servicio/${presupuesto.id}/pdf?version=${v.version}`} target="_blank" rel="noopener noreferrer"><FileDown /> PDF</a>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                    {cambios.map((c) => (
                        <Panel key={c.version} title={`Cambios de la revisión ${c.version - 1} a la ${c.version}`} description={c.nota ? `Motivo: “${c.nota}”` : undefined} bodyClassName="p-0">
                            {c.cambios.length === 0 ? (
                                <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Sin cambios de contenido.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead><tr><th className="text-left !pl-4">Qué cambió</th><th className="text-left">Revisión {c.version - 1}</th><th className="text-left">Revisión {c.version}</th></tr></thead>
                                        <tbody>
                                            {c.cambios.map((x, i) => (
                                                <tr key={i}><td className="!pl-4">{x.que}</td><td className="tabular-nums">{x.antes}</td><td className="tabular-nums">{x.despues}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Panel>
                    ))}
                </div>
                <Panel className="w-full lg:w-96 shrink-0" title="Actividad" actions={<a href="/auditoria" className="text-sm text-primary hover:underline">Ver en Auditoría</a>} bodyClassName="p-0">
                    {actividad === null ? (
                        <p className="px-4 py-3 text-sm text-slate-500">Cargando…</p>
                    ) : actividad.length === 0 ? (
                        <EmptyState compact title="Sin actividad registrada" />
                    ) : (
                        <ul className="divide-y divide-border">
                            {actividad.map((l) => (
                                <li key={l.id} className="grid grid-cols-[88px,1fr] gap-2 px-4 py-2.5 text-sm">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{fechaHora(l.timestamp)}</span>
                                    <span><b className="font-semibold">{l.userName || 'Sistema'}</b> {textoEvento(l)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}
