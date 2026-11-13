'use client';

import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, History, PencilRuler } from 'lucide-react';
import { Badge, Button, Dialog, Textarea } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { ALCANCE_LABEL, type Alcance } from '@/lib/pliegos';
import { apiJson, formatFechaHora, OrigenBadge } from './shared';

export interface MarcaTarea {
    id: string;
    alcance: string;
    modificacion: string | null;
    motivo: string | null;
    nombre: string;
    rol: string;
    createdAt: string;
}

export interface TareaPliego {
    id: string;
    orden: number;
    titulo: string;
    descripcion: string;
    origen: string;
    referencia: string | null;
    alcance: string | null;
    modificacion: string | null;
    motivo: string | null;
    marcadoPor: string | null;
    marcadoEn: string | null;
    marcas: MarcaTarea[];
}

export default function TareaItem({
    tarea,
    soloLectura,
    onCambio,
}: {
    tarea: TareaPliego;
    soloLectura: boolean;
    onCambio: (t: TareaPliego) => void;
}) {
    const [dialogo, setDialogo] = useState<Alcance | null>(null);
    const [modificacion, setModificacion] = useState('');
    const [motivo, setMotivo] = useState('');
    const [errores, setErrores] = useState<{ modificacion?: string; motivo?: string }>({});
    const [guardando, setGuardando] = useState(false);
    const [verHistorial, setVerHistorial] = useState(false);
    const [verDetalle, setVerDetalle] = useState(false);

    const guardar = async (alcance: Alcance, datos: { modificacion?: string; motivo?: string } = {}) => {
        setGuardando(true);
        try {
            const actualizada = await apiJson<TareaPliego>(`/api/pliegos/tareas/${tarea.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ alcance, ...datos }),
            });
            onCambio(actualizada);
            setDialogo(null);
            showToast(alcance === 'fuera' ? 'Tarea marcada fuera del pliego' : 'Tarea marcada dentro del pliego');
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setGuardando(false);
        }
    };

    const abrir = (alcance: Alcance) => {
        if (alcance === tarea.alcance && alcance === 'dentro') return;
        // Primera marca "dentro": un toque. Pasar de "fuera" a "dentro" pide motivo (opcional).
        if (alcance === 'dentro' && !tarea.alcance) { guardar('dentro'); return; }
        setModificacion(alcance === 'fuera' ? tarea.modificacion || '' : '');
        setMotivo('');
        setErrores({});
        setDialogo(alcance);
    };

    const confirmar = () => {
        if (dialogo === 'fuera') {
            const e: typeof errores = {};
            if (modificacion.trim().length < 3) e.modificacion = 'Indicá qué se modificó respecto del pliego.';
            if (motivo.trim().length < 3) e.motivo = 'Indicá por qué se modificó.';
            setErrores(e);
            if (e.modificacion || e.motivo) return;
            guardar('fuera', { modificacion: modificacion.trim(), motivo: motivo.trim() });
        } else if (dialogo === 'dentro') {
            guardar('dentro', { motivo: motivo.trim() || undefined });
        }
    };

    const fuera = tarea.alcance === 'fuera';
    const dentro = tarea.alcance === 'dentro';

    return (
        <li
            className={cn(
                'surface p-4 border-l-4 flex flex-col',
                fuera ? 'border-l-warning-500' : dentro ? 'border-l-success-500' : 'border-l-border',
            )}
        >
            <div className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-muted text-muted-foreground text-sm font-semibold inline-flex items-center justify-center tabular-nums" aria-hidden="true">
                    {tarea.orden}
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="text-heading text-foreground break-words">
                        <span className="sr-only">Tarea {tarea.orden}: </span>{tarea.titulo}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <OrigenBadge origen={tarea.origen} referencia={tarea.referencia} />
                        {tarea.alcance && (
                            <Badge tone={fuera ? 'warning' : 'success'} dot>{ALCANCE_LABEL[tarea.alcance as Alcance]}</Badge>
                        )}
                    </div>
                </div>
            </div>

            {tarea.descripcion && (
                <div className="mt-3">
                    <p className={cn('text-body text-muted-foreground whitespace-pre-line break-words', !verDetalle && 'line-clamp-4')}>
                        {tarea.descripcion}
                    </p>
                    {tarea.descripcion.length > 220 && (
                        <button type="button" className="btn btn-ghost btn-sm mt-1 -ml-2" onClick={() => setVerDetalle(v => !v)} aria-expanded={verDetalle}>
                            {verDetalle ? 'Ver menos' : 'Ver más'}
                        </button>
                    )}
                </div>
            )}

            {fuera && (
                <div className="mt-3 rounded-xl bg-warning-50 dark:bg-warning-950/40 p-3 text-body space-y-1.5">
                    <p><span className="font-medium text-foreground">Qué se modificó: </span><span className="text-muted-foreground whitespace-pre-line">{tarea.modificacion}</span></p>
                    {tarea.motivo && <p><span className="font-medium text-foreground">Por qué: </span><span className="text-muted-foreground whitespace-pre-line">{tarea.motivo}</span></p>}
                </div>
            )}

            {tarea.marcadoPor && tarea.marcadoEn && (
                <p className="text-xs text-muted-foreground mt-2">Marcó {tarea.marcadoPor} · {formatFechaHora(tarea.marcadoEn)}</p>
            )}

            {!soloLectura && (
                <div className="grid grid-cols-2 gap-2 mt-auto pt-4" role="group" aria-label={`Alcance de la tarea ${tarea.orden}`}>
                    <Button
                        size="lg"
                        variant={dentro ? 'primary' : 'secondary'}
                        className={cn('w-full min-h-[48px]', dentro && 'bg-success-600 hover:bg-success-700 border-success-600')}
                        icon={<CheckCircle2 />}
                        aria-pressed={dentro}
                        disabled={guardando}
                        isLoading={guardando && dialogo === null}
                        onClick={() => abrir('dentro')}
                    >
                        Dentro
                    </Button>
                    <Button
                        size="lg"
                        variant={fuera ? 'primary' : 'secondary'}
                        className={cn('w-full min-h-[48px]', fuera && 'bg-warning-600 hover:bg-warning-700 border-warning-600')}
                        icon={<PencilRuler />}
                        aria-pressed={fuera}
                        disabled={guardando}
                        onClick={() => abrir('fuera')}
                    >
                        Fuera
                    </Button>
                </div>
            )}

            {tarea.marcas.length > 0 && (
                <div className="mt-3">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm -ml-2"
                        onClick={() => setVerHistorial(v => !v)}
                        aria-expanded={verHistorial}
                    >
                        <History /> Historial ({tarea.marcas.length})
                        <ChevronDown className={cn('transition-transform', verHistorial && 'rotate-180')} />
                    </button>
                    {verHistorial && (
                        <ol className="mt-2 space-y-2 border-l-2 border-border pl-3">
                            {tarea.marcas.map(m => (
                                <li key={m.id} className="text-sm">
                                    <p className="text-foreground">
                                        <span className="font-medium">{ALCANCE_LABEL[m.alcance as Alcance] || m.alcance}</span>
                                        <span className="text-muted-foreground"> · {m.nombre} ({m.rol}) · {formatFechaHora(m.createdAt)}</span>
                                    </p>
                                    {m.modificacion && <p className="text-muted-foreground whitespace-pre-line">Modificación: {m.modificacion}</p>}
                                    {m.motivo && <p className="text-muted-foreground whitespace-pre-line">Motivo: {m.motivo}</p>}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}

            <Dialog
                open={dialogo !== null}
                onClose={() => setDialogo(null)}
                dismissible={!guardando}
                size="md"
                title={dialogo === 'fuera' ? 'Fuera del pliego' : 'Volver a "Dentro del pliego"'}
                description={tarea.titulo}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setDialogo(null)} disabled={guardando}>Cancelar</Button>
                        <Button onClick={confirmar} isLoading={guardando}>Guardar</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {dialogo === 'fuera' && (
                        <Textarea
                            label="Qué se modificó"
                            required
                            rows={3}
                            value={modificacion}
                            onChange={e => { setModificacion(e.target.value); setErrores(x => ({ ...x, modificacion: undefined })); }}
                            error={errores.modificacion}
                            placeholder="Ej.: se cambió el recorrido de la cañería por el lateral del depósito"
                            maxLength={2000}
                            autoFocus
                        />
                    )}
                    <Textarea
                        label={dialogo === 'fuera' ? 'Por qué' : 'Motivo (opcional)'}
                        required={dialogo === 'fuera'}
                        rows={3}
                        value={motivo}
                        onChange={e => { setMotivo(e.target.value); setErrores(x => ({ ...x, motivo: undefined })); }}
                        error={errores.motivo}
                        placeholder={dialogo === 'fuera' ? 'Ej.: el plano no coincide con la obra; lo pidió la inspección del cliente' : 'Ej.: se volvió a lo indicado en el pliego'}
                        maxLength={2000}
                        autoFocus={dialogo === 'dentro'}
                    />
                </div>
            </Dialog>
        </li>
    );
}
