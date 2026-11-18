'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Badge, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';
import { NIVELES_DOCUMENTO, normalizarOpcionesDocumento, type OpcionesDocumento, type NivelDocumento } from '@/lib/presupuestosServicio/calculos';
import { api } from './cliente';

interface Props {
    presupuestoId: string;
    version: number;
    opcionesIniciales: unknown;
    ivaDiscriminado: boolean;
    listaNombre: string | null;
    /** Guarda las opciones en la revisión (borrador o enviada, con permiso). */
    editable: boolean;
    /** Cambia cuando se guarda el contenido, para regenerar el PDF. */
    marca?: string;
    onOpciones?: (o: OpcionesDocumento) => void;
}

const CHECKS: { k: keyof Omit<OpcionesDocumento, 'nivel'>; label: string; hint?: string }[] = [
    { k: 'cantidades', label: 'Materiales con cantidades', hint: 'En Subtotales y Total, el listado sin precios' },
    { k: 'horas', label: 'Horas de mano de obra' },
    { k: 'tareas', label: 'Listado de tareas', hint: 'En Subtotales y Total, como alcance sin precios' },
    { k: 'plazo', label: 'Plazo de ejecución' },
    { k: 'condiciones', label: 'Condiciones y validez' },
];

/**
 * Vista previa en vivo: muestra el PDF que genera el servidor con las opciones elegidas,
 * así lo que se ve es exactamente lo que se descarga.
 */
export default function DocumentoPreview({ presupuestoId, version, opcionesIniciales, ivaDiscriminado, listaNombre, editable, marca, onOpciones }: Props) {
    const [opciones, setOpciones] = useState<OpcionesDocumento>(() => normalizarOpcionesDocumento(opcionesIniciales));
    const [url, setUrl] = useState('');
    const [cargando, setCargando] = useState(true);
    const [errorPdf, setErrorPdf] = useState<string | null>(null);
    const guardadoRef = useRef(JSON.stringify(normalizarOpcionesDocumento(opcionesIniciales)));

    useEffect(() => {
        const o = normalizarOpcionesDocumento(opcionesIniciales);
        setOpciones(o);
        guardadoRef.current = JSON.stringify(o);
    }, [opcionesIniciales]);

    const query = useMemo(() => {
        const p = new URLSearchParams({ version: String(version), nivel: String(opciones.nivel) });
        for (const c of CHECKS) p.set(c.k, opciones[c.k] ? '1' : '0');
        return p.toString();
    }, [opciones, version]);

    // Regenera el PDF un momento después del último cambio. Se pide como blob para
    // saber cuándo terminó y mostrar el error si el servidor no pudo generarlo.
    useEffect(() => {
        let cancelado = false;
        let blobUrl = '';
        const t = setTimeout(async () => {
            setCargando(true);
            setErrorPdf(null);
            try {
                const res = await fetch(`/api/presupuestos-servicio/${presupuestoId}/pdf?${query}&m=${encodeURIComponent(marca || '')}`, { cache: 'no-store' });
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d?.error || 'No se pudo generar la vista previa');
                }
                const blob = await res.blob();
                if (cancelado) return;
                blobUrl = URL.createObjectURL(blob);
                setUrl(`${blobUrl}#navpanes=0&view=FitH`);
            } catch (e: any) {
                if (!cancelado) setErrorPdf(e.message);
            } finally {
                if (!cancelado) setCargando(false);
            }
        }, 350);
        return () => {
            cancelado = true;
            clearTimeout(t);
            if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        };
    }, [presupuestoId, query, marca]);

    // Guarda las opciones en la revisión para que el PDF enviado salga siempre igual.
    useEffect(() => {
        onOpciones?.(opciones);
        if (!editable) return;
        const s = JSON.stringify(opciones);
        if (s === guardadoRef.current) return;
        const t = setTimeout(async () => {
            try {
                await api(`/api/presupuestos-servicio/${presupuestoId}/documento`, { method: 'PUT', json: opciones });
                guardadoRef.current = s;
            } catch {
                /* se reintenta con el próximo cambio */
            }
        }, 800);
        return () => clearTimeout(t);
    }, [opciones, editable, presupuestoId, onOpciones]);

    const nivel = NIVELES_DOCUMENTO.find((n) => n.nivel === opciones.nivel)!;
    const descargar = `/api/presupuestos-servicio/${presupuestoId}/pdf?${query}&download=true`;

    return (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
            <Panel className="w-full lg:w-80 shrink-0" title="Opciones del documento">
                <div className="space-y-5">
                    <div className="space-y-2">
                        <span className="eyebrow">Nivel de detalle</span>
                        <label htmlFor="nivel-detalle" className="block text-[15px] font-semibold">{nivel.nombre}</label>
                        <input
                            id="nivel-detalle"
                            type="range"
                            min={1}
                            max={4}
                            step={1}
                            value={opciones.nivel}
                            onChange={(e) => setOpciones((o) => ({ ...o, nivel: Number(e.target.value) as NivelDocumento }))}
                            className="w-full accent-[rgb(var(--primary))]"
                            aria-valuetext={nivel.nombre}
                        />
                        <div className="grid grid-cols-4 gap-1 text-center">
                            {NIVELES_DOCUMENTO.map((n) => (
                                <button
                                    key={n.nivel}
                                    type="button"
                                    onClick={() => setOpciones((o) => ({ ...o, nivel: n.nivel }))}
                                    className={cn('text-xs py-1 rounded btn-icon-inline', n.nivel === opciones.nivel ? 'text-primary font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100')}
                                    aria-pressed={n.nivel === opciones.nivel}
                                >
                                    {n.nombre}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{nivel.descripcion}</p>
                    </div>
                    <fieldset className="border-t border-border pt-4 space-y-2">
                        <legend className="eyebrow mb-1">Mostrar en el documento</legend>
                        {CHECKS.map((c) => (
                            <label key={c.k} className="flex gap-2 items-start cursor-pointer text-sm">
                                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[rgb(var(--primary))]" checked={opciones[c.k]} onChange={(e) => setOpciones((o) => ({ ...o, [c.k]: e.target.checked }))} />
                                <span>{c.label}{c.hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{c.hint}</span>}</span>
                            </label>
                        ))}
                    </fieldset>
                    <div className="border-t border-border pt-4 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="eyebrow">IVA</span>
                            <Badge tone="neutral">{ivaDiscriminado ? 'Discriminado' : 'Incluido'}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Lo define la lista {listaNombre || 'de precios'} (Ventas y Comercial).</p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-border pt-4">
                        {editable ? 'Las opciones se guardan con la revisión: el PDF sale siempre igual.' : 'Vista previa: estas opciones no se guardan en una revisión aceptada.'}
                    </p>
                    <a className="btn btn-secondary w-full justify-center" href={descargar}><Download /> Descargar PDF</a>
                </div>
            </Panel>
            <div className="flex-1 min-w-0 w-full rounded-2xl border border-border bg-slate-100 dark:bg-slate-800/50 p-2 sm:p-4 relative">
                {cargando && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-md"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando vista previa…</span>
                    </div>
                )}
                {errorPdf ? (
                    <p className="text-sm text-danger-700 dark:text-danger-300 p-6" role="alert">{errorPdf}</p>
                ) : url ? (
                    <iframe key={url} src={url} title="Vista previa del presupuesto" className="w-full h-[78vh] min-h-[520px] rounded-lg bg-white" />
                ) : (
                    <div className="h-[78vh] min-h-[520px]" />
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 sm:hidden">Si tu celular no muestra el PDF, usá “Descargar PDF”.</p>
            </div>
        </div>
    );
}
