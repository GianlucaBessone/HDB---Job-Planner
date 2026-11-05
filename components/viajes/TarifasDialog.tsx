'use client';

import { useEffect, useState } from 'react';
import { Check, History } from 'lucide-react';
import { Badge, Button, Dialog, Input, LoadingState, MoneyInput } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { CONCEPTOS_TARIFA, formatFechaCorta, formatFechaHora, hoyISO, type ValoresTarifa } from '@/lib/viajes';
import { apiJson, money } from './shared';

export interface TarifaVigente {
    id: string | null;
    vigenciaDesde: string;
    valores: ValoresTarifa;
    creadoPorNombre: string | null;
    createdAt: string | null;
    guardada: boolean;
}

interface Respuesta { vigente: TarifaVigente; historial: (TarifaVigente & { id: string })[] }

/** Valores de referencia de viáticos: cada guardado crea una vigencia nueva. */
export default function TarifasDialog({
    open,
    onClose,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    onSaved?: (t: TarifaVigente) => void;
}) {
    const [data, setData] = useState<Respuesta | null>(null);
    const [valores, setValores] = useState<Record<string, string>>({});
    const [vigencia, setVigencia] = useState(hoyISO());
    const [guardando, setGuardando] = useState(false);
    const [verHistorial, setVerHistorial] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setVerHistorial(false);
        apiJson<Respuesta>('/api/viajes/tarifas')
            .then(r => {
                setData(r);
                setValores(Object.fromEntries(CONCEPTOS_TARIFA.map(c => [c.key, String(r.vigente.valores[c.key] ?? '')])));
                setVigencia(r.vigente.guardada ? hoyISO() : r.vigente.vigenciaDesde);
            })
            .catch(e => setError(e.message));
    }, [open]);

    const guardar = async () => {
        setError(null);
        if (CONCEPTOS_TARIFA.some(c => valores[c.key] === '' || Number(valores[c.key]) < 0)) {
            return setError('Completá todos los valores.');
        }
        setGuardando(true);
        try {
            const t = await apiJson<TarifaVigente>('/api/viajes/tarifas', {
                method: 'POST',
                body: JSON.stringify({
                    vigenciaDesde: vigencia,
                    valores: Object.fromEntries(CONCEPTOS_TARIFA.map(c => [c.key, Number(valores[c.key])])),
                }),
            });
            showToast(`Valores de referencia vigentes desde el ${formatFechaCorta(vigencia)}`, 'success');
            onSaved?.(t);
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
            size="lg"
            title="Valores de referencia – viáticos"
            description="Se usan para precalcular los costos estimados al crear un viaje. Los viajes ya creados conservan sus montos."
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button onClick={guardar} isLoading={guardando} disabled={!data} icon={<Check />}>
                        Guardar valores
                    </Button>
                </>
            }
        >
            {!data && !error ? (
                <LoadingState label="Cargando valores…" />
            ) : (
                <div className="space-y-4">
                    {data && (
                        <div className="flex flex-wrap items-end gap-3">
                            <Input
                                label="Vigencia desde"
                                type="date"
                                required
                                value={vigencia}
                                onChange={e => setVigencia(e.target.value)}
                                className="max-md:text-[16px] sm:w-[200px]"
                                hint="Actualizala cuando cambien los valores."
                            />
                            {!data.vigente.guardada ? (
                                <Badge tone="warning" className="mb-6">Valores iniciales sin guardar</Badge>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                                    Vigentes desde el {formatFechaCorta(data.vigente.vigenciaDesde)} · cargados por {data.vigente.creadoPorNombre}
                                </p>
                            )}
                        </div>
                    )}

                    {data && (
                        <div className="surface overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left">Concepto</th>
                                        <th className="text-left">Unidad</th>
                                        <th className="text-right w-[170px]">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {CONCEPTOS_TARIFA.map(c => {
                                        const modificado = Number(valores[c.key] || 0) !== Number(data.vigente.valores[c.key] || 0);
                                        return (
                                            <tr key={c.key}>
                                                <td className="font-medium text-slate-900 dark:text-slate-100">{c.label}</td>
                                                <td className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.unidad}</td>
                                                <td className="py-1.5">
                                                    <MoneyInput
                                                        aria-label={`${c.label} (${c.unidad})`}
                                                        value={valores[c.key]}
                                                        onValueChange={v => setValores(x => ({ ...x, [c.key]: v }))}
                                                        className={cn('input text-right', modificado && 'border-warning-400 dark:border-warning-600')}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {data && data.historial.length > 0 && (
                        <div>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVerHistorial(v => !v)} aria-expanded={verHistorial}>
                                <History /> {verHistorial ? 'Ocultar historial' : `Ver historial (${data.historial.length})`}
                            </button>
                            {verHistorial && (
                                <ul className="mt-2 divide-y divide-border border border-border rounded-lg">
                                    {data.historial.map(h => (
                                        <li key={h.id} className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                                            <span className="font-medium text-slate-900 dark:text-slate-100">Desde el {formatFechaCorta(h.vigenciaDesde)}</span>
                                            {h.id === data.vigente.id && <Badge tone="success" className="ml-2">Vigente</Badge>}
                                            {h.vigenciaDesde > hoyISO() && <Badge tone="info" className="ml-2">Programada</Badge>}
                                            <span className="block mt-0.5">
                                                {CONCEPTOS_TARIFA.map(c => `${c.label}: ${money(h.valores[c.key])}`).join(' · ')}
                                            </span>
                                            <span className="block text-slate-500 dark:text-slate-400 mt-0.5">{h.creadoPorNombre} · {formatFechaHora(h.createdAt)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {error && <p role="alert" className="field-error rounded-lg bg-danger-50 dark:bg-danger-950 px-3 py-2">{error}</p>}
                </div>
            )}
        </Dialog>
    );
}
