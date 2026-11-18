'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, ListChecks, Users, BarChart3 } from 'lucide-react';
import { Badge, Button, Dialog } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { useAcceso } from '@/lib/store/useAccessStore';
import { api, fechaCorta, horasTxt } from '@/components/presupuestosServicio/cliente';

interface Props {
    projectId: string;
    presupuesto?: { id: string; numero: string } | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    operadores: { id: string; nombreCompleto: string; activo?: boolean }[];
    onVerReporte?: () => void;
}

/**
 * Secciones del detalle de proyecto que agrega el módulo de presupuestos: presupuesto de origen,
 * tareas y equipo asignado. En un proyecto sin presupuesto, sin tareas y sin equipo no muestra nada,
 * así el detalle de los proyectos existentes queda igual.
 */
export default function ProyectoPresupuestoPanel({ projectId, presupuesto, fechaInicio, fechaFin, operadores, onVerReporte }: Props) {
    const { puede } = useAcceso();
    const [tareas, setTareas] = useState<any[] | null>(null);
    const [equipo, setEquipo] = useState<any[] | null>(null);
    const [editarEquipo, setEditarEquipo] = useState(false);

    const cargar = useCallback(async () => {
        const [t, e] = await Promise.all([
            api<any[]>(`/api/projects/${projectId}/tareas`).catch(() => []),
            api<any[]>(`/api/projects/${projectId}/asignaciones`).catch(() => []),
        ]);
        setTareas(Array.isArray(t) ? t : []);
        setEquipo(Array.isArray(e) ? e : []);
    }, [projectId]);
    useEffect(() => { cargar(); }, [cargar]);

    if (tareas === null || equipo === null) return null;
    if (!presupuesto && tareas.length === 0 && equipo.length === 0) return null;

    const puedeEditar = puede('proyectos.crear');
    const horasTot = tareas.reduce((a, t) => a + t.horasEstimadas, 0);
    const horasHechas = tareas.filter((t) => t.completada).reduce((a, t) => a + t.horasEstimadas, 0);

    const marcar = async (t: any, completada: boolean) => {
        setTareas((ts) => ts!.map((x) => (x.id === t.id ? { ...x, completada } : x)));
        try {
            await api(`/api/projects/${projectId}/tareas`, { method: 'PATCH', json: { tareaId: t.id, completada } });
        } catch (e: any) {
            showToast(e.message, 'error');
            setTareas((ts) => ts!.map((x) => (x.id === t.id ? { ...x, completada: !completada } : x)));
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {presupuesto && (
                <section className="surface p-4 space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold"><FileText className="w-4 h-4 text-primary" aria-hidden="true" /> Presupuesto de origen</h4>
                    <p className="text-sm"><Link href={`/presupuestos-servicio/${presupuesto.id}`} className="font-mono text-primary hover:underline">{presupuesto.numero}</Link></p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">La copia congelada de la aceptación está en el presupuesto, con su verificación de integridad.</p>
                    {onVerReporte && puede('presupuestos.ver') && <Button variant="tonal" size="sm" icon={<BarChart3 />} onClick={onVerReporte}>Presupuestado vs. real</Button>}
                </section>
            )}
            {tareas.length > 0 && (
                <section className="surface p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="w-4 h-4 text-primary" aria-hidden="true" /> Tareas</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{tareas.filter((t) => t.completada).length} de {tareas.length} · {horasTot > 0 ? Math.round((horasHechas / horasTot) * 100) : 0} % de las horas</span>
                    </div>
                    <ul className="space-y-1.5">
                        {tareas.map((t) => (
                            <li key={t.id}>
                                <label className="flex items-start gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" className="mt-0.5 w-4 h-4" checked={t.completada} disabled={!puedeEditar} onChange={(e) => marcar(t, e.target.checked)} />
                                    <span className={t.completada ? 'line-through text-slate-500' : ''}>{t.descripcion} <span className="text-xs text-slate-500 dark:text-slate-400">· {horasTxt(t.horasEstimadas)}</span></span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <section className="surface p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold"><Users className="w-4 h-4 text-primary" aria-hidden="true" /> Equipo asignado</h4>
                    {puedeEditar && <button type="button" className="text-sm text-primary hover:underline" onClick={() => setEditarEquipo(true)}>Cambiar</button>}
                </div>
                {equipo.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Sin equipo asignado.</p>
                ) : (
                    <>
                        <p className="text-sm">{equipo.map((a) => a.operator?.nombreCompleto).join(' · ')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Del {fechaCorta(equipo[0].fechaDesde)} al {fechaCorta(equipo[0].fechaHasta)}. La planificación diaria se sigue cargando en Planificación.</p>
                    </>
                )}
            </section>
            {editarEquipo && (
                <EquipoDialog
                    projectId={projectId}
                    actual={equipo}
                    operadores={operadores}
                    fechaDesde={equipo[0]?.fechaDesde || fechaInicio || ''}
                    fechaHasta={equipo[0]?.fechaHasta || fechaFin || ''}
                    horasDia={equipo[0]?.horasDia || 8}
                    onClose={() => setEditarEquipo(false)}
                    onGuardado={() => { setEditarEquipo(false); cargar(); }}
                />
            )}
        </div>
    );
}

function EquipoDialog({ projectId, actual, operadores, fechaDesde, fechaHasta, horasDia, onClose, onGuardado }: {
    projectId: string; actual: any[]; operadores: { id: string; nombreCompleto: string; activo?: boolean }[];
    fechaDesde: string; fechaHasta: string; horasDia: number; onClose: () => void; onGuardado: () => void;
}) {
    const [sel, setSel] = useState<string[]>(actual.map((a) => a.operatorId));
    const [desde, setDesde] = useState(fechaDesde);
    const [hasta, setHasta] = useState(fechaHasta);
    const [horas, setHoras] = useState(String(horasDia));
    const [guardando, setGuardando] = useState(false);
    const [q, setQ] = useState('');
    const guardar = async () => {
        if (!desde || !hasta || hasta < desde) return showToast('Revisá las fechas: el fin no puede ser anterior al inicio', 'error');
        setGuardando(true);
        try {
            const r = await api<any>(`/api/projects/${projectId}/asignaciones`, { method: 'PUT', json: { operadores: sel, fechaDesde: desde, fechaHasta: hasta, horasDia: Number(horas) || 8 } });
            showToast(r.message, 'success');
            onGuardado();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setGuardando(false);
        }
    };
    const lista = operadores.filter((o) => o.activo !== false && (!q || o.nombreCompleto.toLowerCase().includes(q.toLowerCase())));
    return (
        <Dialog
            open
            onClose={onClose}
            dismissible={!guardando}
            title="Equipo asignado"
            description="La disponibilidad día por día se ve en el asistente de nuevo proyecto y en Planificación."
            footer={<><Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button><Button isLoading={guardando} onClick={guardar}>Guardar equipo</Button></>}
        >
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                    <label className="block"><span className="field-label">Desde</span><input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
                    <label className="block"><span className="field-label">Hasta</span><input type="date" className="input" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} /></label>
                    <label className="block"><span className="field-label">Horas por día</span><input className="input" inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} /></label>
                </div>
                <input className="input" placeholder="Buscar operador…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar operador" />
                <ul className="max-h-64 overflow-auto divide-y divide-border rounded-lg border border-border">
                    {lista.map((o) => (
                        <li key={o.id}>
                            <label className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm">
                                <input type="checkbox" className="w-4 h-4" checked={sel.includes(o.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))} />
                                {o.nombreCompleto}
                            </label>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400"><Badge tone="neutral">{sel.length}</Badge> seleccionados</p>
            </div>
        </Dialog>
    );
}
