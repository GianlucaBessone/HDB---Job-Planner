'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calculator, ChevronRight } from 'lucide-react';
import { Badge, Button, Dialog, Field, Input, Panel } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { showToast } from '@/components/Toast';
import { api } from '@/components/presupuestosServicio/cliente';

interface Previa {
    analizado: boolean;
    version: number | null;
    cliente: { id: string; nombre: string } | null;
    tareas: { dentro: number; sinMarcar: number; fuera: number };
    materiales: { delPliego: number; sugeridos: number };
    presupuestos: { id: string; numero: string; estado: string; titulo: string; createdAt: string }[];
    puedeCrear: boolean;
}

/** "1 tarea" / "3 tareas". */
const n = (c: number, uno: string, varios: string) => `${c} ${c === 1 ? uno : varios}`;

const ESTADO: Record<string, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
    borrador: { label: 'Borrador', tone: 'neutral' },
    enviado: { label: 'Enviado', tone: 'info' },
    aceptado: { label: 'Aceptado', tone: 'success' },
    rechazado: { label: 'Rechazado', tone: 'danger' },
    vencido: { label: 'Vencido', tone: 'warning' },
};

/**
 * Pliego → presupuesto (auditoría, P36): arma un presupuesto de servicio en borrador con las tareas dentro del
 * pliego y sus materiales, y lista los presupuestos ya armados desde este pliego.
 */
