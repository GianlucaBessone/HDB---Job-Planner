'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Search, Loader2, PackagePlus, ChevronDown, ChevronUp, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge, Button, EmptyState, Panel, SegmentedControl } from '@/components/ui';
import SearchableSelect from '@/components/SearchableSelect';
import MapPicker from '@/components/MapPicker';
import { cn } from '@/lib/cn';
import { TIPOS_PROYECTO, TIPO_PROYECTO_INFO, type TipoProyecto } from '@/lib/proyectos/tipos';
import { api, pesos, horasTxt, fechaCorta, fechaHora, reemplazarAlEditar } from '@/components/presupuestosServicio/cliente';
import BuscadorMateriales, { type ProductoBuscado } from '@/components/presupuestosServicio/BuscadorMateriales';
import {
    MarcaOrigen, cambiosVsPresupuesto, diasDelRango, finSugerido, fmt, horasTotales, nuevaKey, num,
    type WizardState, type TareaWiz, type MaterialWiz,
} from './estado';
import { sumarDias } from '@/lib/presupuestosServicio/calculos';

type Set = (patch: Partial<WizardState> | ((s: WizardState) => Partial<WizardState>)) => void;

export interface Catalogos {
    clientes: { id: string; nombre: string; listaPrecioId?: string | null }[];
    operadores: { id: string; nombreCompleto: string; role?: string; activo?: boolean; etiquetas?: any }[];
    categorias: string[];
    tiposActividad: string[];
    etiquetas: string[];
    listas: { id: string; nombre: string; ivaDiscriminado: boolean; activo: boolean }[];
}

function Err({ msg }: { msg?: string }) {
    return msg ? <p className="field-error" role="alert">{msg}</p> : null;
}

// ── Paso 1: origen ─────────────────────────────────────────────────

