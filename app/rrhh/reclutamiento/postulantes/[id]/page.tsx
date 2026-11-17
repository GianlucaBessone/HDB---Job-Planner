'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Briefcase, FileText, FileUp, GraduationCap, Linkedin, Mail, MapPin, MessageCircle, Pencil, Phone, Sparkles, Trash2, UserPlus, Users,
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { showToast } from '@/components/Toast';
import { Badge, Button, ConfirmDialogBase, Dialog, EmptyState, ErrorState, LoadingState, Panel, Select, Tabs } from '@/components/ui';
import {
    CV_MAX_BYTES, ESTADOS_CANDIDATO, ETAPAS, formatTamanio, linkLinkedin, linkWhatsapp, nombreCompleto, type EtapaId, type PostulanteInput,
} from '@/lib/rrhh/reclutamiento';
import PostulanteForm, { limpiarPostulante, validarPostulante } from '@/components/rrhh/reclutamiento/PostulanteForm';
import { EvaluacionBloque, MatchBloque, PerfilExtra, VeracidadBloque, type VeracidadData } from '@/components/rrhh/reclutamiento/AnalisisIA';
import {
    API, apiJson, Avatar, useMigasReclutamiento, useTituloRuta, EstadoCandidatoBadge, EtapaBadge, EstadoVacanteBadge, formatFecha, formatFechaHora, MatchBadge, VeracidadBadge, type Permisos,
} from '@/components/rrhh/reclutamiento/shared';

interface Proceso {
    vacancyId: string;
    vacante: { id: string; title: string; status: string; branch: string | null };
    etapa: string;
    desde: string;
    historial: { id: string; etapa: string; notas: string | null; fecha: string; por: string | null }[];
}

interface Compatibilidad {
    id: string;
    vacante: { id: string; title: string; status: string } | null;
    puntaje: number;
    explicacion: string;
    cumple: string[];
    noCumple: string[];
    recomendacion: string | null;
    fortalezas: string[];
    debilidades: string[];
    riesgos: string[];
    fecha: string;
}

interface Postulante extends PostulanteInput {
    id: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    mejorMatch: number | null;
    cv: { id: string; fileName: string; disponible: boolean; fecha: string } | null;
    analisis: {
        fecha: string;
        titular: string | null;
        resumen: string | null;
        seniority: string | null;
        aniosExperiencia: number | null;
        idiomas: { idioma: string; nivel: string | null }[];
        certificaciones: string[];
        veracidad: VeracidadData | null;
        fortalezas: string[];
        debilidades: string[];
        riesgos: string[];
    } | null;
    compatibilidades: Compatibilidad[];
    procesos: Proceso[];
}

interface VacanteOpcion { id: string; title: string; branch: string | null; status: string }

type Seccion = 'perfil' | 'ia' | 'procesos';

