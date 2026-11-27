'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { FileText, Paperclip, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmDialogBase, Dialog, EmptyState, ErrorState, Input, LoadingState, Panel, Select, Textarea } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { api } from '@/components/presupuestosServicio/cliente';
import { useAcceso } from '@/lib/store/useAccessStore';
import {
    ARCHIVO_LEGAJO_MAX_BYTES,
    ESTADO_DOCUMENTO_INFO,
    estadoDocumento,
    TIPO_DOCUMENTO_INFO,
    TIPOS_DOCUMENTO,
    type DatosLegajo,
    type DocumentoLegajo,
    type FichaLegajo,
    type TipoDocumento,
} from '@/lib/legajoTipos';

const fechaCorta = (f: string | null) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-AR') : '—');
const hoy = () => new Date().toLocaleDateString('en-CA');

type CampoDatos = keyof DatosLegajo;
const SECCIONES: { titulo: string; descripcion?: string; campos: { k: CampoDatos; label: string; tipo?: 'date' | 'email' | 'tel'; ancho?: 2 }[] }[] = [
    {
        titulo: 'Datos laborales',
        campos: [
            { k: 'legajo', label: 'Número de legajo' },
            { k: 'fechaIngreso', label: 'Fecha de ingreso', tipo: 'date' },
            { k: 'fechaEgreso', label: 'Fecha de egreso', tipo: 'date' },
        ],
    },
    {
        titulo: 'Datos personales',
        campos: [
            { k: 'dni', label: 'DNI' },
            { k: 'cuil', label: 'CUIL' },
            { k: 'fechaNacimiento', label: 'Fecha de nacimiento', tipo: 'date' },
            { k: 'telefono', label: 'Teléfono', tipo: 'tel' },
            { k: 'email', label: 'Email personal', tipo: 'email' },
            { k: 'obraSocial', label: 'Obra social' },
            { k: 'domicilio', label: 'Domicilio', ancho: 2 },
            { k: 'localidad', label: 'Localidad' },
            { k: 'grupoSanguineo', label: 'Grupo sanguíneo' },
        ],
    },
    {
        titulo: 'Contacto de emergencia',
        descripcion: 'A quién avisar si le pasa algo en una obra',
        campos: [
            { k: 'contactoEmergenciaNombre', label: 'Nombre' },
            { k: 'contactoEmergenciaTelefono', label: 'Teléfono', tipo: 'tel' },
            { k: 'contactoEmergenciaRelacion', label: 'Relación (pareja, madre…)' },
        ],
    },
];

/**
 * Legajo de una persona: datos laborales y personales, contacto de emergencia y documentos con vencimiento. Se usa en
 * la ficha de la persona (P16). Sin `gestiona` se ve en solo lectura (por ejemplo, la propia ficha).
 */
