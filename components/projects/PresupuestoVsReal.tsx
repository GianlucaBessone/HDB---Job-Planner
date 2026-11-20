'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge, Panel, Stat } from '@/components/ui';
import { pesos, horasTxt, fechaCorta } from '@/components/presupuestosServicio/cliente';

const pct = (x: number) => `${Math.round(x * 100)} %`;
const signo = (n: number, f: (v: number) => string) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(Math.abs(n))}` : f(0));

function Barra({ valor }: { valor: number }) {
    return (
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-slate-500 dark:bg-slate-400" style={{ width: `${Math.min(100, Math.max(0, valor * 100))}%` }} />
        </div>
    );
}

/** Reporte presupuestado vs. real (datos de /api/projects/[id]/presupuesto-vs-real). */
export default function PresupuestoVsReal({ data }: { data: any }) {
    const { horas, materiales, monto, presupuesto } = data;
    const alertaHoras = horas.avance > 0 && horas.porcentajeConsumido - horas.avance > 0.1;

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Contra la copia congelada de <Link href={`/presupuestos-servicio/${presupuesto.id}`} className="font-mono text-primary hover:underline">{presupuesto.numero}</Link>, revisión {presupuesto.version}, aceptada el {fechaCorta(presupuesto.fechaAceptacion)}.
                {!presupuesto.integra && <span className="inline-flex items-center gap-1 ml-2 text-danger-700 dark:text-danger-300"><ShieldAlert className="w-4 h-4" aria-hidden="true" /> La copia no pasa la verificación de integridad.</span>}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div><Stat label="Horas consumidas" value={<>{horas.consumidas} <span className="text-sm font-normal text-slate-500">de {horas.presupuestadas} h</span></>} hint={`${pct(horas.porcentajeConsumido)} · el proyecto estima ${horasTxt(horas.proyecto)}`} /><Barra valor={horas.porcentajeConsumido} /></div>
                <div><Stat label="Avance de tareas" value={pct(horas.avance)} hint="Tareas hechas, ponderadas por horas" /><Barra valor={horas.avance} /></div>
                <div><Stat label="Materiales usados" value={pesos(materiales.real, 0)} hint={`${materiales.presupuestado > 0 ? pct(materiales.real / materiales.presupuestado) : '—'} de ${pesos(materiales.presupuestado, 0)}`} /><Barra valor={materiales.presupuestado > 0 ? materiales.real / materiales.presupuestado : 0} /></div>
                <div><Stat label="Monto valorizado (neto)" value={pesos(monto.real.total, 0)} hint={`${monto.presupuestado.total > 0 ? pct(monto.real.total / monto.presupuestado.total) : '—'} de ${pesos(monto.presupuestado.total, 0)}`} /><Barra valor={monto.presupuestado.total > 0 ? monto.real.total / monto.presupuestado.total : 0} /></div>
            </div>

            {alertaHoras && (
                <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-800 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span><b className="font-semibold">Desvío de horas.</b> Con {pct(horas.avance)} de avance ya se consumió el {pct(horas.porcentajeConsumido)} de las horas.
                        {horas.proyeccion !== null && ` Al ritmo actual terminaría con ≈ ${horas.proyeccion} h (${signo(Math.round(horas.desvioProyectado * 100), (v) => `${v} %`)} sobre lo presupuestado).`}</span>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                <Panel title="Horas por tarea" description="Las horas reales por tarea llegan en la fase 2: hoy los registros de horas no indican la tarea." bodyClassName="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px]">
                            <thead><tr><th className="text-left !pl-4">Tarea</th><th className="text-right">Presup.</th><th className="text-right">Proyecto</th><th className="text-left">Estado</th></tr></thead>
                            <tbody>
                                {horas.tareas.map((t: any, i: number) => (
                                    <tr key={i}>
                                        <td className="!pl-4">{t.descripcion}{t.origen === 'manual' && <span className="text-xs text-slate-500"> · no presupuestada</span>}</td>
                                        <td className="text-right tabular-nums">{t.horasPresupuesto ?? '—'}</td>
                                        <td className="text-right tabular-nums">{t.origen === 'quitada' ? '—' : t.horasProyecto}</td>
                                        <td>{t.origen === 'quitada' ? <Badge tone="neutral">No incluida</Badge> : t.completada ? <Badge tone="success">Hecha</Badge> : <Badge tone="neutral">Pendiente</Badge>}</td>
                                    </tr>
                                ))}
                                <tr className="font-semibold"><td className="!pl-4">Total</td><td className="text-right tabular-nums">{horas.presupuestadas}</td><td className="text-right tabular-nums">{horas.proyecto}</td><td /></tr>
                            </tbody>
                        </table>
                    </div>
                </Panel>
                <Panel title="Horas trabajadas por operador" description="Las horas consumidas del proyecto cuentan las extra doble, como el dashboard." bodyClassName="p-0">
                    {horas.operadores.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">Todavía no hay horas cargadas.</p> : (
                        <table className="w-full">
                            <thead><tr><th className="text-left !pl-4">Operador</th><th className="text-right">Horas</th><th className="text-right">Extra</th></tr></thead>
                            <tbody>{horas.operadores.map((o: any) => <tr key={o.nombre}><td className="!pl-4">{o.nombre}</td><td className="text-right tabular-nums">{o.horas}</td><td className="text-right tabular-nums">{o.extras || '—'}</td></tr>)}</tbody>
                        </table>
                    )}
                </Panel>
            </div>

            <Panel title="Materiales" description="Mientras la obra sigue, un desvío negativo es material que falta usar, no un ahorro." bodyClassName="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                        <thead><tr><th className="text-left !pl-4">Material</th><th className="text-right">Presup.</th><th className="text-right">Usado</th><th className="text-right">$ presup.</th><th className="text-right">$ real</th><th className="text-right">Desvío</th></tr></thead>
                        <tbody>
                            {materiales.filas.map((m: any, i: number) => (
                                <tr key={i}><td className="!pl-4">{m.descripcion}</td><td className="text-right tabular-nums">{m.cantidadPresupuesto} {m.unidad}</td><td className="text-right tabular-nums">{m.cantidadUsada}</td><td className="text-right tabular-nums">{pesos(m.importePresupuesto, 0)}</td><td className="text-right tabular-nums">{pesos(m.importeReal, 0)}</td><td className="text-right tabular-nums">{signo(m.desvio, (v) => pesos(v, 0))}</td></tr>
                            ))}
                            {materiales.extras.map((m: any, i: number) => (
                                <tr key={`x${i}`}><td className="!pl-4">{m.descripcion} <Badge tone="neutral">No presupuestado</Badge></td><td className="text-right">—</td><td className="text-right tabular-nums">{m.cantidad}</td><td className="text-right">—</td><td className="text-right tabular-nums">{pesos(m.real, 0)}</td><td className="text-right tabular-nums">{signo(m.real, (v) => pesos(v, 0))}</td></tr>
                            ))}
                            <tr className="font-semibold"><td className="!pl-4">Total</td><td /><td /><td className="text-right tabular-nums">{pesos(materiales.presupuestado, 0)}</td><td className="text-right tabular-nums">{pesos(materiales.real, 0)}</td><td className="text-right tabular-nums">{signo(materiales.desvio, (v) => pesos(v, 0))}</td></tr>
                        </tbody>
                    </table>
                </div>
            </Panel>

            <Panel title="Monto (neto, sin IVA)" bodyClassName="p-0">
                <table className="w-full">
                    <thead><tr><th className="text-left !pl-4">Concepto</th><th className="text-right">Presupuestado</th><th className="text-right">Real valorizado</th></tr></thead>
                    <tbody>
                        <tr><td className="!pl-4">Mano de obra <span className="text-xs text-slate-500">· {horas.presupuestadas} h → {horas.consumidas} h</span></td><td className="text-right tabular-nums">{pesos(monto.presupuestado.manoObra, 0)}</td><td className="text-right tabular-nums">{pesos(monto.real.manoObra, 0)}</td></tr>
                        <tr><td className="!pl-4">Materiales</td><td className="text-right tabular-nums">{pesos(monto.presupuestado.materiales, 0)}</td><td className="text-right tabular-nums">{pesos(monto.real.materiales, 0)}</td></tr>
                        <tr className="font-semibold"><td className="!pl-4">Total</td><td className="text-right tabular-nums">{pesos(monto.presupuestado.total, 0)}</td><td className="text-right tabular-nums">{pesos(monto.real.total, 0)}</td></tr>
                    </tbody>
                </table>
                <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    Valorizado con los precios del presupuesto. Las horas reales no tienen categoría, así que se valorizan al promedio del presupuesto ({pesos(monto.valorHoraPromedio, 0)}/h).
                    El costo interno con el valor de mano de obra de Proyectos → Ajustes sigue en la pestaña Costo real, sin cambios.
                </p>
            </Panel>
        </div>
    );
}