export default function PostulantePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter();
    const [p, setP] = useState<Postulante | null>(null);
    const [permisos, setPermisos] = useState<Permisos>({ gestionar: false, eliminar: false });
    const [error, setError] = useState<string | null>(null);
    const [seccion, setSeccion] = useState<Seccion>('perfil');
    const [vacantes, setVacantes] = useState<VacanteOpcion[] | null>(null);

    const [editando, setEditando] = useState<PostulanteInput | null>(null);
    const [erroresEdicion, setErroresEdicion] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState(false);
    const [sumar, setSumar] = useState(false);
    const [sumarForm, setSumarForm] = useState<{ vacancyId: string; stage: EtapaId }>({ vacancyId: '', stage: 'POSTULADO' });
    const [eliminar, setEliminar] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [evaluarVacante, setEvaluarVacante] = useState('');
    const [evaluando, setEvaluando] = useState(false);
    const [subiendoCv, setSubiendoCv] = useState(false);
    const cvRef = useRef<HTMLInputElement>(null);

    useMigasReclutamiento();
    useTituloRuta(`/rrhh/reclutamiento/postulantes/${id}`, p ? nombreCompleto(p) : null);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const r = await apiJson<{ postulante: Postulante; permisos: Permisos }>(`${API}/postulantes/${id}`);
            setP(r.postulante);
            setPermisos(r.permisos);
        } catch (e: any) {
            setError(e.message);
        }
    }, [id]);
    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        if (!permisos.gestionar || vacantes) return;
        apiJson<{ vacantes: VacanteOpcion[] }>(`${API}/vacantes`).then(r => setVacantes(r.vacantes)).catch(() => setVacantes([]));
    }, [permisos.gestionar, vacantes]);

    const enProceso = useMemo(() => new Set((p?.procesos || []).map(x => x.vacancyId)), [p]);
    const vacantesParaSumar = (vacantes || []).filter(v => v.status !== 'CERRADA' && !enProceso.has(v.id));

    const guardarEdicion = async () => {
        if (!editando) return;
        const e = validarPostulante(editando);
        setErroresEdicion(e);
        if (Object.keys(e).length) { showToast('Revisá los campos marcados.', 'error'); return; }
        setGuardando(true);
        try {
            await apiJson(`${API}/postulantes/${id}`, { method: 'PATCH', body: JSON.stringify(limpiarPostulante(editando)) });
            showToast('Postulante actualizado');
            setEditando(null);
            cargar();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setGuardando(false);
        }
    };

    const cambiarEstado = async (status: string) => {
        try {
            await apiJson(`${API}/postulantes/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            showToast(`Estado: ${ESTADOS_CANDIDATO[status as keyof typeof ESTADOS_CANDIDATO]?.label ?? status}`);
            cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const moverEtapa = async (vacancyId: string, stage: string) => {
        try {
            await apiJson(`${API}/vacantes/${vacancyId}/postulantes/${id}`, { method: 'PATCH', body: JSON.stringify({ stage }) });
            showToast('Etapa actualizada');
            cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const confirmarSumar = async () => {
        if (!sumarForm.vacancyId) return;
        setGuardando(true);
        try {
            await apiJson(`${API}/vacantes/${sumarForm.vacancyId}/postulantes`, { method: 'POST', body: JSON.stringify({ candidateId: id, stage: sumarForm.stage }) });
            showToast('Sumado a la vacante');
            setSumar(false);
            setSeccion('procesos');
            cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setGuardando(false);
        }
    };

    const evaluar = async (vacancyId: string) => {
        if (!vacancyId) return;
        setEvaluando(true);
        try {
            const r = await apiJson<{ match: { puntaje: number } }>(`${API}/postulantes/${id}/compatibilidad`, { method: 'POST', body: JSON.stringify({ vacancyId }) });
            showToast(`Compatibilidad: ${r.match.puntaje}%`);
            setEvaluarVacante('');
            cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setEvaluando(false);
        }
    };

    const subirCv = async (f: File | null) => {
        if (!f) return;
        if (f.size > CV_MAX_BYTES) { showToast(`El PDF pesa ${formatTamanio(f.size)}; el máximo es ${formatTamanio(CV_MAX_BYTES)}.`, 'error'); return; }
        setSubiendoCv(true);
        try {
            const body = new FormData();
            body.append('archivo', f);
            const r = await apiJson<{ almacenamiento: boolean }>(`${API}/postulantes/${id}/cv`, { method: 'POST', body });
            showToast(r.almacenamiento ? 'CV analizado y guardado' : 'CV analizado. El PDF no se guardó: falta configurar el almacenamiento.', r.almacenamiento ? 'success' : 'info');
            setSeccion('ia');
            cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setSubiendoCv(false);
        }
    };

    const confirmarEliminar = async () => {
        setEliminando(true);
        try {
            await apiJson(`${API}/postulantes/${id}`, { method: 'DELETE' });
            showToast('Postulante eliminado');
            router.push('/rrhh/reclutamiento/postulantes');
        } catch (e: any) {
            showToast(e.message, 'error');
            setEliminando(false);
        }
    };

    if (error) {
        return (
            <div className="w-full space-y-4">
                <ModuleHeader title="Postulante" icon={<Users />} actions={[{ id: 'volver', label: 'Base de talentos', icon: <ArrowLeft />, onClick: () => router.push('/rrhh/reclutamiento/postulantes'), variant: 'ghost' }]} />
                <ErrorState description={error} onRetry={cargar} />
            </div>
        );
    }
    if (!p) return <LoadingState label="Cargando postulante…" />;

    const a = p.analisis;
    const wa = linkWhatsapp(p.phone, `Hola ${p.firstName}, te contactamos de HDB por tu postulación.`);
    const li = linkLinkedin(p.linkedin);
    const procesosActivos = p.procesos.filter(x => x.etapa !== 'CONTRATADO' && x.etapa !== 'RECHAZADO');
    const tecnicas = p.skills.filter(s => s.type !== 'SOFT');
    const blandas = p.skills.filter(s => s.type === 'SOFT');

    return (
        <div className="w-full space-y-4">
            <ModuleHeader
                title={nombreCompleto(p)}
                description={a?.titular || p.experience[0]?.position || 'Ficha del postulante'}
                icon={<Users />}
                actions={[
                    { id: 'volver', label: 'Volver', icon: <ArrowLeft />, onClick: () => router.back(), variant: 'ghost', hideLabelOnMobile: true },
                    ...(permisos.eliminar ? [{ id: 'eliminar', label: 'Eliminar', icon: <Trash2 />, onClick: () => setEliminar(true), variant: 'danger' as const, hideLabelOnMobile: true }] : []),
                    ...(permisos.gestionar ? [
                        { id: 'editar', label: 'Editar', icon: <Pencil />, onClick: () => { setErroresEdicion({}); setEditando({ ...p }); }, variant: 'outline' as const, hideLabelOnMobile: true },
                        { id: 'sumar', label: 'Sumar a vacante', icon: <UserPlus />, onClick: () => { setSumarForm({ vacancyId: '', stage: 'POSTULADO' }); setSumar(true); }, variant: 'primary' as const },
                    ] : []),
                ]}
            />

            {/* Resumen */}
            <section className="surface p-4 flex flex-col md:flex-row gap-4 md:items-start" aria-label="Resumen del postulante">
                <Avatar persona={p} size="lg" />
                <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <EstadoCandidatoBadge estado={p.status} />
                        {procesosActivos.length > 0 && <Badge tone="info">{procesosActivos.length} {procesosActivos.length === 1 ? 'proceso abierto' : 'procesos abiertos'}</Badge>}
                        {p.tags.map(t => <Badge key={t}>{t}</Badge>)}
                    </div>
                    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-body text-slate-700 dark:text-slate-300">
                        {p.email && <li><a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="w-4 h-4 text-muted-foreground" aria-hidden="true" />{p.email}</a></li>}
                        {p.phone && <li><a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="w-4 h-4 text-muted-foreground" aria-hidden="true" />{p.phone}</a></li>}
                        {p.city && <li className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground" aria-hidden="true" />{p.city}</li>}
                        {li && <li><a href={li} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline"><Linkedin className="w-4 h-4 text-muted-foreground" aria-hidden="true" />LinkedIn</a></li>}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><MessageCircle className="w-4 h-4" aria-hidden="true" />WhatsApp</a>}
                        {p.cv?.disponible && (
                            <a href={`${API}/postulantes/${id}/cv`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><FileText className="w-4 h-4" aria-hidden="true" />Ver CV</a>
                        )}
                        {permisos.gestionar && (
                            <>
                                <input ref={cvRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Subir CV en PDF" onChange={e => { subirCv(e.target.files?.[0] || null); e.target.value = ''; }} />
                                <Button size="sm" variant="ghost" icon={<FileUp />} isLoading={subiendoCv} onClick={() => cvRef.current?.click()}>
                                    {subiendoCv ? 'Analizando CV…' : p.cv ? 'Actualizar CV' : 'Subir CV y analizar'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                <dl className="grid grid-cols-2 md:grid-cols-1 gap-3 md:w-44 shrink-0 md:border-l md:border-border md:pl-4">
                    <div><dt className="text-xs text-muted-foreground">Veracidad del CV</dt><dd className="mt-0.5"><VeracidadBadge puntaje={a?.veracidad?.puntaje} conTexto /></dd></div>
                    <div><dt className="text-xs text-muted-foreground">Mejor match</dt><dd className="mt-0.5"><MatchBadge puntaje={p.mejorMatch} /></dd></div>
                    <div className="col-span-2 md:col-span-1">
                        <dt className="text-xs text-muted-foreground">Estado</dt>
                        <dd className="mt-0.5">
                            {permisos.gestionar ? (
                                <select className="input !h-8 w-full" aria-label="Estado del postulante" value={p.status} onChange={e => cambiarEstado(e.target.value)}>
                                    {Object.entries(ESTADOS_CANDIDATO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                            ) : <EstadoCandidatoBadge estado={p.status} />}
                        </dd>
                    </div>
                </dl>
            </section>

            <Tabs
                label="Secciones del postulante"
                value={seccion}
                onChange={v => setSeccion(v as Seccion)}
                tabs={[
                    { id: 'perfil', label: 'Perfil', icon: <FileText /> },
                    { id: 'ia', label: 'Análisis IA', icon: <Sparkles />, count: p.compatibilidades.length || undefined },
                    { id: 'procesos', label: 'Procesos', icon: <Briefcase />, count: p.procesos.length || undefined },
                ]}
            />

            {seccion === 'perfil' && (
                <div className="grid gap-4 lg:grid-cols-3 items-start">
                    <div className="lg:col-span-2 space-y-4">
                        {a?.resumen && (
                            <Panel title="Resumen profesional" description="Generado por la IA a partir del CV">
                                <p className="text-body text-slate-700 dark:text-slate-300">{a.resumen}</p>
                            </Panel>
                        )}
                        <Panel title="Experiencia laboral">
                            {p.experience.length === 0 ? <p className="text-sm text-muted-foreground">Sin experiencia cargada.</p> : (
                                <ol className="space-y-4">
                                    {p.experience.map((e, i) => (
                                        <li key={i} className="flex gap-3">
                                            <span className="w-8 h-8 rounded-lg bg-surface-sunken border border-border flex items-center justify-center shrink-0" aria-hidden="true">
                                                <Briefcase className="w-4 h-4 text-muted-foreground" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-semibold text-foreground">{e.position}</p>
                                                <p className="text-[13px] text-slate-700 dark:text-slate-300">{e.company}</p>
                                                {(e.startDate || e.endDate) && <p className="text-xs text-muted-foreground">{e.startDate || '¿?'} – {e.endDate || 'Actualidad'}</p>}
                                                {e.description && <p className="text-body text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-line">{e.description}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </Panel>
                        <Panel title="Formación">
                            {p.education.length === 0 ? <p className="text-sm text-muted-foreground">Sin formación cargada.</p> : (
                                <ul className="space-y-3">
                                    {p.education.map((e, i) => (
                                        <li key={i} className="flex gap-3">
                                            <span className="w-8 h-8 rounded-lg bg-surface-sunken border border-border flex items-center justify-center shrink-0" aria-hidden="true">
                                                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                                            </span>
                                            <div>
                                                <p className="text-[13px] font-semibold text-foreground">{e.degree}</p>
                                                <p className="text-[13px] text-slate-700 dark:text-slate-300">{e.institution}</p>
                                                {(e.startDate || e.endDate) && <p className="text-xs text-muted-foreground">{e.startDate || '¿?'} – {e.endDate || 'En curso'}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>
                    <div className="space-y-4">
                        <Panel title="Habilidades">
                            {p.skills.length === 0 ? <p className="text-sm text-muted-foreground">Sin habilidades cargadas.</p> : (
                                <div className="space-y-3">
                                    {[{ t: 'Técnicas', l: tecnicas }, { t: 'Blandas', l: blandas }].filter(g => g.l.length).map(g => (
                                        <div key={g.t}>
                                            <p className="eyebrow mb-1.5">{g.t}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {g.l.map(s => <Badge key={s.name}>{s.name}{s.level ? ` · ${s.level}` : ''}</Badge>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                        {a && (a.seniority || a.aniosExperiencia != null || a.idiomas.length > 0 || a.certificaciones.length > 0) && (
                            <Panel title="Datos del CV">
                                <PerfilExtra seniority={a.seniority} anios={a.aniosExperiencia} idiomas={a.idiomas} certificaciones={a.certificaciones} />
                            </Panel>
                        )}
                        <Panel title="Observaciones internas">
                            {p.observations
                                ? <p className="text-body text-slate-700 dark:text-slate-300 whitespace-pre-line">{p.observations}</p>
                                : <p className="text-sm text-muted-foreground">Sin observaciones.</p>}
                        </Panel>
                        <p className="text-xs text-muted-foreground px-1">
                            Alta: {formatFecha(p.createdAt)} · Última modificación: {formatFechaHora(p.updatedAt)}
                            {p.cv && <><br />CV: {p.cv.fileName}{!p.cv.disponible && ' (el archivo no se guardó)'}</>}
                        </p>
                    </div>
                </div>
            )}

            {seccion === 'ia' && (
                <div className="space-y-4">
                    {!a ? (
                        <Panel>
                            <EmptyState
                                compact
                                icon={<Sparkles />}
                                title="Este postulante no tiene un CV analizado"
                                description="Subí el CV en PDF: la IA estima el índice de veracidad, fortalezas, debilidades y riesgos, y completa lo que falte en la ficha."
                                action={permisos.gestionar ? <Button icon={<FileUp />} isLoading={subiendoCv} onClick={() => cvRef.current?.click()}>Subir CV y analizar</Button> : undefined}
                            />
                        </Panel>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-3 items-start">
                            <Panel title="Veracidad del CV" description={`Analizado el ${formatFecha(a.fecha)}`}>
                                {a.veracidad ? <VeracidadBloque veracidad={a.veracidad} /> : <p className="text-sm text-muted-foreground">Sin datos.</p>}
                            </Panel>
                            <Panel title="Evaluación general" className="lg:col-span-2">
                                <EvaluacionBloque fortalezas={a.fortalezas} debilidades={a.debilidades} riesgos={a.riesgos} />
                            </Panel>
                        </div>
                    )}

                    <Panel
                        title="Compatibilidad con vacantes"
                        description="La IA compara el perfil actual (con tus ediciones) con los requisitos de la vacante."
                        actions={permisos.gestionar && vacantes && vacantes.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <select className="input w-auto max-w-[220px] !h-8" aria-label="Vacante a evaluar" value={evaluarVacante} onChange={e => setEvaluarVacante(e.target.value)}>
                                    <option value="">Elegir vacante…</option>
                                    {vacantes.filter(v => v.status !== 'CERRADA').map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                                </select>
                                <Button size="sm" variant="tonal" icon={<Sparkles />} isLoading={evaluando} disabled={!evaluarVacante} onClick={() => evaluar(evaluarVacante)}>Evaluar</Button>
                            </div>
                        ) : undefined}
                    >
                        {p.compatibilidades.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Todavía no se evaluó contra ninguna vacante.</p>
                        ) : (
                            <div className="divide-y divide-border">
                                {p.compatibilidades.map(c => (
                                    <div key={c.id} className="py-4 first:pt-0 last:pb-0 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            {c.vacante ? (
                                                <Link href={`/rrhh/reclutamiento/vacantes/${c.vacante.id}/pipeline`} className="text-heading text-foreground hover:underline">{c.vacante.title}</Link>
                                            ) : <span className="text-heading text-foreground">Vacante eliminada</span>}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{formatFecha(c.fecha)}</span>
                                                {permisos.gestionar && c.vacante && c.vacante.status !== 'CERRADA' && (
                                                    <Button size="sm" variant="ghost" icon={<Sparkles />} isLoading={evaluando && evaluarVacante === c.vacante.id} onClick={() => { setEvaluarVacante(c.vacante!.id); evaluar(c.vacante!.id); }}>
                                                        Reevaluar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <MatchBloque match={c} />
                                        {(c.fortalezas.length + c.debilidades.length + c.riesgos.length > 0) && (
                                            <EvaluacionBloque fortalezas={c.fortalezas} debilidades={c.debilidades} riesgos={c.riesgos} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            {seccion === 'procesos' && (
                p.procesos.length === 0 ? (
                    <Panel>
                        <EmptyState
                            compact
                            icon={<Briefcase />}
                            title="No participa en ninguna búsqueda"
                            description="Sumalo a una vacante para seguir su avance en el pipeline."
                            action={permisos.gestionar ? <Button icon={<UserPlus />} onClick={() => setSumar(true)}>Sumar a vacante</Button> : undefined}
                        />
                    </Panel>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2 items-start">
                        {p.procesos.map(pr => (
                            <Panel
                                key={pr.vacancyId}
                                title={<Link href={`/rrhh/reclutamiento/vacantes/${pr.vacancyId}/pipeline`} className="hover:underline">{pr.vacante.title}</Link>}
                                description={[pr.vacante.branch, `En esta etapa desde ${formatFecha(pr.desde)}`].filter(Boolean).join(' · ')}
                                actions={<EstadoVacanteBadge estado={pr.vacante.status} />}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-[13px] text-muted-foreground">Etapa actual</span>
                                    {permisos.gestionar ? (
                                        <select className="input w-auto !h-8" aria-label={`Etapa en ${pr.vacante.title}`} value={pr.etapa === 'FINALISTA' ? 'FINALISTAS' : pr.etapa} onChange={e => moverEtapa(pr.vacancyId, e.target.value)}>
                                            {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.singular}</option>)}
                                        </select>
                                    ) : <EtapaBadge etapa={pr.etapa} />}
                                </div>
                                <ol className="relative border-l border-border ml-1.5 space-y-3">
                                    {pr.historial.map(h => (
                                        <li key={h.id} className="pl-4 relative">
                                            <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-card border-2 border-primary" aria-hidden="true" />
                                            <div className="flex flex-wrap items-center gap-2">
                                                <EtapaBadge etapa={h.etapa} />
                                                <span className="text-xs text-muted-foreground">{formatFechaHora(h.fecha)}{h.por ? ` · ${h.por}` : ''}</span>
                                            </div>
                                            {h.notas && <p className="text-body text-slate-600 dark:text-slate-400 mt-0.5">{h.notas}</p>}
                                        </li>
                                    ))}
                                </ol>
                            </Panel>
                        ))}
                    </div>
                )
            )}

            {/* Editar */}
            <Dialog
                open={!!editando}
                onClose={() => setEditando(null)}
                dismissible={!guardando}
                size="lg"
                icon={<Pencil className="w-[18px] h-[18px]" />}
                title="Editar postulante"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Button>
                        <Button onClick={guardarEdicion} isLoading={guardando}>Guardar cambios</Button>
                    </>
                }
            >
                {editando && <PostulanteForm value={editando} onChange={setEditando} errores={erroresEdicion} idPrefix="editar" />}
            </Dialog>

            {/* Sumar a vacante */}
            <Dialog
                open={sumar}
                onClose={() => setSumar(false)}
                dismissible={!guardando}
                size="sm"
                icon={<UserPlus className="w-[18px] h-[18px]" />}
                title="Sumar a una vacante"
                description={nombreCompleto(p)}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setSumar(false)} disabled={guardando}>Cancelar</Button>
                        <Button onClick={confirmarSumar} isLoading={guardando} disabled={!sumarForm.vacancyId}>Sumar</Button>
                    </>
                }
            >
                {!vacantes ? <LoadingState label="Cargando vacantes…" /> : vacantesParaSumar.length === 0 ? (
                    <p className="text-body text-muted-foreground">No hay vacantes abiertas en las que no participe.</p>
                ) : (
                    <div className="space-y-3">
                        <Select label="Vacante" required value={sumarForm.vacancyId} onChange={e => setSumarForm({ ...sumarForm, vacancyId: e.target.value })}>
                            <option value="">Elegir…</option>
                            {vacantesParaSumar.map(v => <option key={v.id} value={v.id}>{v.title}{v.branch ? ` · ${v.branch}` : ''}</option>)}
                        </Select>
                        <Select label="Etapa" value={sumarForm.stage} onChange={e => setSumarForm({ ...sumarForm, stage: e.target.value as EtapaId })}>
                            {ETAPAS.filter(e => e.id !== 'CONTRATADO' && e.id !== 'RECHAZADO').map(e => <option key={e.id} value={e.id}>{e.singular}</option>)}
                        </Select>
                        <p className="text-xs text-muted-foreground">Después podés evaluar la compatibilidad con IA desde la pestaña Análisis IA o desde el pipeline.</p>
                    </div>
                )}
            </Dialog>

            <ConfirmDialogBase
                open={eliminar}
                onCancel={() => setEliminar(false)}
                onConfirm={confirmarEliminar}
                tone="danger"
                loading={eliminando}
                title={`¿Eliminar a ${nombreCompleto(p)}?`}
                message="Se borran su ficha, el CV, los análisis de IA y su historial en todas las vacantes. No se puede deshacer."
                detail={procesosActivos.length > 0 ? `Tiene ${procesosActivos.length} ${procesosActivos.length === 1 ? 'proceso abierto' : 'procesos abiertos'}. Si no avanza, conviene marcarlo como descartado o "No apto".` : undefined}
                confirmLabel="Eliminar postulante"
            />
        </div>
    );
}
