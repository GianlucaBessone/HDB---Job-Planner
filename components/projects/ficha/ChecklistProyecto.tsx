'use client';

import { useState } from 'react';
import { CheckCircle2, MinusCircle, Plus, XCircle } from 'lucide-react';
import { Badge, Dialog, EmptyState, Panel, Textarea } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';

export interface ItemChecklist {
    id: string;
    tag: string;
    description: string;
    completed: boolean;
    excluded: boolean;
    confirmedBySupervisor: boolean;
    pendingChange: boolean;
    justification?: string | null;
}

/** Avance del checklist sin contar los ítems excluidos. */
export function avanceChecklist(items: ItemChecklist[]) {
    const activos = items.filter(i => !i.excluded);
    const hechos = activos.filter(i => i.completed).length;
    return { hechos, total: activos.length, porcentaje: activos.length ? Math.round((hechos / activos.length) * 100) : 0 };
}

/**
 * Checklist del proyecto. Quien gestiona proyectos marca y excluye ítems; el responsable
 * los marca y, si un supervisor ya confirmó el ítem, pide el cambio con una justificación.
 * Antes eran dos pantallas distintas (Proyectos y Mis proyectos) con reglas distintas.
 */
export default function ChecklistProyecto({
    projectId,
    items,
    setItems,
    gestiona,
    esResponsable,
    cargando,
}: {
    projectId: string;
    items: ItemChecklist[];
    setItems: (fn: (prev: ItemChecklist[]) => ItemChecklist[]) => void;
    gestiona: boolean;
    esResponsable: boolean;
    cargando: boolean;
}) {
    const [pedirCambio, setPedirCambio] = useState<ItemChecklist | null>(null);
    const puedeMarcar = gestiona || esResponsable;
    const visibles = gestiona ? items : items.filter(i => !i.excluded);
    const etiquetas = Array.from(new Set(visibles.map(i => i.tag)));
    const { hechos, total, porcentaje } = avanceChecklist(items);

    const actualizar = async (item: ItemChecklist, cambios: Partial<Pick<ItemChecklist, 'completed' | 'excluded'>>) => {
        try {
            const res = await safeApiRequest(`/api/projects/${projectId}/checklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, ...cambios }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return showToast(data?.error || 'No se pudo actualizar el ítem', 'error');
            setItems(prev => prev.map(i => (i.id === item.id ? { ...i, ...cambios } : i)));
        } catch {
            showToast('Error de conexión', 'error');
        }
    };

    const alMarcar = (item: ItemChecklist) => {
        if (!puedeMarcar) return;
        if (item.confirmedBySupervisor) {
            if (gestiona) return showToast('Un supervisor ya confirmó este ítem', 'info');
            if (item.pendingChange) return showToast('Ya pediste un cambio para este ítem', 'info');
            return setPedirCambio(item);
        }
        actualizar(item, { completed: !item.completed });
    };

    return (
        <Panel
            title="Checklist"
            description={total ? `${hechos} de ${total} ítems (${porcentaje}%)` : undefined}
        >
            {cargando ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Cargando checklist…</p>
            ) : visibles.length === 0 ? (
                <EmptyState title="Sin checklist" description="Las etiquetas del proyecto no tienen ítems de checklist asociados." />
            ) : (
                <div className="space-y-6">
                    {!puedeMarcar && (
                        <p className="text-sm text-muted-foreground">Solo el responsable del proyecto o quien gestiona proyectos puede marcar ítems.</p>
                    )}
                    {etiquetas.map(tag => (
                        <section key={tag} aria-label={tag} className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tag}</h3>
                            <ul className="grid gap-2">
                                {visibles.filter(i => i.tag === tag).map(item => (
                                    <li
                                        key={item.id}
                                        className={`flex items-center gap-3 rounded-xl border p-3 ${item.excluded ? 'border-dashed border-border opacity-60' : item.completed ? 'border-success-200 bg-success-50/50 dark:border-success-900 dark:bg-success-950/30' : 'border-border bg-card'}`}
                                    >
                                        {item.excluded ? (
                                            <MinusCircle className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        ) : (
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={item.completed}
                                                aria-label={item.description}
                                                disabled={!puedeMarcar}
                                                onClick={() => alMarcar(item)}
                                                className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${item.completed ? 'bg-success-600 border-success-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-card hover:border-brand-500'} disabled:cursor-not-allowed`}
                                            >
                                                {item.completed && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                                            </button>
                                        )}
                                        <span className={`flex-1 min-w-0 text-sm ${item.excluded ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.description}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {item.excluded && <Badge>Excluido</Badge>}
                                            {item.confirmedBySupervisor && <Badge tone="info">Confirmado</Badge>}
                                            {item.pendingChange && <Badge tone="warning">Cambio pedido</Badge>}
                                            {gestiona && (
                                                <button
                                                    type="button"
                                                    onClick={() => actualizar(item, { excluded: !item.excluded })}
                                                    className="btn btn-ghost btn-sm btn-icon"
                                                    aria-label={item.excluded ? `Incluir: ${item.description}` : `Excluir: ${item.description}`}
                                                    title={item.excluded ? 'Incluir en el proyecto' : 'Excluir del proyecto'}
                                                >
                                                    {item.excluded ? <Plus aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            {pedirCambio && (
                <PedirCambio
                    projectId={projectId}
                    item={pedirCambio}
                    onCerrar={() => setPedirCambio(null)}
                    onListo={(justification) => {
                        setItems(prev => prev.map(i => (i.id === pedirCambio.id ? { ...i, pendingChange: true, justification } : i)));
                        setPedirCambio(null);
                    }}
                />
            )}
        </Panel>
    );
}

function PedirCambio({ projectId, item, onCerrar, onListo }: { projectId: string; item: ItemChecklist; onCerrar: () => void; onListo: (j: string) => void }) {
    const [motivo, setMotivo] = useState('');
    const [enviando, setEnviando] = useState(false);

    const enviar = async () => {
        if (!motivo.trim()) return;
        setEnviando(true);
        try {
            const res = await safeApiRequest(`/api/projects/${projectId}/checklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, requestChange: true, justification: motivo }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                return showToast(data?.error || 'No se pudo enviar el pedido', 'error');
            }
            showToast('Pedido enviado al supervisor', 'success');
            onListo(motivo);
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onCerrar}
            dismissible={!enviando}
            title="Pedir un cambio"
            description="Un supervisor ya confirmó este ítem. Explicá por qué hay que cambiarlo."
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={enviando}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={enviar} disabled={!motivo.trim() || enviando}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
                </>
            }
        >
            <p className="text-sm font-medium text-foreground mb-3">{item.description}</p>
            <Textarea label="Motivo" rows={4} value={motivo} onChange={e => setMotivo(e.target.value)} required data-autofocus />
        </Dialog>
    );
}
