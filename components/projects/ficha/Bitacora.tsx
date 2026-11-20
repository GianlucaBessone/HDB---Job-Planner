'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Send, Trash2 } from 'lucide-react';
import { Badge, EmptyState, Field, Input, Panel, Select, SegmentedControl, Textarea } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatDate } from '@/lib/formatDate';
import { AREAS_DEMORA_POR_DEFECTO, TIPOS_ENTRADA, type EntradaBitacora, type TipoEntrada } from '@/lib/bitacora';

const TONO: Record<TipoEntrada, BadgeTone> = {
    Nota: 'info',
    Reporte: 'success',
    Consulta: 'brand',
    Bloqueante: 'danger',
    Demora: 'warning',
};

const ETIQUETA: Record<TipoEntrada, string> = Object.fromEntries(TIPOS_ENTRADA.map(t => [t.id, t.label])) as Record<TipoEntrada, string>;

type Filtro = 'todas' | 'Bloqueante' | 'Demora';

const hoy = () => new Date().toISOString().slice(0, 10);
const ahora = () => new Date().toTimeString().slice(0, 5);

/**
 * Bitácora del proyecto: notas, reportes, consultas, bloqueantes y demoras del cliente
 * en una sola línea de tiempo (auditoría, FU10 y P28). Antes las demoras se cargaban en
 * otra pantalla y los bloqueantes se veían en una pestaña llamada "Riesgos".
 */
