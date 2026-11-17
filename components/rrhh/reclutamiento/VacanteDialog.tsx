'use client';

import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, X } from 'lucide-react';
import { Button, Dialog, Input, Select, Textarea } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { ESTADOS_VACANTE, PRIORIDADES, type EstadoVacante, type Prioridad } from '@/lib/rrhh/reclutamiento';
import { API, apiJson } from './shared';

export interface VacanteEditable {
    id: string;
    title: string;
    branch: string | null;
    status: string;
    priority: string;
    positionsCount: number;
    description: string;
    requirements: string;
    keywords: unknown;
}

const VACIA = { title: '', branch: '', status: 'ABIERTA' as EstadoVacante, priority: 'MEDIA' as Prioridad, positionsCount: 1, description: '', requirements: '', keywords: [] as string[] };

export default function VacanteDialog({
    open,
    onClose,
    onGuardada,
    vacante,
}: {
    open: boolean;
    onClose: () => void;
    onGuardada: (id: string) => void;
    /** Si viene, se edita; si no, se crea. */
    vacante?: VacanteEditable | null;
}) {
    const [f, setF] = useState(VACIA);
    const [palabra, setPalabra] = useState('');
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!open) return;
        setErrores({}); setPalabra(''); setGuardando(false);
        setF(vacante
            ? {
                title: vacante.title,
                branch: vacante.branch || '',
                status: (vacante.status as EstadoVacante) || 'ABIERTA',
                priority: (vacante.priority as Prioridad) || 'MEDIA',
                positionsCount: vacante.positionsCount || 1,
                description: vacante.description || '',
                requirements: vacante.requirements || '',
                keywords: Array.isArray(vacante.keywords) ? vacante.keywords.map(String) : [],
            }
            : VACIA);
    }, [open, vacante]);

    const agregarPalabra = () => {
        const p = palabra.trim().slice(0, 60);
        if (p && !f.keywords.some(k => k.toLowerCase() === p.toLowerCase())) setF({ ...f, keywords: [...f.keywords, p] });
        setPalabra('');
    };

    const guardar = async () => {
        const e: Record<string, string> = {};
        if (f.title.trim().length < 3) e.title = 'Indicá el puesto.';
        if (!Number.isInteger(f.positionsCount) || f.positionsCount < 1) e.positionsCount = 'Al menos 1 puesto.';
        setErrores(e);
        if (Object.keys(e).length) return;
        setGuardando(true);
        try {
            const body = JSON.stringify({ ...f, title: f.title.trim(), branch: f.branch.trim() || null });
            const r = vacante
                ? await apiJson<{ vacante: { id: string } }>(`${API}/vacantes/${vacante.id}`, { method: 'PATCH', body })
                : await apiJson<{ vacante: { id: string } }>(`${API}/vacantes`, { method: 'POST', body });
            showToast(vacante ? 'Vacante actualizada' : 'Vacante creada');
            onGuardada(r.vacante.id);
            onClose();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!guardando}
            size="lg"
            icon={<Briefcase className="w-[18px] h-[18px]" />}
            title={vacante ? 'Editar vacante' : 'Nueva vacante'}
            description="Los requisitos y las palabras clave son lo que usa la IA para medir la compatibilidad de cada postulante."
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button onClick={guardar} isLoading={guardando}>{vacante ? 'Guardar cambios' : 'Crear vacante'}</Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                    <Input label="Puesto" required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} error={errores.title} maxLength={160} placeholder="Ej.: Técnico electromecánico" data-autofocus />
                    <Input label="Sucursal o ubicación" value={f.branch} onChange={e => setF({ ...f, branch: e.target.value })} maxLength={120} placeholder="Ej.: Córdoba, planta del cliente" />
                    <Input
                        label="Puestos a cubrir"
                        type="number"
                        min={1}
                        max={500}
                        required
                        value={f.positionsCount}
                        onChange={e => setF({ ...f, positionsCount: parseInt(e.target.value, 10) || 0 })}
                        error={errores.positionsCount}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Prioridad" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as Prioridad })}>
                            {Object.entries(PRIORIDADES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                        </Select>
                        <Select label="Estado" value={f.status} onChange={e => setF({ ...f, status: e.target.value as EstadoVacante })}>
                            {Object.entries(ESTADOS_VACANTE).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                        </Select>
                    </div>
                </div>
                <Textarea label="Descripción y tareas" rows={4} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} maxLength={10_000} placeholder="Responsabilidades, horario, modalidad, lugar de trabajo…" />
                <Textarea
                    label="Requisitos"
                    rows={4}
                    value={f.requirements}
                    onChange={e => setF({ ...f, requirements: e.target.value })}
                    maxLength={10_000}
                    placeholder={'Excluyentes y deseables, uno por línea. Ej.:\nExcluyente: técnico electromecánico recibido\nExcluyente: carnet de conducir\nDeseable: experiencia en media tensión'}
                    hint="Separar excluyentes de deseables mejora la precisión del puntaje de compatibilidad."
                />
                <div>
                    <label htmlFor="vacante-kw" className="field-label">Palabras clave</label>
                    <div className="flex gap-2">
                        <input
                            id="vacante-kw"
                            className="input flex-1"
                            value={palabra}
                            maxLength={60}
                            onChange={e => setPalabra(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarPalabra(); } }}
                            placeholder="Ej.: PLC, tableros, soldadura… y Enter"
                        />
                        <Button variant="secondary" icon={<Plus />} onClick={agregarPalabra} disabled={!palabra.trim()}>Agregar</Button>
                    </div>
                    {f.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {f.keywords.map(k => (
                                <span key={k} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-md border border-border bg-surface-sunken text-sm">
                                    {k}
                                    <button type="button" aria-label={`Quitar ${k}`} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setF({ ...f, keywords: f.keywords.filter(x => x !== k) })}>
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
