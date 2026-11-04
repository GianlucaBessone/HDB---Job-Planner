'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2, UserPlus, Wallet, HandCoins, X } from 'lucide-react';
import { Button, Dialog, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { showToast } from '@/components/Toast';
import {
    BASES_COSTO, CATEGORIAS_GASTO, diasViaje, nochesViaje, subtotalCosto, type BaseCosto, type CategoriaGasto, type ModalidadFondos,
} from '@/lib/viajes';
import { apiJson, money, OpcionesGrandes } from './shared';

interface Operador { id: string; nombreCompleto: string; activo?: boolean; role?: string }
interface Proyecto { id: string; nombre: string; codigoProyecto?: string | null; activo?: boolean }
interface ParticipanteForm { id?: string; operatorId?: string | null; nombre: string }
interface CostoForm { key: string; categoria: CategoriaGasto; base: BaseCosto; monto: string; descripcion: string }

export interface ViajeEditable {
    id: string;
    motivo: string;
    descripcion: string | null;
    origen: string;
    destino: string;
    fechaInicio: string;
    fechaFin: string;
    modalidadFondos: string;
    montoAnticipo: number;
    responsableId: string;
    projectId: string | null;
    estado: string;
    participantes: { id: string; nombre: string; operatorId: string | null }[];
    costos: { categoria: string; base: string; monto: number; descripcion: string | null }[];
}

let keySeq = 0;
const nuevaKey = () => `c${++keySeq}`;

const COSTOS_SUGERIDOS: Omit<CostoForm, 'key'>[] = [
    { categoria: 'combustible', base: 'total', monto: '', descripcion: '' },
    { categoria: 'alojamiento', base: 'por_persona_noche', monto: '', descripcion: '' },
    { categoria: 'comidas', base: 'por_persona_dia', monto: '', descripcion: '' },
];

function inicial(viaje?: ViajeEditable | null) {
    if (viaje) {
        return {
            motivo: viaje.motivo,
            descripcion: viaje.descripcion || '',
            origen: viaje.origen,
            destino: viaje.destino,
            fechaInicio: viaje.fechaInicio,
            fechaFin: viaje.fechaFin,
            modalidadFondos: viaje.modalidadFondos as ModalidadFondos,
            montoAnticipo: viaje.montoAnticipo ? String(viaje.montoAnticipo) : '',
            responsableId: viaje.responsableId,
            projectId: viaje.projectId || '',
            participantes: viaje.participantes.map(p => ({ id: p.id, operatorId: p.operatorId, nombre: p.nombre })) as ParticipanteForm[],
            costos: viaje.costos.map(c => ({ key: nuevaKey(), categoria: c.categoria as CategoriaGasto, base: c.base as BaseCosto, monto: String(c.monto), descripcion: c.descripcion || '' })),
        };
    }
    return {
        motivo: '',
        descripcion: '',
        origen: '',
        destino: '',
        fechaInicio: '',
        fechaFin: '',
        modalidadFondos: 'anticipo' as ModalidadFondos,
        montoAnticipo: '',
        responsableId: '',
        projectId: '',
        participantes: [] as ParticipanteForm[],
        costos: COSTOS_SUGERIDOS.map(c => ({ ...c, key: nuevaKey() })),
    };
}

export default function ViajeFormDialog({
    open,
    onClose,
    viaje,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    viaje?: ViajeEditable | null;
    onSaved: (v: any) => void;
}) {
    const [form, setForm] = useState(() => inicial(viaje));
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [agregarId, setAgregarId] = useState('');
    const [externo, setExterno] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setForm(inicial(viaje));
        setError(null);
        setAgregarId('');
        setExterno('');
        if (operadores.length === 0) {
            fetch('/api/operators').then(r => (r.ok ? r.json() : [])).then(d => setOperadores(Array.isArray(d) ? d : [])).catch(() => {});
        }
        if (proyectos.length === 0) {
            fetch('/api/projects').then(r => (r.ok ? r.json() : [])).then(d => setProyectos(Array.isArray(d) ? d : [])).catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, viaje?.id]);

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));

    const activos = useMemo(() => operadores.filter(o => o.activo !== false), [operadores]);
    const responsable = operadores.find(o => o.id === form.responsableId);

    // El responsable siempre figura como participante.
    const participantes = useMemo(() => {
        const lista = [...form.participantes];
        if (responsable && !lista.some(p => p.operatorId === responsable.id)) {
            lista.unshift({ operatorId: responsable.id, nombre: responsable.nombreCompleto });
        }
        return lista;
    }, [form.participantes, responsable]);

    const fechasOk = form.fechaInicio && form.fechaFin && form.fechaFin >= form.fechaInicio;
    const dias = fechasOk ? diasViaje(form.fechaInicio, form.fechaFin) : 0;
    const noches = fechasOk ? nochesViaje(form.fechaInicio, form.fechaFin) : 0;
    const personas = Math.max(1, participantes.length);

    const subtotales = form.costos.map(c => subtotalCosto({ categoria: c.categoria, base: c.base, monto: Number(c.monto) || 0 }, dias || 1, noches, personas));
    const estimado = subtotales.reduce((s, n) => s + n, 0);

    const agregarOperador = (id: string) => {
        const op = operadores.find(o => o.id === id);
        setAgregarId('');
        if (!op || participantes.some(p => p.operatorId === id)) return;
        set('participantes', [...form.participantes, { operatorId: op.id, nombre: op.nombreCompleto }]);
    };

    const agregarExterno = () => {
        const nombre = externo.trim();
        if (nombre.length < 2) return;
        set('participantes', [...form.participantes, { operatorId: null, nombre }]);
        setExterno('');
    };

    const quitar = (p: ParticipanteForm) => {
        set('participantes', form.participantes.filter(x => x !== p && !(p.operatorId && x.operatorId === p.operatorId)));
    };

    const setCosto = (key: string, patch: Partial<CostoForm>) => {
        set('costos', form.costos.map(c => (c.key === key ? { ...c, ...patch } : c)));
    };

    const guardar = async () => {
        setError(null);
        if (!form.motivo.trim() || !form.origen.trim() || !form.destino.trim()) return setError('Completá motivo, origen y destino.');
        if (!fechasOk) return setError('Revisá las fechas: el fin no puede ser anterior al inicio.');
        if (!form.responsableId) return setError('Elegí el responsable del viaje.');

        setGuardando(true);
        try {
            const body = {
                motivo: form.motivo,
                descripcion: form.descripcion || null,
                origen: form.origen,
                destino: form.destino,
                fechaInicio: form.fechaInicio,
                fechaFin: form.fechaFin,
                modalidadFondos: form.modalidadFondos,
                montoAnticipo: form.modalidadFondos === 'anticipo' ? Number(form.montoAnticipo) || 0 : 0,
                responsableId: form.responsableId,
                projectId: form.projectId || null,
                participantes,
                costos: form.costos
                    .filter(c => Number(c.monto) > 0)
                    .map(c => ({ categoria: c.categoria, base: c.base, monto: Number(c.monto), descripcion: c.descripcion || null })),
            };
            const data = await apiJson(viaje ? `/api/viajes/${viaje.id}` : '/api/viajes', {
                method: viaje ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
            });
            showToast(viaje ? 'Viaje actualizado' : `Viaje ${data.codigo} creado`, 'success');
            onSaved(data);
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };

    const opcionesOperadores = activos
        .filter(o => !participantes.some(p => p.operatorId === o.id))
        .map(o => ({ id: o.id, nombre: o.nombreCompleto, extra: o.role }));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!guardando}
            size="xl"
            title={viaje ? 'Editar viaje' : 'Nuevo viaje'}
            description={viaje ? undefined : 'Definí el recorrido, las personas, los fondos y el presupuesto estimado.'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button onClick={guardar} isLoading={guardando} icon={<Check />}>{viaje ? 'Guardar cambios' : 'Crear viaje'}</Button>
                </>
            }
        >
            <div className="space-y-6">
                {/* 1. Datos */}
                <section className="space-y-4">
                    <h3 className="eyebrow">Datos del viaje</h3>
                    <Input label="Motivo" required value={form.motivo} onChange={e => set('motivo', e.target.value)} placeholder="Ej.: Montaje tablero planta Rafaela" maxLength={200} data-autofocus />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label="Origen" required value={form.origen} onChange={e => set('origen', e.target.value)} placeholder="Ciudad de partida" maxLength={160} />
                        <Input label="Destino" required value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="Ciudad de destino" maxLength={160} />
                        <Input label="Fecha de inicio" type="date" required value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} className="max-md:text-[16px]" />
                        <Input
                            label="Fecha de fin"
                            type="date"
                            required
                            value={form.fechaFin}
                            min={form.fechaInicio || undefined}
                            onChange={e => set('fechaFin', e.target.value)}
                            className="max-md:text-[16px]"
                            error={form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio ? 'Es anterior al inicio.' : undefined}
                            hint={fechasOk ? `${dias} día${dias === 1 ? '' : 's'} · ${noches} noche${noches === 1 ? '' : 's'}` : undefined}
                        />
                    </div>
                    <Field label="Proyecto" hint="Opcional. Para imputar los viáticos a una obra.">
                        <SearchableSelect
                            options={proyectos.filter(p => p.activo !== false || p.id === form.projectId).map(p => ({ id: p.id, nombre: p.nombre, extra: p.codigoProyecto }))}
                            value={form.projectId}
                            onChange={v => set('projectId', v)}
                            placeholder="Sin proyecto"
                            searchPlaceholder="Buscar proyecto…"
                        />
                    </Field>
                    <Textarea label="Notas" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} maxLength={4000} placeholder="Indicaciones para el responsable (opcional)" />
                </section>

                {/* 2. Personas */}
                <section className="space-y-4">
                    <h3 className="eyebrow">Personas</h3>
                    <Field label="Responsable" required hint="Registra los gastos y concluye el viaje.">
                        <SearchableSelect
                            options={activos.map(o => ({ id: o.id, nombre: o.nombreCompleto, extra: o.role }))}
                            value={form.responsableId}
                            onChange={v => set('responsableId', v)}
                            placeholder="Elegir responsable"
                            searchPlaceholder="Buscar persona…"
                            allowClear={false}
                        />
                    </Field>
                    <div>
                        <span className="field-label">Participantes ({participantes.length})</span>
                        {participantes.length > 0 && (
                            <ul className="flex flex-wrap gap-2 mb-3">
                                {participantes.map((p, i) => {
                                    const esResp = !!responsable && p.operatorId === responsable.id;
                                    return (
                                        <li key={`${p.operatorId || p.nombre}-${i}`} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full border border-border bg-surface-sunken text-[13px] text-slate-800 dark:text-slate-100">
                                            {p.nombre}
                                            {esResp && <span className="text-xs text-slate-500 dark:text-slate-400">· responsable</span>}
                                            {!p.operatorId && <span className="text-xs text-slate-500 dark:text-slate-400">· externo</span>}
                                            {!esResp ? (
                                                <button type="button" onClick={() => quitar(p)} className="btn btn-ghost btn-icon btn-sm btn-icon-inline !w-6 !h-6 rounded-full" aria-label={`Quitar a ${p.nombre}`}>
                                                    <X />
                                                </button>
                                            ) : <span className="w-2" />}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <SearchableSelect
                                options={opcionesOperadores}
                                value={agregarId}
                                onChange={agregarOperador}
                                placeholder="Agregar persona del sistema"
                                searchPlaceholder="Buscar…"
                            />
                            <div className="flex gap-2">
                                <input
                                    className="input flex-1"
                                    value={externo}
                                    onChange={e => setExterno(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarExterno(); } }}
                                    placeholder="Externo (nombre)"
                                    aria-label="Nombre de participante externo"
                                    maxLength={120}
                                />
                                <Button variant="secondary" size="icon" onClick={agregarExterno} aria-label="Agregar externo" disabled={externo.trim().length < 2}>
                                    <UserPlus />
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Fondos */}
                <section className="space-y-4">
                    <h3 className="eyebrow">Entrega de dinero</h3>
                    <OpcionesGrandes
                        label="Modalidad de fondos"
                        value={form.modalidadFondos}
                        onChange={v => set('modalidadFondos', v)}
                        options={[
                            { value: 'anticipo', label: 'Anticipo (pre-viaje)', hint: 'Se entrega dinero antes de salir', icon: <Wallet /> },
                            { value: 'rendicion', label: 'Contra rendición', hint: 'Se reintegra al volver', icon: <HandCoins /> },
                        ]}
                    />
                    {form.modalidadFondos === 'anticipo' && (
                        <Field label="Monto del anticipo" htmlFor="viaje-anticipo" hint={estimado > 0 ? `Estimado del viaje: ${money(estimado)}` : undefined}>
                            <div className="flex gap-2">
                                <MoneyInput id="viaje-anticipo" value={form.montoAnticipo} onValueChange={v => set('montoAnticipo', v)} className="input flex-1" />
                                {estimado > 0 && (
                                    <Button variant="secondary" onClick={() => set('montoAnticipo', String(Math.round(estimado * 100) / 100))}>Igualar al estimado</Button>
                                )}
                            </div>
                        </Field>
                    )}
                </section>

                {/* 4. Costos */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="eyebrow">Costos estimados</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {dias || '—'} días · {noches} noches · {personas} persona{personas === 1 ? '' : 's'}
                        </span>
                    </div>
                    {form.costos.length === 0 && (
                        <p className="text-[13px] text-slate-500 dark:text-slate-400">Sin costos estimados. El consumo no se podrá comparar contra un presupuesto.</p>
                    )}
                    <ul className="space-y-2">
                        {form.costos.map((c, i) => (
                            <li key={c.key} className="grid grid-cols-2 sm:grid-cols-[minmax(150px,1fr)_minmax(180px,1.2fr)_minmax(130px,1fr)_auto] gap-2 items-start rounded-lg border border-border p-2 sm:p-0 sm:border-0">
                                <Select aria-label="Categoría" value={c.categoria} onChange={e => setCosto(c.key, { categoria: e.target.value as CategoriaGasto })}>
                                    {CATEGORIAS_GASTO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </Select>
                                <Select aria-label="Base de cálculo" value={c.base} onChange={e => setCosto(c.key, { base: e.target.value as BaseCosto })}>
                                    {BASES_COSTO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </Select>
                                <MoneyInput aria-label="Monto unitario" value={c.monto} onValueChange={v => setCosto(c.key, { monto: v })} className="input" />
                                <div className="flex items-center justify-end gap-1 sm:min-w-[150px]">
                                    <span className="text-[13px] tabular-nums text-slate-600 dark:text-slate-300 text-right flex-1">{money(subtotales[i])}</span>
                                    <Button variant="ghost" size="icon" onClick={() => set('costos', form.costos.filter(x => x.key !== c.key))} aria-label="Quitar costo">
                                        <Trash2 />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <Button
                            variant="tonal"
                            size="sm"
                            icon={<Plus />}
                            onClick={() => set('costos', [...form.costos, { key: nuevaKey(), categoria: 'otros', base: 'total', monto: '', descripcion: '' }])}
                        >
                            Agregar costo
                        </Button>
                        <p className="text-[13px] text-slate-600 dark:text-slate-300">
                            Total estimado <span className="ml-1 text-heading tabular-nums text-slate-900 dark:text-slate-50">{money(estimado)}</span>
                        </p>
                    </div>
                </section>

                {error && <p role="alert" className="field-error rounded-lg bg-danger-50 dark:bg-danger-950 px-3 py-2">{error}</p>}
            </div>
        </Dialog>
    );
}
