'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { NIVELES_HABILIDAD, TIPOS_HABILIDAD, type PostulanteInput } from '@/lib/rrhh/reclutamiento';

export const POSTULANTE_VACIO: PostulanteInput = {
    firstName: '', lastName: '', email: null, phone: null, city: null, linkedin: null, observations: null,
    skills: [], experience: [], education: [], tags: [],
};

export function validarPostulante(v: PostulanteInput): Record<string, string> {
    const e: Record<string, string> = {};
    if (!v.firstName.trim()) e.firstName = 'Indicá el nombre.';
    if (!v.lastName.trim()) e.lastName = 'Indicá el apellido.';
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'El email no es válido.';
    v.experience.forEach((x, i) => {
        if (!x.company.trim() || !x.position.trim()) e[`experience.${i}`] = 'Completá empresa y puesto, o quitá la fila.';
    });
    v.education.forEach((x, i) => {
        if (!x.institution.trim() || !x.degree.trim()) e[`education.${i}`] = 'Completá institución y título, o quitá la fila.';
    });
    return e;
}

/** Normaliza antes de enviar: recorta y convierte vacíos en null. */
export function limpiarPostulante(v: PostulanteInput): PostulanteInput {
    const n = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
    return {
        ...v,
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        email: n(v.email), phone: n(v.phone), city: n(v.city), linkedin: n(v.linkedin), observations: n(v.observations),
        experience: v.experience.map(x => ({ ...x, company: x.company.trim(), position: x.position.trim(), startDate: n(x.startDate), endDate: n(x.endDate), description: n(x.description) })),
        education: v.education.map(x => ({ ...x, institution: x.institution.trim(), degree: x.degree.trim(), startDate: n(x.startDate), endDate: n(x.endDate) })),
    };
}

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
    return (
        <section className="pt-4 border-t border-border first:pt-0 first:border-t-0">
            <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="eyebrow">{titulo}</h3>
                {accion}
            </div>
            {children}
        </section>
    );
}

function Chip({ children, onQuitar, etiqueta }: { children: React.ReactNode; onQuitar: () => void; etiqueta: string }) {
    return (
        <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-md border border-border bg-surface-sunken text-sm text-foreground">
            {children}
            <button type="button" onClick={onQuitar} aria-label={`Quitar ${etiqueta}`} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="w-3.5 h-3.5" />
            </button>
        </span>
    );
}