export default function PresupuestoDesdePliego({ pliegoId, titulo, version }: { pliegoId: string; titulo: string; version: number }) {
    const router = useRouter();
    const [previa, setPrevia] = useState<Previa | null>(null);
    const [abierto, setAbierto] = useState(false);

    const cargar = useCallback(() => {
        api<Previa>(`/api/pliegos/${pliegoId}/presupuesto`)
            .then(setPrevia)
            .catch(() => setPrevia(null));
    }, [pliegoId]);
    // El análisis vigente cambia al re-analizar o al marcar tareas: se vuelve a pedir
    useEffect(cargar, [cargar, version]);

    if (!previa || !previa.analizado) return null;
    if (!previa.puedeCrear && previa.presupuestos.length === 0) return null;

    return (
        <>
            <Panel
                className="mb-4"
                title="Presupuesto"
                description={
                    previa.presupuestos.length
                        ? 'Presupuestos de servicio armados desde este pliego'
                        : 'Armá el presupuesto de servicio con las tareas dentro del pliego y sus materiales'
                }
                padded={previa.presupuestos.length === 0}
                actions={
                    previa.puedeCrear && (
                        <Button size="sm" icon={<Calculator />} onClick={() => setAbierto(true)}>
                            {previa.presupuestos.length ? 'Armar otro' : 'Armar presupuesto'}
                        </Button>
                    )
                }
            >
                {previa.presupuestos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Se cargarían {n(previa.tareas.dentro, 'tarea', 'tareas')} dentro del pliego
                        {previa.tareas.sinMarcar ? ` y ${previa.tareas.sinMarcar} sin marcar` : ''}, y {n(previa.materiales.delPliego, 'material', 'materiales')}.
                        {previa.tareas.fuera > 0 && ` ${previa.tareas.fuera === 1 ? 'La tarea fuera del pliego no se carga' : `Las ${previa.tareas.fuera} tareas fuera del pliego no se cargan`}.`}
                    </p>
                ) : (
                    <ul className="divide-y divide-border">
                        {previa.presupuestos.map((p) => {
                            const e = ESTADO[p.estado] || { label: p.estado, tone: 'neutral' as const };
                            return (
                                <li key={p.id}>
                                    <Link href={`/presupuestos-servicio/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken transition-colors">
                                        <span className="min-w-0 flex-1 text-sm">
                                            <span className="font-medium text-foreground">{p.numero}</span> · {p.titulo}
                                            <span className="block text-xs text-muted-foreground">Armado el {new Date(p.createdAt).toLocaleDateString('es-AR')}</span>
                                        </span>
                                        <Badge tone={e.tone}>{e.label}</Badge>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Panel>
            {abierto && (
                <ArmarDialog
                    pliegoId={pliegoId}
                    tituloPliego={titulo}
                    previa={previa}
                    onClose={() => setAbierto(false)}
                    onCreado={(id) => router.push(`/presupuestos-servicio/${id}`)}
                />
            )}
        </>
    );
}

function ArmarDialog({ pliegoId, tituloPliego, previa, onClose, onCreado }: { pliegoId: string; tituloPliego: string; previa: Previa; onClose: () => void; onCreado: (id: string) => void }) {
    const [titulo, setTitulo] = useState(tituloPliego);
    const [clienteId, setClienteId] = useState(previa.cliente?.id ?? '');
    const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
    const [sinMarcar, setSinMarcar] = useState(true);
    const [sugeridos, setSugeridos] = useState(false);
    const [creando, setCreando] = useState(false);

    useEffect(() => {
        if (previa.cliente) return;
        api<{ id: string; nombre: string; activo?: boolean }[]>('/api/clients')
            .then((l) => setClientes(l.filter((c) => c.activo !== false)))
            .catch(() => setClientes([]));
    }, [previa.cliente]);

    const tareas = previa.tareas.dentro + (sinMarcar ? previa.tareas.sinMarcar : 0);
    const materiales = previa.materiales.delPliego + (sugeridos ? previa.materiales.sugeridos : 0);

    const crear = async () => {
        if (!clienteId) return showToast('Elegí el cliente', 'error');
        setCreando(true);
        try {
            const r = await api<{ id: string; numero: string }>(`/api/pliegos/${pliegoId}/presupuesto`, {
                method: 'POST',
                json: { clienteId, titulo: titulo.trim(), incluirSinMarcar: sinMarcar, incluirSugeridos: sugeridos },
            });
            showToast(`Presupuesto ${r.numero} armado: completá mano de obra y precios`);
            onCreado(r.id);
        } catch (e: any) {
            showToast(e.message || 'No se pudo armar el presupuesto', 'error');
            setCreando(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            dismissible={!creando}
            size="md"
            title="Armar presupuesto desde el pliego"
            description={`Análisis v${previa.version}. Queda en borrador: la mano de obra y los precios se completan en el editor.`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={creando}>
                        Cancelar
                    </Button>
                    <Button icon={<Calculator />} onClick={crear} isLoading={creando} disabled={tareas === 0 && materiales === 0}>
                        Armar presupuesto
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
                {previa.cliente ? (
                    <p className="text-sm">
                        Cliente: <strong>{previa.cliente.nombre}</strong>
                    </p>
                ) : (
                    <Field label="Cliente" required hint="El pliego no tiene cliente asignado">
                        <SearchableSelect options={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} value={clienteId} onChange={setClienteId} placeholder="Elegí el cliente…" allowClear={false} />
                    </Field>
                )}
                <fieldset className="space-y-2">
                    <legend className="field-label">Qué se carga</legend>
                    <p className="text-sm text-foreground">
                        {n(previa.tareas.dentro, 'tarea', 'tareas')} dentro del pliego y {n(previa.materiales.delPliego, 'material', 'materiales')} del pliego.
                        {previa.tareas.fuera > 0 && ` ${previa.tareas.fuera === 1 ? 'La tarea fuera del pliego no se carga' : `Las ${previa.tareas.fuera} tareas fuera del pliego no se cargan`}.`}
                    </p>
                    {previa.tareas.sinMarcar > 0 && (
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={sinMarcar} onChange={(e) => setSinMarcar(e.target.checked)} />
                            {previa.tareas.sinMarcar === 1 ? 'Incluir la tarea todavía sin marcar' : `Incluir las ${previa.tareas.sinMarcar} tareas todavía sin marcar`}
                        </label>
                    )}
                    {previa.materiales.sugeridos > 0 && (
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={sugeridos} onChange={(e) => setSugeridos(e.target.checked)} />
                            {previa.materiales.sugeridos === 1 ? 'Incluir el material sugerido por la IA' : `Incluir los ${previa.materiales.sugeridos} materiales sugeridos por la IA`}
                        </label>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Total: {n(tareas, 'tarea', 'tareas')} y {n(materiales, 'material', 'materiales')}. Los materiales van sin precio: elegilos del catálogo en el editor. Cada tarea lleva una línea de mano de obra en 0 horas para completar.
                    </p>
                </fieldset>
            </div>
        </Dialog>
    );
}
