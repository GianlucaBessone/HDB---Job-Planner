'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileSignature, FileText, X } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, Button, Dialog, EmptyState, ErrorState, Input, LoadingState, Panel, Textarea } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { fechaPortal, pesosPortal, portalApi } from '@/components/portal/portalApi';

interface PresupuestoPortal {
    id: string;
    numero: string;
    titulo: string;
    estado: 'enviado' | 'vencido' | 'aceptado' | 'rechazado';
    revision: number;
    total: number;
    ivaDiscriminado: boolean;
    enviado: string | null;
    vence: string | null;
    puedeResponder: boolean;
    aceptacion: { fecha: string; por: string | null; referencia: string | null } | null;
    motivoRechazo: string | null;
}

const ESTADO: Record<PresupuestoPortal['estado'], { label: string; tone: 'info' | 'warning' | 'success' | 'danger' }> = {
    enviado: { label: 'Esperando tu respuesta', tone: 'info' },
    vencido: { label: 'Vencido', tone: 'warning' },
    aceptado: { label: 'Aceptado', tone: 'success' },
    rechazado: { label: 'Rechazado', tone: 'danger' },
};

/**
 * Presupuestos de servicio enviados al cliente. Quien está habilitado los acepta (con su referencia, por ejemplo el
 * número de orden de compra) o los rechaza; la aceptación queda sellada igual que cuando la registra HDB.
 */
