'use client';

import React, { useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ExternalLink, FileText, ImagePlus, Loader2, X } from 'lucide-react';
import { Dialog } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { VIAJE_COMPROBANTE_MAX_BYTES, VIAJE_COMPROBANTES_MAX } from '@/lib/viajes';

export interface Comprobante { id: string; nombre: string; mime: string; size: number }

export const urlComprobante = (id: string) => `/api/viajes/comprobantes/${id}`;

const LADO_MAX = 1600;

/** Reduce la foto a 1600 px y la pasa a JPEG: tickets legibles con ~200-400 KB. */
async function comprimirImagen(file: File): Promise<File> {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try {
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = url;
        });
        const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * escala);
        const h = Math.round(img.naturalHeight * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
        if (!blob || (blob.size >= file.size && file.type === "image/jpeg")) return file;
        const nombre = file.name.replace(/\.[^.]+$/, '') || 'ticket';
        return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' });
    } catch {
        return file; // El servidor valida el formato y avisa.
    }
}

function Miniatura({ c, onOpen, onRemove, className }: { c: Comprobante; onOpen?: () => void; onRemove?: () => void; className?: string }) {
    const esPdf = c.mime === 'application/pdf';
    return (
        <div className={cn('relative shrink-0 w-16 h-16 rounded-lg border border-border bg-surface-sunken overflow-hidden', className)}>
            <button type="button" onClick={onOpen} className="w-full h-full flex items-center justify-center" aria-label={`Ver ${c.nombre}`}>
                {esPdf ? (
                    <span className="flex flex-col items-center gap-0.5 text-slate-500"><FileText className="w-5 h-5" /><span className="text-xs">PDF</span></span>
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urlComprobante(c.id)} alt="" loading="lazy" className="w-full h-full object-cover" />
                )}
            </button>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="absolute top-0.5 right-0.5 w-6 h-6 btn-icon-inline rounded-full bg-slate-900/70 text-white flex items-center justify-center"
                    aria-label={`Quitar ${c.nombre}`}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

/** Carga de fotos de tickets: cámara directa en el celular, galería o PDF. */
export function SubirComprobantes({
    value,
    onChange,
    disabled,
    onUploadingChange,
}: {
    value: Comprobante[];
    onChange: (v: Comprobante[]) => void;
    disabled?: boolean;
    onUploadingChange?: (b: boolean) => void;
}) {
    const camaraRef = useRef<HTMLInputElement>(null);
    const archivoRef = useRef<HTMLInputElement>(null);
    const [subiendo, setSubiendo] = useState(0);
    const [verIdx, setVerIdx] = useState<number | null>(null);
    const restantes = VIAJE_COMPROBANTES_MAX - value.length;

    const subir = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const lista = Array.from(files).slice(0, restantes);
        if (files.length > restantes) showToast(`Se admiten hasta ${VIAJE_COMPROBANTES_MAX} comprobantes por gasto.`, 'info');
        setSubiendo(lista.length);
        onUploadingChange?.(true);
        const nuevos: Comprobante[] = [];
        for (const original of lista) {
            try {
                const file = await comprimirImagen(original);
                if (file.size > VIAJE_COMPROBANTE_MAX_BYTES) throw new Error(`${original.name} es demasiado grande.`);
                const fd = new FormData();
                fd.append('files', file);
                const res = await fetch('/api/viajes/comprobantes', { method: 'POST', body: fd });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'No se pudo subir el comprobante.');
                nuevos.push(...(data.archivos || []));
            } catch (e: any) {
                showToast(e.message || 'No se pudo subir el comprobante.', 'error');
            } finally {
                setSubiendo(n => Math.max(0, n - 1));
            }
        }
        onUploadingChange?.(false);
        if (nuevos.length) onChange([...value, ...nuevos]);
        if (camaraRef.current) camaraRef.current.value = '';
        if (archivoRef.current) archivoRef.current.value = '';
    };

    return (
        <div>
            <div className="flex flex-wrap gap-2">
                {value.map((c, i) => (
                    <Miniatura key={c.id} c={c} onOpen={() => setVerIdx(i)} onRemove={disabled ? undefined : () => onChange(value.filter(x => x.id !== c.id))} />
                ))}
                {Array.from({ length: subiendo }).map((_, i) => (
                    <div key={`s${i}`} className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" aria-label="Subiendo" />
                    </div>
                ))}
            </div>
            {restantes > 0 && !disabled && (
                <div className={cn('grid gap-2', value.length || subiendo ? 'mt-2' : '', 'grid-cols-2 sm:flex')}>
                    <button type="button" className="btn btn-secondary sm:hidden" onClick={() => camaraRef.current?.click()} disabled={subiendo > 0}>
                        <Camera /> Sacar foto
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => archivoRef.current?.click()} disabled={subiendo > 0}>
                        <ImagePlus /> <span className="sm:hidden">Galería</span><span className="hidden sm:inline">Adjuntar foto o PDF</span>
                    </button>
                </div>
            )}
            <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => subir(e.target.files)} />
            <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={e => subir(e.target.files)} />
            <VisorComprobantes comprobantes={value} index={verIdx} onClose={() => setVerIdx(null)} onIndex={setVerIdx} />
        </div>
    );
}

/** Miniaturas de solo lectura. */
export function ListaComprobantes({ comprobantes, className }: { comprobantes: Comprobante[]; className?: string }) {
    const [verIdx, setVerIdx] = useState<number | null>(null);
    if (!comprobantes.length) return null;
    return (
        <>
            <div className={cn('flex flex-wrap gap-1.5', className)}>
                {comprobantes.map((c, i) => <Miniatura key={c.id} c={c} className="w-12 h-12" onOpen={() => setVerIdx(i)} />)}
            </div>
            <VisorComprobantes comprobantes={comprobantes} index={verIdx} onClose={() => setVerIdx(null)} onIndex={setVerIdx} />
        </>
    );
}

export function VisorComprobantes({
    comprobantes, index, onClose, onIndex,
}: {
    comprobantes: Comprobante[];
    index: number | null;
    onClose: () => void;
    onIndex: (i: number) => void;
}) {
    const c = index != null ? comprobantes[index] : null;
    const total = comprobantes.length;
    return (
        <Dialog
            open={!!c}
            onClose={onClose}
            size="xl"
            title={c ? `Comprobante ${index! + 1} de ${total}` : ''}
            description={c?.nombre}
            zIndex="z-[260]"
            footer={c && (
                <>
                    <a href={urlComprobante(c.id)} target="_blank" rel="noreferrer" className="btn btn-secondary">
                        <ExternalLink /> Abrir en otra pestaña
                    </a>
                    {total > 1 && (
                        <div className="flex gap-2 sm:ml-2">
                            <button type="button" className="btn btn-secondary flex-1" onClick={() => onIndex((index! - 1 + total) % total)} aria-label="Anterior"><ChevronLeft /></button>
                            <button type="button" className="btn btn-secondary flex-1" onClick={() => onIndex((index! + 1) % total)} aria-label="Siguiente"><ChevronRight /></button>
                        </div>
                    )}
                </>
            )}
        >
            {c && (c.mime === 'application/pdf' ? (
                <iframe src={urlComprobante(c.id)} title={c.nombre} className="w-full h-[65dvh] rounded-lg border border-border bg-white" />
            ) : (
                <div className="flex items-center justify-center bg-surface-sunken rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urlComprobante(c.id)} alt={c.nombre} className="max-h-[65dvh] w-auto object-contain" />
                </div>
            ))}
        </Dialog>
    );
}