export default function PostulanteForm({
    value,
    onChange,
    errores = {},
    idPrefix = 'postulante',
}: {
    value: PostulanteInput;
    onChange: (v: PostulanteInput) => void;
    errores?: Record<string, string>;
    idPrefix?: string;
}) {
    const set = <K extends keyof PostulanteInput>(k: K, v: PostulanteInput[K]) => onChange({ ...value, [k]: v });
    const [hab, setHab] = useState({ name: '', type: 'HARD' as 'HARD' | 'SOFT', level: '' });
    const [tag, setTag] = useState('');

    const agregarHabilidad = () => {
        const name = hab.name.trim();
        if (!name) return;
        if (value.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) { setHab({ ...hab, name: '' }); return; }
        set('skills', [...value.skills, { name, type: hab.type, level: (hab.level || null) as PostulanteInput['skills'][number]['level'] }]);
        setHab({ ...hab, name: '' });
    };

    const agregarTag = () => {
        const t = tag.trim().slice(0, 40);
        if (t && !value.tags.some(x => x.toLowerCase() === t.toLowerCase())) set('tags', [...value.tags, t]);
        setTag('');
    };

    const alEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); fn(); }
    };

    const tecnicas = value.skills.map((s, i) => ({ ...s, i })).filter(s => s.type !== 'SOFT');
    const blandas = value.skills.map((s, i) => ({ ...s, i })).filter(s => s.type === 'SOFT');

    return (
        <div className="space-y-4">
            <Seccion titulo="Datos de contacto">
                <div className="grid sm:grid-cols-2 gap-3">
                    <Input id={`${idPrefix}-nombre`} label="Nombre" required value={value.firstName} onChange={e => set('firstName', e.target.value)} error={errores.firstName} maxLength={80} autoComplete="off" />
                    <Input id={`${idPrefix}-apellido`} label="Apellido" required value={value.lastName} onChange={e => set('lastName', e.target.value)} error={errores.lastName} maxLength={80} autoComplete="off" />
                    <Input id={`${idPrefix}-email`} label="Email" type="email" value={value.email ?? ''} onChange={e => set('email', e.target.value)} error={errores.email} maxLength={160} autoComplete="off" />
                    <Input id={`${idPrefix}-tel`} label="Teléfono / WhatsApp" value={value.phone ?? ''} onChange={e => set('phone', e.target.value)} maxLength={40} placeholder="+54 9 351 123-4567" autoComplete="off" />
                    <Input id={`${idPrefix}-ciudad`} label="Ciudad" value={value.city ?? ''} onChange={e => set('city', e.target.value)} maxLength={120} autoComplete="off" />
                    <Input id={`${idPrefix}-linkedin`} label="LinkedIn" value={value.linkedin ?? ''} onChange={e => set('linkedin', e.target.value)} maxLength={300} placeholder="linkedin.com/in/usuario" autoComplete="off" />
                </div>
            </Seccion>

            <Seccion titulo={`Habilidades (${value.skills.length})`}>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <input
                        className="input flex-1"
                        aria-label="Nueva habilidad"
                        placeholder="Agregar habilidad y presionar Enter"
                        value={hab.name}
                        maxLength={80}
                        onChange={e => setHab({ ...hab, name: e.target.value })}
                        onKeyDown={alEnter(agregarHabilidad)}
                    />
                    <div className="flex gap-2">
                        <select className="input w-auto" aria-label="Tipo de habilidad" value={hab.type} onChange={e => setHab({ ...hab, type: e.target.value as 'HARD' | 'SOFT' })}>
                            {Object.entries(TIPOS_HABILIDAD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <select className="input w-auto" aria-label="Nivel" value={hab.level} onChange={e => setHab({ ...hab, level: e.target.value })}>
                            <option value="">Sin nivel</option>
                            {NIVELES_HABILIDAD.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <Button variant="secondary" icon={<Plus />} onClick={agregarHabilidad} aria-label="Agregar habilidad" disabled={!hab.name.trim()}>Agregar</Button>
                    </div>
                </div>
                {value.skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin habilidades cargadas.</p>
                ) : (
                    <div className="space-y-2">
                        {[{ t: 'Técnicas', l: tecnicas }, { t: 'Blandas', l: blandas }].filter(g => g.l.length).map(g => (
                            <div key={g.t} className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted-foreground w-16 shrink-0">{g.t}</span>
                                {g.l.map(s => (
                                    <Chip key={`${s.name}-${s.i}`} etiqueta={s.name} onQuitar={() => set('skills', value.skills.filter((_, j) => j !== s.i))}>
                                        {s.name}{s.level && <span className="text-muted-foreground">· {s.level}</span>}
                                    </Chip>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </Seccion>

            <Seccion
                titulo={`Experiencia laboral (${value.experience.length})`}
                accion={
                    <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => set('experience', [...value.experience, { company: '', position: '', startDate: null, endDate: null, description: null }])}>
                        Agregar
                    </Button>
                }
            >
                {value.experience.length === 0 && <p className="text-sm text-muted-foreground">Sin experiencia cargada.</p>}
                <div className="space-y-3">
                    {value.experience.map((x, i) => {
                        const upd = (patch: Partial<typeof x>) => set('experience', value.experience.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                        return (
                            <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                    <div className="grid sm:grid-cols-2 gap-2 flex-1">
                                        <input className="input" aria-label={`Puesto ${i + 1}`} placeholder="Puesto" value={x.position} maxLength={160} onChange={e => upd({ position: e.target.value })} />
                                        <input className="input" aria-label={`Empresa ${i + 1}`} placeholder="Empresa" value={x.company} maxLength={160} onChange={e => upd({ company: e.target.value })} />
                                        <input className="input" aria-label={`Desde ${i + 1}`} placeholder="Desde (ej.: 03/2021)" value={x.startDate ?? ''} maxLength={40} onChange={e => upd({ startDate: e.target.value })} />
                                        <input className="input" aria-label={`Hasta ${i + 1}`} placeholder="Hasta (o Actualidad)" value={x.endDate ?? ''} maxLength={40} onChange={e => upd({ endDate: e.target.value })} />
                                    </div>
                                    <Button size="icon-sm" variant="ghost" aria-label={`Quitar experiencia ${i + 1}`} onClick={() => set('experience', value.experience.filter((_, j) => j !== i))}>
                                        <X />
                                    </Button>
                                </div>
                                <textarea className="input" rows={2} aria-label={`Tareas ${i + 1}`} placeholder="Tareas y logros" value={x.description ?? ''} maxLength={4000} onChange={e => upd({ description: e.target.value })} />
                                {errores[`experience.${i}`] && <p className="field-error" role="alert">{errores[`experience.${i}`]}</p>}
                            </div>
                        );
                    })}
                </div>
            </Seccion>

            <Seccion
                titulo={`Formación (${value.education.length})`}
                accion={
                    <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => set('education', [...value.education, { institution: '', degree: '', startDate: null, endDate: null }])}>
                        Agregar
                    </Button>
                }
            >
                {value.education.length === 0 && <p className="text-sm text-muted-foreground">Sin formación cargada.</p>}
                <div className="space-y-3">
                    {value.education.map((x, i) => {
                        const upd = (patch: Partial<typeof x>) => set('education', value.education.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                        return (
                            <div key={i} className="rounded-xl border border-border p-3">
                                <div className="flex items-start gap-2">
                                    <div className="grid sm:grid-cols-2 gap-2 flex-1">
                                        <input className="input" aria-label={`Título ${i + 1}`} placeholder="Título o curso" value={x.degree} maxLength={160} onChange={e => upd({ degree: e.target.value })} />
                                        <input className="input" aria-label={`Institución ${i + 1}`} placeholder="Institución" value={x.institution} maxLength={160} onChange={e => upd({ institution: e.target.value })} />
                                        <input className="input" aria-label={`Inicio ${i + 1}`} placeholder="Desde" value={x.startDate ?? ''} maxLength={40} onChange={e => upd({ startDate: e.target.value })} />
                                        <input className="input" aria-label={`Fin ${i + 1}`} placeholder="Hasta (o En curso)" value={x.endDate ?? ''} maxLength={40} onChange={e => upd({ endDate: e.target.value })} />
                                    </div>
                                    <Button size="icon-sm" variant="ghost" aria-label={`Quitar formación ${i + 1}`} onClick={() => set('education', value.education.filter((_, j) => j !== i))}>
                                        <X />
                                    </Button>
                                </div>
                                {errores[`education.${i}`] && <p className="field-error mt-1" role="alert">{errores[`education.${i}`]}</p>}
                            </div>
                        );
                    })}
                </div>
            </Seccion>

            <Seccion titulo="Etiquetas y notas">
                <div className="flex gap-2 mb-2">
                    <input
                        className="input flex-1"
                        aria-label="Nueva etiqueta"
                        placeholder="Ej.: Disponibilidad inmediata, Media tensión…"
                        value={tag}
                        maxLength={40}
                        onChange={e => setTag(e.target.value)}
                        onKeyDown={alEnter(agregarTag)}
                    />
                    <Button variant="secondary" icon={<Plus />} onClick={agregarTag} disabled={!tag.trim()}>Agregar</Button>
                </div>
                {value.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {value.tags.map((t, i) => (
                            <Chip key={t} etiqueta={t} onQuitar={() => set('tags', value.tags.filter((_, j) => j !== i))}>{t}</Chip>
                        ))}
                    </div>
                )}
                <Textarea
                    id={`${idPrefix}-obs`}
                    label="Observaciones internas"
                    rows={3}
                    value={value.observations ?? ''}
                    onChange={e => set('observations', e.target.value)}
                    maxLength={10_000}
                    placeholder="Referencias, disponibilidad, pretensión salarial, comentarios de la entrevista…"
                />
            </Seccion>
        </div>
    );
}