export default function PortalPresupuestosPage() {
    const [datos, setDatos] = useState<{ presupuestos: PresupuestoPortal[]; puedeResponder: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');
    const [respondiendo, setRespondiendo] = useState<{ p: PresupuestoPortal; accion: 'aceptar' | 'rechazar' } | null>(null);

    const cargar = useCallback(() => {
        portalApi<{ presupuestos: PresupuestoPortal[]; puedeResponder: boolean }>('/api/portal-clientes/presupuestos')
            .then(setDatos)
            .catch((e) => setError(e.message));
    }, []);
    useEffect(cargar, [cargar]);

    const pendientes = useMemo(() => (datos?.presupuestos || []).filter((p) => p.estado === 'enviado'), [datos]);
    const historial = useMemo(() => (datos?.presupuestos || []).filter((p) => p.estado !== 'enviado'), [datos]);
    const lista = tab === 'pendientes' ? pendientes : historial;

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Presupuestos"
                description="Presupuestos de servicio que te envió HDB"
                icon={<FileSignature className="w-5 h-5" />}
                tabs={[
                    { id: 'pendientes', label: 'Por responder', count: datos ? pendientes.length : undefined },
                    { id: 'historial', label: 'Historial', count: datos ? historial.length : undefined },
                ]}
                activeTabId={tab}
                onTabChange={(id) => setTab(id as 'pendientes')}
            />
            {datos && !datos.puedeResponder && pendientes.length > 0 && (
                <p className="text-sm text-muted-foreground">Podés ver los presupuestos. Para aceptarlos o rechazarlos desde acá, pedile a HDB que te habilite.</p>
            )}
            {error ? (
                <ErrorState title="No se pudieron cargar los presupuestos" description={error} />
            ) : !datos ? (
                <LoadingState label="Cargando presupuestos…" />
            ) : lista.length === 0 ? (
                <EmptyState icon={<FileSignature />} title={tab === 'pendientes' ? 'No hay presupuestos por responder' : 'Todavía no hay presupuestos respondidos'} />
            ) : (
                <Panel padded={false}>
                    <ul className="divide-y divide-border">
                        {lista.map((p) => {
                            const e = ESTADO[p.estado];
                            return (
                                <li key={p.id} className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className="text-[13px] font-medium text-foreground">
                                            {p.numero} · {p.titulo}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Revisión {p.revision} · enviado {fechaPortal(p.enviado)}
                                            {p.vence ? ` · válido hasta ${fechaPortal(p.vence)}` : ''}
                                        </p>
                                        {p.aceptacion && (
                                            <p className="text-xs text-muted-foreground">
                                                Aceptado el {fechaPortal(p.aceptacion.fecha)}
                                                {p.aceptacion.por ? ` por ${p.aceptacion.por}` : ''}
                                                {p.aceptacion.referencia ? ` · referencia ${p.aceptacion.referencia}` : ''}
                                            </p>
                                        )}
                                        {p.motivoRechazo && <p className="text-xs text-muted-foreground">Motivo: {p.motivoRechazo}</p>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <span className="text-sm font-semibold tabular-nums">
                                            {pesosPortal(p.total)}
                                            <span className="text-xs font-normal text-muted-foreground"> {p.ivaDiscriminado ? '+ IVA' : 'final'}</span>
                                        </span>
                                        <Badge tone={e.tone}>{e.label}</Badge>
                                        <a href={`/api/portal-clientes/presupuestos/${p.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                            <FileText className="w-4 h-4" aria-hidden="true" /> Ver PDF
                                        </a>
                                        {p.puedeResponder && (
                                            <>
                                                <Button size="sm" variant="danger-ghost" icon={<X />} onClick={() => setRespondiendo({ p, accion: 'rechazar' })}>
                                                    Rechazar
                                                </Button>
                                                <Button size="sm" icon={<Check />} onClick={() => setRespondiendo({ p, accion: 'aceptar' })}>
                                                    Aceptar
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
            )}

            {respondiendo && (
                <ResponderDialog
                    p={respondiendo.p}
                    accion={respondiendo.accion}
                    onClose={() => setRespondiendo(null)}
                    onListo={() => {
                        setRespondiendo(null);
                        cargar();
                    }}
                />
            )}
        </div>
    );
}

function ResponderDialog({ p, accion, onClose, onListo }: { p: PresupuestoPortal; accion: 'aceptar' | 'rechazar'; onClose: () => void; onListo: () => void }) {
    const [referencia, setReferencia] = useState('');
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const aceptar = accion === 'aceptar';

    const enviar = async () => {
        if (!aceptar && texto.trim().length < 3) return showToast('Contanos el motivo del rechazo', 'error');
        setEnviando(true);
        try {
            await portalApi(`/api/portal-clientes/presupuestos/${p.id}/responder`, {
                method: 'POST',
                json: aceptar
                    ? { respuesta: 'aceptar', referenciaCliente: referencia.trim() || null, comentario: texto.trim() || null }
                    : { respuesta: 'rechazar', motivo: texto.trim() },
            });
            showToast(aceptar ? `Presupuesto ${p.numero} aceptado` : `Presupuesto ${p.numero} rechazado`);
            onListo();
        } catch (e: any) {
            showToast(e.message || 'No se pudo enviar la respuesta', 'error');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            dismissible={!enviando}
            size="md"
            title={aceptar ? `Aceptar ${p.numero}` : `Rechazar ${p.numero}`}
            description={
                aceptar
                    ? `Aceptás la revisión ${p.revision} por ${pesosPortal(p.total)} ${p.ivaDiscriminado ? '+ IVA' : 'final'}. Queda registrada con tu nombre y la fecha de hoy.`
                    : 'HDB recibe el motivo y puede enviarte una revisión.'
            }
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={enviando}>
                        Volver
                    </Button>
                    <Button variant={aceptar ? 'primary' : 'danger'} onClick={enviar} isLoading={enviando}>
                        {aceptar ? 'Aceptar presupuesto' : 'Rechazar presupuesto'}
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                {aceptar && (
                    <Input label="Tu referencia (opcional)" hint="Por ejemplo, el número de orden de compra" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={80} />
                )}
                <Textarea
                    label={aceptar ? 'Comentario (opcional)' : 'Motivo del rechazo'}
                    required={!aceptar}
                    rows={3}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    maxLength={1000}
                />
            </div>
        </Dialog>
    );
}