export default function Bitacora({
    proyecto,
    entradas,
    cargando,
    onRecargar,
    puedeBorrarEntradas,
    puedeBorrarDemoras,
}: {
    proyecto: { id: string; nombre: string };
    entradas: EntradaBitacora[];
    cargando: boolean;
    onRecargar: () => void;
    puedeBorrarEntradas: boolean;
    puedeBorrarDemoras: boolean;
}) {
    const [filtro, setFiltro] = useState<Filtro>('todas');
    const [aBorrar, setABorrar] = useState<EntradaBitacora | null>(null);

    const visibles = useMemo(
        () => (filtro === 'todas' ? entradas : entradas.filter(e => e.tipo === filtro)),
        [entradas, filtro]
    );

    const borrar = async () => {
        if (!aBorrar) return;
        const url = aBorrar.origen === 'demora'
            ? `/api/delays?id=${aBorrar.id}`
            : `/api/projects/${proyecto.id}/logs?logId=${aBorrar.id}`;
        try {
            const res = await safeApiRequest(url, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                showToast(data?.error || 'No se pudo eliminar la entrada', 'error');
                return;
            }
            showToast('Entrada eliminada', 'success');
            onRecargar();
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setABorrar(null);
        }
    };

    const cantidad = (t: TipoEntrada) => entradas.filter(e => e.tipo === t).length;

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <NuevaEntrada proyecto={proyecto} onGuardada={onRecargar} />

            <Panel
                title="Historial"
                description={`${entradas.length} ${entradas.length === 1 ? 'entrada' : 'entradas'}`}
                actions={
                    <SegmentedControl<Filtro>
                        label="Filtrar la bitácora"
                        value={filtro}
                        onChange={setFiltro}
                        options={[
                            { value: 'todas', label: 'Todas' },
                            { value: 'Bloqueante', label: `Bloqueantes (${cantidad('Bloqueante')})` },
                            { value: 'Demora', label: `Demoras (${cantidad('Demora')})` },
                        ]}
                    />
                }
            >
                {cargando ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Cargando bitácora…</p>
                ) : visibles.length === 0 ? (
                    <EmptyState
                        title={filtro === 'todas' ? 'Sin entradas' : 'Nada para mostrar'}
                        description={filtro === 'todas' ? 'Registrá avances, consultas, bloqueantes y demoras del cliente.' : 'No hay entradas de este tipo.'}
                    />
                ) : (
                    <ol className="space-y-3 max-h-[640px] overflow-y-auto pr-1" aria-label="Entradas de la bitácora">
                        {visibles.map(e => {
                            const puedeBorrar = e.origen === 'demora' ? puedeBorrarDemoras : puedeBorrarEntradas;
                            return (
                                <li
                                    key={`${e.origen}-${e.id}`}
                                    className={`rounded-xl border p-3 space-y-1.5 ${e.tipo === 'Bloqueante' ? 'border-danger-200 bg-danger-50/60 dark:border-danger-900 dark:bg-danger-950/40' : 'border-border bg-card'}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge tone={TONO[e.tipo]}>{ETIQUETA[e.tipo]}</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDate(e.fecha)}{e.demora ? ` · ${e.demora.hora}` : ''} · {e.autor}
                                            </span>
                                        </div>
                                        {puedeBorrar && (
                                            <button
                                                type="button"
                                                onClick={() => setABorrar(e)}
                                                className="btn btn-ghost btn-sm btn-icon"
                                                aria-label="Eliminar entrada"
                                                title="Eliminar entrada"
                                            >
                                                <Trash2 aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                    {e.demora && (
                                        <p className="text-xs font-medium text-foreground">
                                            {e.demora.area}{e.demora.responsableArea ? ` (${e.demora.responsableArea})` : ''} · {e.demora.duracion} h perdidas
                                        </p>
                                    )}
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{e.texto}</p>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </Panel>

            <ConfirmDialog
                isOpen={!!aBorrar}
                title="Eliminar entrada"
                message={aBorrar?.origen === 'demora' ? 'Se elimina la demora y deja de contar en los indicadores.' : 'Se elimina la entrada de la bitácora.'}
                onConfirm={borrar}
                onCancel={() => setABorrar(null)}
            />
        </div>
    );
}

function NuevaEntrada({ proyecto, onGuardada }: { proyecto: { id: string; nombre: string }; onGuardada: () => void }) {
    const [tipo, setTipo] = useState<TipoEntrada>('Nota');
    const [fecha, setFecha] = useState(hoy());
    const [texto, setTexto] = useState('');
    const [hora, setHora] = useState(ahora());
    const [area, setArea] = useState('');
    const [responsableArea, setResponsableArea] = useState('');
    const [duracion, setDuracion] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [areas, setAreas] = useState<string[]>(AREAS_DEMORA_POR_DEFECTO);
    const [motivos, setMotivos] = useState<string[]>([]);

    // Áreas y motivos configurados en Ajustes (si no hay, las áreas por defecto)
    useEffect(() => {
        safeApiRequest('/api/config/options')
            .then(r => r.json())
            .then((opciones: { category: string; value: string; active: boolean }[]) => {
                if (!Array.isArray(opciones)) return;
                const de = (cat: string) => opciones.filter(o => o.category === cat && o.active).map(o => o.value);
                if (de('AREA_DEMORA').length) setAreas(de('AREA_DEMORA'));
                setMotivos(de('MOTIVO_DEMORA'));
            })
            .catch(() => undefined);
    }, []);

    const esDemora = tipo === 'Demora';
    const horas = Number(duracion.replace(',', '.'));
    const valido = texto.trim().length > 0 && (!esDemora || (area && horas > 0));

    const limpiar = () => {
        setTexto('');
        setDuracion('');
        setResponsableArea('');
        setTipo('Nota');
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valido || guardando) return;
        setGuardando(true);
        try {
            const res = esDemora
                ? await safeApiRequest('/api/delays', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: proyecto.id, fecha, hora, area, responsableArea: responsableArea || null, motivo: texto, duracion: horas }),
                })
                : await safeApiRequest(`/api/projects/${proyecto.id}/logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha, observacion: texto, categoria: tipo }),
                });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                showToast(data?.error || 'No se pudo guardar la entrada', 'error');
                return;
            }

            if (tipo === 'Bloqueante') {
                // El bloqueante avisa a supervisores, administradores y QA
                const aviso = await safeApiRequest('/api/activities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        forSupervisors: true,
                        title: `Bloqueante en el proyecto ${proyecto.nombre}`,
                        message: `Proyecto: ${proyecto.nombre}\n${texto}`,
                        type: 'BLOCKER_COMMENT',
                        priority: 'HIGH',
                        category: 'Projects',
                        entityType: 'project',
                        entityId: proyecto.id,
                    }),
                }).catch(() => null);
                showToast(aviso?.ok ? 'Bloqueante registrado; se avisó a los supervisores' : 'Se guardó, pero no se pudo avisar a los supervisores', aviso?.ok ? 'success' : 'error');
            } else {
                showToast(esDemora ? 'Demora registrada' : 'Entrada registrada', 'success');
            }
            limpiar();
            onGuardada();
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const ayuda = TIPOS_ENTRADA.find(t => t.id === tipo)?.ayuda;

    return (
        <Panel title="Nueva entrada">
            <form onSubmit={guardar} className="space-y-4">
                <Field label="Tipo" hint={ayuda}>
                    <div role="radiogroup" aria-label="Tipo de entrada" className="flex flex-wrap gap-2">
                        {TIPOS_ENTRADA.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                role="radio"
                                aria-checked={tipo === t.id}
                                onClick={() => setTipo(t.id)}
                                className={`btn btn-sm ${tipo === t.id ? (t.id === 'Bloqueante' ? 'btn-danger' : 'btn-primary') : 'btn-secondary'}`}
                            >
                                {t.id === 'Bloqueante' && <AlertOctagon aria-hidden="true" />}
                                {t.label}
                            </button>
                        ))}
                    </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Input label="Fecha" type="date" value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)} required />
                    {esDemora && <Input label="Hora" type="time" value={hora} onChange={e => setHora(e.target.value)} required />}
                </div>

                {esDemora && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <Select label="Área del cliente" value={area} onChange={e => setArea(e.target.value)} required>
                                <option value="">Elegí un área</option>
                                {areas.map(a => <option key={a} value={a}>{a}</option>)}
                            </Select>
                            <Input
                                label="Horas perdidas"
                                inputMode="decimal"
                                value={duracion}
                                onChange={e => setDuracion(e.target.value)}
                                placeholder="1,5"
                                required
                            />
                        </div>
                        <Input label="Responsable del área" value={responsableArea} onChange={e => setResponsableArea(e.target.value)} placeholder="Opcional" />
                    </>
                )}

                <Textarea
                    label={esDemora ? 'Motivo' : 'Texto'}
                    rows={4}
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    placeholder={esDemora ? 'Qué pasó y por qué no se pudo trabajar' : 'Escribí el avance, la consulta o el problema'}
                    required
                />
                {esDemora && motivos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Motivos frecuentes">
                        {motivos.map(m => (
                            <button key={m} type="button" className="btn btn-ghost btn-sm" onClick={() => setTexto(m)}>{m}</button>
                        ))}
                    </div>
                )}

                <button type="submit" disabled={!valido || guardando} className={`btn w-full ${tipo === 'Bloqueante' ? 'btn-danger' : 'btn-primary'}`}>
                    <Send aria-hidden="true" />
                    {guardando ? 'Guardando…' : esDemora ? 'Registrar demora' : 'Registrar entrada'}
                </button>
            </form>
        </Panel>
    );
}
