'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, BellPlus, Check, ChevronDown, Edit3, Loader2, Send, Trash2, X } from 'lucide-react';
import { Badge, Button, Dialog, Field, SegmentedControl } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { cn } from '@/lib/cn';
import {
    ATAJOS_VENCIMIENTO, aDatetimeLocal, desdeDatetimeLocal, fechaAtajo,
} from '@/lib/tareas/vencimiento';
import PrioridadSlider from './PrioridadSlider';
import {
    ESTADOS, ROLES_INVOLUCRADO, TIPOS_RECORDATORIO, columnaDeEstado, iniciales,
    type OperadorOpcion, type ProyectoOpcion, type Tarea,
} from './tipos';
import type { BorradorTarea } from './QuickAddTarea';

interface Comentario {
    id: string;
    operatorId: string;
    operator: { id: string; nombreCompleto: string; role: string };
    mensaje: string;
    createdAt: string;
}

interface FormState {
    titulo: string;
    descripcion: string;
    estado: string;
    prioridad: string;
    categoria: string;
    fechaInicio: string; // datetime-local
    fechaVencimiento: string; // datetime-local
    projectId: string;
    notas: string;
}

type Involucrado = { operatorId: string; rol: string };
type NuevoRecordatorio = { tipo: string; fechaDisparo: string; mensaje: string };

function formDesde(tarea: Tarea | null, borrador?: BorradorTarea | null): FormState {
    if (tarea) {
        return {
            titulo: tarea.titulo,
            descripcion: tarea.descripcion || '',
            estado: tarea.estado,
            prioridad: tarea.prioridad,
            categoria: tarea.categoria || '',
            fechaInicio: aDatetimeLocal(tarea.fechaInicio),
            fechaVencimiento: aDatetimeLocal(tarea.fechaVencimiento),
            projectId: tarea.projectId || '',
            notas: tarea.notas || '',
        };
    }
    return {
        titulo: borrador?.titulo || '',
        descripcion: '',
        estado: 'pendiente',
        prioridad: borrador?.prioridad || 'media',
        categoria: '',
        fechaInicio: '',
        fechaVencimiento: aDatetimeLocal(borrador?.fechaVencimiento || null),
        projectId: '',
        notas: '',
    };
}

