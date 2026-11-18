'use client';

import { useEffect, useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { Button, Dialog } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { hoyArgentina, NIVELES_DOCUMENTO, type OpcionesDocumento } from '@/lib/presupuestosServicio/calculos';
import { api, pesos } from './cliente';

interface Base {
    open: boolean;
    onClose: () => void;
    presupuesto: any;
    onHecho: (p: any) => void;
}

function Aviso({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-800 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-200">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{children}</span>
        </div>
    );
}

export function EnviarDialog({ open, onClose, presupuesto, onHecho, opciones }: Base & { opciones: OpcionesDocumento | null }) {
    const [enviando, setEnviando] = useState(false);
    const v = presupuesto?.versiones?.[0];
    const nivel = NIVELES_DOCUMENTO.find((n) => n.nivel === (opciones?.nivel ?? 1));
    const enviar = async () => {
        setEnviando(true);
        try {
            const r = await api<any>(`/api/presupuestos-servicio/${presupuesto.id}/estado`, { method: 'POST', json: { accion: 'enviar', ...(opciones ? { opcionesDocumento: opciones } : {}) } });
            showToast(r.message, 'success');
            onHecho(r.presupuesto);
            onClose();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setEnviando(false);
        }
    };
    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!enviando}
            title="Enviar al cliente"
            description={`${presupuesto?.numero} · Revisión ${v?.version} · ${pesos(v?.total, 0)}`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
                    <Button icon={<Send />} isLoading={enviando} onClick={enviar}>Marcar como enviado</Button>
                </>
            }
        >
            <div className="space-y-3 text-sm">
                <p>El documento sale en nivel <b className="font-semibold">{nivel?.nombre}</b>. Descargalo desde la pestaña Documento para mandarlo por mail o WhatsApp.</p>
                <p>La oferta vence en {v?.validezDias} días.</p>
                <Aviso>Después de enviarlo no se puede editar: cualquier cambio abre una revisión nueva y la actual queda guardada.</Aviso>
            </div>
        </Dialog>
    );
}

export function AceptarDialog({ open, onClose, presupuesto, onHecho }: Base) {
    const [fecha, setFecha] = useState(hoyArgentina());
    const [referencia, setReferencia] = useState('');
    const [comentario, setComentario] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const v = presupuesto?.versiones?.[0];
    useEffect(() => {
        if (open) { setFecha(hoyArgentina()); setReferencia(''); setComentario(''); setError(null); }
    }, [open]);
    const aceptar = async () => {
        if (!fecha) return setError('Indicá la fecha de aceptación');
        if (fecha > hoyArgentina()) return setError('La fecha no puede ser futura');
        setGuardando(true);
        try {
            const r = await api<any>(`/api/presupuestos-servicio/${presupuesto.id}/estado`, {
                method: 'POST',
                json: { accion: 'aceptar', fechaAceptacion: fecha, referenciaCliente: referencia || null, comentario: comentario || null },
            });
            showToast(r.message, 'success');
            onHecho(r.presupuesto);
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };
    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!guardando}
            title="Registrar aceptación del cliente"
            description={`${presupuesto?.numero} · ${presupuesto?.clienteNombre} · ${pesos(v?.total, 0)}`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button isLoading={guardando} onClick={aceptar}>Registrar aceptación</Button>
                </>
            }
        >
            <div className="space-y-4">
                {presupuesto?.estado === 'vencido' && (
                    <p className="text-sm text-warning-800 dark:text-warning-200">La validez del presupuesto venció. Registrá la aceptación solo si mantenés los precios.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <span className="field-label">Revisión aceptada</span>
                        <p className="text-sm py-2">Revisión {v?.version} (vigente)</p>
                    </div>
                    <label className="block">
                        <span className="field-label">Fecha de aceptación<span className="text-danger-600 ml-0.5" aria-hidden="true">*</span></span>
                        <input type="date" className="input" value={fecha} max={hoyArgentina()} onChange={(e) => setFecha(e.target.value)} required />
                    </label>
                </div>
                <label className="block">
                    <span className="field-label">Referencia del cliente</span>
                    <input className="input" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={200} placeholder="Orden de compra, mail o nota de pedido" />
                </label>
                <label className="block">
                    <span className="field-label">Comentario</span>
                    <textarea className="input min-h-[64px] py-2" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={1000} />
                </label>
                <Aviso>Se congela la revisión {v?.version}: queda una copia que no se puede modificar ni borrar. Para cambiar algo después hay que duplicar el presupuesto.</Aviso>
                {error && <p className="field-error" role="alert">{error}</p>}
            </div>
        </Dialog>
    );
}

export function RechazarDialog({ open, onClose, presupuesto, onHecho }: Base) {
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { if (open) { setMotivo(''); setError(null); } }, [open]);
    const rechazar = async () => {
        if (motivo.trim().length < 3) return setError('Contá brevemente el motivo del rechazo');
        setGuardando(true);
        try {
            const r = await api<any>(`/api/presupuestos-servicio/${presupuesto.id}/estado`, { method: 'POST', json: { accion: 'rechazar', motivo } });
            showToast(r.message, 'success');
            onHecho(r.presupuesto);
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };
    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!guardando}
            title="Registrar rechazo del cliente"
            description={`${presupuesto?.numero} · ${presupuesto?.clienteNombre}`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button variant="danger" isLoading={guardando} onClick={rechazar}>Registrar rechazo</Button>
                </>
            }
        >
            <label className="block">
                <span className="field-label">Motivo<span className="text-danger-600 ml-0.5" aria-hidden="true">*</span></span>
                <textarea className="input min-h-[80px] py-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} placeholder="Ej.: precio alto, eligió otra empresa, se postergó la obra" aria-invalid={Boolean(error)} />
            </label>
            {error && <p className="field-error" role="alert">{error}</p>}
            <p className="field-hint">Si el cliente pide otro precio, después podés abrir una revisión nueva.</p>
        </Dialog>
    );
}

export function RevisionDialog({ open, onClose, presupuesto, onHecho }: Base) {
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);
    useEffect(() => { if (open) setNota(''); }, [open]);
    const crear = async () => {
        setGuardando(true);
        try {
            const r = await api<any>(`/api/presupuestos-servicio/${presupuesto.id}/revisiones`, { method: 'POST', json: { nota: nota || null } });
            showToast(r.message, 'success');
            onHecho(r.presupuesto);
            onClose();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setGuardando(false);
        }
    };
    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!guardando}
            title="Nueva revisión"
            description={`Se copia la revisión ${presupuesto?.versionActual} a la ${Number(presupuesto?.versionActual) + 1}, en borrador, para editarla.`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button isLoading={guardando} onClick={crear}>Crear revisión {Number(presupuesto?.versionActual) + 1}</Button>
                </>
            }
        >
            <label className="block">
                <span className="field-label">Qué cambia y por qué</span>
                <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} placeholder="Ej.: el cliente pidió sumar las pruebas" data-autofocus />
            </label>
            <p className="field-hint">La revisión {presupuesto?.versionActual} queda guardada tal como está.</p>
        </Dialog>
    );
}
