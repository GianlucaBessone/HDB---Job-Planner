'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    BedDouble, Bus, Car, Check, Fuel, Hammer, Receipt, SquareParking, Ticket, Users, Utensils, Wallet, Globe2, UserRound,
} from 'lucide-react';
import { Button, Dialog, Field, Input, MoneyInput } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { CATEGORIAS_GASTO, hoyISO, type CategoriaGasto } from '@/lib/viajes';
import { apiJson, money, OpcionesGrandes } from './shared';
import { SubirComprobantes, type Comprobante } from './Comprobantes';

export const ICONO_CATEGORIA: Record<string, React.ReactNode> = {
    combustible: <Fuel />,
    peajes: <Ticket />,
    alojamiento: <BedDouble />,
    comidas: <Utensils />,
    transporte: <Bus />,
    movilidad: <Car />,
    estacionamiento: <SquareParking />,
    materiales: <Hammer />,
    otros: <Receipt />,
};

interface ViajeParaGasto {
    id: string;
    modalidadFondos: string;
    fechaInicio: string;
    fechaFin: string;
    participantes: { id: string; nombre: string }[];
    resumen?: { saldoFondos: number };
}

export interface GastoEditable {
    id: string;
    fecha: string;
    categoria: string;
    monto: number;
    descripcion: string | null;
    comercio: string | null;
    numeroComprobante: string | null;
    alcance: string;
    medioPago: string;
    afectados: { participanteId: string }[];
    comprobantes: Comprobante[];
}

function estadoInicial(viaje: ViajeParaGasto, gasto?: GastoEditable | null) {
    if (gasto) {
        return {
            fecha: gasto.fecha,
            categoria: gasto.categoria as CategoriaGasto,
            monto: String(gasto.monto),
            descripcion: gasto.descripcion || '',
            comercio: gasto.comercio || '',
            numeroComprobante: gasto.numeroComprobante || '',
            alcance: gasto.alcance as 'global' | 'individual',
            medioPago: gasto.medioPago as 'fondos' | 'propio',
            afectados: gasto.afectados.map(a => a.participanteId),
            comprobantes: gasto.comprobantes,
        };
    }
    const hoy = hoyISO();
    return {
        fecha: hoy,
        categoria: 'combustible' as CategoriaGasto,
        monto: '',
        descripcion: '',
        comercio: '',
        numeroComprobante: '',
        alcance: 'global' as 'global' | 'individual',
        medioPago: (viaje.modalidadFondos === 'rendicion' ? 'propio' : 'fondos') as 'fondos' | 'propio',
        afectados: [] as string[],
        comprobantes: [] as Comprobante[],
    };
}