export default function TareaFormDialog({
    open,
    onClose,
    tarea,
    borrador,
    startInEdit,
    canEditFull,
    operators,
    projects,
    categorias,
    currentUserId,
    onSaved,
    onDelete,
}: {
    open: boolean;
    onClose: () => void;
    /** null = nueva tarea */
    tarea: Tarea | null;
    borrador?: BorradorTarea | null;
    startInEdit?: boolean;
    canEditFull: boolean;
    operators: OperadorOpcion[];
    projects: ProyectoOpcion[];
    categorias: string[];
    currentUserId?: string;
    onSaved: () => void | Promise<void>;
    onDelete?: () => void;
}) {
    const esNueva = !tarea;
    const [isViewMode, setIsViewMode] = useState(false);
    const [form, setForm] = useState<FormState>(() => formDesde(tarea, borrador));
    const [involucrados, setInvolucrados] = useState<Involucrado[]>([]);
    const [recordatorios, setRecordatorios] = useState<NuevoRecordatorio[]>([]);
    const [existentes, setExistentes] = useState(tarea?.recordatorios || []);
    const [masOpciones, setMasOpciones] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState(false);

    const [comentarios, setComentarios] = useState<Comentario[]>([]);
    const [comentario, setComentario] = useState('');
    const [comentando, setComentando] = useState(false);

    // Reinicia el formulario cada vez que se abre
    useEffect(() => {
        if (!open) return;
        const f = formDesde(tarea, borrador);
        setForm(f);
        setInvolucrados(
            tarea
                ? tarea.involucrados.map(i => ({ operatorId: i.operatorId, rol: i.rol }))
                : borrador?.responsableId ? [{ operatorId: borrador.responsableId, rol: 'responsable' }] : []
        );
        setRecordatorios([]);
        setExistentes(tarea?.recordatorios || []);
        setErrores({});
        setIsViewMode(!!tarea && (!startInEdit || !canEditFull));
        setMasOpciones(!!tarea && !!(f.fechaInicio || f.projectId || f.categoria || f.notas || tarea.recordatorios.length));
        setComentario('');
        setComentarios([]);
        if (tarea) {
            safeApiRequest(`/api/tareas/comentarios?tareaId=${tarea.id}&_t=${Date.now()}`)
                .then(r => r.json())
                .then(data => { if (Array.isArray(data)) setComentarios(data); })
                .catch(() => { /* sin conexión: el chat queda vacío */ });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tarea?.id]);

    useEffect(() => {
        const c = document.getElementById('tarea-chat');
        if (c) c.scrollTop = c.scrollHeight;
    }, [comentarios.length]);

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
        setForm(prev => ({ ...prev, [k]: v }));
        if (errores[k]) setErrores(prev => { const n = { ...prev }; delete n[k]; return n; });
    };

    const nombreDe = (id: string) => operators.find(o => o.id === id)?.nombreCompleto
        || tarea?.involucrados.find(i => i.operatorId === id)?.operator.nombreCompleto
        || 'Usuario';

    const disponibles = useMemo(
        () => operators.filter(o => !involucrados.some(i => i.operatorId === o.id)),
        [operators, involucrados]
    );

    const agregarInvolucrado = (operatorId: string) => {
        if (!operatorId) return;
        setInvolucrados(prev => [...prev, { operatorId, rol: prev.some(i => i.rol === 'responsable') ? 'colaborador' : 'responsable' }]);
    };

    const validar = (): boolean => {
        const e: Record<string, string> = {};
        if (!form.titulo.trim()) e.titulo = 'Escribí qué hay que hacer';
        if (form.fechaInicio && form.fechaVencimiento && new Date(form.fechaInicio) > new Date(form.fechaVencimiento)) {
            e.fechaVencimiento = 'El vencimiento no puede ser anterior al inicio';
        }
        recordatorios.forEach((r, i) => {
            if (!r.fechaDisparo) e[`rec${i}`] = 'Elegí cuándo avisar';
            else if (new Date(r.fechaDisparo).getTime() < Date.now()) e[`rec${i}`] = 'La fecha ya pasó';
        });
        setErrores(e);
        if (e.fechaVencimiento || Object.keys(e).some(k => k.startsWith('rec'))) setMasOpciones(true);
        return Object.keys(e).length === 0;
    };

    const crearRecordatorios = async (tareaId: string, titulo: string): Promise<string[]> => {
        const fallidos: string[] = [];
        for (const rec of recordatorios) {
            try {
                const r = await safeApiRequest('/api/tareas/recordatorios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tareaId,
                        tipo: rec.tipo,
                        fechaDisparo: desdeDatetimeLocal(rec.fechaDisparo),
                        mensaje: rec.mensaje || titulo,
                    }),
                });
                if (!r.ok) {
                    const data = await r.json().catch(() => ({}));
                    fallidos.push(data.error || `error ${r.status}`);
                }
            } catch {
                fallidos.push('sin conexión');
            }
        }
        return fallidos;
    };

    const guardar = async () => {
        if (guardando || isViewMode || !validar()) return;
        setGuardando(true);
        try {
            const payload = {
                titulo: form.titulo.trim(),
                descripcion: form.descripcion.trim(),
                estado: form.estado,
                prioridad: form.prioridad,
                categoria: form.categoria.trim(),
                fechaInicio: desdeDatetimeLocal(form.fechaInicio),
                fechaVencimiento: desdeDatetimeLocal(form.fechaVencimiento),
                projectId: form.projectId,
                notas: form.notas.trim(),
                involucrados,
            };
            const res = await safeApiRequest('/api/tareas', {
                method: esNueva ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(esNueva ? payload : { id: tarea!.id, ...payload }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar');

            const fallidos = await crearRecordatorios(esNueva ? data.id : tarea!.id, payload.titulo);
            const msg = esNueva ? 'Tarea creada' : 'Tarea actualizada';
            if (fallidos.length === 0) showToast(msg, 'success');
            else showToast(`${msg}, pero ${fallidos.length === 1 ? 'un recordatorio no se programó' : `${fallidos.length} recordatorios no se programaron`}: ${fallidos[0]}`, 'error');

            await onSaved();
            onClose();
        } catch (e: any) {
            showToast(e?.message || 'Error al guardar', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const eliminarRecordatorio = async (id: string) => {
        try {
            const r = await safeApiRequest(`/api/tareas/recordatorios?id=${id}`, { method: 'DELETE' });
            if (!r.ok) throw new Error();
            setExistentes(prev => prev.filter(x => x.id !== id));
            showToast('Recordatorio eliminado', 'success');
            await onSaved();
        } catch {
            showToast('No se pudo eliminar el recordatorio', 'error');
        }
    };

    const enviarComentario = async () => {
        if (!comentario.trim() || !tarea) return;
        setComentando(true);
        try {
            const res = await safeApiRequest('/api/tareas/comentarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tareaId: tarea.id, mensaje: comentario.trim() }),
            });
            if (!res.ok) throw new Error();
            const nuevo = await res.json();
            setComentarios(prev => [...prev, nuevo]);
            setComentario('');
        } catch {
            showToast('No se pudo enviar el comentario', 'error');
        } finally {
            setComentando(false);
        }
    };

    const titulo = esNueva ? 'Nueva tarea' : isViewMode ? 'Detalle de la tarea' : 'Editar tarea';
    const ro = isViewMode;

    const footer = (
        <div className="flex items-center justify-between w-full gap-2">
            <div>
                {!esNueva && canEditFull && onDelete && (
                    <Button variant="danger-ghost" icon={<Trash2 />} onClick={onDelete}>
                        <span className="hidden sm:inline">Eliminar</span>
                    </Button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose}>{ro ? 'Cerrar' : 'Cancelar'}</Button>
                {ro ? (
                    canEditFull && <Button variant="primary" icon={<Edit3 />} onClick={() => setIsViewMode(false)}>Editar</Button>
                ) : (
                    <Button variant="primary" isLoading={guardando} onClick={guardar} title="Ctrl + Enter">
                        {esNueva ? 'Crear tarea' : 'Guardar cambios'}
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <Dialog open={open} onClose={onClose} title={titulo} size="lg" footer={footer} dismissible={!guardando}>
            <div
                className="space-y-5"
                onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardar(); }
                }}
            >
                {/* Título */}
                <Field label="Título" required error={errores.titulo} htmlFor="tarea-titulo">
                    <input
                        id="tarea-titulo"
                        data-autofocus={!ro || undefined}
                        value={form.titulo}
                        onChange={e => set('titulo', e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && esNueva && !e.ctrlKey && !e.metaKey) { e.preventDefault(); guardar(); }
                        }}
                        disabled={ro}
                        maxLength={200}
                        aria-invalid={!!errores.titulo}
                        placeholder="¿Qué hay que hacer?"
                        className="input font-semibold"
                    />
                </Field>

                {/* Prioridad + estado */}
                <div className="grid gap-4">
                    <PrioridadSlider value={form.prioridad} onChange={v => set('prioridad', v)} disabled={ro} />
                    {!esNueva && (
                        <Field label="Estado">
                            {ro ? (
                                <div><Badge tone={ESTADOS.find(e => e.value === columnaDeEstado(form.estado))?.tone} dot>{ESTADOS.find(e => e.value === columnaDeEstado(form.estado))?.label || form.estado}</Badge></div>
                            ) : (
                                <SegmentedControl
                                    label="Estado"
                                    value={columnaDeEstado(form.estado)}
                                    onChange={v => set('estado', v)}
                                    options={ESTADOS.map(e => ({ value: e.value, label: e.label }))}
                                    className="flex w-full sm:w-auto sm:inline-flex [&>button]:flex-1 [&>button]:justify-center [&>button]:whitespace-nowrap"
                                />
                            )}
                        </Field>
                    )}
                </div>

                {/* Vencimiento */}
                <Field label="Vence" error={errores.fechaVencimiento} htmlFor="tarea-vence">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {!ro && ATAJOS_VENCIMIENTO.map(a => {
                            const valor = aDatetimeLocal(fechaAtajo(a.id));
                            const activo = form.fechaVencimiento === valor;
                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    aria-pressed={activo}
                                    onClick={() => set('fechaVencimiento', activo ? '' : valor)}
                                    className={cn(
                                        'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
                                        activo
                                            ? 'bg-brand-50 text-brand-700 border-brand-300 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-700'
                                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                                    )}
                                >
                                    {a.label}
                                </button>
                            );
                        })}
                        <input
                            id="tarea-vence"
                            type="datetime-local"
                            value={form.fechaVencimiento}
                            onChange={e => set('fechaVencimiento', e.target.value)}
                            disabled={ro}
                            aria-invalid={!!errores.fechaVencimiento}
                            className="input h-8 py-0 text-sm w-auto min-w-[13rem]"
                        />
                        {!ro && form.fechaVencimiento && (
                            <Button variant="ghost" size="icon-sm" aria-label="Quitar vencimiento" onClick={() => set('fechaVencimiento', '')}>
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                        {ro && !form.fechaVencimiento && <span className="text-sm text-muted-foreground">Sin fecha</span>}
                    </div>
                </Field>

                {/* Involucrados */}
                <Field label="Involucrados" hint={!ro && involucrados.length === 0 ? 'El responsable puede editar la tarea; el colaborador solo cambia el estado.' : undefined}>
                    <div className="space-y-2">
                        {involucrados.length > 0 && (
                            <ul className="flex flex-wrap gap-2">
                                {involucrados.map((inv, i) => (
                                    <li key={inv.operatorId} className="flex items-center gap-1.5 h-9 pl-1 pr-1.5 rounded-full border border-border bg-card">
                                        <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-[11px] font-semibold flex items-center justify-center" aria-hidden="true">
                                            {iniciales(nombreDe(inv.operatorId))}
                                        </span>
                                        <span className="text-sm font-medium max-w-[10rem] truncate">{nombreDe(inv.operatorId)}</span>
                                        {ro ? (
                                            <span className="text-xs text-muted-foreground">· {ROLES_INVOLUCRADO.find(r => r.value === inv.rol)?.label}</span>
                                        ) : (
                                            <>
                                                <select
                                                    value={inv.rol}
                                                    onChange={e => setInvolucrados(prev => prev.map((x, idx) => idx === i ? { ...x, rol: e.target.value } : x))}
                                                    aria-label={`Rol de ${nombreDe(inv.operatorId)}`}
                                                    className="h-7 text-xs bg-transparent border-0 text-muted-foreground focus:text-foreground cursor-pointer pr-1"
                                                >
                                                    {ROLES_INVOLUCRADO.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setInvolucrados(prev => prev.filter((_, idx) => idx !== i))}
                                                    aria-label={`Quitar a ${nombreDe(inv.operatorId)}`}
                                                    className="p-1 rounded-full text-muted-foreground hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!ro && (
                            <select
                                value=""
                                onChange={e => agregarInvolucrado(e.target.value)}
                                aria-label="Agregar persona"
                                className="input sm:w-72"
                            >
                                <option value="">{involucrados.length ? '+ Agregar otra persona…' : '+ Asignar responsable…'}</option>
                                {currentUserId && disponibles.some(o => o.id === currentUserId) && (
                                    <option value={currentUserId}>Yo</option>
                                )}
                                {disponibles.filter(o => o.id !== currentUserId).map(o => (
                                    <option key={o.id} value={o.id}>{o.nombreCompleto}</option>
                                ))}
                            </select>
                        )}
                        {ro && involucrados.length === 0 && <p className="text-sm text-muted-foreground">Sin involucrados</p>}
                    </div>
                </Field>

                {/* Descripción */}
                <Field label="Descripción" htmlFor="tarea-desc">
                    <textarea
                        id="tarea-desc"
                        value={form.descripcion}
                        onChange={e => set('descripcion', e.target.value)}
                        disabled={ro}
                        rows={3}
                        placeholder={ro ? 'Sin descripción' : 'Detalles, alcance, materiales…'}
                        className="input min-h-[72px] resize-y"
                    />
                </Field>

                {/* Más opciones */}
                <div className="border-t border-border pt-3">
                    <button
                        type="button"
                        onClick={() => setMasOpciones(v => !v)}
                        aria-expanded={masOpciones}
                        className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                    >
                        <ChevronDown className={cn('w-4 h-4 transition-transform', !masOpciones && '-rotate-90')} />
                        Más opciones
                        <span className="text-xs font-normal">(inicio, proyecto, categoría, recordatorios, notas)</span>
                    </button>

                    {masOpciones && (
                        <div className="space-y-4 mt-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field label="Inicio" htmlFor="tarea-inicio">
                                    <input id="tarea-inicio" type="datetime-local" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} disabled={ro} className="input" />
                                </Field>
                                <Field label="Categoría" htmlFor="tarea-cat">
                                    <input id="tarea-cat" list="tarea-categorias" value={form.categoria} onChange={e => set('categoria', e.target.value)} disabled={ro} maxLength={60} placeholder="Ej.: Mantenimiento" className="input" />
                                    <datalist id="tarea-categorias">
                                        {categorias.map(c => <option key={c} value={c} />)}
                                    </datalist>
                                </Field>
                            </div>
                            <Field label="Proyecto" htmlFor="tarea-proyecto">
                                <select id="tarea-proyecto" value={form.projectId} onChange={e => set('projectId', e.target.value)} disabled={ro} className="input">
                                    <option value="">Sin proyecto</option>
                                    {tarea?.project && !projects.some(p => p.id === tarea.project!.id) && (
                                        <option value={tarea.project.id}>{tarea.project.codigoProyecto ? `${tarea.project.codigoProyecto} · ` : ''}{tarea.project.nombre}</option>
                                    )}
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.codigoProyecto ? `${p.codigoProyecto} · ` : ''}{p.nombre}</option>
                                    ))}
                                </select>
                            </Field>

                            {/* Recordatorios */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="field-label mb-0">Recordatorios</span>
                                    {!ro && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={<BellPlus />}
                                            onClick={() => setRecordatorios(prev => [...prev, { tipo: 'unico', fechaDisparo: '', mensaje: '' }])}
                                        >
                                            Agregar
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {existentes.map(rec => (
                                        <div key={rec.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {rec.disparado ? <Check className="w-4 h-4 text-success-600 shrink-0" /> : <Bell className="w-4 h-4 text-brand-600 shrink-0" />}
                                                <span className="font-medium">{TIPOS_RECORDATORIO.find(t => t.value === rec.tipo)?.label}</span>
                                                <span className="text-muted-foreground tabular-nums">{format(new Date(rec.fechaDisparo), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                                                {rec.disparado && <Badge tone="success">Enviado</Badge>}
                                            </div>
                                            {!ro && (
                                                <Button variant="ghost" size="icon-sm" aria-label="Eliminar recordatorio" onClick={() => eliminarRecordatorio(rec.id)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {recordatorios.map((rec, i) => (
                                        <div key={i} className="rounded-lg border border-border p-2.5 space-y-2">
                                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                                <select
                                                    value={rec.tipo}
                                                    onChange={e => setRecordatorios(prev => prev.map((r, idx) => idx === i ? { ...r, tipo: e.target.value } : r))}
                                                    aria-label="Frecuencia"
                                                    className="input sm:w-40"
                                                >
                                                    {TIPOS_RECORDATORIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                                <input
                                                    type="datetime-local"
                                                    value={rec.fechaDisparo}
                                                    onChange={e => {
                                                        setRecordatorios(prev => prev.map((r, idx) => idx === i ? { ...r, fechaDisparo: e.target.value } : r));
                                                        setErrores(prev => { const n = { ...prev }; delete n[`rec${i}`]; return n; });
                                                    }}
                                                    aria-label="Cuándo avisar"
                                                    aria-invalid={!!errores[`rec${i}`]}
                                                    className="input flex-1"
                                                />
                                                <Button variant="ghost" size="icon" aria-label="Quitar recordatorio" onClick={() => setRecordatorios(prev => prev.filter((_, idx) => idx !== i))}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            {errores[`rec${i}`] && <p className="field-error" role="alert">{errores[`rec${i}`]}</p>}
                                            <input
                                                value={rec.mensaje}
                                                onChange={e => setRecordatorios(prev => prev.map((r, idx) => idx === i ? { ...r, mensaje: e.target.value } : r))}
                                                placeholder="Mensaje (opcional; por defecto, el título)"
                                                aria-label="Mensaje del recordatorio"
                                                className="input"
                                            />
                                        </div>
                                    ))}
                                    {existentes.length === 0 && recordatorios.length === 0 && (
                                        <p className="text-sm text-muted-foreground">Sin recordatorios</p>
                                    )}
                                </div>
                            </div>

                            <Field label="Notas" htmlFor="tarea-notas">
                                <textarea id="tarea-notas" value={form.notas} onChange={e => set('notas', e.target.value)} disabled={ro} rows={2} placeholder={ro ? 'Sin notas' : 'Notas internas…'} className="input min-h-[60px] resize-y" />
                            </Field>
                        </div>
                    )}
                </div>

                {/* Chat */}
                {tarea && (
                    <div className="border-t border-border pt-4">
                        <span className="field-label">Comentarios</span>
                        <div id="tarea-chat" className="rounded-xl bg-surface-sunken p-3 h-56 overflow-y-auto flex flex-col gap-2.5 custom-scrollbar">
                            {comentarios.length === 0 ? (
                                <p className="m-auto text-sm text-muted-foreground">Todavía no hay comentarios</p>
                            ) : comentarios.map(c => {
                                const mio = c.operatorId === currentUserId;
                                return (
                                    <div key={c.id} className={cn('flex flex-col max-w-[85%]', mio ? 'self-end items-end' : 'self-start items-start')}>
                                        {!mio && <span className="text-xs text-muted-foreground ml-1 mb-0.5">{c.operator.nombreCompleto}</span>}
                                        <div className={cn('px-3 py-2 rounded-2xl text-sm', mio ? 'bg-primary text-white rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm')}>
                                            {c.mensaje}
                                        </div>
                                        <span className="text-[11px] text-muted-foreground mt-0.5 mx-1 tabular-nums">{format(new Date(c.createdAt), 'dd/MM HH:mm')}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <input
                                value={comentario}
                                onChange={e => setComentario(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); enviarComentario(); } }}
                                placeholder="Escribí un comentario…"
                                aria-label="Comentario"
                                className="input flex-1"
                            />
                            <Button variant="secondary" size="icon" aria-label="Enviar comentario" onClick={enviarComentario} disabled={comentando || !comentario.trim()}>
                                {comentando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
