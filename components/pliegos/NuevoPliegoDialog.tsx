'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { Button, Dialog, Field, Input, Textarea } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { showToast } from '@/components/Toast';
import { formatTamanio, PLIEGO_MAX_BYTES } from '@/lib/pliegos';
import { apiJson } from './shared';

interface Opciones {
    clientes: { id: string; nombre: string }[];
    proyectos: { id: string; nombre: string; codigoProyecto: string | null; clientId: string | null }[];
}

type Etapa = 'form' | 'subiendo' | 'verificando' | 'analizando';

const ETAPA_LABEL: Record<Exclude<Etapa, 'form'>, string> = {
    subiendo: 'Subiendo el PDF…',
    verificando: 'Verificando el archivo…',
    analizando: 'La IA está leyendo el pliego. Puede tardar uno o dos minutos; no cierres esta ventana.',
};

/** Sube el PDF directo al almacenamiento con progreso (fetch no informa progreso de subida). */
function subirConProgreso(url: string, archivo: File, headers: Record<string, string>, onProgreso: (p: number) => void) {
    return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = e => { if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`El almacenamiento rechazó el archivo (HTTP ${xhr.status}).`)));
        xhr.onerror = () => reject(new Error('Se cortó la conexión mientras se subía el PDF.'));
        xhr.send(archivo);
    });
}

export default function NuevoPliegoDialog({
    open,
    onClose,
    onCreado,
}: {
    open: boolean;
    onClose: () => void;
    onCreado: (id: string) => void;
}) {
    const [opciones, setOpciones] = useState<Opciones | null>(null);
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [clientId, setClientId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [etapa, setEtapa] = useState<Etapa>('form');
    const [progreso, setProgreso] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setTitulo(''); setDescripcion(''); setClientId(''); setProjectId(''); setArchivo(null);
        setErrores({}); setEtapa('form'); setProgreso(0);
        if (!opciones) apiJson<Opciones>('/api/pliegos/opciones').then(setOpciones).catch(e => showToast(e.message, 'error'));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const proyectos = useMemo(
        () => (opciones?.proyectos || [])
            .filter(p => !clientId || p.clientId === clientId)
            .map(p => ({ id: p.id, nombre: p.nombre, extra: p.codigoProyecto })),
        [opciones, clientId],
    );

    const elegirArchivo = (f: File | null) => {
        const e = { ...errores };
        delete e.archivo;
        if (f && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) e.archivo = 'Elegí un archivo PDF.';
        else if (f && f.size > PLIEGO_MAX_BYTES) e.archivo = `El PDF pesa ${formatTamanio(f.size)}; el máximo es ${formatTamanio(PLIEGO_MAX_BYTES)}.`;
        setErrores(e);
        setArchivo(e.archivo ? null : f);
        if (f && !e.archivo && !titulo.trim()) setTitulo(f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 200));
    };

    const enviar = async () => {
        const e: Record<string, string> = {};
        if (titulo.trim().length < 3) e.titulo = 'Indicá un título.';
        if (!archivo) e.archivo = errores.archivo || 'Elegí el PDF del pliego.';
        setErrores(e);
        if (Object.keys(e).length) return;

        let creadoId: string | null = null;
        try {
            setEtapa('subiendo');
            setProgreso(0);
            const creado = await apiJson<{ id: string; codigo: string; subida: { url: string; headers: Record<string, string> } }>('/api/pliegos', {
                method: 'POST',
                body: JSON.stringify({
                    titulo: titulo.trim(),
                    descripcion: descripcion.trim() || null,
                    clientId: clientId || null,
                    projectId: projectId || null,
                    archivo: { nombre: archivo!.name, size: archivo!.size },
                }),
            });
            creadoId = creado.id;
            await subirConProgreso(creado.subida.url, archivo!, creado.subida.headers, setProgreso);

            setEtapa('verificando');
            await apiJson(`/api/pliegos/${creado.id}/archivo/confirmar`, { method: 'POST' });
        } catch (err: any) {
            // Sin PDF el pliego no sirve: se descarta para poder reintentar desde cero.
            if (creadoId) await fetch(`/api/pliegos/${creadoId}`, { method: 'DELETE' }).catch(() => {});
            setEtapa('form');
            showToast(err.message, 'error');
            return;
        }

        setEtapa('analizando');
        try {
            await apiJson(`/api/pliegos/${creadoId}/analizar`, { method: 'POST' });
            showToast('Pliego analizado');
        } catch (err: any) {
            showToast(`El PDF se guardó, pero el análisis falló: ${err.message}`, 'error');
        }
        onCreado(creadoId!);
    };

    const ocupado = etapa !== 'form';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!ocupado}
            size="md"
            icon={<FileUp className="w-[18px] h-[18px]" />}
            title="Nuevo pliego"
            description="Subí el PDF del pliego del cliente. La IA arma las tareas, materiales, herramientas, personal, H&S y alertas."
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
                    <Button size="lg" onClick={enviar} isLoading={ocupado} icon={<Sparkles />}>
                        Subir y analizar
                    </Button>
                </>
            }
        >
            {ocupado ? (
                <div className="py-4" aria-live="polite">
                    <p className="text-body text-foreground mb-3">{ETAPA_LABEL[etapa]}</p>
                    {etapa === 'subiendo' && (
                        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso} aria-label="Progreso de la subida" className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progreso}%` }} />
                        </div>
                    )}
                    {etapa === 'subiendo' && <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">{progreso}%</p>}
                </div>
            ) : (
                <div className="space-y-4">
                    <Field label="PDF del pliego" required error={errores.archivo} hint={archivo ? `${archivo.name} · ${formatTamanio(archivo.size)}` : `Máximo ${formatTamanio(PLIEGO_MAX_BYTES)}.`}>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            id="pliego-pdf"
                            onChange={e => elegirArchivo(e.target.files?.[0] || null)}
                        />
                        <Button variant="secondary" size="lg" className="w-full" icon={<FileUp />} onClick={() => inputRef.current?.click()}>
                            {archivo ? 'Cambiar PDF' : 'Elegir PDF'}
                        </Button>
                    </Field>
                    <Input label="Título" required value={titulo} onChange={e => setTitulo(e.target.value)} error={errores.titulo} maxLength={200} placeholder="Ej.: Climatización oficinas C.D. Arroyito" />
                    <Field label="Cliente">
                        <SearchableSelect
                            options={opciones?.clientes || []}
                            value={clientId}
                            onChange={v => { setClientId(v); setProjectId(''); }}
                            placeholder={opciones ? 'Sin cliente' : 'Cargando…'}
                            searchPlaceholder="Buscar cliente…"
                            allowClear
                            disabled={!opciones}
                        />
                    </Field>
                    <Field label="Proyecto" hint="Opcional. Se puede vincular a un proyecto activo.">
                        <SearchableSelect
                            options={proyectos}
                            value={projectId}
                            onChange={setProjectId}
                            placeholder={opciones ? 'Sin proyecto' : 'Cargando…'}
                            searchPlaceholder="Buscar proyecto…"
                            allowClear
                            disabled={!opciones}
                            emptyMessage={clientId ? 'Ese cliente no tiene proyectos activos.' : 'No hay proyectos activos.'}
                        />
                    </Field>
                    <Textarea label="Notas" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={4000} placeholder="Opcional" />
                </div>
            )}
        </Dialog>
    );
}
