'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, History, MinusCircle, Package, PlusCircle, Search, Share2, ShieldCheck } from 'lucide-react';
import { Dialog, EmptyState, Input, Panel, SegmentedControl, Select, Textarea } from '@/components/ui';
import SignatureButton from '@/components/SignatureButton';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';

interface Movimiento { cantidadUtilizada?: number; cantidadADevolver?: number; estado?: string }
export interface MaterialObra {
    id: string;
    nombre: string;
    codigo?: string | null;
    unidad: string;
    estado: string;
    cantidadEntregada: number;
    usos: Movimiento[];
    devoluciones: Movimiento[];
}

const redondear = (n: number) => Math.round(n * 100) / 100;
const normalizar = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Saldo de un material en obra, con el mismo criterio que la API de devoluciones:
 * cuenta como devuelto lo cerrado (con o sin reserva) y como pendiente lo que espera
 * confirmación del depósito o la aceptación de una delegación. Una delegación
 * rechazada no descuenta: el material sigue en poder del responsable.
 */
export function saldoMaterial(m: MaterialObra) {
    const usado = redondear(m.usos.reduce((a, u) => a + (u.cantidadUtilizada || 0), 0));
    const devuelto = redondear(m.devoluciones.filter(d => d.estado === 'cerrado_ok' || d.estado === 'cerrado_con_reserva').reduce((a, d) => a + (d.cantidadADevolver || 0), 0));
    const pendiente = redondear(m.devoluciones.filter(d => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente').reduce((a, d) => a + (d.cantidadADevolver || 0), 0));
    const enPoder = redondear(m.cantidadEntregada - usado - devuelto - pendiente);
    const cerrado = ['cerrado_ok', 'cerrado_con_reserva'].includes(m.estado) || (enPoder <= 0 && pendiente === 0);
    return { usado, devuelto, pendiente, enPoder, cerrado };
}

type Accion = { tipo: 'uso' | 'devolucion' | 'delegar'; material: MaterialObra } | { tipo: 'delegar_todo' };

/**
 * Materiales entregados a la obra: informar uso, pedir la devolución al depósito y
 * delegar la devolución a otra persona (con firma). Antes vivía dentro de "Mis proyectos".
 */
export default function MaterialesObra({
    proyecto,
    usuario,
}: {
    proyecto: { id: string; nombre: string };
    usuario: { id: string; nombreCompleto: string };
}) {
    const [materiales, setMateriales] = useState<MaterialObra[]>([]);
    const [cargando, setCargando] = useState(true);
    const [vista, setVista] = useState<'en_obra' | 'cerrados'>('en_obra');
    const [busqueda, setBusqueda] = useState('');
    const [accion, setAccion] = useState<Accion | null>(null);
    const [personas, setPersonas] = useState<{ id: string; nombreCompleto: string; role: string }[]>([]);

    const cargar = async () => {
        setCargando(true);
        try {
            const res = await safeApiRequest(`/api/materiales-proyecto?proyectoId=${proyecto.id}`);
            const data = await res.json();
            setMateriales(Array.isArray(data) ? data : []);
        } catch {
            showToast('No se pudieron cargar los materiales', 'error');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargar();
        safeApiRequest('/api/operators')
            .then(r => r.json())
            .then(data => Array.isArray(data) && setPersonas(data.filter((op: any) => op.activo)))
            .catch(() => undefined);
    }, [proyecto.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const visibles = useMemo(() => materiales.filter(m => {
        const q = normalizar(busqueda);
        if (q && !normalizar(m.nombre).includes(q) && !normalizar(m.codigo || '').includes(q)) return false;
        return saldoMaterial(m).cerrado === (vista === 'cerrados');
    }), [materiales, busqueda, vista]);

    const conSaldo = materiales.filter(m => saldoMaterial(m).enPoder > 0);

    return (
        <Panel
            title="Materiales en obra"
            description="Lo que entregó el depósito para este proyecto y lo que queda en tu poder"
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl<'en_obra' | 'cerrados'>
                        label="Materiales a mostrar"
                        value={vista}
                        onChange={setVista}
                        options={[{ value: 'en_obra', label: 'En obra' }, { value: 'cerrados', label: 'Devueltos' }]}
                    />
                    {vista === 'en_obra' && conSaldo.length > 0 && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAccion({ tipo: 'delegar_todo' })}>
                            <Share2 aria-hidden="true" /> Delegar todo
                        </button>
                    )}
                </div>
            }
        >
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                    type="search"
                    className="input pl-9"
                    placeholder="Buscar material o código…"
                    aria-label="Buscar material"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                />
            </div>

            {cargando ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Cargando materiales…</p>
            ) : visibles.length === 0 ? (
                <EmptyState title="Sin materiales" description={vista === 'en_obra' ? 'No hay materiales en obra.' : 'Todavía no hay materiales devueltos.'} />
            ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                    {visibles.map(m => {
                        const s = saldoMaterial(m);
                        return (
                            <li key={m.id} className="rounded-xl border border-border bg-card p-3 space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{m.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{m.codigo || 'Sin código'} · {m.unidad}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-muted-foreground">En poder</p>
                                        <p className={`text-sm font-semibold tabular-nums ${s.enPoder > 0 ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground'}`}>{s.enPoder}</p>
                                    </div>
                                </div>
                                <dl className="grid grid-cols-3 gap-2 text-center border-t border-border pt-2">
                                    <div><dt className="text-xs text-muted-foreground">Entregado</dt><dd className="text-sm tabular-nums">{m.cantidadEntregada}</dd></div>
                                    <div><dt className="text-xs text-muted-foreground">Usado</dt><dd className="text-sm tabular-nums text-success-700 dark:text-success-300">{s.usado}</dd></div>
                                    <div><dt className="text-xs text-muted-foreground">Devuelto</dt><dd className="text-sm tabular-nums">{s.devuelto}</dd></div>
                                </dl>
                                {s.pendiente > 0 && (
                                    <p className="flex items-center gap-1.5 rounded-lg bg-warning-50 dark:bg-warning-950/40 px-2 py-1 text-xs font-medium text-warning-800 dark:text-warning-200">
                                        <History className="w-3.5 h-3.5" aria-hidden="true" /> Devolución o delegación pendiente: {s.pendiente}
                                    </p>
                                )}
                                {vista === 'en_obra' && s.enPoder > 0 && (
                                    <div className="flex gap-2">
                                        <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => setAccion({ tipo: 'uso', material: m })}>
                                            <PlusCircle aria-hidden="true" /> Informar uso
                                        </button>
                                        <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => setAccion({ tipo: 'devolucion', material: m })}>
                                            <MinusCircle aria-hidden="true" /> Devolver
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setAccion({ tipo: 'delegar', material: m })} aria-label={`Delegar ${m.nombre}`} title="Delegar la devolución">
                                            <Share2 aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {accion && (accion.tipo === 'uso' || accion.tipo === 'devolucion') && (
                <DialogoMovimiento
                    tipo={accion.tipo}
                    material={accion.material}
                    usuario={usuario}
                    onCerrar={() => setAccion(null)}
                    onListo={() => { setAccion(null); cargar(); }}
                />
            )}
            {accion && (accion.tipo === 'delegar' || accion.tipo === 'delegar_todo') && (
                <DialogoDelegar
                    proyecto={proyecto}
                    usuario={usuario}
                    material={accion.tipo === 'delegar' ? accion.material : null}
                    materialesConSaldo={conSaldo}
                    personas={personas.filter(p => p.id !== usuario.id)}
                    onCerrar={() => setAccion(null)}
                    onListo={() => { setAccion(null); cargar(); }}
                />
            )}
        </Panel>
    );
}

function DialogoMovimiento({ tipo, material, usuario, onCerrar, onListo }: {
    tipo: 'uso' | 'devolucion';
    material: MaterialObra;
    usuario: { id: string; nombreCompleto: string };
    onCerrar: () => void;
    onListo: () => void;
}) {
    const [cantidad, setCantidad] = useState('');
    const [nota, setNota] = useState('');
    const [enviando, setEnviando] = useState(false);
    const maximo = saldoMaterial(material).enPoder;

    const enviar = async () => {
        const qty = Number(cantidad.replace(',', '.'));
        if (!(qty > 0)) return showToast('Ingresá una cantidad válida', 'error');
        if (qty > maximo) return showToast(`No podés ${tipo === 'uso' ? 'informar' : 'devolver'} más de lo que tenés en poder (${maximo} ${material.unidad})`, 'error');
        setEnviando(true);
        try {
            const res = await safeApiRequest(tipo === 'uso' ? '/api/materiales-proyecto/uso' : '/api/materiales-proyecto/devolucion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tipo === 'uso'
                    ? { materialId: material.id, cantidadUtilizada: qty, operadorNombre: usuario.nombreCompleto, operatorId: usuario.id }
                    : { materialId: material.id, cantidadADevolver: qty, estado: 'pendiente', comentario: nota, operatorId: usuario.id }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                return showToast(err?.error || 'No se pudo registrar', 'error');
            }
            showToast(tipo === 'uso' ? 'Uso registrado' : 'Devolución pedida al depósito', 'success');
            onListo();
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
            title={tipo === 'uso' ? 'Informar uso' : 'Devolver material'}
            description={material.nombre}
            size="md"
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={enviando}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={enviar} disabled={!cantidad || enviando}>
                        <Package aria-hidden="true" /> {enviando ? 'Enviando…' : tipo === 'uso' ? 'Confirmar uso' : 'Pedir devolución'}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <Input
                    label={`Cantidad (${material.unidad})`}
                    hint={`Máximo: ${maximo}`}
                    inputMode="decimal"
                    value={cantidad}
                    onChange={e => setCantidad(e.target.value)}
                    data-autofocus
                    required
                />
                {tipo === 'devolucion' && (
                    <Textarea label="Observación" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional: estado del material sobrante" />
                )}
            </div>
        </Dialog>
    );
}

function DialogoDelegar({ proyecto, usuario, material, materialesConSaldo, personas, onCerrar, onListo }: {
    proyecto: { id: string; nombre: string };
    usuario: { id: string; nombreCompleto: string };
    /** null = delegar todos los materiales con saldo. */
    material: MaterialObra | null;
    materialesConSaldo: MaterialObra[];
    personas: { id: string; nombreCompleto: string; role: string }[];
    onCerrar: () => void;
    onListo: () => void;
}) {
    const [destinoId, setDestinoId] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [nota, setNota] = useState('');
    const [firma, setFirma] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const maximo = material ? saldoMaterial(material).enPoder : 0;

    const enviar = async () => {
        const destino = personas.find(p => p.id === destinoId);
        if (!destino) return showToast('Elegí a quién delegar', 'error');
        if (!firma) return showToast('Firmá para autorizar la delegación', 'error');
        const comun = {
            estado: 'delegacion_pendiente',
            comentario: nota,
            delegadoAId: destino.id,
            delegadoANombre: destino.nombreCompleto,
            delegadoPorId: usuario.id,
            delegadoPorNombre: usuario.nombreCompleto,
            firmaDelegacion: firma,
            operatorId: usuario.id,
        };
        let url: string;
        let body: object;
        if (material) {
            const qty = Number(cantidad.replace(',', '.'));
            if (!(qty > 0)) return showToast('Ingresá una cantidad válida', 'error');
            if (qty > maximo) return showToast(`No podés delegar más de lo que tenés en poder (${maximo} ${material.unidad})`, 'error');
            url = '/api/materiales-proyecto/devolucion';
            body = { ...comun, materialId: material.id, cantidadADevolver: qty };
        } else {
            const delegations = materialesConSaldo.map(m => {
                const enPoder = saldoMaterial(m).enPoder;
                return { materialId: m.id, cantidadADevolver: enPoder, materialNombre: m.nombre, unidad: m.unidad, balance: enPoder };
            });
            if (delegations.length === 0) return showToast('No hay materiales para delegar', 'error');
            url = '/api/materiales-proyecto/devolucion/batch';
            body = { ...comun, delegations, projectId: proyecto.id, projectName: proyecto.nombre };
        }
        setEnviando(true);
        try {
            const res = await safeApiRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                return showToast(err?.error || 'No se pudo delegar', 'error');
            }
            showToast(material ? 'Delegación pedida' : 'Se delegaron todos los materiales', 'success');
            onListo();
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
            title={material ? 'Delegar la devolución' : 'Delegar todos los materiales'}
            description={material ? material.nombre : `${materialesConSaldo.length} materiales con saldo · ${proyecto.nombre}`}
            size="md"
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={enviando}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={enviar} disabled={!destinoId || !firma || (!!material && !cantidad) || enviando}>
                        <Share2 aria-hidden="true" /> {enviando ? 'Enviando…' : 'Delegar'}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <Select label="Delegar a" value={destinoId} onChange={e => setDestinoId(e.target.value)} required>
                    <option value="">Elegí una persona</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombreCompleto}</option>)}
                </Select>
                {material && (
                    <Input label={`Cantidad (${material.unidad})`} hint={`Máximo: ${maximo}`} inputMode="decimal" value={cantidad} onChange={e => setCantidad(e.target.value)} required />
                )}
                <Textarea label="Nota" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional" />
                <p className="flex items-start gap-2 rounded-lg bg-warning-50 dark:bg-warning-950/40 p-2 text-xs text-warning-800 dark:text-warning-200">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    El material sigue pendiente de devolución hasta que la otra persona acepte y lo devuelva al depósito.
                </p>
                <div>
                    <div className="flex items-center justify-between">
                        <span className="field-label">Tu firma</span>
                        {firma && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFirma(null)}>Borrar firma</button>}
                    </div>
                    <div className="rounded-xl border border-border p-4 flex justify-center min-h-[120px] items-center">
                        {firma ? (
                            <span className="flex items-center gap-2 text-sm font-medium text-success-700 dark:text-success-300">
                                <ShieldCheck className="w-5 h-5" aria-hidden="true" /> Firmado electrónicamente
                            </span>
                        ) : (
                            <SignatureButton
                                documentId={proyecto.id}
                                documentVersion="MATERIAL"
                                onSignComplete={(sig: { FirmaID: string }) => setFirma(sig.FirmaID)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