export function PasoOrigen({
    s, set, errores, puedeConvertir, elegirPresupuesto, cargandoPrecarga, borradores, retomar, descartarBorrador,
}: {
    s: WizardState; set: Set; errores: Record<string, string>; puedeConvertir: boolean;
    elegirPresupuesto: (id: string) => void; cargandoPrecarga: string | null;
    borradores: any[]; retomar: (b: any) => void; descartarBorrador: (id: string) => void;
}) {
    const [aceptados, setAceptados] = useState<any[] | null>(null);
    const [q, setQ] = useState('');
    useEffect(() => {
        if (!puedeConvertir) { setAceptados([]); return; }
        api<any>('/api/presupuestos-servicio?estado=aceptado&limit=100')
            .then((r) => setAceptados((r.presupuestos || []).filter((p: any) => !p.proyecto)))
            .catch(() => setAceptados([]));
    }, [puedeConvertir]);
    const lista = (aceptados || []).filter((p) => !q || `${p.numero} ${p.clienteNombre} ${p.titulo}`.toLowerCase().includes(q.toLowerCase()));

    const opcion = (valor: 'presupuesto' | 'manual', titulo: string, texto: string, deshabilitado = false) => {
        const activo = s.origen === valor;
        return (
            <label className={cn('flex gap-3 items-start p-4 rounded-xl border cursor-pointer transition-colors', activo ? 'border-primary ring-1 ring-primary bg-brand-50/60 dark:bg-brand-950/30' : 'border-border bg-card hover:border-slate-300', deshabilitado && 'opacity-50 cursor-not-allowed')}>
                <input type="radio" name="origen" className="mt-1 w-4 h-4" checked={activo} disabled={deshabilitado} onChange={() => set({ origen: valor })} />
                <span><span className="block text-[15px] font-semibold">{titulo}</span><span className="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">{texto}</span></span>
            </label>
        );
    };

    return (
        <div className="space-y-4">
            <div role="radiogroup" aria-label="Origen del proyecto" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {opcion('presupuesto', 'Desde un presupuesto aceptado', 'Cliente, tareas, horas, materiales y fechas vienen cargados. Vos ajustás fechas y elegís el equipo.', !puedeConvertir)}
                {opcion('manual', 'Proyecto manual', 'Mismo recorrido, sin datos precargados. Para trabajos sin presupuesto.')}
            </div>
            <Err msg={errores.origen} />

            {s.origen === 'presupuesto' && (
                <Panel
                    title="Presupuestos aceptados sin proyecto"
                    actions={<label className="relative"><span className="sr-only">Buscar presupuesto</span><Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input className="input pl-8 w-64" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número o cliente…" /></label>}
                    bodyClassName="p-0"
                >
                    {aceptados === null ? (
                        <p className="px-4 py-3 text-sm text-slate-500">Cargando…</p>
                    ) : lista.length === 0 ? (
                        <EmptyState compact title="No hay presupuestos aceptados pendientes" description="Registrá la aceptación de un presupuesto o creá el proyecto manual." />
                    ) : (
                        <ul role="radiogroup" aria-label="Presupuesto" className="divide-y divide-border">
                            {lista.map((p) => {
                                const sel = s.presupuesto?.id === p.id;
                                return (
                                    <li key={p.id}>
                                        <label className={cn('flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer', sel && 'bg-brand-50/60 dark:bg-brand-950/30')}>
                                            <input type="radio" name="presupuesto" className="w-4 h-4" checked={sel} onChange={() => elegirPresupuesto(p.id)} />
                                            <span className="font-mono text-xs w-32">{p.numero}</span>
                                            <span className="flex-1 min-w-[200px]"><span className="font-medium">{p.clienteNombre}</span> · {p.titulo} <span className="text-xs text-slate-500">· Rev. {p.versionActual}</span></span>
                                            <span className="text-sm tabular-nums">{horasTxt(p.versionVigente?.horasTotales)}</span>
                                            <span className="text-sm tabular-nums w-32 text-right">{pesos(p.versionVigente?.neto, 0)} <span className="text-xs text-slate-500">neto</span></span>
                                            {cargandoPrecarga === p.id && <Loader2 className="w-4 h-4 animate-spin" aria-label="Cargando" />}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <Err msg={errores.presupuesto} />
                </Panel>
            )}

            {borradores.length > 0 && (
                <Panel title="Borradores sin terminar" bodyClassName="p-0">
                    <ul className="divide-y divide-border">
                        {borradores.map((b) => (
                            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                <span><span className="font-medium">{b.titulo || 'Proyecto sin nombre'}</span><span className="block text-xs text-slate-500 dark:text-slate-400">Quedó en el paso {b.paso} · guardado {fechaHora(b.updatedAt)}</span></span>
                                <span className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => descartarBorrador(b.id)}>Descartar</Button><Button variant="secondary" size="sm" onClick={() => retomar(b)}>Retomar</Button></span>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400">¿Preferís el formulario de siempre? <Link href="/projects?alta=clasica" className="text-primary hover:underline">Alta rápida (formulario clásico)</Link></p>
        </div>
    );
}

// ── Paso 2: datos generales ────────────────────────────────────────

export function PasoDatos({ s, set, errores, cat }: { s: WizardState; set: Set; errores: Record<string, string>; cat: Catalogos }) {
    const [avanzada, setAvanzada] = useState(false);
    const sug = s.origen === 'presupuesto' ? s.sugerido : null;
    const listaCliente = cat.clientes.find((c) => c.id === s.clientId)?.listaPrecioId || '';
    const elegirCliente = (id: string) => {
        const c = cat.clientes.find((x) => x.id === id);
        set((p) => ({ clientId: id, listaPrecioId: p.listaPrecioId || c?.listaPrecioId || '' }));
    };
    const tagsSug = sug ? [...sug.tags].sort().join('|') : '';
    const resumenAvanzada = [
        `Tipo: ${TIPO_PROYECTO_INFO[s.tipo].label}`,
        `Orden de Servicio: ${s.generarOS ? 'sí' : 'no'}`,
        `Aprovisionamiento: ${s.aprovisionamiento ? `sí${s.listaPrecioId ? `, ${cat.listas.find((l) => l.id === s.listaPrecioId)?.nombre || ''}` : ''}` : 'no'}`,
        `Fichaje GPS/QR: ${s.fichajeHabilitado ? 'sí' : 'no'}`,
    ].join(' · ');

    return (
        <div className="space-y-4">
            <Panel title="Datos generales" actions={sug ? <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5"><MarcaOrigen desdePresupuesto /> = dato del presupuesto</span> : undefined}>
                <div className="space-y-4">
                    <div>
                        <span className="flex flex-wrap items-center justify-between gap-2 mb-1.5"><label htmlFor="wiz-nombre" className="field-label !mb-0">Nombre del proyecto<span className="text-danger-600 ml-0.5" aria-hidden="true">*</span></label>
                            <MarcaOrigen desdePresupuesto={Boolean(sug)} texto="Sugerido" modificado={Boolean(sug) && s.nombre !== sug!.nombre} onRestaurar={() => set({ nombre: sug!.nombre })} /></span>
                        <input id="wiz-nombre" className="input" value={s.nombre} onChange={(e) => set({ nombre: e.target.value })} maxLength={200} aria-invalid={Boolean(errores.nombre)} placeholder="Ej.: Cliente – Obra" />
                        <Err msg={errores.nombre} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="flex flex-wrap items-center justify-between gap-2 mb-1.5"><span className="field-label !mb-0">Cliente</span>
                                <MarcaOrigen desdePresupuesto={Boolean(sug)} modificado={Boolean(sug) && s.clientId !== (sug!.clientId || '')} onRestaurar={() => set({ clientId: sug!.clientId || '' })} /></span>
                            <SearchableSelect options={cat.clientes.map((c) => ({ id: c.id, label: c.nombre }))} value={s.clientId} onChange={elegirCliente} placeholder="Elegí el cliente…" />
                        </div>
                        <div>
                            <span className="field-label">Responsable</span>
                            <SearchableSelect options={cat.operadores.map((o) => ({ id: o.id, label: o.nombreCompleto }))} value={s.responsableId} onChange={(v) => set({ responsableId: v })} placeholder="Sin asignar" />
                            <p className="field-hint">Lo ve en Mis Proyectos.</p>
                        </div>
                        <label className="block">
                            <span className="field-label">Categoría</span>
                            <select className="input" value={s.categoria} onChange={(e) => set({ categoria: e.target.value })}>
                                <option value="">Sin categoría</option>
                                {cat.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="field-label">Tipo de actividad</span>
                            <select className="input" value={s.tipoActividad} onChange={(e) => set({ tipoActividad: e.target.value })}>
                                <option value="">Sin tipo</option>
                                {cat.tiposActividad.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                    </div>
                    <div>
                        <span className="flex flex-wrap items-center justify-between gap-2 mb-1.5"><span className="field-label !mb-0">Etiquetas técnicas</span>
                            <MarcaOrigen desdePresupuesto={Boolean(sug)} modificado={Boolean(sug) && [...s.tags].sort().join('|') !== tagsSug} onRestaurar={() => set({ tags: [...sug!.tags] })} /></span>
                        <div className="flex flex-wrap gap-2">
                            {Array.from(new Set([...cat.etiquetas, ...s.tags])).map((t) => {
                                const on = s.tags.includes(t);
                                return (
                                    <button key={t} type="button" aria-pressed={on} onClick={() => set((p) => ({ tags: on ? p.tags.filter((x) => x !== t) : [...p.tags, t] }))}
                                        className={cn('h-8 px-3 rounded-full border text-[13px] font-medium transition-colors', on ? 'border-primary bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200' : 'border-border text-slate-600 dark:text-slate-300 hover:border-slate-400')}>
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="field-hint">Generan el checklist de avance técnico, como hoy.</p>
                    </div>
                    <div>
                        <span className="flex flex-wrap items-center justify-between gap-2 mb-1.5"><label htmlFor="wiz-observaciones" className="field-label !mb-0">Observaciones</label>
                            <MarcaOrigen desdePresupuesto={Boolean(sug)} modificado={Boolean(sug) && s.observaciones !== (sug!.observaciones || '')} onRestaurar={() => set({ observaciones: sug!.observaciones || '' })} /></span>
                        <textarea id="wiz-observaciones" className="input min-h-[72px] py-2" value={s.observaciones} onChange={(e) => set({ observaciones: e.target.value })} maxLength={5000} />
                    </div>
                </div>
            </Panel>

            <section className="surface">
                <button type="button" aria-expanded={avanzada} onClick={() => setAvanzada((v) => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                    <span><span className="block text-[15px] font-semibold">Configuración avanzada</span><span className="block text-xs text-slate-500 dark:text-slate-400">{resumenAvanzada}</span></span>
                    {avanzada ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                </button>
                {avanzada && (
                    <div className="border-t border-border p-4 space-y-4">
                        {/* Tipo de proyecto: propone OS, aprovisionamiento y fichaje (P27) */}
                        <div className="space-y-2">
                            <span className="block font-medium">Tipo de proyecto</span>
                            <SegmentedControl<TipoProyecto>
                                label="Tipo de proyecto"
                                options={TIPOS_PROYECTO.map((t) => ({ value: t, label: TIPO_PROYECTO_INFO[t].label }))}
                                value={s.tipo}
                                onChange={(t) => {
                                    const v = TIPO_PROYECTO_INFO[t].valores;
                                    set({ tipo: t, generarOS: v.generarOS, aprovisionamiento: v.aprovisionamiento || s.cargarMateriales && s.materiales.length > 0, fichajeHabilitado: v.fichajeHabilitado, listaPrecioId: v.aprovisionamiento ? s.listaPrecioId || listaCliente : s.listaPrecioId });
                                }}
                            />
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{TIPO_PROYECTO_INFO[s.tipo].descripcion}</span>
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" className="mt-1 w-4 h-4" checked={s.generarOS} onChange={(e) => set({ generarOS: e.target.checked })} /><span><span className="font-medium">Generar Orden de Servicio</span><span className="block text-xs text-slate-500 dark:text-slate-400">Habilita el flujo de Orden de Servicio para este proyecto.</span></span></label>
                        <div className="space-y-2">
                            <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" className="mt-1 w-4 h-4" checked={s.aprovisionamiento} onChange={(e) => set({ aprovisionamiento: e.target.checked, listaPrecioId: s.listaPrecioId || listaCliente })} /><span><span className="font-medium">Aprovisionamiento de materiales</span><span className="block text-xs text-slate-500 dark:text-slate-400">Gestión y trazabilidad de materiales vinculados a Gestión Comercial.</span></span></label>
                            {s.aprovisionamiento && (
                                <label className="block ml-7 max-w-md">
                                    <span className="field-label">Lista de precios aplicable</span>
                                    <select className="input" value={s.listaPrecioId} onChange={(e) => set({ listaPrecioId: e.target.value })}>
                                        <option value="">Precio base (predeterminado de Gestión Comercial)</option>
                                        {cat.listas.filter((l) => l.activo).map((l) => <option key={l.id} value={l.id}>{l.nombre}{l.id === listaCliente ? ' (del cliente)' : ''}</option>)}
                                    </select>
                                </label>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" className="mt-1 w-4 h-4" checked={s.fichajeHabilitado} onChange={(e) => set({ fichajeHabilitado: e.target.checked })} /><span><span className="font-medium">Fichaje GPS/QR en obra</span><span className="block text-xs text-slate-500 dark:text-slate-400">Marcá la geocerca de la obra. El QR se imprime después desde Editar.</span></span></label>
                            {s.fichajeHabilitado && (
                                <div className="ml-7">
                                    <MapPicker lat={s.geofenceLat} lng={s.geofenceLng} radius={s.geofenceRadius} onChange={(lat, lng, radius) => set({ geofenceLat: lat, geofenceLng: lng, geofenceRadius: radius })} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

// ── Paso 3: tareas y horas ─────────────────────────────────────────

export function PasoTareas({ s, set, errores, cat }: { s: WizardState; set: Set; errores: Record<string, string>; cat: Catalogos }) {
    const editar = (key: string, patch: Partial<TareaWiz>) => set((p) => ({ tareas: p.tareas.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
    const quitar = (key: string) => set((p) => ({ tareas: p.tareas.filter((t) => t.key !== key) }));
    const agregar = () => set((p) => ({ tareas: [...p.tareas, { key: nuevaKey(), descripcion: '', etiqueta: '', horasEstimadas: '', presupuestoTareaId: null, horasPresupuesto: null }] }));
    const total = horasTotales(s);
    const deP = s.origen === 'presupuesto' && s.presupuesto;

    return (
        <Panel
            title="Tareas y horas"
            description={deP ? 'El detalle por categoría (oficial, ayudante…) queda en el presupuesto. El proyecto lleva las horas por tarea.' : 'Opcional: las tareas ordenan el trabajo y suman las horas estimadas.'}
            actions={<Button variant="secondary" size="sm" icon={<Plus />} onClick={agregar}>Agregar tarea</Button>}
            bodyClassName="p-0"
        >
            {s.tareas.length === 0 ? (
                <div className="p-4 space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Sin tareas. Podés cargar solo las horas estimadas totales.</p>
                    <label className="block max-w-xs">
                        <span className="field-label">Horas estimadas</span>
                        <input className="input tabular-nums" inputMode="decimal" placeholder="0" value={s.horasSinTareas} {...reemplazarAlEditar} onChange={(e) => set({ horasSinTareas: e.target.value })} />
                    </label>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead>
                            <tr>
                                <th className="text-left w-8 !pl-4">#</th>
                                <th className="text-left">Tarea</th>
                                <th className="text-left w-44">Etiqueta</th>
                                {deP && <th className="text-right w-20">Presup.</th>}
                                <th className="text-right w-28">Horas proyecto</th>
                                <th className="text-left w-28">Origen</th>
                                <th className="w-10"><span className="sr-only">Quitar</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {s.tareas.map((t, i) => (
                                <tr key={t.key} className="align-top">
                                    <td className="!pl-4 text-xs text-slate-500 pt-3">{i + 1}</td>
                                    <td>
                                        {t.presupuestoTareaId ? <span className="block pt-1.5">{t.descripcion}</span> : (
                                            <><input className="input h-8" value={t.descripcion} onChange={(e) => editar(t.key, { descripcion: e.target.value })} placeholder="Descripción" aria-label={`Descripción de la tarea ${i + 1}`} aria-invalid={Boolean(errores[`tarea.${i}.descripcion`])} maxLength={300} /><Err msg={errores[`tarea.${i}.descripcion`]} /></>
                                        )}
                                    </td>
                                    <td>
                                        <select className="input h-8" value={t.etiqueta} onChange={(e) => editar(t.key, { etiqueta: e.target.value })} aria-label="Etiqueta técnica">
                                            <option value="">Sin etiqueta</option>
                                            {Array.from(new Set([...cat.etiquetas, ...(t.etiqueta ? [t.etiqueta] : [])])).map((e) => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                    </td>
                                    {deP && <td className="text-right tabular-nums pt-3">{t.horasPresupuesto ?? '—'}</td>}
                                    <td>
                                        <input className="input h-8 text-right tabular-nums" inputMode="decimal" placeholder="0" value={t.horasEstimadas} {...reemplazarAlEditar} onChange={(e) => editar(t.key, { horasEstimadas: e.target.value })} aria-label={`Horas de la tarea ${i + 1}`} aria-invalid={Boolean(errores[`tarea.${i}.horas`])} />
                                        <Err msg={errores[`tarea.${i}.horas`]} />
                                    </td>
                                    <td className="pt-2.5">
                                        {t.presupuestoTareaId ? (
                                            <MarcaOrigen desdePresupuesto modificado={t.horasPresupuesto !== null && num(t.horasEstimadas) !== t.horasPresupuesto} onRestaurar={() => editar(t.key, { horasEstimadas: String(t.horasPresupuesto) })} />
                                        ) : deP ? <Badge tone="info">Agregada</Badge> : null}
                                    </td>
                                    <td><Button variant="ghost" size="icon-sm" icon={<Trash2 />} aria-label={`Quitar la tarea ${i + 1}`} onClick={() => quitar(t.key)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="flex flex-wrap justify-end gap-6 px-4 py-3 border-t border-border tabular-nums text-sm">
                {deP && <span className="text-slate-500 dark:text-slate-400">Presupuesto: {horasTxt(s.presupuesto!.horas)}</span>}
                <span className="font-semibold">Horas estimadas del proyecto: {horasTxt(total)}
                    {deP && total !== s.presupuesto!.horas && <span className="font-normal text-slate-500"> ({total > s.presupuesto!.horas ? '+' : ''}{Math.round((total - s.presupuesto!.horas) * 100) / 100} h)</span>}</span>
            </div>
            <p className="px-4 pb-3 field-hint !mt-0">El total va a “Horas estimadas” del proyecto, el mismo campo que usan el dashboard y los KPI. Se redondea al entero; el valor exacto queda en las tareas.</p>
        </Panel>
    );
}

// ── Paso 4: materiales ─────────────────────────────────────────────

export function PasoMateriales({ s, set, errores, cat }: { s: WizardState; set: Set; errores: Record<string, string>; cat: Catalogos }) {
    const editar = (key: string, patch: Partial<MaterialWiz>) => set((p) => ({ materiales: p.materiales.map((m) => (m.key === key ? { ...m, ...patch } : m)) }));
    const quitar = (key: string) => set((p) => ({ materiales: p.materiales.filter((m) => m.key !== key) }));
    const agregar = (m: Partial<MaterialWiz>) =>
        set((p) => ({ materiales: [...p.materiales, { key: nuevaKey(), productoId: null, codigo: '', nombre: '', unidad: 'unidad', cantidad: '1', cantidadPresupuesto: null, precioVenta: null, ...m }] }));
    const cantidades = useMemo(() => {
        const r = new Map<string, number>();
        for (const m of s.materiales) if (m.productoId) r.set(m.productoId, (r.get(m.productoId) || 0) + num(m.cantidad));
        return r;
    }, [s.materiales]);
    /** Agrega el producto; si ya está en la lista, le suma 1 a la cantidad. */
    const agregarProducto = (p: ProductoBuscado) =>
        set((prev) => {
            const i = prev.materiales.findIndex((m) => m.productoId === p.id);
            if (i >= 0) return { materiales: prev.materiales.map((m, j) => (j === i ? { ...m, cantidad: String(Math.round((num(m.cantidad) + 1) * 100) / 100) } : m)) };
            return { materiales: [...prev.materiales, { key: nuevaKey(), productoId: p.id, codigo: p.sku, nombre: p.descripcion, unidad: p.unidad || 'unidad', cantidad: '1', cantidadPresupuesto: null, precioVenta: p.precioAplicado }] };
        });
    const deP = s.origen === 'presupuesto';
    const lista = cat.listas.find((l) => l.id === s.listaPrecioId);

    return (
        <div className="space-y-4">
            <section className="surface p-4 flex flex-wrap gap-4 items-start justify-between">
                <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-[260px]">
                    <input type="checkbox" className="mt-1 w-4 h-4" checked={s.cargarMateriales} onChange={(e) => set({ cargarMateriales: e.target.checked, aprovisionamiento: e.target.checked ? true : s.aprovisionamiento })} />
                    <span><span className="font-medium">Cargar en aprovisionamiento</span><span className="block text-xs text-slate-500 dark:text-slate-400">Se crean como materiales del proyecto en estado “Material cargado” y aparecen en Provisión de Materiales.</span></span>
                </label>
                <label className="block w-full sm:w-72">
                    <span className="field-label">Lista de precios</span>
                    <select className="input" value={s.listaPrecioId} onChange={(e) => set({ listaPrecioId: e.target.value })}>
                        <option value="">Precio base (predeterminado)</option>
                        {cat.listas.filter((l) => l.activo).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                </label>
            </section>
            <Panel title="Materiales" actions={<Button variant="secondary" size="sm" icon={<PackagePlus />} onClick={() => agregar({})}>Ítem manual</Button>} bodyClassName="p-0">
                <BuscadorMateriales listaPrecioId={s.listaPrecioId || null} cantidades={cantidades} onAgregar={agregarProducto} />
                {s.materiales.length === 0 ? (
                    <p className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">Sin materiales.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px]">
                            <thead>
                                <tr>
                                    <th className="text-left !pl-4 w-24">Código</th>
                                    <th className="text-left">Descripción</th>
                                    <th className="text-left w-20">Unidad</th>
                                    {deP && <th className="text-right w-20">Presup.</th>}
                                    <th className="text-right w-28">A cargar</th>
                                    <th className="text-right w-28">Precio</th>
                                    <th className="text-left w-28">Origen</th>
                                    <th className="w-10"><span className="sr-only">Quitar</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {s.materiales.map((m, i) => (
                                    <tr key={m.key} className="align-top">
                                        <td className="!pl-4 font-mono text-xs pt-3">{m.codigo || '—'}</td>
                                        <td>{m.productoId || m.cantidadPresupuesto !== null ? <span className="block pt-1.5">{m.nombre}</span> : (<><input className="input h-8" value={m.nombre} onChange={(e) => editar(m.key, { nombre: e.target.value })} aria-label="Descripción del material" placeholder="Descripción" aria-invalid={Boolean(errores[`material.${i}.nombre`])} /><Err msg={errores[`material.${i}.nombre`]} /></>)}</td>
                                        <td className="pt-3">{m.unidad}</td>
                                        {deP && <td className="text-right tabular-nums pt-3">{m.cantidadPresupuesto ?? '—'}</td>}
                                        <td><input className="input h-8 text-right tabular-nums" inputMode="decimal" placeholder="0" value={m.cantidad} {...reemplazarAlEditar} onChange={(e) => editar(m.key, { cantidad: e.target.value })} aria-label="Cantidad a cargar" aria-invalid={Boolean(errores[`material.${i}.cantidad`])} /><Err msg={errores[`material.${i}.cantidad`]} /></td>
                                        <td className="text-right tabular-nums pt-3">{m.precioVenta !== null ? pesos(m.precioVenta) : '—'}</td>
                                        <td className="pt-2.5">{m.cantidadPresupuesto !== null ? <MarcaOrigen desdePresupuesto modificado={num(m.cantidad) !== m.cantidadPresupuesto} onRestaurar={() => editar(m.key, { cantidad: String(m.cantidadPresupuesto) })} /> : deP ? <Badge tone="info">Agregado</Badge> : null}</td>
                                        <td><Button variant="ghost" size="icon-sm" icon={<Trash2 />} aria-label="Quitar material" onClick={() => quitar(m.key)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="px-4 py-3 field-hint !mt-0">
                    {deP ? 'El precio es el del presupuesto aceptado y queda como precio de venta del material en el proyecto.' : `Precios de ${lista?.nombre || 'la lista predeterminada'}.`} El costo real se calcula con lo usado, igual que hoy.
                </p>
            </Panel>
        </div>
    );
}

// ── Paso 5: fechas y equipo ────────────────────────────────────────

export function PasoFechasEquipo({ s, set, errores }: { s: WizardState; set: Set; errores: Record<string, string> }) {
    const [disp, setDisp] = useState<{ dias: string[]; operadores: any[] } | null>(null);
    const [cargando, setCargando] = useState(false);
    const [errorDisp, setErrorDisp] = useState<string | null>(null);
    const [filtro, setFiltro] = useState<'disponibles' | 'todos'>('disponibles');
    const [q, setQ] = useState('');
    const sugerido = finSugerido(s);

    // Recalcula el fin mientras el usuario no lo fije a mano.
    useEffect(() => {
        if (!s.finManual && sugerido && sugerido.fin !== s.fechaFin) set({ fechaFin: sugerido.fin });
    }, [s.finManual, sugerido?.fin, s.fechaFin, set]); // eslint-disable-line react-hooks/exhaustive-deps

    const desde = s.fechaInicio;
    const hasta = s.fechaFin && s.fechaFin >= desde ? (s.fechaFin > sumarDias(desde, 13) ? s.fechaFin : sumarDias(desde, 13)) : '';
    useEffect(() => {
        if (!desde || !hasta) return;
        const t = setTimeout(async () => {
            setCargando(true);
            setErrorDisp(null);
            try {
                setDisp(await api(`/api/operators/disponibilidad?desde=${desde}&hasta=${hasta > sumarDias(desde, 60) ? sumarDias(desde, 60) : hasta}`));
            } catch (e: any) {
                setErrorDisp(e.message);
            } finally {
                setCargando(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [desde, hasta]);

    const enRango = (d: string) => d >= s.fechaInicio && d <= s.fechaFin;
    const operadores = useMemo(() => {
        const ops = (disp?.operadores || []).map((o) => ({ ...o, conflictosRango: (disp?.dias || []).filter((d) => enRango(d) && o.celdas[d]?.tipo !== 'libre').length }));
        return ops
            .filter((o) => !q || o.nombre.toLowerCase().includes(q.toLowerCase()))
            .filter((o) => filtro === 'todos' || s.operadores.includes(o.id) || (o.conflictosRango === 0 && !o.enVacaciones))
            .sort((a, b) => Number(s.operadores.includes(b.id)) - Number(s.operadores.includes(a.id)) || a.conflictosRango - b.conflictosRango || a.nombre.localeCompare(b.nombre));
    }, [disp, filtro, q, s.operadores, s.fechaInicio, s.fechaFin]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = (id: string) => set((p) => ({ operadores: p.operadores.includes(id) ? p.operadores.filter((x) => x !== id) : [...p.operadores, id] }));
    const diasRango = diasDelRango(s);
    const horasDia = num(s.horasDia) || 8;
    const ocupadas = (disp?.operadores || []).filter((o) => s.operadores.includes(o.id)).reduce((a, o) => a + (disp?.dias || []).filter(enRango).reduce((b: number, d: string) => b + Math.min(horasDia, o.celdas[d]?.tipo === 'viaje' ? horasDia : o.celdas[d]?.horas || 0), 0), 0);
    const capacidad = s.operadores.length * diasRango * horasDia - ocupadas;
    const conflictos = (disp?.operadores || []).filter((o) => s.operadores.includes(o.id)).flatMap((o) => (disp?.dias || []).filter((d) => enRango(d) && o.celdas[d]?.tipo !== 'libre').map((d) => `${o.nombre}: ${fmt(d)} — ${o.celdas[d].detalle.join(', ')}`));
    const sug = s.origen === 'presupuesto' ? s.sugerido : null;

    const celda = (c: any) =>
        c?.tipo === 'viaje' ? 'bg-info-100 text-info-800 dark:bg-info-950 dark:text-info-200' :
        c?.tipo === 'ocupado' ? 'bg-warning-100 text-warning-800 dark:bg-warning-950 dark:text-warning-200' :
        'bg-success-50 dark:bg-success-950/40';

    return (
        <div className="space-y-4">
            <Panel title="Fechas">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <span className="flex flex-wrap items-center justify-between gap-2 mb-1.5"><label htmlFor="wiz-inicio" className="field-label !mb-0">Inicio<span className="text-danger-600 ml-0.5" aria-hidden="true">*</span></label>
                            <MarcaOrigen desdePresupuesto={Boolean(sug)} modificado={Boolean(sug) && s.fechaInicio !== sug!.fechaInicio} onRestaurar={() => set({ fechaInicio: sug!.fechaInicio, fechaFin: sug!.fechaFin, finManual: false })} /></span>
                        <input id="wiz-inicio" type="date" className="input" value={s.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} aria-invalid={Boolean(errores.fechaInicio)} required />
                        <Err msg={errores.fechaInicio} />
                    </div>
                    <div>
                        <span className="flex flex-wrap items-center justify-between gap-2 mb-1.5"><label htmlFor="wiz-fin" className="field-label !mb-0">Fin<span className="text-danger-600 ml-0.5" aria-hidden="true">*</span></label>
                            {s.finManual ? <button type="button" className="text-xs text-primary hover:underline" onClick={() => set({ finManual: false })}>Volver al calculado</button> : <Badge tone="neutral">Calculado</Badge>}</span>
                        <input id="wiz-fin" type="date" className="input" value={s.fechaFin} min={s.fechaInicio || undefined} onChange={(e) => set({ fechaFin: e.target.value, finManual: true })} aria-invalid={Boolean(errores.fechaFin)} required />
                        <Err msg={errores.fechaFin} />
                    </div>
                    <div>
                        <label htmlFor="wiz-horas-dia" className="field-label">Horas por día</label>
                        <input id="wiz-horas-dia" className="input tabular-nums" inputMode="decimal" placeholder="8" value={s.horasDia} {...reemplazarAlEditar} onChange={(e) => set({ horasDia: e.target.value })} aria-invalid={Boolean(errores.horasDia)} />
                        {errores.horasDia ? <Err msg={errores.horasDia} /> : (
                            <span className="field-hint flex flex-wrap items-center gap-1.5">
                                Jornada de trabajo de este proyecto.
                                <MarcaOrigen desdePresupuesto={Boolean(sug)} modificado={Boolean(sug) && num(s.horasDia) !== (sug!.horasDia || 8)} onRestaurar={() => set({ horasDia: String(sug!.horasDia || 8) })} />
                            </span>
                        )}
                    </div>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm">
                    <b className="font-semibold">{diasRango} {diasRango === 1 ? 'día hábil' : 'días hábiles'}</b>
                    {sugerido && <span className="text-slate-500 dark:text-slate-400"> · Sugerido: {horasTxt(horasTotales(s))} ÷ ({s.operadores.length || sug?.operariosSimultaneos || 1} operadores × {horasDia} h) = {sugerido.dias} días.{s.finManual ? ' El fin está fijado a mano.' : ' Si cambiás el equipo, el fin se recalcula.'}</span>}
                </p>
                {sug?.fechasAjustadas && <p className="field-hint">El inicio tentativo del presupuesto ({fmt(sug.fechaInicioTentativa)}) ya pasó: se propone el próximo día hábil con la misma duración.</p>}
            </Panel>

            <Panel
                title="Equipo"
                description="Disponibilidad según Planificación, otros proyectos, viajes y vacaciones."
                actions={
                    <div className="flex flex-wrap gap-2 items-center">
                        <SegmentedControl label="Filtro de operadores" value={filtro} onChange={(v) => setFiltro(v as 'disponibles' | 'todos')} options={[{ value: 'disponibles', label: 'Disponibles' }, { value: 'todos', label: 'Todos' }]} />
                        <label className="relative"><span className="sr-only">Buscar operador</span><input className="input h-8 w-44" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar operador…" /></label>
                    </div>
                }
                bodyClassName="p-0"
            >
                {errorDisp ? (
                    <p className="p-4 text-sm text-danger-700 dark:text-danger-300" role="alert">{errorDisp}</p>
                ) : !disp ? (
                    <p className="p-4 text-sm text-slate-500">{cargando ? 'Calculando disponibilidad…' : 'Elegí las fechas para ver la disponibilidad.'}</p>
                ) : operadores.length === 0 ? (
                    <EmptyState compact title="Nadie libre en todo el rango" description="Mirá “Todos” para elegir igual o cambiá las fechas." />
                ) : (
                    <>
                        <div className="overflow-x-auto hidden md:block" aria-busy={cargando}>
                            <table className="w-full" style={{ minWidth: 260 + disp.dias.length * 52 + 150 }}>
                                <thead>
                                    <tr>
                                        <th className="text-left !pl-4 w-64">Operador</th>
                                        {disp.dias.map((d) => (
                                            <th key={d} className={cn('text-center !px-0.5 w-12 normal-case', enRango(d) && 'text-slate-900 dark:text-slate-100')}>
                                                <span className={cn('block rounded px-0.5 py-0.5 text-[11px] leading-tight', enRango(d) && 'bg-slate-100 dark:bg-slate-800')}>
                                                    {['D', 'L', 'M', 'X', 'J', 'V', 'S'][new Date(d + 'T00:00:00Z').getUTCDay()]}<br />{d.slice(8, 10)}/{d.slice(5, 7)}
                                                </span>
                                            </th>
                                        ))}
                                        <th className="text-left w-36">En el rango</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operadores.map((o) => {
                                        const sel = s.operadores.includes(o.id);
                                        return (
                                            <tr key={o.id}>
                                                <td className="!pl-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" className="w-4 h-4" checked={sel} onChange={() => toggle(o.id)} />
                                                        <span><span className={cn(sel && 'font-semibold')}>{o.nombre}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{o.etiquetas?.join(', ') || o.role}</span></span>
                                                    </label>
                                                </td>
                                                {disp.dias.map((d) => {
                                                    const c = o.celdas[d];
                                                    return (
                                                        <td key={d} className="!px-0.5">
                                                            <span className={cn('flex h-7 items-center justify-center rounded text-[11px] font-medium tabular-nums', celda(c), !enRango(d) && 'opacity-60')} title={c?.detalle?.join('\n') || 'Libre'}>
                                                                {c?.tipo === 'viaje' ? 'viaje' : c?.tipo === 'ocupado' ? (c.horas ? `${c.horas} h` : 'ocup.') : ''}
                                                            </span>
                                                        </td>
                                                    );
                                                })}
                                                <td>
                                                    {o.enVacaciones ? <Badge tone="neutral">De vacaciones hoy</Badge> : o.conflictosRango === 0 ? <Badge tone="success">Libre</Badge> : <Badge tone="warning">{o.conflictosRango} {o.conflictosRango === 1 ? 'conflicto' : 'conflictos'}</Badge>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <ul className="md:hidden divide-y divide-border">
                            {operadores.map((o) => (
                                <li key={o.id}>
                                    <label className="flex items-center gap-3 px-4 py-3 min-h-[44px] cursor-pointer">
                                        <input type="checkbox" className="w-5 h-5" checked={s.operadores.includes(o.id)} onChange={() => toggle(o.id)} />
                                        <span className="flex-1"><span className="font-medium">{o.nombre}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{o.conflictosRango ? `${o.conflictosRango} de ${diasRango} días ocupado` : `Libre los ${diasRango} días`}</span></span>
                                        {o.enVacaciones ? <Badge tone="neutral">Vacaciones</Badge> : o.conflictosRango === 0 ? <Badge tone="success">Libre</Badge> : <Badge tone="warning">Conflicto</Badge>}
                                    </label>
                                </li>
                            ))}
                        </ul>
                        <div className="hidden md:flex flex-wrap gap-4 px-4 py-3 border-t border-border text-xs text-slate-600 dark:text-slate-300">
                            <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded bg-success-50 border border-success-200" />Libre</span>
                            <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded bg-warning-100" />Horas en otro proyecto o en Planificación</span>
                            <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded bg-info-100" />Viaje</span>
                            <span>Las vacaciones no tienen fechas cargadas: se avisa “de vacaciones hoy”.</span>
                        </div>
                    </>
                )}
            </Panel>
            {s.operadores.length > 0 && (
                <p className={cn('text-sm', capacidad >= horasTotales(s) ? 'text-slate-600 dark:text-slate-300' : 'text-warning-800 dark:text-warning-200')}>
                    {s.operadores.length} {s.operadores.length === 1 ? 'operador' : 'operadores'} · capacidad en el rango ≈ {Math.max(0, Math.round(capacidad))} h para {horasTxt(horasTotales(s))} estimadas.
                    {capacidad < horasTotales(s) && ' No alcanza: sumá gente o extendé las fechas.'}
                </p>
            )}
            {conflictos.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-800 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div><p className="font-medium">Conflictos (no bloquean)</p><ul className="list-disc pl-4">{conflictos.slice(0, 6).map((c) => <li key={c}>{c}</li>)}</ul>{conflictos.length > 6 && <p>y {conflictos.length - 6} más.</p>}</div>
                </div>
            )}
        </div>
    );
}

// ── Paso 6: revisión ───────────────────────────────────────────────

export function PasoRevision({ s, cat, irA, advertencias }: { s: WizardState; cat: Catalogos; irA: (paso: number) => void; advertencias: string[] }) {
    const cambios = cambiosVsPresupuesto(s);
    const cliente = cat.clientes.find((c) => c.id === s.clientId)?.nombre;
    const responsable = cat.operadores.find((o) => o.id === s.responsableId)?.nombreCompleto;
    const equipo = s.operadores.map((id) => cat.operadores.find((o) => o.id === id)?.nombreCompleto || id);
    const valorMat = s.materiales.reduce((a, m) => a + num(m.cantidad) * (m.precioVenta || 0), 0);
    const seccion = (titulo: string, paso: number, filas: [string, React.ReactNode][]) => (
        <Panel title={titulo} actions={<button type="button" className="text-sm text-primary hover:underline" onClick={() => irA(paso)}>Editar</button>}>
            <dl className="grid grid-cols-[140px,1fr] gap-x-4 gap-y-1.5 text-sm">
                {filas.map(([k, v]) => (<Fragment key={k}><dt className="text-slate-500 dark:text-slate-400">{k}</dt><dd>{v}</dd></Fragment>))}
            </dl>
        </Panel>
    );
    return (
        <div className="flex flex-col xl:flex-row gap-4 items-start">
            <div className="flex-1 min-w-0 space-y-4 w-full">
                {seccion('Datos generales', 2, [
                    ['Nombre', s.nombre || '—'],
                    ['Cliente', cliente || '—'],
                    ['Responsable', responsable || 'Sin asignar'],
                    ['Etiquetas', s.tags.join(', ') || '—'],
                    ['Configuración', [s.aprovisionamiento ? 'aprovisionamiento' : null, s.generarOS ? 'Orden de Servicio' : null, s.fichajeHabilitado ? 'fichaje GPS/QR' : null].filter(Boolean).join(' · ') || 'Sin opciones avanzadas'],
                ])}
                {seccion('Tareas y horas', 3, [
                    ['Tareas', s.tareas.length ? `${s.tareas.length}${s.origen === 'presupuesto' ? ` (${s.tareas.filter((t) => t.presupuestoTareaId).length} del presupuesto)` : ''}` : 'Sin tareas'],
                    ['Horas estimadas', horasTxt(horasTotales(s))],
                ])}
                {seccion('Materiales', 4, [
                    ['Ítems', s.materiales.length ? `${s.materiales.length}${s.cargarMateriales ? ', cargados en Provisión de Materiales' : ', sin cargar en aprovisionamiento'}` : 'Sin materiales'],
                    ['Valor', valorMat ? pesos(valorMat) : '—'],
                ])}
                {seccion('Fechas y equipo', 5, [
                    ['Fechas', `${fechaCorta(s.fechaInicio)} → ${fechaCorta(s.fechaFin)} · ${diasDelRango(s)} días hábiles`],
                    ['Equipo', equipo.length ? equipo.join(' · ') : 'Sin asignar (se puede asignar después)'],
                ])}
            </div>
            <aside className="w-full xl:w-96 shrink-0 space-y-4">
                {s.origen === 'presupuesto' && s.presupuesto && (
                    <Panel title="Cambios respecto del presupuesto">
                        {cambios.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Sin cambios: el proyecto replica el presupuesto aceptado.</p> : (
                            <ul className="text-sm space-y-1.5 list-disc pl-4">{cambios.map((c) => <li key={c}>{c}</li>)}</ul>
                        )}
                        <p className="field-hint">El presupuesto aceptado no cambia: el reporte compara contra su copia congelada.</p>
                        {!s.presupuesto.integra && <p className="mt-2 flex gap-2 text-sm text-danger-700 dark:text-danger-300"><ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />La copia congelada del presupuesto no pasa la verificación de integridad.</p>}
                    </Panel>
                )}
                {advertencias.length > 0 && (
                    <Panel title="Advertencias" description="No bloquean la creación.">
                        <ul className="text-sm space-y-1.5 list-disc pl-4 text-warning-800 dark:text-warning-200">{advertencias.map((a) => <li key={a}>{a}</li>)}</ul>
                    </Panel>
                )}
                <Panel title="Al crear se va a">
                    <ul className="text-sm space-y-1.5 list-disc pl-4 text-slate-700 dark:text-slate-200">
                        <li>Crear el proyecto con su código PR-AAAA-NNNN</li>
                        {s.tags.length > 0 && <li>Armar el checklist de {s.tags.length} {s.tags.length === 1 ? 'etiqueta' : 'etiquetas'}</li>}
                        {s.tareas.length > 0 && <li>Cargar {s.tareas.length} tareas</li>}
                        {s.cargarMateriales && s.materiales.length > 0 && <li>Cargar {s.materiales.length} materiales en Provisión</li>}
                        {s.operadores.length > 0 && <li>Asignar {s.operadores.length} operadores del {fechaCorta(s.fechaInicio)} al {fechaCorta(s.fechaFin)}</li>}
                        {s.origen === 'presupuesto' && s.presupuesto && <li>Vincular {s.presupuesto.numero} y su copia congelada</li>}
                        <li>Registrarlo en Auditoría a tu nombre</li>
                    </ul>
                </Panel>
            </aside>
        </div>
    );
}