export default function LegajoFicha({ operatorId: id, gestiona: gestionaProp, propia = false }: { operatorId: string; gestiona?: boolean; propia?: boolean }) {
    const { puede, cargado } = useAcceso();
    const gestiona = gestionaProp ?? puede('rrhh.legajo_gestionar');
    const [ficha, setFicha] = useState<FichaLegajo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<DatosLegajo | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [editando, setEditando] = useState<{ doc: DocumentoLegajo | null } | null>(null);
    const [borrando, setBorrando] = useState<DocumentoLegajo | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const setTitle = useHistoryStore((s) => s.setTitle);

    const cargar = useCallback(async () => {
        try {
            const r = await api<{ ficha: FichaLegajo }>(`/api/rrhh/legajos/${id}`);
            setTitle(`/personas/${id}`, r.ficha.persona.nombreCompleto);
            setFicha(r.ficha);
            setForm(r.ficha.datos);
        } catch (e: any) {
            setError(e.message || 'No se pudo cargar el legajo');
        }
    }, [id, setTitle]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const cambios = !!(ficha && form) && (Object.keys(form) as CampoDatos[]).some((k) => (form[k] || null) !== (ficha.datos[k] || null));

    const guardar = async () => {
        if (!ficha || !form) return;
        const enviar = Object.fromEntries((Object.keys(form) as CampoDatos[]).filter((k) => (form[k] || null) !== (ficha.datos[k] || null)).map((k) => [k, form[k] || null]));
        setGuardando(true);
        try {
            const r = await api<{ ficha: FichaLegajo }>(`/api/rrhh/legajos/${id}`, { method: 'PUT', json: enviar });
            setFicha(r.ficha);
            setForm(r.ficha.datos);
            showToast('Legajo guardado');
        } catch (e: any) {
            showToast(e.message || 'No se pudo guardar', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const borrar = async () => {
        if (!borrando) return;
        setOcupado(true);
        try {
            await api(`/api/rrhh/legajos/documentos/${borrando.id}`, { method: 'DELETE' });
            showToast('Documento borrado');
            setBorrando(null);
            await cargar();
        } catch (e: any) {
            showToast(e.message || 'No se pudo borrar', 'error');
        } finally {
            setOcupado(false);
        }
    };

    if (error) return <ErrorState title="No se pudo cargar el legajo" description={error} />;
    if (!ficha || !form || !cargado) return <LoadingState label="Cargando legajo…" />;

    return (
        <div className="w-full space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
                <div className="space-y-5">
                    {SECCIONES.map((s) => (
                        <Panel key={s.titulo} title={s.titulo} description={s.descripcion}>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {s.campos.map((c) => (
                                    <div key={c.k} className={c.ancho === 2 ? 'sm:col-span-2' : undefined}>
                                        <Input
                                            label={c.label}
                                            type={c.tipo || 'text'}
                                            value={form[c.k] ?? ''}
                                            readOnly={!gestiona}
                                            onChange={(e) => setForm({ ...form, [c.k]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    ))}
                    {/* Notas internas de RRHH: no se muestran en la propia ficha */}
                    {!propia && (
                    <Panel title="Observaciones">
                        <Textarea
                            aria-label="Observaciones"
                            rows={3}
                            value={form.observaciones ?? ''}
                            readOnly={!gestiona}
                            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                            placeholder="Notas internas de RRHH"
                        />
                        {ficha.actualizadoPorNombre && ficha.actualizado && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Última modificación: {ficha.actualizadoPorNombre}, {new Date(ficha.actualizado).toLocaleString('es-AR')}
                            </p>
                        )}
                    </Panel>
                    )}
                    {gestiona && (
                        <div className="flex justify-end">
                            <Button icon={<Save />} onClick={guardar} isLoading={guardando} disabled={!cambios}>
                                Guardar cambios
                            </Button>
                        </div>
                    )}
                </div>

                <Panel
                    title="Documentos"
                    description="Apto médico, licencia de conducir, ART, habilitaciones"
                    padded={false}
                    actions={
                        gestiona && (
                            <Button size="sm" icon={<Plus />} onClick={() => setEditando({ doc: null })}>
                                Agregar
                            </Button>
                        )
                    }
                >
                    {ficha.documentos.length === 0 ? (
                        <EmptyState icon={<FileText />} title="Sin documentos" description="Cargá los documentos con vencimiento: aparecen en el calendario de vencimientos." />
                    ) : (
                        <ul className="divide-y divide-border">
                            {ficha.documentos.map((d) => {
                                const est = ESTADO_DOCUMENTO_INFO[estadoDocumento(d.fechaVencimiento, hoy())];
                                return (
                                    <li key={d.id} className="px-4 py-3 space-y-1">
                                        <div className="flex items-start gap-2">
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-medium text-foreground">{d.nombre}</span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {TIPO_DOCUMENTO_INFO[d.tipo].label}
                                                    {d.numero ? ` · Nº ${d.numero}` : ''}
                                                    {d.fechaEmision ? ` · emitido ${fechaCorta(d.fechaEmision)}` : ''}
                                                </span>
                                            </span>
                                            <Badge tone={est.tone}>{d.fechaVencimiento ? `${est.label} · ${fechaCorta(d.fechaVencimiento)}` : est.label}</Badge>
                                        </div>
                                        {d.observaciones && <p className="text-xs text-muted-foreground whitespace-pre-line">{d.observaciones}</p>}
                                        <div className="flex items-center gap-1 -ml-2">
                                            {d.tieneArchivo && (
                                                <a href={`/api/rrhh/legajos/documentos/${d.id}/archivo`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                                                    <Paperclip className="w-4 h-4" aria-hidden="true" />
                                                    <span className="truncate max-w-[180px]">{d.archivoNombre || 'Ver archivo'}</span>
                                                </a>
                                            )}
                                            <span className="flex-1" />
                                            {gestiona && (
                                                <>
                                                    <Button variant="ghost" size="icon-sm" icon={<Pencil />} aria-label={`Editar ${d.nombre}`} onClick={() => setEditando({ doc: d })} />
                                                    <Button variant="danger-ghost" size="icon-sm" icon={<Trash2 />} aria-label={`Borrar ${d.nombre}`} onClick={() => setBorrando(d)} />
                                                </>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>
            </div>

            {editando && (
                <DocumentoDialog
                    operatorId={id}
                    doc={editando.doc}
                    adjuntos={ficha.adjuntos}
                    onClose={() => setEditando(null)}
                    onGuardado={async () => {
                        setEditando(null);
                        await cargar();
                    }}
                />
            )}
            <ConfirmDialogBase
                open={!!borrando}
                onCancel={() => setBorrando(null)}
                onConfirm={borrar}
                loading={ocupado}
                title={`¿Borrar "${borrando?.nombre}"?`}
                message={borrando?.tieneArchivo ? 'Se borra también el archivo adjunto.' : 'Deja de aparecer en el calendario de vencimientos.'}
                confirmLabel="Borrar"
                cancelLabel="Volver"
            />
        </div>
    );
}

function DocumentoDialog({
    operatorId,
    doc,
    adjuntos,
    onClose,
    onGuardado,
}: {
    operatorId: string;
    doc: DocumentoLegajo | null;
    adjuntos: boolean;
    onClose: () => void;
    onGuardado: () => void;
}) {
    const [tipo, setTipo] = useState<TipoDocumento>(doc?.tipo ?? 'apto_medico');
    const [nombre, setNombre] = useState(doc?.nombre ?? '');
    const [numero, setNumero] = useState(doc?.numero ?? '');
    const [emision, setEmision] = useState(doc?.fechaEmision ?? '');
    const [vencimiento, setVencimiento] = useState(doc?.fechaVencimiento ?? '');
    const [observaciones, setObservaciones] = useState(doc?.observaciones ?? '');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [quitar, setQuitar] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        const nombreFinal = nombre.trim() || TIPO_DOCUMENTO_INFO[tipo].label;
        if (archivo && archivo.size > ARCHIVO_LEGAJO_MAX_BYTES) return showToast(`El archivo supera los ${ARCHIVO_LEGAJO_MAX_BYTES / (1024 * 1024)} MB`, 'error');
        const fd = new FormData();
        fd.set(
            'datos',
            JSON.stringify({ tipo, nombre: nombreFinal, numero: numero.trim() || null, fechaEmision: emision || null, fechaVencimiento: vencimiento || null, observaciones: observaciones.trim() || null })
        );
        if (archivo) fd.set('archivo', archivo);
        if (quitar && !archivo) fd.set('quitarArchivo', '1');
        setGuardando(true);
        try {
            await api(doc ? `/api/rrhh/legajos/documentos/${doc.id}` : `/api/rrhh/legajos/${operatorId}/documentos`, { method: doc ? 'PATCH' : 'POST', body: fd });
            showToast(doc ? 'Documento actualizado' : 'Documento agregado');
            onGuardado();
        } catch (e: any) {
            showToast(e.message || 'No se pudo guardar el documento', 'error');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog
            open
            onClose={onClose}
            dismissible={!guardando}
            size="md"
            title={doc ? 'Editar documento' : 'Agregar documento'}
            description="Con vencimiento, aparece en el calendario de vencimientos."
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>
                        Cancelar
                    </Button>
                    <Button onClick={guardar} isLoading={guardando}>
                        Guardar
                    </Button>
                </>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
                    {TIPOS_DOCUMENTO.map((t) => (
                        <option key={t} value={t}>
                            {TIPO_DOCUMENTO_INFO[t].label}
                        </option>
                    ))}
                </Select>
                <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={TIPO_DOCUMENTO_INFO[tipo].ejemplo} maxLength={120} />
                <Input label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={60} />
                <span className="hidden sm:block" />
                <Input label="Emisión" type="date" value={emision} onChange={(e) => setEmision(e.target.value)} />
                <Input label="Vencimiento" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
                <div className="sm:col-span-2">
                    <Textarea label="Observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                    {adjuntos ? (
                        <>
                            <Input
                                label={doc?.tieneArchivo ? 'Reemplazar archivo (PDF o imagen)' : 'Archivo (PDF o imagen)'}
                                type="file"
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                            />
                            {doc?.tieneArchivo && !archivo && (
                                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                    <input type="checkbox" checked={quitar} onChange={(e) => setQuitar(e.target.checked)} />
                                    Quitar el archivo actual ({doc.archivoNombre})
                                </label>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground">El almacenamiento de archivos no está configurado: el documento se guarda sin adjunto.</p>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
