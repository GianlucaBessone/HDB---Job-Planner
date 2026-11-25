'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, RefreshCw, ShoppingCart } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from '@/components/ui';
import { api, pesos } from '@/components/presupuestosServicio/cliente';
import EditorOrden, { type MetaCompras } from '@/components/compras/EditorOrden';
import DetalleOrden from '@/components/compras/DetalleOrden';
import { ESTADO_OC_INFO, type OrdenCompraDetalle, type OrdenCompraResumen } from '@/lib/comprasTipos';
import { useAcceso } from '@/lib/store/useAccessStore';

/**
 * Compras y recepción (auditoría, faltante): órdenes de compra a proveedores comerciales; al recibir la
 * mercadería entra stock al almacén con su kardex, y la factura del proveedor se vincula a la orden.
 */
type Grupo = 'abiertas' | 'recibidas' | 'canceladas' | 'todas';
const TABS: { id: Grupo; label: string }[] = [
    { id: 'abiertas', label: 'Abiertas' },
    { id: 'recibidas', label: 'Recibidas' },
    { id: 'canceladas', label: 'Canceladas' },
    { id: 'todas', label: 'Todas' },
];

const fechaCorta = (f: string | null) => (f ? new Date(f).toLocaleDateString('es-AR') : '—');

export default function ComprasPage() {
    return (
        <Suspense fallback={<LoadingState label="Cargando compras…" />}>
            <Compras />
        </Suspense>
    );
}

function Compras() {
    const { puede } = useAcceso();
    const searchParams = useSearchParams();
    const [grupo, setGrupo] = useState<Grupo>('abiertas');
    const [q, setQ] = useState('');
    const [ordenes, setOrdenes] = useState<OrdenCompraResumen[] | null>(null);
    const [error, setError] = useState(false);
    const [meta, setMeta] = useState<MetaCompras | null>(null);
    const [editor, setEditor] = useState<{ orden: OrdenCompraDetalle | null } | null>(null);
    const [abierta, setAbierta] = useState<string | null>(searchParams.get('orden'));

    const cargar = useCallback(async () => {
        setError(false);
        try {
            const r = await api<{ ordenes: OrdenCompraResumen[] }>(`/api/compras?grupo=${grupo}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);
            setOrdenes(r.ordenes);
        } catch {
            setError(true);
        }
    }, [grupo, q]);

    useEffect(() => {
        const t = setTimeout(cargar, q ? 250 : 0);
        return () => clearTimeout(t);
    }, [cargar, q]);

    const abrirEditor = async (orden: OrdenCompraDetalle | null) => {
        if (!meta) {
            try {
                setMeta(await api<MetaCompras>('/api/compras/meta'));
            } catch {
                return;
            }
        }
        setEditor({ orden });
    };

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Compras"
                description="Órdenes de compra a proveedores, recepción de mercadería y factura del proveedor"
                icon={<ShoppingCart className="w-5 h-5" />}
                tabs={TABS}
                activeTabId={grupo}
                onTabChange={(id) => {
                    setOrdenes(null);
                    setGrupo(id as Grupo);
                }}
                searchValue={q}
                onSearchChange={setQ}
                searchPlaceholder="Buscar por número, proveedor o producto…"
                actions={[
                    { id: 'refrescar', label: 'Actualizar', icon: <RefreshCw className="w-4 h-4" />, onClick: cargar, variant: 'outline', hideLabelOnMobile: true },
                    ...(puede('compras.gestionar')
                        ? [{ id: 'nueva', label: 'Nueva orden', icon: <Plus className="w-4 h-4" />, onClick: () => abrirEditor(null), variant: 'primary' as const }]
                        : []),
                ]}
            />

            {error ? (
                <ErrorState title="No se pudieron cargar las órdenes" description="Probá de nuevo en un momento." />
            ) : !ordenes ? (
                <LoadingState label="Cargando órdenes…" />
            ) : ordenes.length === 0 ? (
                <EmptyState
                    icon={<ShoppingCart />}
                    title={q ? 'Ninguna orden coincide con la búsqueda' : grupo === 'abiertas' ? 'No hay órdenes abiertas' : 'No hay órdenes'}
                    description="Una orden de compra se envía al proveedor y, al recibir la mercadería, entra el stock al almacén."
                />
            ) : (
                <Panel padded={false}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-sunken text-xs text-muted-foreground">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2">Orden</th>
                                    <th className="text-left font-medium px-4 py-2">Proveedor</th>
                                    <th className="text-left font-medium px-4 py-2">Emitida</th>
                                    <th className="text-left font-medium px-4 py-2">Esperada</th>
                                    <th className="text-left font-medium px-4 py-2">Estado</th>
                                    <th className="text-right font-medium px-4 py-2">Recibido</th>
                                    <th className="text-right font-medium px-4 py-2">Total s/IVA</th>
                                    <th className="text-left font-medium px-4 py-2">Factura</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {ordenes.map((o) => {
                                    const info = ESTADO_OC_INFO[o.estado];
                                    const atrasada = !!o.fechaEsperada && ['enviada', 'parcial'].includes(o.estado) && o.fechaEsperada.slice(0, 10) < new Date().toLocaleDateString('en-CA');
                                    return (
                                        <tr key={o.id} className="hover:bg-surface-sunken cursor-pointer transition-colors" onClick={() => setAbierta(o.id)}>
                                            <td className="px-4 py-2.5">
                                                <button type="button" className="font-medium text-foreground hover:underline" onClick={() => setAbierta(o.id)}>
                                                    {o.numero}
                                                </button>
                                                <span className="block text-xs text-muted-foreground">
                                                    {o.items} {o.items === 1 ? 'producto' : 'productos'} · {o.almacen.nombre}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5">{o.proveedor.razonSocial}</td>
                                            <td className="px-4 py-2.5 tabular-nums">{fechaCorta(o.fechaEmision)}</td>
                                            <td className={`px-4 py-2.5 tabular-nums ${atrasada ? 'text-danger-600 font-medium' : ''}`}>{fechaCorta(o.fechaEsperada)}</td>
                                            <td className="px-4 py-2.5">
                                                <Badge tone={info.tone}>{info.label}</Badge>
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">{o.estado === 'borrador' ? '—' : `${o.recibido}%`}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">{pesos(o.total)}</td>
                                            <td className="px-4 py-2.5 text-muted-foreground">{o.factura?.numero ?? '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}

            <DetalleOrden
                ordenId={abierta}
                onClose={() => setAbierta(null)}
                onCambio={cargar}
                onEditar={(o) => {
                    setAbierta(null);
                    abrirEditor(o);
                }}
            />
            {meta && editor && (
                <EditorOrden
                    open
                    meta={meta}
                    orden={editor.orden}
                    onClose={() => setEditor(null)}
                    onGuardada={(id) => {
                        setEditor(null);
                        cargar();
                        setAbierta(id);
                    }}
                />
            )}
        </div>
    );
}
