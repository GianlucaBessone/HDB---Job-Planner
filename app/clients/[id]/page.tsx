'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Landmark, Save, Settings } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import ClientConfigModal from '@/components/ot/ClientConfigModal';
import { Badge, EmptyState, ErrorState, Input, LoadingState, Panel, Select, Stat } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { CONDICIONES_IVA } from '@/lib/clientes';
import { STATUS_CONFIG } from '@/lib/projectTypes';
import { formatARS } from '@/lib/formatCurrency';

type Pestana = 'datos' | 'comercial' | 'portal' | 'proyectos' | 'cuenta';

interface Ficha {
    id: string;
    nombre: string;
    razonSocial: string | null;
    cuit: string | null;
    condicionIva: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
    activo: boolean;
    listaPrecioId: string | null;
    listaPrecio: { id: string; nombre: string; codigo: string } | null;
    configuracion: { porcentajeMateriales: number; habilitadoOT: boolean } | null;
    _count: { projects: number; ordenesTrabajo: number; ventas: number; cotizaciones: number; presupuestosServicio: number; responsables: number; sectores: number };
    projects: { id: string; nombre: string; codigoProyecto: string | null; estado: string; activo: boolean; fechaInicio: string | null }[];
}

const DATOS_VACIOS = { nombre: '', razonSocial: '', cuit: '', condicionIva: '', email: '', telefono: '', direccion: '' };

/**
 * Ficha del cliente: todo lo del cliente en un solo lugar (auditoría, FU6).
 * Antes los datos estaban en Clientes, la configuración de OT dentro de Órdenes
 * de trabajo y el crédito dentro de Cuentas corrientes.
 */
