'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, FileText, Link2, PackageCheck, Pencil, Send, Trash2, Undo2 } from 'lucide-react';
import { Badge, Button, ConfirmDialogBase, Dialog, Field, Input, LoadingState, ErrorState } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { api, pesos } from '@/components/presupuestosServicio/cliente';
import { ESTADO_OC_INFO, type OrdenCompraDetalle } from '@/lib/comprasTipos';
import { useAcceso } from '@/lib/store/useAccessStore';

const fechaCorta = (f: string | null) => (f ? new Date(f).toLocaleDateString('es-AR') : '—');
const cant = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });
const num = (s: string) => {
    const n = Number(String(s).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

type Confirmacion = { tipo: 'enviar' | 'cancelar' | 'borrar' } | { tipo: 'anular'; recepcionId: string; numero: string };

/**
 * Ficha de una orden de compra: ítems con lo pedido y lo recibido, recepciones (con su anulación), factura del
 * proveedor y las acciones según el estado y los permisos.
 */
export default function DetalleOrden({
    ordenId,
    onClose,
    onCambio,
    onEditar,
}: {
    ordenId: string | null;
    onClose: () => void;
    onCambio: () => void;
    onEditar: (o: OrdenCompraDetalle) => void;
}) {
    const { puede } = useAcceso();
    const gestiona = puede('compras.gestionar');
    const recibe = puede('compras.recibir');
    const [orden, setOrden] = useState<OrdenCompraDetalle | null>(null);
    const [error, setError] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);
    const [recibiendo, setRecibiendo] = useState(false);
    const [eligiendoFactura, setEligiendoFactura] = useState(false);

    const cargar = useCallback(async () => {
        if (!ordenId) return;
        setError(false);
        try {
            setOrden((await api<{ orden: OrdenCompraDetalle }>(`/api/compras/${ordenId}`)).orden);
        } catch {
            setError(true);
        }
    }, [ordenId]);

    useEffect(() => {
        setOrden(null);
        cargar();
    }, [cargar]);

    const ejecutar = async () => {
        if (!confirmar || !orden) return;
        setOcupado(true);
        try {
            if (confirmar.tipo === 'borrar') {
                await api(`/api/compras/${orden.id}`, { method: 'DELETE' });
                showToast('Orden borrada');
                setConfirmar(null);
                onCambio();
                onClose();
                return;
            }
            if (confirmar.tipo === 'anular') {
                await api(`/api/compras/recepciones/${confirmar.recepcionId}/anular`, { method: 'POST' });
                showToast('Recepción anulada; el stock se descontó');
            } else {
                await api(`/api/compras/${orden.id}`, { method: 'PATCH', json: { accion: confirmar.tipo } });
                showToast(confirmar.tipo === 'enviar' ? 'Orden enviada' : 'Orden cancelada');
            }
            setConfirmar(null);
            await cargar();
            onCambio();
        } catch (e: any) {
            showToast(e.message || 'No se pudo completar', 'error');
        } finally {
            setOcupado(false);
        }
    };

    const abierta = orden && ['enviada', 'parcial'].includes(orden.estado);
    const info = orden ? ESTADO_OC_INFO[orden.estado] : null;

    return (
        <>
            <Dialog
                open={!!ordenId}
                onClose={onClose}
                size="xl"
                title={orden ? `Orden ${orden.numero}` : 'Orden de compra'}
                description={orden ? `${orden.proveedor.razonSocial} · entra a ${orden.almacen.nombre}` : undefined}
                footer={
                    orden && (
                        <div className="flex flex-wrap items-center gap-2 w-full">
                            {gestiona && orden.estado === 'borrador' && (
                                <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => setConfirmar({ tipo: 'borrar' })}>
                                    Borrar
                                </Button>
                            )}
                            {gestiona && ['enviada', 'parcial'].includes(orden.estado) && (
                                <Button variant="danger-ghost" icon={<Ban />} onClick={() => setConfirmar({ tipo: 'cancelar' })}>
                                    {orden.estado === 'parcial' ? 'Cerrar sin el resto' : 'Cancelar orden'}
                                </Button>
                            )}
                            <span className="flex-1" />
                            {gestiona && orden.estado !== 'borrador' && orden.estado !== 'cancelada' && (
                                <Button variant="secondary" icon={<Link2 />} onClick={() => setEligiendoFactura(true)}>
                                    {orden.factura ? 'Cambiar factura' : 'Vincular factura'}
                                </Button>
                            )}
                            {gestiona && orden.estado === 'borrador' && (
                                <>
                                    <Button variant="secondary" icon={<Pencil />} onClick={() => onEditar(orden)}>
                                        Editar
                                    </Button>
                                    <Button icon={<Send />} onClick={() => setConfirmar({ tipo: 'enviar' })}>
                                        Enviar
                                    </Button>
                                </>
                            )}
                            {recibe && abierta && (
                                <Button icon={<PackageCheck />} onClick={() => setRecibiendo(true)}>
                                    Registrar recepción
                                </Button>
                            )}
                        </div>
                    )
                }
            >
                {error ? (
                    <ErrorState title="No se pudo cargar la orden" description="Probá de nuevo en un momento." />
                ) : !orden || !info ? (
                    <LoadingState label="Cargando orden…" />
                ) : (
                    <div className="space-y-5">
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                                <dt className="text-xs text-muted-foreground">Estado</dt>
                                <dd>
                                    <Badge tone={info.tone}>{info.label}</Badge>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">Emitida</dt>
                                <dd>{fechaCorta(orden.fechaEmision)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">Esperada</dt>
                                <dd>{fechaCorta(orden.fechaEsperada)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">Total sin IVA</dt>
                                <dd className="tabular-nums font-medium">{pesos(orden.total)}</dd>
                            </div>
                            <div className="col-span-2">
                                <dt className="text-xs text-muted-foreground">Factura del proveedor</dt>
                                <dd>
                                    {orden.factura ? (
                                        <Link href="/administracion/gastos" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                                            {orden.factura.numero} · {fechaCorta(orden.factura.fechaEmision)} · {pesos(orden.factura.total)}
                                        </Link>
                                    ) : (
                                        <span className="text-muted-foreground">Sin vincular</span>
                                    )}
                                </dd>
                            </div>
                            {orden.observaciones && (
                                <div className="col-span-2">
                                    <dt className="text-xs text-muted-foreground">Observaciones</dt>
                                    <dd className="whitespace-pre-line">{orden.observaciones}</dd>
                                </div>
                            )}
                        </dl>

                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-sunken text-xs text-muted-foreground">
                                    <tr>
                                        <th className="text-left font-medium px-3 py-2">Producto</th>
                                        <th className="text-right font-medium px-3 py-2">Pedido</th>
                                        <th className="text-right font-medium px-3 py-2">Recibido</th>
                                        <th className="text-right font-medium px-3 py-2">Costo unit.</th>
                                        <th className="text-right font-medium px-3 py-2">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {orden.items.map((i) => {
                                        const completo = i.cantidadRecibida >= i.cantidad - 0.0005;
                                        return (
                                            <tr key={i.id}>
                                                <td className="px-3 py-2">
                                                    <span className="font-mono text-xs text-muted-foreground mr-2">{i.sku}</span>
                                                    {i.descripcion}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {cant(i.cantidad)} {i.unidad ?? ''}
                                                </td>
                                                <td className={`px-3 py-2 text-right tabular-nums ${completo ? 'text-success-600' : i.cantidadRecibida > 0 ? 'text-warning-600' : 'text-muted-foreground'}`}>
                                                    {cant(i.cantidadRecibida)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">{pesos(i.costoUnitario)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{pesos(i.cantidad * i.costoUnitario)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <section className="space-y-2">
                            <h3 className="text-sm font-semibold text-foreground">Recepciones</h3>
                            {orden.recepciones.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Todavía no se recibió mercadería.</p>
                            ) : (
                                <ul className="divide-y divide-border rounded-lg border border-border">
                                    {orden.recepciones.map((r) => (
                                        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                                            <span className="font-medium">{r.numero}</span>
                                            <span className="text-muted-foreground">{fechaCorta(r.fecha)}</span>
                                            {r.remito && <span className="text-muted-foreground">Remito {r.remito}</span>}
                                            <span className="text-muted-foreground">
                                                {r.items.length} {r.items.length === 1 ? 'producto' : 'productos'}
                                                {r.usuarioNombre ? ` · ${r.usuarioNombre}` : ''}
                                            </span>
                                            {r.anulada && <Badge tone="danger">Anulada</Badge>}
                                            <span className="flex-1" />
                                            {recibe && !r.anulada && orden.estado !== 'cancelada' && (
                                                <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => setConfirmar({ tipo: 'anular', recepcionId: r.id, numero: r.numero })}>
                                                    Anular
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )}
            </Dialog>

            {orden && (
                <RecepcionDialog
                    open={recibiendo}
                    orden={orden}
                    puedeActualizarCostos={gestiona}
                    onClose={() => setRecibiendo(false)}
                    onRegistrada={async () => {
                        setRecibiendo(false);
                        await cargar();
                        onCambio();
                    }}
                />
            )}
            {orden && (
                <FacturaDialog
                    open={eligiendoFactura}
                    orden={orden}
                    onClose={() => setEligiendoFactura(false)}
                    onVinculada={async () => {
                        setEligiendoFactura(false);
                        await cargar();
                        onCambio();
                    }}
                />
            )}

            <ConfirmDialogBase
                open={!!confirmar}
                onCancel={() => setConfirmar(null)}
                onConfirm={ejecutar}
                loading={ocupado}
                tone={confirmar?.tipo === 'enviar' ? 'primary' : 'danger'}
                title={
                    confirmar?.tipo === 'enviar'
                        ? '¿Enviar la orden?'
                        : confirmar?.tipo === 'cancelar'
                          ? orden?.estado === 'parcial'
                              ? '¿Cerrar la orden sin el resto?'
                              : '¿Cancelar la orden?'
                          : confirmar?.tipo === 'borrar'
                            ? '¿Borrar el borrador?'
                            : `¿Anular la recepción ${confirmar?.tipo === 'anular' ? confirmar.numero : ''}?`
                }
                message={
                    confirmar?.tipo === 'enviar'
                        ? 'Ya no se podrán cambiar el proveedor ni los productos. Queda esperando la mercadería.'
                        : confirmar?.tipo === 'cancelar'
                          ? 'Lo que no llegó deja de esperarse. Lo ya recibido queda en el stock.'
                          : confirmar?.tipo === 'borrar'
                            ? 'La orden no se envió nunca; se borra por completo.'
                            : 'Lo que entró con esta recepción sale del stock del almacén.'
                }
                confirmLabel={confirmar?.tipo === 'enviar' ? 'Enviar' : confirmar?.tipo === 'borrar' ? 'Borrar' : confirmar?.tipo === 'anular' ? 'Anular recepción' : 'Cancelar orden'}
                cancelLabel="Volver"
            />
        </>
    );
}

/** Cantidades recibidas por ítem (por defecto, lo que falta), remito y si se actualizan los costos. */
function RecepcionDialog({
    open,
    orden,
    puedeActualizarCostos,
    onClose,
    onRegistrada,
}: {
    open: boolean;
    orden: OrdenCompraDetalle;
    puedeActualizarCostos: boolean;
    onClose: () => void;
    onRegistrada: () => void;
}) {
    const [cantidades, setCantidades] = useState<Record<string, string>>({});
    const [remito, setRemito] = useState('');
    const [fecha, setFecha] = useState('');
    const [actualizarCostos, setActualizarCostos] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCantidades(Object.fromEntries(orden.items.map((i) => [i.id, String(Math.max(0, Math.round((i.cantidad - i.cantidadRecibida) * 1000) / 1000))])));
        setRemito('');
        setFecha(new Date().toLocaleDateString('en-CA'));
        setActualizarCostos(false);
    }, [open, orden]);

    const registrar = async () => {
        const items = orden.items.map((i) => ({ itemId: i.id, cantidad: num(cantidades[i.id] ?? '0') })).filter((i) => i.cantidad > 0);
        if (items.length === 0) return showToast('Cargá al menos una cantidad recibida', 'error');
        setGuardando(true);
        try {
            const r = await api<{ recepcion: { numero: string; estado: string } }>(`/api/compras/${orden.id}/recepciones`, {
                method: 'POST',
                json: { items, remito: remito.trim() || null, fecha: fecha || null, actualizarCostos },
            });
            showToast(`Recepción ${r.recepcion.numero} registrada; el stock entró a ${orden.almacen.nombre}`);
            onRegistrada();
        } catch (e: any) {
            showToast(e.message || 'No se pudo registrar la recepción', 'error');
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
            zIndex="z-[210]"
            title={`Recibir mercadería · ${orden.numero}`}
            description={`Lo recibido entra al stock de ${orden.almacen.nombre}.`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>
                        Cancelar
                    </Button>
                    <Button icon={<PackageCheck />} onClick={registrar} isLoading={guardando}>
                        Registrar recepción
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Remito del proveedor" value={remito} onChange={(e) => setRemito(e.target.value)} placeholder="0001-00001234" maxLength={60} />
                    <Input label="Fecha de recepción" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-sunken text-xs text-muted-foreground">
                            <tr>
                                <th className="text-left font-medium px-3 py-2">Producto</th>
                                <th className="text-right font-medium px-3 py-2">Pedido</th>
                                <th className="text-right font-medium px-3 py-2">Ya recibido</th>
                                <th className="text-right font-medium px-3 py-2 w-32">Recibo ahora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {orden.items.map((i) => {
                                const valor = num(cantidades[i.id] ?? '0');
                                const excede = i.cantidadRecibida + valor > i.cantidad + 0.0005;
                                return (
                                    <tr key={i.id}>
                                        <td className="px-3 py-1.5">{i.descripcion}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">{cant(i.cantidad)}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{cant(i.cantidadRecibida)}</td>
                                        <td className="px-3 py-1.5">
                                            <input
                                                className={`input text-right tabular-nums ${excede ? 'border-warning-500' : ''}`}
                                                inputMode="decimal"
                                                aria-label={`Cantidad recibida de ${i.descripcion}`}
                                                value={cantidades[i.id] ?? ''}
                                                onChange={(e) => setCantidades((c) => ({ ...c, [i.id]: e.target.value }))}
                                            />
                                            {excede && <span className="block text-xs text-warning-600 mt-0.5 text-right">Más de lo pedido</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {puedeActualizarCostos && (
                    <Field hint="Pasa el costo de esta orden al costo del proveedor en cada producto. Cambia los precios de venta que se calculan desde el costo.">
                        <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={actualizarCostos} onChange={(e) => setActualizarCostos(e.target.checked)} />
                            Actualizar el costo de los productos
                        </label>
                    </Field>
                )}
            </div>
        </Dialog>
    );
}

interface FacturaOpcion {
    id: string;
    numero: string;
    fechaEmision: string;
    total: number;
    ordenes: string[];
}

/** Elegir una factura del mismo proveedor (cargada en Gastos y facturas) para vincularla a la orden. */
function FacturaDialog({ open, orden, onClose, onVinculada }: { open: boolean; orden: OrdenCompraDetalle; onClose: () => void; onVinculada: () => void }) {
    const [facturas, setFacturas] = useState<FacturaOpcion[] | null>(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFacturas(null);
        api<{ facturas: FacturaOpcion[] }>(`/api/compras/facturas?proveedorId=${orden.proveedor.id}`)
            .then((r) => setFacturas(r.facturas))
            .catch(() => setFacturas([]));
    }, [open, orden.proveedor.id]);

    const vincular = async (facturaId: string | null) => {
        setGuardando(true);
        try {
            await api(`/api/compras/${orden.id}`, { method: 'PATCH', json: { accion: 'vincular_factura', facturaId } });
            showToast(facturaId ? 'Factura vinculada' : 'Factura desvinculada');
            onVinculada();
        } catch (e: any) {
            showToast(e.message || 'No se pudo vincular', 'error');
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
            zIndex="z-[210]"
            title="Factura del proveedor"
            description={`Facturas de ${orden.proveedor.razonSocial} cargadas en Gastos y facturas.`}
            footer={
                <>
                    {orden.factura && (
                        <Button variant="danger-ghost" onClick={() => vincular(null)} disabled={guardando}>
                            Desvincular
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>
                        Cerrar
                    </Button>
                </>
            }
        >
            {!facturas ? (
                <LoadingState label="Cargando facturas…" />
            ) : facturas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No hay facturas de este proveedor. Cargala en{' '}
                    <Link href="/administracion/gastos" className="text-brand-600 hover:underline">
                        Gastos y facturas
                    </Link>{' '}
                    y volvé a vincularla.
                </p>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {facturas.map((f) => {
                        const actual = orden.factura?.id === f.id;
                        const otras = f.ordenes.filter((n) => n !== orden.numero);
                        return (
                            <li key={f.id}>
                                <button
                                    type="button"
                                    disabled={guardando || actual}
                                    onClick={() => vincular(f.id)}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-sunken transition-colors disabled:opacity-60"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium text-foreground">{f.numero}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {fechaCorta(f.fechaEmision)} · {pesos(f.total)}
                                            {otras.length > 0 ? ` · ya en ${otras.join(', ')}` : ''}
                                        </span>
                                    </span>
                                    {actual && <Badge tone="success">Vinculada</Badge>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Dialog>
    );
}
