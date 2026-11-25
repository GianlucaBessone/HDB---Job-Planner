'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Dialog, Field, Input, Select, Textarea } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { showToast } from '@/components/Toast';
import { api, pesos } from '@/components/presupuestosServicio/cliente';
import type { OrdenCompraDetalle } from '@/lib/comprasTipos';

export interface MetaCompras {
    proveedores: { id: string; razonSocial: string; cuit: string | null }[];
    almacenes: { id: string; nombre: string }[];
    almacenPorDefecto: string | null;
}

interface ProductoCompra {
    id: string;
    sku: string;
    descripcion: string;
    unidad: string | null;
    costo: number;
    esDelProveedor: boolean;
    skuProveedor: string | null;
    stock: number;
}

interface Linea {
    productoId: string;
    sku: string;
    descripcion: string;
    unidad: string | null;
    cantidad: string;
    costoUnitario: string;
}

const num = (s: string) => {
    const n = Number(String(s).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

/**
 * Alta y edición de una orden de compra en borrador: proveedor, almacén, fecha esperada y productos con su
 * costo (por defecto, el que ese proveedor tiene cargado en el producto).
 */
export default function EditorOrden({
    open,
    meta,
    orden,
    onClose,
    onGuardada,
}: {
    open: boolean;
    meta: MetaCompras;
    /** Para editar un borrador; sin orden, crea una nueva. */
    orden?: OrdenCompraDetalle | null;
    onClose: () => void;
    onGuardada: (id: string) => void;
}) {
    const [proveedorId, setProveedorId] = useState('');
    const [almacenId, setAlmacenId] = useState('');
    const [fechaEsperada, setFechaEsperada] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [q, setQ] = useState('');
    const [resultados, setResultados] = useState<ProductoCompra[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [guardando, setGuardando] = useState<false | 'guardar' | 'enviar'>(false);

    useEffect(() => {
        if (!open) return;
        setProveedorId(orden?.proveedor.id ?? '');
        setAlmacenId(orden?.almacen.id ?? meta.almacenPorDefecto ?? meta.almacenes[0]?.id ?? '');
        setFechaEsperada(orden?.fechaEsperada?.slice(0, 10) ?? '');
        setObservaciones(orden?.observaciones ?? '');
        setLineas(
            (orden?.items ?? []).map((i) => ({
                productoId: i.productoId,
                sku: i.sku,
                descripcion: i.descripcion,
                unidad: i.unidad,
                cantidad: String(i.cantidad),
                costoUnitario: String(i.costoUnitario),
            }))
        );
        setQ('');
    }, [open, orden, meta]);

    const termino = q.trim();
    useEffect(() => {
        if (termino.length < 2) {
            setResultados([]);
            return;
        }
        let vigente = true;
        const t = setTimeout(async () => {
            setBuscando(true);
            const r = await api<{ productos: ProductoCompra[] }>(`/api/compras/productos?q=${encodeURIComponent(termino)}&proveedorId=${proveedorId}`).catch(() => null);
            if (!vigente) return;
            setResultados(r?.productos ?? []);
            setBuscando(false);
        }, 250);
        return () => {
            vigente = false;
            clearTimeout(t);
        };
    }, [termino, proveedorId]);

    const agregar = (p: ProductoCompra) => {
        setLineas((ls) =>
            ls.some((l) => l.productoId === p.id)
                ? ls.map((l) => (l.productoId === p.id ? { ...l, cantidad: String(num(l.cantidad) + 1) } : l))
                : [...ls, { productoId: p.id, sku: p.sku, descripcion: p.descripcion, unidad: p.unidad, cantidad: '1', costoUnitario: String(p.costo || '') }]
        );
    };
    const cambiar = (productoId: string, campo: 'cantidad' | 'costoUnitario', valor: string) =>
        setLineas((ls) => ls.map((l) => (l.productoId === productoId ? { ...l, [campo]: valor } : l)));

    const total = useMemo(() => lineas.reduce((a, l) => a + num(l.cantidad) * num(l.costoUnitario), 0), [lineas]);
    const enLista = useMemo(() => new Set(lineas.map((l) => l.productoId)), [lineas]);

    const guardar = async (enviar: boolean) => {
        if (!proveedorId) return showToast('Elegí el proveedor', 'error');
        if (lineas.length === 0) return showToast('Agregá al menos un producto', 'error');
        if (lineas.some((l) => num(l.cantidad) <= 0)) return showToast('Todas las cantidades tienen que ser mayores a cero', 'error');
        setGuardando(enviar ? 'enviar' : 'guardar');
        const datos = {
            proveedorId,
            almacenId,
            fechaEsperada: fechaEsperada || null,
            observaciones: observaciones.trim() || null,
            items: lineas.map((l) => ({ productoId: l.productoId, cantidad: num(l.cantidad), costoUnitario: num(l.costoUnitario) })),
        };
        try {
            let id = orden?.id;
            if (id) await api(`/api/compras/${id}`, { method: 'PATCH', json: { accion: 'editar', ...datos } });
            else id = (await api<{ id: string }>('/api/compras', { method: 'POST', json: datos })).id;
            if (enviar) await api(`/api/compras/${id}`, { method: 'PATCH', json: { accion: 'enviar' } });
            showToast(enviar ? 'Orden enviada' : 'Orden guardada como borrador');
            onGuardada(id!);
        } catch (e: any) {
            showToast(e.message || 'No se pudo guardar la orden', 'error');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!guardando}
            size="xl"
            title={orden ? `Editar ${orden.numero}` : 'Nueva orden de compra'}
            description="Se guarda como borrador; al enviarla queda esperando la mercadería."
            footer={
                <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 w-full">
                    <span className="text-sm text-muted-foreground sm:mr-auto">
                        Total sin IVA: <strong className="text-foreground tabular-nums">{pesos(total)}</strong>
                    </span>
                    <Button variant="secondary" onClick={onClose} disabled={!!guardando}>
                        Cancelar
                    </Button>
                    <Button variant="secondary" onClick={() => guardar(false)} isLoading={guardando === 'guardar'} disabled={!!guardando}>
                        Guardar borrador
                    </Button>
                    <Button onClick={() => guardar(true)} isLoading={guardando === 'enviar'} disabled={!!guardando}>
                        Guardar y enviar
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Proveedor" required className="sm:col-span-2">
                        <SearchableSelect
                            options={meta.proveedores.map((p) => ({ id: p.id, nombre: p.razonSocial, extra: p.cuit }))}
                            value={proveedorId}
                            onChange={setProveedorId}
                            placeholder="Elegí el proveedor…"
                            searchPlaceholder="Buscar por razón social o CUIT…"
                            allowClear={false}
                        />
                    </Field>
                    <Select label="Entra al almacén" value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
                        {meta.almacenes.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.nombre}
                            </option>
                        ))}
                    </Select>
                    <Input label="Fecha esperada" type="date" value={fechaEsperada} onChange={(e) => setFechaEsperada(e.target.value)} />
                    <Textarea
                        label="Observaciones"
                        className="sm:col-span-2"
                        rows={1}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Condiciones, forma de entrega…"
                    />
                </div>

                <div className="space-y-2">
                    <label className="relative block">
                        <span className="sr-only">Buscar producto</span>
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input className="input pl-9 pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Agregar producto: SKU o nombre…" />
                        {buscando && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
                    </label>
                    {termino.length >= 2 && (
                        <ul className="rounded-lg border border-border divide-y divide-border max-h-56 overflow-y-auto" aria-label="Resultados">
                            {resultados.length === 0 && !buscando && <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>}
                            {resultados.map((p) => (
                                <li key={p.id}>
                                    <button type="button" onClick={() => agregar(p)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-sunken transition-colors">
                                        <Plus className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm text-foreground truncate">
                                                <span className="font-mono text-xs text-muted-foreground mr-2">{p.sku}</span>
                                                {p.descripcion}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                Stock {p.stock.toLocaleString('es-AR')} · costo {pesos(p.costo)}
                                                {proveedorId && !p.esDelProveedor ? ' (de otro proveedor)' : ''}
                                                {p.skuProveedor ? ` · código del proveedor ${p.skuProveedor}` : ''}
                                            </span>
                                        </span>
                                        {enLista.has(p.id) && <Badge tone="brand">En la orden</Badge>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {lineas.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">Todavía no hay productos en la orden.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-sunken text-xs text-muted-foreground">
                                <tr>
                                    <th className="text-left font-medium px-3 py-2">Producto</th>
                                    <th className="text-right font-medium px-3 py-2 w-28">Cantidad</th>
                                    <th className="text-right font-medium px-3 py-2 w-36">Costo unit. s/IVA</th>
                                    <th className="text-right font-medium px-3 py-2 w-32">Subtotal</th>
                                    <th className="w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {lineas.map((l) => (
                                    <tr key={l.productoId}>
                                        <td className="px-3 py-1.5">
                                            <span className="font-mono text-xs text-muted-foreground mr-2">{l.sku}</span>
                                            {l.descripcion}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <input
                                                className="input text-right tabular-nums"
                                                inputMode="decimal"
                                                aria-label={`Cantidad de ${l.descripcion}`}
                                                value={l.cantidad}
                                                onChange={(e) => cambiar(l.productoId, 'cantidad', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <input
                                                className="input text-right tabular-nums"
                                                inputMode="decimal"
                                                aria-label={`Costo de ${l.descripcion}`}
                                                value={l.costoUnitario}
                                                placeholder="0"
                                                onChange={(e) => cambiar(l.productoId, 'costoUnitario', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">{pesos(num(l.cantidad) * num(l.costoUnitario))}</td>
                                        <td className="px-1">
                                            <Button
                                                variant="danger-ghost"
                                                size="icon-sm"
                                                icon={<Trash2 />}
                                                aria-label={`Quitar ${l.descripcion}`}
                                                onClick={() => setLineas((ls) => ls.filter((x) => x.productoId !== l.productoId))}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
