'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, PackagePlus, Info } from 'lucide-react';
import { Button, Panel, Badge, SegmentedControl } from '@/components/ui';
import SearchableSelect from '@/components/SearchableSelect';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import {
    calcularPresupuesto,
    resolverLineaManoObra,
    modoTrasEditar,
    valorHoraSegunLista,
    diasHabilesEstimados,
    finSegunDiasHabiles,
    contarDiasHabiles,
    MODO_LABEL,
    type ModoManoObra,
} from '@/lib/presupuestosServicio/calculos';
import { contenidoPresupuestoSchema } from '@/lib/presupuestosServicio/schemas';
import { api, pesos, horasTxt, numCampo, reemplazarAlEditar } from './cliente';
import BuscadorMateriales, { type ProductoBuscado } from './BuscadorMateriales';

// ── Tipos del formulario (los números se editan como texto) ────────

interface FormLinea {
    key: string;
    categoriaId: string | null;
    categoriaNombre: string;
    modo: ModoManoObra;
    horas: string;
    valorHora: string;
    importe: string;
    ivaPorcentaje: number;
}
interface FormTarea { key: string; descripcion: string; etiqueta: string; manoObra: FormLinea[] }
interface FormMaterial {
    key: string;
    productoId: string | null;
    sku: string;
    descripcion: string;
    unidad: string;
    cantidad: string;
    precioUnitario: string;
    precioModificado: boolean;
    ivaPorcentaje: number;
}
export interface FormPresupuesto {
    clienteId: string;
    clienteNombre: string;
    titulo: string;
    alcance: string;
    condiciones: string;
    fechaInicioTentativa: string;
    fechaFinTentativa: string;
    operariosSimultaneos: string;
    horasDia: string;
    validezDias: string;
    listaPrecioId: string;
    descuentoPorcentaje: string;
    notaRevision: string;
    tareas: FormTarea[];
    materiales: FormMaterial[];
}

interface Categoria { id: string; nombre: string; valorHora: number; ivaPorcentaje: number; activo: boolean }
interface Lista { id: string; nombre: string; ivaDiscriminado: boolean; activo: boolean; esPredeterminada: boolean }
interface Cliente { id: string; nombre: string; listaPrecioId: string | null; activo?: boolean }

export interface PresupuestoEditorHandle {
    /** Valida y guarda. Devuelve el presupuesto guardado o null si hay errores. */
    guardar: () => Promise<any | null>;
    hayCambios: () => boolean;
}

interface Props {
    presupuestoId?: string;
    /** Versión vigente y cabecera, tal como vienen de la API. */
    inicial?: any;
    soloLectura?: boolean;
    onGuardado?: (p: any) => void;
    onCambio?: (dirty: boolean) => void;
}

// ── Utilidades ─────────────────────────────────────────────────────

let seq = 0;
const nuevaKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;
const num = (s: string | number): number => {
    const v = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
};
/** Los 0 quedan vacíos: el campo muestra el 0 como placeholder y lo que se escribe lo reemplaza. */
const txt = numCampo;

function desdeApi(p: any): FormPresupuesto {
    const v = p?.versiones?.[0];
    return {
        clienteId: p?.clienteId || '',
        clienteNombre: p?.clienteNombre || '',
        titulo: p?.titulo || '',
        alcance: v?.alcance || '',
        condiciones: v?.condiciones || '',
        fechaInicioTentativa: v?.fechaInicioTentativa || '',
        fechaFinTentativa: v?.fechaFinTentativa || '',
        operariosSimultaneos: String(v?.operariosSimultaneos ?? 1),
        horasDia: String(v?.horasDia ?? 8),
        validezDias: String(v?.validezDias ?? 15),
        listaPrecioId: v?.listaPrecioId || '',
        descuentoPorcentaje: txt(v?.descuentoPorcentaje ?? 0),
        notaRevision: v?.notaRevision || '',
        tareas: (v?.tareas || []).map((t: any) => ({
            key: nuevaKey(),
            descripcion: t.descripcion,
            etiqueta: t.etiqueta || '',
            manoObra: (t.manoObra || []).map((l: any) => ({
                key: nuevaKey(),
                categoriaId: l.categoriaId,
                categoriaNombre: l.categoriaNombre,
                modo: (['manual', 'costo', 'tiempo'].includes(l.modo) ? l.modo : 'manual') as ModoManoObra,
                horas: txt(l.horas),
                valorHora: txt(l.valorHora),
                importe: txt(l.importe),
                ivaPorcentaje: l.ivaPorcentaje,
            })),
        })),
        materiales: (v?.materiales || []).map((m: any) => ({
            key: nuevaKey(),
            productoId: m.productoId,
            sku: m.sku || '',
            descripcion: m.descripcion,
            unidad: m.unidad || '',
            cantidad: txt(m.cantidad),
            precioUnitario: txt(m.precioUnitario),
            precioModificado: Boolean(m.precioModificado),
            ivaPorcentaje: m.ivaPorcentaje,
        })),
    };
}

