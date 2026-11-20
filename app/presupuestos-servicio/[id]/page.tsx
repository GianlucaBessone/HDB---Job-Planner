'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { Calculator, Save, Send, CheckCircle2, XCircle, GitBranch, Copy, Trash2, FolderPlus, FolderOpen } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { ConfirmDialogBase, ErrorState, LoadingState, Tabs } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import PresupuestoEditor, { type PresupuestoEditorHandle } from '@/components/presupuestosServicio/PresupuestoEditor';
import DocumentoPreview from '@/components/presupuestosServicio/DocumentoPreview';
import HistorialRevisiones from '@/components/presupuestosServicio/HistorialRevisiones';
import { AceptarDialog, EnviarDialog, RechazarDialog, RevisionDialog } from '@/components/presupuestosServicio/AccionesDialogs';
import { api, fechaCorta, EstadoPresupuestoBadge } from '@/components/presupuestosServicio/cliente';
import { ESTADOS_PRESUPUESTO, type EstadoPresupuesto, type OpcionesDocumento } from '@/lib/presupuestosServicio/calculos';

type Dlg = null | 'enviar' | 'aceptar' | 'rechazar' | 'revision' | 'descartar';

export default function PresupuestoDetallePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { puede } = useAcceso();
    const [p, setP] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState('contenido');
    const [dlg, setDlg] = useState<Dlg>(null);
    const [dirty, setDirty] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [opcionesDoc, setOpcionesDoc] = useState<OpcionesDocumento | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const editor = useRef<PresupuestoEditorHandle>(null);
    const pathname = usePathname();
    const setTitle = useHistoryStore((s) => s.setTitle);
    useEffect(() => {
        if (p?.numero && pathname) setTitle(pathname, p.numero);
    }, [p?.numero, pathname, setTitle]);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            setP(await api(`/api/presupuestos-servicio/${id}`));
        } catch (e: any) {
            setError(e.message);
        }
    }, [id]);
    useEffect(() => { cargar(); }, [cargar]);

    if (error && !p) return <ErrorState description={error} onRetry={cargar} />;
    if (!p) return <LoadingState label="Cargando presupuesto…" />;

    const estado = p.estado as EstadoPresupuesto;
    const v = p.versiones[0];
    const puedeGestionar = puede('presupuestos.gestionar');
    const puedeAprobar = puede('presupuestos.aprobar');
    const puedeConvertir = puede('presupuestos.convertir');
    const editable = estado === 'borrador' && v?.estado === 'borrador' && puedeGestionar;
    const nuncaEnviado = estado === 'borrador' && p.versiones.length === 1;

    const guardar = async () => {
        setGuardando(true);
        const r = await editor.current?.guardar();
        setGuardando(false);
        if (r) await cargar();
        return Boolean(r);
    };

    const enviar = async () => {
        if (dirty && !(await guardar())) return;
        setDlg('enviar');
    };

    const duplicar = async () => {
        setTrabajando(true);
        try {
            const r = await api<any>(`/api/presupuestos-servicio/${id}/duplicar`, { method: 'POST' });
            showToast(r.message, 'success');
            router.push(`/presupuestos-servicio/${r.presupuesto.id}`);
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setTrabajando(false);
        }
    };

    const descartar = async () => {
        setTrabajando(true);
        try {
            await api(`/api/presupuestos-servicio/${id}`, { method: 'DELETE' });
            showToast('Presupuesto descartado', 'success');
            router.push('/presupuestos-servicio');
        } catch (e: any) {
            showToast(e.message, 'error');
            setTrabajando(false);
        }
    };

    type Accion = { id: string; label: string; icon: React.ReactNode; onClick: () => void; variant: 'primary' | 'outline' | 'danger' | 'ghost'; disabled?: boolean; hideLabelOnMobile?: boolean };
    const acciones: Accion[] = [];
    if (estado === 'borrador' && puedeGestionar) {
        if (nuncaEnviado) acciones.push({ id: 'descartar', label: 'Descartar', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDlg('descartar'), variant: 'danger', hideLabelOnMobile: true });
        acciones.push({ id: 'guardar', label: guardando ? 'Guardando…' : 'Guardar', icon: <Save className="w-4 h-4" />, onClick: guardar, variant: 'outline', disabled: guardando || !dirty });
        acciones.push({ id: 'enviar', label: 'Enviar al cliente', icon: <Send className="w-4 h-4" />, onClick: enviar, variant: 'primary', disabled: guardando });
    }
    if ((estado === 'enviado' || estado === 'vencido') && puedeAprobar) {
        acciones.push({ id: 'rechazar', label: 'Registrar rechazo', icon: <XCircle className="w-4 h-4" />, onClick: () => setDlg('rechazar'), variant: 'danger', hideLabelOnMobile: true });
    }
    if (['enviado', 'vencido', 'rechazado'].includes(estado) && puedeGestionar) {
        acciones.push({ id: 'revision', label: 'Nueva revisión', icon: <GitBranch className="w-4 h-4" />, onClick: () => setDlg('revision'), variant: estado === 'rechazado' ? 'primary' : 'outline' });
    }
    if ((estado === 'enviado' || estado === 'vencido') && puedeAprobar) {
        acciones.push({ id: 'aceptar', label: 'Registrar aceptación', icon: <CheckCircle2 className="w-4 h-4" />, onClick: () => setDlg('aceptar'), variant: 'primary' });
    }
    if ((estado === 'aceptado' || estado === 'rechazado') && puedeGestionar) {
        acciones.push({ id: 'duplicar', label: 'Duplicar', icon: <Copy className="w-4 h-4" />, onClick: duplicar, variant: 'outline', disabled: trabajando, hideLabelOnMobile: true });
    }
    if (estado === 'aceptado') {
        if (p.proyecto) acciones.push({ id: 'proyecto', label: `Ver ${p.proyecto.codigoProyecto || 'proyecto'}`, icon: <FolderOpen className="w-4 h-4" />, onClick: () => router.push(`/projects?proyecto=${p.proyecto.id}`), variant: 'outline' });
        else if (puedeConvertir) acciones.push({ id: 'convertir', label: 'Convertir en proyecto', icon: <FolderPlus className="w-4 h-4" />, onClick: () => router.push(`/projects/nuevo?presupuestoId=${p.id}`), variant: 'primary' });
    }
    // La acción primaria va siempre última.
    acciones.sort((a, b) => Number(a.variant === 'primary') - Number(b.variant === 'primary'));

    const descripcion = [
        p.clienteNombre,
        `Revisión ${p.versionActual}`,
        estado === 'enviado' && p.fechaVencimiento ? `vence el ${fechaCorta(p.fechaVencimiento)}` : null,
        estado === 'rechazado' && p.motivoRechazo ? `Rechazado: ${p.motivoRechazo}` : null,
    ].filter(Boolean).join(' · ');

    const alActualizar = (np: any) => { setP(np); setDirty(false); };

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title={`${p.numero} · ${p.titulo}`}
                description={descripcion}
                icon={<Calculator className="w-5 h-5" />}
                actions={acciones}
                toolbar={<span className="inline-flex items-center gap-2"><EstadoPresupuestoBadge estado={estado} /><span className="text-xs text-slate-500 dark:text-slate-400">{ESTADOS_PRESUPUESTO[estado]?.label === 'Borrador' && dirty ? 'Cambios sin guardar' : ''}</span></span>}
            />
            <Tabs
                label="Secciones del presupuesto"
                value={tab}
                onChange={setTab}
                tabs={[
                    { id: 'contenido', label: editable ? 'Contenido' : 'Detalle' },
                    { id: 'documento', label: 'Documento' },
                    { id: 'historial', label: 'Revisiones y actividad', count: p.versiones.length },
                ]}
            />

            <div hidden={tab !== 'contenido'}>
                <PresupuestoEditor ref={editor} presupuestoId={p.id} inicial={p} soloLectura={!editable} onGuardado={() => undefined} onCambio={setDirty} />
            </div>
            {tab === 'documento' && (
                <DocumentoPreview
                    presupuestoId={p.id}
                    version={v.version}
                    opcionesIniciales={v.opcionesDocumento}
                    ivaDiscriminado={v.ivaDiscriminado}
                    listaNombre={v.listaPrecioNombre}
                    editable={puedeGestionar && v.estado !== 'aceptada'}
                    marca={v.updatedAt}
                    onOpciones={setOpcionesDoc}
                />
            )}
            {tab === 'historial' && <HistorialRevisiones presupuesto={p} />}

            <EnviarDialog open={dlg === 'enviar'} onClose={() => setDlg(null)} presupuesto={p} onHecho={alActualizar} opciones={opcionesDoc} />
            <AceptarDialog open={dlg === 'aceptar'} onClose={() => setDlg(null)} presupuesto={p} onHecho={alActualizar} />
            <RechazarDialog open={dlg === 'rechazar'} onClose={() => setDlg(null)} presupuesto={p} onHecho={alActualizar} />
            <RevisionDialog open={dlg === 'revision'} onClose={() => setDlg(null)} presupuesto={p} onHecho={(np) => { alActualizar(np); setTab('contenido'); }} />
            <ConfirmDialogBase
                open={dlg === 'descartar'}
                onCancel={() => setDlg(null)}
                onConfirm={descartar}
                tone="danger"
                title={`Descartar ${p.numero}`}
                message="El presupuesto nunca se envió. Se borra con su contenido."
                confirmLabel="Descartar presupuesto"
                loading={trabajando}
            />
        </div>
    );
}