export default function FichaClientePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { puede, role } = useAcceso();
    const puedeEditar = puede('clientes.gestionar');
    const puedeVerCuenta = puede('ventas.cc_ver');

    const [pestana, setPestana] = useState<Pestana>('datos');
    const [ficha, setFicha] = useState<Ficha | null>(null);
    const [error, setError] = useState(false);
    const [reintento, setReintento] = useState(0);
    const [configOT, setConfigOT] = useState(false);

    const cargar = useCallback(async () => {
        setError(false);
        try {
            const res = await safeApiRequest(`/api/clients/${id}`);
            if (!res.ok) throw new Error();
            setFicha(await res.json());
        } catch {
            setError(true);
        }
    }, [id]);

    useEffect(() => { cargar(); }, [cargar, reintento]);

    // Migas de pan con el nombre del cliente en lugar del id
    const setTitle = useHistoryStore(s => s.setTitle);
    const nombre = ficha?.nombre;
    useEffect(() => {
        if (!nombre) return;
        const t = setTimeout(() => setTitle(`/clients/${id}`, nombre), 0);
        return () => clearTimeout(t);
    }, [id, nombre, setTitle]);

    if (error) return <ErrorState description="No se pudo cargar el cliente." onRetry={() => setReintento(n => n + 1)} />;
    if (!ficha) return <LoadingState label="Cargando cliente…" />;

    const pestanas: { id: Pestana; label: string; count?: number }[] = [
        { id: 'datos', label: 'Datos' },
        { id: 'comercial', label: 'Comercial' },
        { id: 'portal', label: 'Portal y OT' },
        { id: 'proyectos', label: 'Proyectos', count: ficha._count.projects },
        ...(puedeVerCuenta ? [{ id: 'cuenta' as Pestana, label: 'Cuenta corriente' }] : []),
    ];

    return (
        <div className="w-full space-y-6">
            <ModuleHeader
                title={ficha.nombre}
                description={[ficha.razonSocial && ficha.razonSocial !== ficha.nombre ? ficha.razonSocial : null, ficha.cuit ? `CUIT ${ficha.cuit}` : 'Sin CUIT cargado', ficha.activo ? null : 'Inactivo'].filter(Boolean).join(' · ')}
                icon={<Landmark />}
                tabs={pestanas}
                activeTabId={pestana}
                onTabChange={(t) => setPestana(t as Pestana)}
            />

            {pestana === 'datos' && <PestanaDatos ficha={ficha} puedeEditar={puedeEditar} onGuardado={cargar} />}
            {pestana === 'comercial' && <PestanaComercial ficha={ficha} puedeEditar={puedeEditar} onGuardado={cargar} />}
            {pestana === 'portal' && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Stat label="Órdenes de trabajo" value={ficha._count.ordenesTrabajo} hint={ficha.configuracion?.habilitadoOT ? 'Habilitado para OT' : 'No habilitado para OT'} />
                    <Stat label="Responsables del portal" value={ficha._count.responsables} />
                    <Stat label="Sectores" value={ficha._count.sectores} />
                    <div className="md:col-span-3 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-primary" onClick={() => setConfigOT(true)}>
                            <Settings aria-hidden="true" /> Tarifas, responsables y sectores
                        </button>
                        <Link href={`/ordenes-trabajo/cliente/${ficha.id}`} className="btn btn-secondary">
                            Ver órdenes de trabajo <ArrowRight aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            )}
            {pestana === 'proyectos' && (
                ficha.projects.length === 0 ? (
                    <EmptyState title="Sin proyectos" description="Este cliente todavía no tiene proyectos." />
                ) : (
                    <div className="rounded-xl border border-border bg-card overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr><th scope="col">Proyecto</th><th scope="col">Código</th><th scope="col">Estado</th><th scope="col">Inicio</th></tr>
                            </thead>
                            <tbody>
                                {ficha.projects.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <Link href={`/projects?proyecto=${p.id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">{p.nombre}</Link>
                                            {!p.activo && <span className="ml-2 text-xs text-muted-foreground">(inactivo)</span>}
                                        </td>
                                        <td className="font-mono">{p.codigoProyecto || '—'}</td>
                                        <td>{STATUS_CONFIG[p.estado as keyof typeof STATUS_CONFIG]?.label ?? p.estado}</td>
                                        <td className="whitespace-nowrap">{p.fechaInicio ? p.fechaInicio.split('-').reverse().join('/') : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
            {pestana === 'cuenta' && puedeVerCuenta && <PestanaCuenta clienteId={ficha.id} />}

            {configOT && (
                <ClientConfigModal
                    clientId={ficha.id}
                    clientName={ficha.nombre}
                    isOpen={configOT}
                    onClose={() => { setConfigOT(false); cargar(); }}
                    currentUserRole={role}
                />
            )}
        </div>
    );
}

function PestanaDatos({ ficha, puedeEditar, onGuardado }: { ficha: Ficha; puedeEditar: boolean; onGuardado: () => void }) {
    const [form, setForm] = useState(DATOS_VACIOS);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        setForm({
            nombre: ficha.nombre,
            razonSocial: ficha.razonSocial ?? '',
            cuit: ficha.cuit ?? '',
            condicionIva: ficha.condicionIva ?? '',
            email: ficha.email ?? '',
            telefono: ficha.telefono ?? '',
            direccion: ficha.direccion ?? '',
        });
    }, [ficha]);

    const set = (k: keyof typeof DATOS_VACIOS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const res = await safeApiRequest(`/api/clients?id=${ficha.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) { showToast(data?.error || 'No se pudo guardar', 'error'); return; }
            showToast('Cliente actualizado', 'success');
            onGuardado();
        } finally {
            setGuardando(false);
        }
    };

    const condiciones: string[] = [...CONDICIONES_IVA];
    if (form.condicionIva && !condiciones.includes(form.condicionIva)) condiciones.push(form.condicionIva);

    return (
        <form onSubmit={guardar} className="grid gap-4 lg:grid-cols-2 items-start">
            <Panel title="Datos fiscales" description="Se usan en ventas y cotizaciones en lugar de tipearlos cada vez">
                <fieldset disabled={!puedeEditar} className="space-y-4">
                    <Input label="Razón social" value={form.razonSocial} onChange={set('razonSocial')} placeholder={form.nombre} />
                    <Input label="CUIT" value={form.cuit} onChange={set('cuit')} placeholder="30-12345678-9" inputMode="numeric" />
                    <Select label="Condición frente al IVA" value={form.condicionIva} onChange={set('condicionIva')}>
                        <option value="">Sin indicar</option>
                        {condiciones.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                </fieldset>
            </Panel>
            <Panel title="Contacto">
                <fieldset disabled={!puedeEditar} className="space-y-4">
                    <Input label="Nombre" value={form.nombre} onChange={set('nombre')} required />
                    <Input label="Email" type="email" value={form.email} onChange={set('email')} />
                    <Input label="Teléfono" value={form.telefono} onChange={set('telefono')} />
                    <Input label="Dirección" value={form.direccion} onChange={set('direccion')} />
                </fieldset>
            </Panel>
            {puedeEditar && (
                <div className="lg:col-span-2">
                    <button type="submit" className="btn btn-primary" disabled={guardando}>
                        <Save aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar datos'}
                    </button>
                </div>
            )}
        </form>
    );
}

function PestanaComercial({ ficha, puedeEditar, onGuardado }: { ficha: Ficha; puedeEditar: boolean; onGuardado: () => void }) {
    const { puede } = useAcceso();
    const puedeCredito = puede('ventas.cc_configurar');
    const puedeVerCredito = puede('ventas.cc_ver');
    const [listas, setListas] = useState<{ id: string; nombre: string }[]>([]);
    const [listaId, setListaId] = useState(ficha.listaPrecioId ?? '');
    const [porcentaje, setPorcentaje] = useState(String(ficha.configuracion?.porcentajeMateriales ?? 0));
    const [credito, setCredito] = useState<{ limiteCredito: number; plazoDias: number; estadoCredito: string; observaciones: string | null } | null>(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        safeApiRequest('/api/ventas/listas-precios').then(r => r.json()).then(d => setListas(Array.isArray(d) ? d : [])).catch(() => {});
        if (puedeVerCredito) {
            safeApiRequest(`/api/ventas/cuentas-corrientes/${ficha.id}`)
                .then(r => (r.ok ? r.json() : null))
                .then(d => { if (d?.cliente?.config) setCredito(d.cliente.config); })
                .catch(() => {});
        }
    }, [ficha.id, puedeVerCredito]);

    const guardar = async () => {
        setGuardando(true);
        try {
            const pedidos: Promise<Response>[] = [];
            if (puedeEditar) {
                pedidos.push(safeApiRequest(`/api/clients?id=${ficha.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listaPrecioId: listaId || null }) }));
                pedidos.push(safeApiRequest(`/api/clients/${ficha.id}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ porcentajeMateriales: porcentaje }) }));
            }
            if (puedeCredito && credito) {
                pedidos.push(safeApiRequest(`/api/ventas/cuentas-corrientes/${ficha.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credito) }));
            }
            const respuestas = await Promise.all(pedidos);
            const fallida = respuestas.find(r => !r.ok);
            if (fallida) {
                const data = await fallida.json().catch(() => null);
                showToast(data?.error || 'No se pudo guardar todo', 'error');
            } else {
                showToast('Condiciones comerciales guardadas', 'success');
            }
            onGuardado();
        } finally {
            setGuardando(false);
        }
    };

    const editable = puedeEditar || puedeCredito;

    return (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
            <Panel title="Precios" description="Lista para materiales y ajuste del cliente sobre materiales de OT">
                <fieldset disabled={!puedeEditar} className="space-y-4">
                    <Select label="Lista de precios" value={listaId} onChange={e => setListaId(e.target.value)} hint="Los proyectos nuevos de este cliente la heredan">
                        <option value="">Lista general</option>
                        {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </Select>
                    <Input label="Ajuste sobre materiales (%)" type="number" step="0.01" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} hint="Positivo es recargo, negativo es descuento" />
                </fieldset>
            </Panel>
            {puedeVerCredito && (
                <Panel title="Crédito" description="Condiciones de la cuenta corriente">
                    {credito ? (
                        <fieldset disabled={!puedeCredito} className="space-y-4">
                            <Input label="Límite de crédito" type="number" min={0} value={credito.limiteCredito} onChange={e => setCredito({ ...credito, limiteCredito: Number(e.target.value) })} hint="0 es sin límite" />
                            <Input label="Plazo (días)" type="number" min={0} max={365} value={credito.plazoDias} onChange={e => setCredito({ ...credito, plazoDias: Number(e.target.value) })} />
                            <Select label="Estado del crédito" value={credito.estadoCredito} onChange={e => setCredito({ ...credito, estadoCredito: e.target.value })}>
                                <option value="ACTIVO">Activo</option>
                                <option value="OBSERVADO">Observado</option>
                                <option value="SUSPENDIDO">Suspendido</option>
                            </Select>
                        </fieldset>
                    ) : (
                        <p className="text-[13px] text-muted-foreground">Cargando…</p>
                    )}
                </Panel>
            )}
            {editable && (
                <div className="lg:col-span-2">
                    <button type="button" onClick={guardar} className="btn btn-primary" disabled={guardando}>
                        <Save aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar condiciones'}
                    </button>
                </div>
            )}
        </div>
    );
}

function PestanaCuenta({ clienteId }: { clienteId: string }) {
    const [resumen, setResumen] = useState<any>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        safeApiRequest(`/api/ventas/cuentas-corrientes/${clienteId}`)
            .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(d => setResumen(d.resumen))
            .catch(() => setError(true));
    }, [clienteId]);

    if (error) return <ErrorState description="No se pudo cargar la cuenta corriente." />;
    if (!resumen) return <LoadingState label="Cargando cuenta corriente…" />;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Stat label="Saldo" value={formatARS(resumen.saldoActual)} tone={resumen.saldoActual > 0.01 ? 'warning' : 'success'} />
                <Stat label="Vencido" value={formatARS(resumen.deudaVencida)} tone={resumen.deudaVencida > 0.01 ? 'danger' : 'neutral'} hint={resumen.diasMoraMaxima ? `${resumen.diasMoraMaxima} días de mora máxima` : undefined} />
                <Stat label="Disponible de crédito" value={resumen.disponibleCredito == null ? 'Sin límite' : formatARS(resumen.disponibleCredito)} />
                <Stat label="Comprobantes pendientes" value={resumen.comprobantesPendientesCount} />
            </div>
            <Link href={`/ventas/cuentas-corrientes?cliente=${clienteId}`} className="btn btn-secondary">
                Ver movimientos y cobrar <ArrowRight aria-hidden="true" />
            </Link>
            {resumen.saldoActual <= 0.01 && <Badge tone="success">Sin deuda</Badge>}
        </div>
    );
}