export default function GastoFormDialog({
    open,
    onClose,
    viaje,
    gasto,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    viaje: ViajeParaGasto;
    gasto?: GastoEditable | null;
    onSaved: (viajeActualizado: any) => void;
}) {
    const [form, setForm] = useState(() => estadoInicial(viaje, gasto));
    const [guardando, setGuardando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm(estadoInicial(viaje, gasto));
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, gasto?.id]);

    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
    const montoNum = Number(form.monto) || 0;
    const esAnticipo = viaje.modalidadFondos === 'anticipo';
    const parte = form.alcance === 'individual' && form.afectados.length > 0 ? montoNum / form.afectados.length : 0;
    const fueraDeFechas = form.fecha && (form.fecha < viaje.fechaInicio || form.fecha > viaje.fechaFin);

    const saldoTrasGasto = useMemo(() => {
        if (!esAnticipo || form.medioPago !== 'fondos' || !viaje.resumen) return null;
        const previo = gasto && gasto.medioPago === 'fondos' ? gasto.monto : 0;
        return viaje.resumen.saldoFondos + previo - montoNum;
    }, [esAnticipo, form.medioPago, viaje.resumen, gasto, montoNum]);

    const toggleAfectado = (id: string) => {
        set('afectados', form.afectados.includes(id) ? form.afectados.filter(a => a !== id) : [...form.afectados, id]);
    };

    const guardar = async () => {
        setError(null);
        if (montoNum <= 0) return setError('Ingresá el monto del gasto.');
        if (!form.fecha) return setError('Indicá la fecha.');
        if (form.alcance === 'individual' && form.afectados.length === 0) return setError('Elegí a quiénes afecta el gasto.');

        setGuardando(true);
        try {
            const body = {
                fecha: form.fecha,
                categoria: form.categoria,
                monto: montoNum,
                descripcion: form.descripcion.trim() || null,
                comercio: form.comercio.trim() || null,
                numeroComprobante: form.numeroComprobante.trim() || null,
                alcance: form.alcance,
                medioPago: form.medioPago,
                afectados: form.alcance === 'individual' ? form.afectados : [],
                comprobantes: form.comprobantes.map(c => c.id),
            };
            const data = await apiJson(gasto ? `/api/viajes/${viaje.id}/gastos/${gasto.id}` : `/api/viajes/${viaje.id}/gastos`, {
                method: gasto ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
            });
            showToast(gasto ? 'Gasto actualizado' : 'Gasto registrado', 'success');
            onSaved(data);
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!guardando}
            size="md"
            title={gasto ? 'Editar gasto' : 'Registrar gasto'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button onClick={guardar} isLoading={guardando} disabled={subiendo} icon={<Check />}>
                        {subiendo ? 'Subiendo fotos…' : gasto ? 'Guardar cambios' : 'Guardar gasto'}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                {/* Monto */}
                <Field label="Monto" required htmlFor="gasto-monto">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400 pointer-events-none" aria-hidden="true">$</span>
                        <MoneyInput
                            id="gasto-monto"
                            data-autofocus
                            value={form.monto}
                            onValueChange={v => set('monto', v)}
                            className="input !h-12 !pl-8 !text-[1.375rem] font-semibold"
                            aria-required="true"
                        />
                    </div>
                </Field>

                {/* Categoría */}
                <div>
                    <span className="field-label" id="gasto-cat-label">Categoría</span>
                    <div role="radiogroup" aria-labelledby="gasto-cat-label" className="grid grid-cols-3 gap-2">
                        {CATEGORIAS_GASTO.map(c => {
                            const active = form.categoria === c.value;
                            return (
                                <button
                                    key={c.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => set('categoria', c.value)}
                                    className={cn(
                                        'flex flex-col items-center justify-center gap-1 min-h-[60px] px-1 py-2 rounded-lg border text-center transition-colors [&_svg]:w-5 [&_svg]:h-5',
                                        active
                                            ? 'border-primary bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100 dark:border-brand-400'
                                            : 'border-border bg-card text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                    )}
                                >
                                    {ICONO_CATEGORIA[c.value]}
                                    <span className="text-xs font-medium leading-tight">{c.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <Input
                    label="Fecha"
                    type="date"
                    value={form.fecha}
                    onChange={e => set('fecha', e.target.value)}
                    required
                    className="max-md:text-[16px]"
                    hint={fueraDeFechas ? 'La fecha queda fuera del período del viaje.' : undefined}
                />

                {/* Alcance */}
                <div>
                    <span className="field-label">¿A quién corresponde?</span>
                    <OpcionesGrandes
                        label="Alcance del gasto"
                        value={form.alcance}
                        onChange={v => set('alcance', v)}
                        options={[
                            { value: 'global', label: 'Global', hint: 'Todo el viaje', icon: <Globe2 /> },
                            { value: 'individual', label: 'Individual', hint: 'Personas puntuales', icon: <UserRound /> },
                        ]}
                    />
                    {form.alcance === 'individual' && (
                        <div className="mt-3 rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Users className="w-4 h-4" aria-hidden="true" /> Afecta a
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => set('afectados', form.afectados.length === viaje.participantes.length ? [] : viaje.participantes.map(p => p.id))}
                                >
                                    {form.afectados.length === viaje.participantes.length ? 'Ninguno' : 'Todos'}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {viaje.participantes.map(p => {
                                    const sel = form.afectados.includes(p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            role="checkbox"
                                            aria-checked={sel}
                                            onClick={() => toggleAfectado(p.id)}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full border text-[13px] transition-colors',
                                                sel
                                                    ? 'border-primary bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100'
                                                    : 'border-border bg-card text-slate-700 dark:text-slate-200'
                                            )}
                                        >
                                            {sel && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                                            {p.nombre}
                                        </button>
                                    );
                                })}
                            </div>
                            {parte > 0 && form.afectados.length > 1 && (
                                <p className="field-hint">{money(parte)} por persona</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Medio de pago */}
                <div>
                    <span className="field-label">¿Con qué se pagó?</span>
                    {esAnticipo ? (
                        <>
                            <OpcionesGrandes
                                label="Medio de pago"
                                value={form.medioPago}
                                onChange={v => set('medioPago', v)}
                                options={[
                                    { value: 'fondos', label: 'Fondos del viaje', hint: 'Anticipo entregado', icon: <Wallet /> },
                                    { value: 'propio', label: 'Medios propios', hint: 'Se te reintegra', icon: <UserRound /> },
                                ]}
                            />
                            {saldoTrasGasto != null && montoNum > 0 && (
                                <p className={cn('field-hint', saldoTrasGasto < 0 && '!text-danger-600 dark:!text-danger-300')}>
                                    {saldoTrasGasto < 0
                                        ? `Supera el saldo de fondos en ${money(-saldoTrasGasto)}. Si lo pagaste vos, marcá "Medios propios".`
                                        : `Saldo de fondos después de este gasto: ${money(saldoTrasGasto)}`}
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-[13px] text-slate-600 dark:text-slate-300 rounded-lg bg-surface-sunken border border-border px-3 py-2.5">
                            Viaje contra rendición: los gastos se pagan con medios propios y se reintegran al rendir.
                        </p>
                    )}
                </div>

                {/* Comprobantes */}
                <Field label="Foto del ticket" hint="Sacale una foto clara al comprobante. Podés adjuntar hasta 6.">
                    <SubirComprobantes value={form.comprobantes} onChange={v => set('comprobantes', v)} onUploadingChange={setSubiendo} disabled={guardando} />
                </Field>

                <Input
                    label="Detalle"
                    value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="Ej.: carga ida, cena del equipo"
                    maxLength={300}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Comercio" value={form.comercio} onChange={e => set('comercio', e.target.value)} placeholder="Ej.: YPF Ruta 9" maxLength={160} />
                    <Input label="N° de comprobante" value={form.numeroComprobante} onChange={e => set('numeroComprobante', e.target.value)} placeholder="Opcional" maxLength={60} inputMode="text" />
                </div>

                {error && <p role="alert" className="field-error !mt-0 rounded-lg bg-danger-50 dark:bg-danger-950 px-3 py-2">{error}</p>}
            </div>
        </Dialog>
    );
}