const FORM_VACIO: FormPresupuesto = {
    clienteId: '', clienteNombre: '', titulo: '', alcance: '', condiciones: '', fechaInicioTentativa: '', fechaFinTentativa: '',
    operariosSimultaneos: '2', horasDia: '8', validezDias: '15', listaPrecioId: '', descuentoPorcentaje: '', notaRevision: '', tareas: [], materiales: [],
};

function aPayload(f: FormPresupuesto) {
    return {
        clienteId: f.clienteId || null,
        clienteNombre: f.clienteNombre || null,
        titulo: f.titulo,
        alcance: f.alcance || null,
        condiciones: f.condiciones || null,
        fechaInicioTentativa: f.fechaInicioTentativa || null,
        fechaFinTentativa: f.fechaFinTentativa || null,
        operariosSimultaneos: Math.max(1, Math.round(num(f.operariosSimultaneos)) || 1),
        horasDia: num(f.horasDia),
        validezDias: Math.max(1, Math.round(num(f.validezDias)) || 15),
        listaPrecioId: f.listaPrecioId || null,
        descuentoPorcentaje: num(f.descuentoPorcentaje),
        notaRevision: f.notaRevision || null,
        tareas: f.tareas.map((t) => ({
            descripcion: t.descripcion,
            etiqueta: t.etiqueta || null,
            manoObra: t.manoObra.map((l) => ({
                categoriaId: l.categoriaId,
                categoriaNombre: l.categoriaNombre,
                modo: l.modo,
                horas: num(l.horas),
                valorHora: num(l.valorHora),
                importe: num(l.importe),
                ivaPorcentaje: l.ivaPorcentaje,
            })),
        })),
        materiales: f.materiales.map((m) => ({
            productoId: m.productoId,
            sku: m.sku || null,
            descripcion: m.descripcion,
            unidad: m.unidad || null,
            cantidad: num(m.cantidad),
            precioUnitario: num(m.precioUnitario),
            precioModificado: m.precioModificado,
            ivaPorcentaje: m.ivaPorcentaje,
        })),
    };
}

/** Aplica el modo de cálculo de la línea a los textos del formulario. */
function recalcularLinea(l: FormLinea): FormLinea {
    const r = resolverLineaManoObra({ modo: l.modo, horas: num(l.horas), valorHora: num(l.valorHora), importe: num(l.importe) });
    return {
        ...l,
        horas: l.modo === 'tiempo' ? txt(r.horas) : l.horas,
        importe: l.modo === 'costo' ? txt(r.importe) : l.importe,
    };
}

// ── Componente ─────────────────────────────────────────────────────

