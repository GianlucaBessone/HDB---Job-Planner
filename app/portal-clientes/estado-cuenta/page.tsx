'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, EmptyState, ErrorState, LoadingState, Panel, Stat } from '@/components/ui';
import { fechaPortal, pesosPortal, portalApi } from '@/components/portal/portalApi';

interface EstadoCuenta {
    resumen: { saldo: number; vencido: number; noVencido: number; limiteCredito: number | null; disponible: number | null; plazoDias: number };
    pendientes: { numero: string; fecha: string | null; vence: string | null; vencido: boolean; diasVencido: number; concepto: string; saldo: number }[];
    movimientos: { numero: string; fecha: string | null; tipo: string; concepto: string; debe: number; haber: number; saldo: number }[];
}

/** Estado de cuenta del cliente (solo responsables habilitados por HDB). */
export default function PortalEstadoCuentaPage() {
    const [datos, setDatos] = useState<EstadoCuenta | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        portalApi<EstadoCuenta>('/api/portal-clientes/estado-cuenta')
            .then(setDatos)
            .catch((e) => setError(e.message));
    }, []);

    return (
        <div className="w-full space-y-5">
            <ModuleHeader title="Estado de cuenta" description="Saldo, comprobantes pendientes y movimientos de tu cuenta corriente con HDB" icon={<Wallet className="w-5 h-5" />} />
            {error ? (
                <ErrorState title="No se pudo cargar el estado de cuenta" description={error} />
            ) : !datos ? (
                <LoadingState label="Cargando estado de cuenta…" />
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Stat label="Saldo" value={pesosPortal(datos.resumen.saldo)} hint={datos.resumen.saldo < 0 ? 'A tu favor' : undefined} />
                        <Stat label="Vencido" value={pesosPortal(datos.resumen.vencido)} tone={datos.resumen.vencido > 0 ? 'danger' : 'success'} />
                        <Stat label="A vencer" value={pesosPortal(datos.resumen.noVencido)} hint={`Plazo de pago: ${datos.resumen.plazoDias} días`} />
                        <Stat
                            label="Crédito disponible"
                            value={datos.resumen.disponible !== null ? pesosPortal(datos.resumen.disponible) : 'Sin límite'}
                            hint={datos.resumen.limiteCredito ? `Límite ${pesosPortal(datos.resumen.limiteCredito)}` : undefined}
                        />
                    </div>

                    <Panel title="Comprobantes pendientes" padded={false}>
                        {datos.pendientes.length === 0 ? (
                            <EmptyState icon={<Wallet />} title="No hay comprobantes pendientes" description="Estás al día." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-sunken text-xs text-muted-foreground">
                                        <tr>
                                            <th className="text-left font-medium px-4 py-2">Comprobante</th>
                                            <th className="text-left font-medium px-4 py-2">Fecha</th>
                                            <th className="text-left font-medium px-4 py-2">Vence</th>
                                            <th className="text-right font-medium px-4 py-2">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {datos.pendientes.map((c) => (
                                            <tr key={c.numero}>
                                                <td className="px-4 py-2.5">
                                                    <span className="font-medium">{c.numero}</span>
                                                    <span className="block text-xs text-muted-foreground">{c.concepto}</span>
                                                </td>
                                                <td className="px-4 py-2.5 tabular-nums">{fechaPortal(c.fecha)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="tabular-nums">{fechaPortal(c.vence)}</span>
                                                    {c.vencido && <Badge tone="danger" className="ml-2">Vencido hace {c.diasVencido} días</Badge>}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{pesosPortal(c.saldo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Movimientos" description="Los más recientes primero" padded={false}>
                        {datos.movimientos.length === 0 ? (
                            <EmptyState icon={<Wallet />} title="Sin movimientos" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-sunken text-xs text-muted-foreground">
                                        <tr>
                                            <th className="text-left font-medium px-4 py-2">Fecha</th>
                                            <th className="text-left font-medium px-4 py-2">Comprobante</th>
                                            <th className="text-right font-medium px-4 py-2">Debe</th>
                                            <th className="text-right font-medium px-4 py-2">Haber</th>
                                            <th className="text-right font-medium px-4 py-2">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {datos.movimientos.map((m) => (
                                            <tr key={`${m.numero}-${m.fecha}`}>
                                                <td className="px-4 py-2.5 tabular-nums">{fechaPortal(m.fecha)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="font-medium">{m.numero}</span>
                                                    <span className="block text-xs text-muted-foreground">{m.concepto}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">{m.debe ? pesosPortal(m.debe) : ''}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">{m.haber ? pesosPortal(m.haber) : ''}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{pesosPortal(m.saldo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                </>
            )}
        </div>
    );
}