const PresupuestoEditor = forwardRef<PresupuestoEditorHandle, Props>(function PresupuestoEditor(
    { presupuestoId, inicial, soloLectura = false, onGuardado, onCambio },
    ref
) {
    const [form, setForm] = useState<FormPresupuesto>(() => (inicial ? desdeApi(inicial) : FORM_VACIO));
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [listas, setListas] = useState<Lista[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [etiquetas, setEtiquetas] = useState<string[]>([]);
    const [intentoGuardar, setIntentoGuardar] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const base = useRef(JSON.stringify(aPayload(inicial ? desdeApi(inicial) : FORM_VACIO)));

    useEffect(() => {
        if (inicial) {
            const f = desdeApi(inicial);
            setForm(f);
            base.current = JSON.stringify(aPayload(f));
        }
    }, [inicial]);

    useEffect(() => {
        (async () => {
            const [cl, li, ca, tg] = await Promise.all([
                api<Cliente[]>('/api/clients').catch(() => []),
                api<Lista[]>('/api/ventas/listas-precios').catch(() => []),
                api<Categoria[]>('/api/presupuestos-servicio/mano-obra?activas=1').catch(() => []),
                api<any[]>('/api/config/tags').catch(() => []),
            ]);
            setClientes(Array.isArray(cl) ? cl.filter((c) => c.activo !== false) : []);
            setListas(Array.isArray(li) ? li.filter((l) => l.activo) : []);
            setCategorias(Array.isArray(ca) ? ca : []);
            setEtiquetas(Array.isArray(tg) ? tg.filter((t) => t.active).map((t) => t.name) : []);
        })();
    }, []);

    const dirty = useMemo(() => JSON.stringify(aPayload(form)) !== base.current, [form]);
    useEffect(() => onCambio?.(dirty), [dirty, onCambio]);
    useEffect(() => {
        if (!dirty || soloLectura) return;
        const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [dirty, soloLectura]);

    // Lista de precios efectiva: la elegida; si no, la del cliente; si no, la predeterminada.
    const cliente = clientes.find((c) => c.id === form.clienteId) || null;
    const listaCliente = cliente?.listaPrecioId ? listas.find((l) => l.id === cliente.listaPrecioId) || null : null;
    const listaPredeterminada = listas.find((l) => l.esPredeterminada) || listas[0] || null;
    const lista = listas.find((l) => l.id === form.listaPrecioId) || listaCliente || listaPredeterminada;
    const ivaDiscriminado = Boolean(lista?.ivaDiscriminado);

    const calculo = useMemo(() => {
        const p = aPayload(form);
        return calcularPresupuesto({ ivaDiscriminado, descuentoPorcentaje: p.descuentoPorcentaje, tareas: p.tareas, materiales: p.materiales });
    }, [form, ivaDiscriminado]);

    const validacion = useMemo(() => contenidoPresupuestoSchema.safeParse(aPayload(form)), [form]);
    const errores = useMemo(() => {
        const e: Record<string, string> = {};
        if (!validacion.success) for (const i of validacion.error.issues) {
            const k = i.path.join('.');
            if (!e[k]) e[k] = i.message;
        }
        if (form.tareas.length === 0 && form.materiales.length === 0) e['contenido'] = 'Cargá al menos una tarea o un material';
        form.tareas.forEach((t, i) => { if (t.manoObra.length === 0) e[`tareas.${i}.manoObra`] = 'Agregá al menos una categoría de mano de obra'; });
        return e;
    }, [validacion, form]);
    const err = (k: string) => (intentoGuardar ? errores[k] : undefined);

    const set = <K extends keyof FormPresupuesto>(k: K, v: FormPresupuesto[K]) => setForm((f) => ({ ...f, [k]: v }));

    // ── Cliente y lista ──
    const elegirCliente = (id: string) => {
        const c = clientes.find((x) => x.id === id);
        setForm((f) => ({ ...f, clienteId: id, clienteNombre: c?.nombre || '', listaPrecioId: c?.listaPrecioId || f.listaPrecioId }));
        if (c?.listaPrecioId && c.listaPrecioId !== lista?.id) void cambiarLista(c.listaPrecioId, true);
    };

    const cambiarLista = useCallback(async (id: string, silencioso = false) => {
        const nueva = listas.find((l) => l.id === id);
        setForm((f) => ({ ...f, listaPrecioId: id }));
        if (!nueva) return;
        // Valor hora de las categorías del catálogo según el IVA de la nueva lista.
        setForm((f) => ({
            ...f,
            tareas: f.tareas.map((t) => ({
                ...t,
                manoObra: t.manoObra.map((l) => {
                    const cat = categorias.find((c) => c.id === l.categoriaId);
                    if (!cat) return l;
                    return recalcularLinea({ ...l, valorHora: txt(valorHoraSegunLista(cat.valorHora, cat.ivaPorcentaje, nueva.ivaDiscriminado)) });
                }),
            })),
        }));
        // Precios de materiales del catálogo (salvo los modificados a mano).
        const aActualizar = form.materiales.filter((m) => m.productoId && m.sku && !m.precioModificado);
        if (aActualizar.length === 0) return;
        const precios = await Promise.all(
            aActualizar.slice(0, 40).map(async (m) => {
                const r = await api<any>(`/api/ventas/pdv/buscar-productos?q=${encodeURIComponent(m.sku)}&listaPrecioId=${id}&limit=5`).catch(() => null);
                const p = r?.productos?.find((x: any) => x.id === m.productoId);
                return p ? { key: m.key, precio: p.precioAplicado as number } : null;
            })
        );
        const mapa = new Map(precios.filter(Boolean).map((x) => [x!.key, x!.precio]));
        setForm((f) => ({ ...f, materiales: f.materiales.map((m) => (mapa.has(m.key) ? { ...m, precioUnitario: txt(mapa.get(m.key)!) } : m)) }));
        if (!silencioso) showToast(`Precios actualizados a la lista ${nueva.nombre}`, 'info');
    }, [listas, categorias, form.materiales]);

    // ── Tareas y mano de obra ──
    const lineaNueva = (catId?: string): FormLinea => {
        const cat = categorias.find((c) => c.id === catId) || categorias[0];
        return {
            key: nuevaKey(),
            categoriaId: cat?.id || null,
            categoriaNombre: cat?.nombre || '',
            modo: 'costo',
            horas: '',
            valorHora: cat ? txt(valorHoraSegunLista(cat.valorHora, cat.ivaPorcentaje, ivaDiscriminado)) : '',
            importe: '',
            ivaPorcentaje: cat?.ivaPorcentaje ?? 21,
        };
    };
    const agregarTarea = () => setForm((f) => ({ ...f, tareas: [...f.tareas, { key: nuevaKey(), descripcion: '', etiqueta: '', manoObra: [lineaNueva()] }] }));
    const editarTarea = (key: string, patch: Partial<FormTarea>) =>
        setForm((f) => ({ ...f, tareas: f.tareas.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
    const quitarTarea = (key: string) => setForm((f) => ({ ...f, tareas: f.tareas.filter((t) => t.key !== key) }));
    const editarLinea = (tKey: string, lKey: string, campo: 'horas' | 'importe' | 'valorHora' | 'modo' | 'categoria', valor: string) =>
        setForm((f) => ({
            ...f,
            tareas: f.tareas.map((t) => {
                if (t.key !== tKey) return t;
                return {
                    ...t,
                    manoObra: t.manoObra.map((l) => {
                        if (l.key !== lKey) return l;
                        if (campo === 'modo') return recalcularLinea({ ...l, modo: valor as ModoManoObra });
                        if (campo === 'categoria') {
                            const cat = categorias.find((c) => c.id === valor);
                            if (!cat) return l;
                            return recalcularLinea({
                                ...l, categoriaId: cat.id, categoriaNombre: cat.nombre, ivaPorcentaje: cat.ivaPorcentaje,
                                valorHora: txt(valorHoraSegunLista(cat.valorHora, cat.ivaPorcentaje, ivaDiscriminado)),
                            });
                        }
                        return recalcularLinea({ ...l, [campo]: valor, modo: modoTrasEditar(l.modo, campo) });
                    }),
                };
            }),
        }));
    const agregarLinea = (tKey: string) => editarTarea(tKey, { manoObra: [...(form.tareas.find((t) => t.key === tKey)?.manoObra || []), lineaNueva()] });
    const quitarLinea = (tKey: string, lKey: string) =>
        setForm((f) => ({ ...f, tareas: f.tareas.map((t) => (t.key === tKey ? { ...t, manoObra: t.manoObra.filter((l) => l.key !== lKey) } : t)) }));

    // ── Materiales ──
    const cantidadesCargadas = useMemo(() => {
        const m = new Map<string, number>();
        for (const x of form.materiales) if (x.productoId) m.set(x.productoId, (m.get(x.productoId) || 0) + num(x.cantidad));
        return m;
    }, [form.materiales]);
    /** Agrega el producto; si ya está en la lista, le suma 1 a la cantidad. */
    const agregarProducto = (p: ProductoBuscado) =>
        setForm((f) => {
            const i = f.materiales.findIndex((m) => m.productoId === p.id);
            if (i >= 0) return { ...f, materiales: f.materiales.map((m, j) => (j === i ? { ...m, cantidad: String(Math.round((num(m.cantidad) + 1) * 100) / 100) } : m)) };
            return {
                ...f,
                materiales: [...f.materiales, {
                    key: nuevaKey(), productoId: p.id, sku: p.sku, descripcion: p.descripcion, unidad: p.unidad || 'UN',
                    cantidad: '1', precioUnitario: txt(p.precioAplicado), precioModificado: false, ivaPorcentaje: p.ivaPorcentaje ?? 21,
                }],
            };
        });
    const agregarManual = () =>
        setForm((f) => ({ ...f, materiales: [...f.materiales, { key: nuevaKey(), productoId: null, sku: '', descripcion: '', unidad: 'UN', cantidad: '1', precioUnitario: '', precioModificado: true, ivaPorcentaje: 21 }] }));
    const editarMaterial = (key: string, patch: Partial<FormMaterial>) =>
        setForm((f) => ({ ...f, materiales: f.materiales.map((m) => (m.key === key ? { ...m, ...patch } : m)) }));
    const quitarMaterial = (key: string) => setForm((f) => ({ ...f, materiales: f.materiales.filter((m) => m.key !== key) }));

    // ── Plazo ──
    const horasDia = num(form.horasDia) || 8;
    const diasEstimados = diasHabilesEstimados(calculo.horasTotales, num(form.operariosSimultaneos), horasDia);
    const finSugerido = form.fechaInicioTentativa && diasEstimados > 0 ? finSegunDiasHabiles(form.fechaInicioTentativa, diasEstimados) : '';
    const diasElegidos = form.fechaInicioTentativa && form.fechaFinTentativa ? contarDiasHabiles(form.fechaInicioTentativa, form.fechaFinTentativa) : 0;

    // ── Guardar ──
    useImperativeHandle(ref, () => ({
        hayCambios: () => dirty,
        guardar: async () => {
            setIntentoGuardar(true);
            if (Object.keys(errores).length > 0) {
                showToast(Object.values(errores)[0], 'error');
                return null;
            }
            setGuardando(true);
            try {
                const payload = aPayload(form);
                const r = presupuestoId
                    ? await api<any>(`/api/presupuestos-servicio/${presupuestoId}`, { method: 'PUT', json: payload })
                    : await api<any>('/api/presupuestos-servicio', { method: 'POST', json: payload });
                base.current = JSON.stringify(payload);
                setIntentoGuardar(false);
                showToast(r.message || 'Cambios guardados', 'success');
                onGuardado?.(r.presupuesto);
                return r.presupuesto;
            } catch (e: any) {
                showToast(e.message, 'error');
                return null;
            } finally {
                setGuardando(false);
            }
        },
    }), [dirty, errores, form, presupuestoId, onGuardado]);

    const ro = soloLectura;
    const opcionesClientes = clientes.map((c) => ({ id: c.id, label: c.nombre }));
    const sinValorHora = categorias.length > 0 && categorias.every((c) => !c.valorHora);

    return (
        <div className="flex flex-col lg:flex-row gap-5 items-start" aria-busy={guardando}>
            <fieldset disabled={ro} className="flex-1 min-w-0 space-y-4 w-full">
                <Panel title="Cliente y alcance">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="field-label">Cliente<span className="text-danger-600 ml-0.5" aria-hidden="true">*</span></span>
                            {ro ? (
                                <p className="text-sm py-2">{form.clienteNombre}</p>
                            ) : (
                                <SearchableSelect options={opcionesClientes} value={form.clienteId} onChange={elegirCliente} placeholder="Elegí el cliente…" />
                            )}
                            {err('clienteId') && <p className="field-error" role="alert">{err('clienteId')}</p>}
                        </div>
                        <label className="block">
                            <span className="field-label">Título de la obra<span className="text-danger-600 ml-0.5" aria-hidden="true">*</span></span>
                            <input className="input" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ej.: Tendido BT nave 3" aria-invalid={Boolean(err('titulo'))} maxLength={200} />
                            {err('titulo') && <p className="field-error" role="alert">{err('titulo')}</p>}
                        </label>
                        <label className="block md:col-span-2">
                            <span className="field-label">Alcance</span>
                            <textarea className="input min-h-[80px] py-2" value={form.alcance} onChange={(e) => set('alcance', e.target.value)} placeholder="Qué incluye el trabajo" maxLength={5000} />
                            <span className="field-hint">Se imprime en el documento en todos los niveles de detalle.</span>
                        </label>
                    </div>
                </Panel>

                <Panel
                    title="Mano de obra por tarea"
                    description="Modo de cada línea · Manual: cargás horas e importe. Costo: calcula el importe = horas × valor hora. Tiempo: calcula las horas = importe ÷ valor hora. Todo se puede editar; si cambiás el valor calculado, la línea pasa a Manual."
                    actions={!ro ? <Button variant="secondary" size="sm" icon={<Plus />} onClick={agregarTarea}>Agregar tarea</Button> : undefined}
                >
                    {sinValorHora && !ro && (
                        <p className="mb-3 flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-200">
                            <Info className="w-4 h-4 shrink-0" aria-hidden="true" /> Las categorías de mano de obra no tienen valor hora cargado. Configuralo en Presupuestos de servicios › Mano de obra.
                        </p>
                    )}
                    {form.tareas.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Sin tareas. {ro ? '' : 'Agregá la primera para cargar la mano de obra.'}</p>
                    ) : (
                        <div className="space-y-3">
                            {form.tareas.map((t, ti) => {
                                const ct = calculo.tareas[ti];
                                return (
                                    <div key={t.key} className="rounded-xl border border-border">
                                        <div className="flex flex-wrap items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-t-xl border-b border-border">
                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-2.5">{ti + 1}</span>
                                            <div className="flex-1 min-w-[200px]">
                                                <input className="input" value={t.descripcion} onChange={(e) => editarTarea(t.key, { descripcion: e.target.value })} placeholder="Descripción de la tarea" aria-label={`Descripción de la tarea ${ti + 1}`} aria-invalid={Boolean(err(`tareas.${ti}.descripcion`))} maxLength={300} />
                                                {err(`tareas.${ti}.descripcion`) && <p className="field-error" role="alert">{err(`tareas.${ti}.descripcion`)}</p>}
                                            </div>
                                            <select className="input w-44" value={t.etiqueta} onChange={(e) => editarTarea(t.key, { etiqueta: e.target.value })} aria-label="Etiqueta técnica">
                                                <option value="">Sin etiqueta</option>
                                                {Array.from(new Set([...etiquetas, ...(t.etiqueta ? [t.etiqueta] : [])])).map((e) => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                            <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300 mt-2 whitespace-nowrap">
                                                {horasTxt(ct?.horas)} · <b className="font-semibold text-slate-900 dark:text-slate-100">{pesos(ct?.importe, 0)}</b>
                                            </span>
                                            {!ro && <Button variant="danger-ghost" size="icon-sm" icon={<Trash2 />} aria-label={`Quitar la tarea ${ti + 1}`} onClick={() => quitarTarea(t.key)} />}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[640px]">
                                                <thead>
                                                    <tr>
                                                        <th className="text-left">Categoría</th>
                                                        <th className="text-left w-[196px]">Modo</th>
                                                        <th className="text-right w-20">Horas</th>
                                                        <th className="text-right w-28">Valor hora</th>
                                                        <th className="text-right w-32">Importe</th>
                                                        {!ro && <th className="w-10"><span className="sr-only">Quitar</span></th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {t.manoObra.map((l) => {
                                                        const calcH = l.modo === 'tiempo';
                                                        const calcI = l.modo === 'costo';
                                                        return (
                                                            <tr key={l.key}>
                                                                <td>
                                                                    <select className="input h-8" value={l.categoriaId || ''} onChange={(e) => editarLinea(t.key, l.key, 'categoria', e.target.value)} aria-label="Categoría de mano de obra">
                                                                        {!l.categoriaId && <option value="">{l.categoriaNombre || 'Elegí…'}</option>}
                                                                        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td>
                                                                    {ro ? <span className="text-sm whitespace-nowrap">{MODO_LABEL[l.modo]}</span> : (
                                                                        <SegmentedControl
                                                                            label="Modo de cálculo"
                                                                            value={l.modo}
                                                                            onChange={(m) => editarLinea(t.key, l.key, 'modo', m)}
                                                                            options={[
                                                                                { value: 'manual', label: <span title="Cargás horas e importe">Manual</span> },
                                                                                { value: 'costo', label: <span title="Calcular costo: importe = horas × valor hora">Costo</span> },
                                                                                { value: 'tiempo', label: <span title="Calcular tiempo: horas = importe ÷ valor hora">Tiempo</span> },
                                                                            ]}
                                                                        />
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <input className={cn('input h-8 text-right tabular-nums', calcH && 'bg-muted border-dashed')} inputMode="decimal" placeholder="0" value={l.horas} {...reemplazarAlEditar} onChange={(e) => editarLinea(t.key, l.key, 'horas', e.target.value)} aria-label={calcH ? 'Horas (calculadas)' : 'Horas'} title={calcH ? 'Calculado: importe ÷ valor hora' : undefined} />
                                                                </td>
                                                                <td>
                                                                    <input className="input h-8 text-right tabular-nums" inputMode="decimal" placeholder="0" value={l.valorHora} {...reemplazarAlEditar} onChange={(e) => editarLinea(t.key, l.key, 'valorHora', e.target.value)} aria-label="Valor hora" />
                                                                </td>
                                                                <td>
                                                                    <input className={cn('input h-8 text-right tabular-nums', calcI && 'bg-muted border-dashed')} inputMode="decimal" placeholder="0" value={l.importe} {...reemplazarAlEditar} onChange={(e) => editarLinea(t.key, l.key, 'importe', e.target.value)} aria-label={calcI ? 'Importe (calculado)' : 'Importe'} title={calcI ? 'Calculado: horas × valor hora' : undefined} />
                                                                </td>
                                                                {!ro && (
                                                                    <td><Button variant="ghost" size="icon-sm" icon={<Trash2 />} aria-label="Quitar categoría" onClick={() => quitarLinea(t.key, l.key)} /></td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="px-3 py-2 flex flex-wrap items-center gap-3">
                                            {!ro && <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => agregarLinea(t.key)}>Agregar categoría</Button>}
                                            {err(`tareas.${ti}.manoObra`) && <span className="field-error !mt-0" role="alert">{err(`tareas.${ti}.manoObra`)}</span>}
                                            {!ivaDiscriminado && <span className="text-xs text-slate-500 dark:text-slate-400">Valores hora con IVA incluido, como la lista.</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <p className="field-hint">El campo con borde punteado es el calculado.</p>
                </Panel>

                <Panel
                    title="Materiales"
                    actions={!ro ? <Button variant="secondary" size="sm" icon={<PackagePlus />} onClick={agregarManual}>Ítem manual</Button> : undefined}
                    bodyClassName="p-0"
                >
                    {!ro && <BuscadorMateriales listaPrecioId={lista?.id} cantidades={cantidadesCargadas} onAgregar={agregarProducto} />}
                    {form.materiales.length === 0 ? (
                        <p className="px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">Sin materiales.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px]">
                                <thead>
                                    <tr>
                                        <th className="text-left w-24 !pl-4">SKU</th>
                                        <th className="text-left">Descripción</th>
                                        <th className="text-left w-20">Unidad</th>
                                        <th className="text-right w-24">Cantidad</th>
                                        <th className="text-right w-32">Precio unit.</th>
                                        <th className="text-right w-32">Subtotal</th>
                                        {!ro && <th className="w-10"><span className="sr-only">Quitar</span></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.materiales.map((m, mi) => (
                                        <tr key={m.key}>
                                            <td className="font-mono text-xs !pl-4">{m.sku || '—'}</td>
                                            <td>
                                                {m.productoId ? (
                                                    <span>{m.descripcion}{m.precioModificado && <Badge tone="warning" className="ml-2">Precio modificado</Badge>}</span>
                                                ) : (
                                                    <input className="input h-8" value={m.descripcion} onChange={(e) => editarMaterial(m.key, { descripcion: e.target.value })} placeholder="Descripción" aria-label="Descripción del material" aria-invalid={Boolean(err(`materiales.${mi}.descripcion`))} />
                                                )}
                                                {err(`materiales.${mi}.descripcion`) && <p className="field-error" role="alert">{err(`materiales.${mi}.descripcion`)}</p>}
                                            </td>
                                            <td>
                                                {m.productoId ? m.unidad : <input className="input h-8" value={m.unidad} onChange={(e) => editarMaterial(m.key, { unidad: e.target.value })} aria-label="Unidad" maxLength={20} />}
                                            </td>
                                            <td>
                                                <input className="input h-8 text-right tabular-nums" inputMode="decimal" placeholder="0" value={m.cantidad} {...reemplazarAlEditar} onChange={(e) => editarMaterial(m.key, { cantidad: e.target.value })} aria-label="Cantidad" aria-invalid={Boolean(err(`materiales.${mi}.cantidad`))} />
                                                {err(`materiales.${mi}.cantidad`) && <p className="field-error" role="alert">{err(`materiales.${mi}.cantidad`)}</p>}
                                            </td>
                                            <td>
                                                <input className="input h-8 text-right tabular-nums" inputMode="decimal" placeholder="0" value={m.precioUnitario} {...reemplazarAlEditar} onChange={(e) => editarMaterial(m.key, { precioUnitario: e.target.value, precioModificado: Boolean(m.productoId) || m.precioModificado })} aria-label="Precio unitario" />
                                            </td>
                                            <td className="text-right tabular-nums whitespace-nowrap">{pesos(calculo.materiales[mi]?.subtotal)}</td>
                                            {!ro && <td><Button variant="ghost" size="icon-sm" icon={<Trash2 />} aria-label="Quitar material" onClick={() => quitarMaterial(m.key)} /></td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="px-4 py-3 field-hint !mt-0">Precios de la lista {lista?.nombre || '—'}. Si cambiás la lista se recalculan, salvo los precios modificados a mano.</p>
                </Panel>

                <Panel title="Plazo, validez y condiciones">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <label className="block">
                            <span className="field-label">Operarios en simultáneo</span>
                            <input className="input tabular-nums" inputMode="numeric" placeholder="1" value={form.operariosSimultaneos} {...reemplazarAlEditar} onChange={(e) => set('operariosSimultaneos', e.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(err('operariosSimultaneos'))} />
                            {err('operariosSimultaneos') && <p className="field-error" role="alert">{err('operariosSimultaneos')}</p>}
                        </label>
                        <label className="block">
                            <span className="field-label">Horas por día</span>
                            <input className="input tabular-nums" inputMode="decimal" placeholder="8" value={form.horasDia} {...reemplazarAlEditar} onChange={(e) => set('horasDia', e.target.value)} aria-invalid={Boolean(err('horasDia'))} />
                            {err('horasDia') ? <p className="field-error" role="alert">{err('horasDia')}</p> : <p className="field-hint">Jornada de trabajo de esta obra.</p>}
                        </label>
                        <label className="block">
                            <span className="field-label">Inicio tentativo</span>
                            <input type="date" className="input" value={form.fechaInicioTentativa} onChange={(e) => set('fechaInicioTentativa', e.target.value)} />
                        </label>
                        <label className="block">
                            <span className="field-label">Fin tentativo</span>
                            <input type="date" className="input" value={form.fechaFinTentativa} min={form.fechaInicioTentativa || undefined} onChange={(e) => set('fechaFinTentativa', e.target.value)} aria-invalid={Boolean(err('fechaFinTentativa'))} />
                            {err('fechaFinTentativa') ? (
                                <p className="field-error" role="alert">{err('fechaFinTentativa')}</p>
                            ) : finSugerido && !ro ? (
                                <p className="field-hint">
                                    Sugerido: {diasEstimados} {diasEstimados === 1 ? 'día hábil' : 'días hábiles'} de {horasTxt(horasDia)}.{' '}
                                    {finSugerido !== form.fechaFinTentativa && (
                                        <button type="button" className="text-primary hover:underline" onClick={() => set('fechaFinTentativa', finSugerido)}>Usar {finSugerido.split('-').reverse().join('/')}</button>
                                    )}
                                </p>
                            ) : null}
                        </label>
                        <label className="block">
                            <span className="field-label">Validez de la oferta (días)</span>
                            <input className="input tabular-nums" inputMode="numeric" placeholder="15" value={form.validezDias} {...reemplazarAlEditar} onChange={(e) => set('validezDias', e.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(err('validezDias'))} />
                            {err('validezDias') ? <p className="field-error" role="alert">{err('validezDias')}</p> : <p className="field-hint">Cuenta desde el envío.</p>}
                        </label>
                        <label className="block sm:col-span-2 lg:col-span-3">
                            <span className="field-label">Condiciones</span>
                            <textarea className="input min-h-[64px] py-2" value={form.condiciones} onChange={(e) => set('condiciones', e.target.value)} placeholder="Forma de pago, exclusiones, etc." maxLength={3000} />
                        </label>
                        {presupuestoId && (
                            <label className="block sm:col-span-2 lg:col-span-4">
                                <span className="field-label">Nota de la revisión</span>
                                <input className="input" value={form.notaRevision} onChange={(e) => set('notaRevision', e.target.value)} placeholder="Qué cambió y por qué (queda en el historial)" maxLength={500} />
                            </label>
                        )}
                    </div>
                    {diasElegidos > 0 && <p className="field-hint">El rango elegido son {diasElegidos} días hábiles.</p>}
                </Panel>
                {intentoGuardar && errores['contenido'] && <p className="field-error" role="alert">{errores['contenido']}</p>}
            </fieldset>

            <aside className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-20">
                <Panel title="Lista de precios e IVA">
                    <div className="space-y-3">
                        {!ro ? (
                            <label className="block">
                                <span className="field-label">Lista de precios</span>
                                <select className="input" value={lista?.id || ''} onChange={(e) => cambiarLista(e.target.value)}>
                                    {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}{l.ivaDiscriminado ? ' (+IVA)' : ''}</option>)}
                                </select>
                            </label>
                        ) : (
                            <p className="text-sm">{lista?.nombre || inicial?.versiones?.[0]?.listaPrecioNombre || '—'}</p>
                        )}
                        {form.clienteId && (
                            <p className="field-hint !mt-0">
                                {listaCliente
                                    ? lista?.id === listaCliente.id ? 'Es la lista asignada al cliente.' : `El cliente tiene asignada ${listaCliente.nombre}.`
                                    : 'El cliente no tiene lista asignada: la elegida vale solo para este presupuesto.'}
                            </p>
                        )}
                        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                            <span className="text-xs text-slate-500 dark:text-slate-400">IVA según la lista</span>
                            <Badge tone="neutral">{ivaDiscriminado ? 'Discriminado' : 'Incluido en precios'}</Badge>
                        </div>
                    </div>
                </Panel>

                <Panel title="Totales">
                    <dl className="text-sm space-y-2 tabular-nums">
                        <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Mano de obra · {horasTxt(calculo.horasTotales)}</dt><dd>{pesos(calculo.subtotalManoObra)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Materiales · {form.materiales.length}</dt><dd>{pesos(calculo.subtotalMateriales)}</dd></div>
                        <div className="flex justify-between gap-3 items-center">
                            <dt className="text-slate-500 dark:text-slate-400">Descuento</dt>
                            <dd className="flex items-center gap-1">
                                <input className="input h-8 w-16 text-right" inputMode="decimal" placeholder="0" value={form.descuentoPorcentaje} {...reemplazarAlEditar} onChange={(e) => set('descuentoPorcentaje', e.target.value)} aria-label="Descuento en porcentaje" disabled={ro} /> %
                            </dd>
                        </div>
                        {calculo.descuentoMonto > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Descuento</dt><dd>−{pesos(calculo.descuentoMonto)}</dd></div>}
                        <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="text-slate-500 dark:text-slate-400">{ivaDiscriminado ? 'Neto gravado' : 'Neto sin IVA'}</dt><dd>{pesos(calculo.neto)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">{ivaDiscriminado ? 'IVA' : 'IVA contenido'}</dt><dd>{pesos(calculo.impuestos)}</dd></div>
                        <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{pesos(calculo.total)}</dd></div>
                    </dl>
                    {diasEstimados > 0 && <p className="field-hint">Plazo estimado: {diasEstimados} {diasEstimados === 1 ? 'día hábil' : 'días hábiles'} con {Math.max(1, num(form.operariosSimultaneos))} {Math.max(1, num(form.operariosSimultaneos)) === 1 ? 'operario' : 'operarios'} de {horasTxt(horasDia)} por día.</p>}
                </Panel>
            </aside>
        </div>
    );
});

export default PresupuestoEditor;
