'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, FileText, FileUp, PenLine, RefreshCw, Search, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { Button, Dialog, EmptyState, Field, LoadingState, Select, Spinner, Tabs } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import {
    analisisAFormulario, CV_MAX_BYTES, ETAPAS, formatTamanio, nombreCompleto,
    type AnalisisCv, type EtapaId, type PostulanteInput,
} from '@/lib/rrhh/reclutamiento';
import PostulanteForm, { limpiarPostulante, POSTULANTE_VACIO, validarPostulante } from './PostulanteForm';
import { EvaluacionBloque, MatchBloque, PerfilExtra, VeracidadBloque } from './AnalisisIA';
import { API, apiJson, Avatar, EstadoCandidatoBadge } from './shared';

type Modo = 'cv' | 'manual' | 'base';
type Paso = 'elegir' | 'analizando' | 'revisar';

interface RespuestaAnalisis {
    analisis: AnalisisCv;
    firma: string;
    vacancyId: string | null;
    duplicados: { id: string; firstName: string; lastName: string; email: string | null; status: string }[];
}

interface VacanteOpcion { id: string; title: string; branch: string | null; status: string }

interface Disponible {
    id: string; firstName: string; lastName: string; email: string | null; city: string | null; status: string; titular: string | null; tags: string[];
}

const MENSAJES_ANALISIS = [
    'Leyendo el PDF…',
    'Extrayendo datos de contacto…',
    'Identificando experiencia, formación y habilidades…',
    'Evaluando la consistencia del CV…',
    'Preparando el resumen…',
];

const ETAPAS_ALTA = ETAPAS.filter(e => e.id !== 'CONTRATADO' && e.id !== 'RECHAZADO');

export default function NuevoPostulanteDialog({
    open,
    onClose,
    onGuardado,
    vacante = null,
    etapaInicial = 'POSTULADO',
}: {
    open: boolean;
    onClose: () => void;
    /** Se llama al crear (o sumar desde la base) un postulante. */
    onGuardado: (id: string, origen: 'nuevo' | 'base') => void;
    /** Vacante fija (desde el pipeline o la tarjeta de la vacante). */
    vacante?: { id: string; title: string } | null;
    etapaInicial?: EtapaId;
}) {
    const [modo, setModo] = useState<Modo>('cv');
    const [paso, setPaso] = useState<Paso>('elegir');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
    const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
    const [resultado, setResultado] = useState<RespuestaAnalisis | null>(null);
    const [form, setForm] = useState<PostulanteInput>(POSTULANTE_VACIO);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [vacancyId, setVacancyId] = useState(vacante?.id ?? '');
    const [etapa, setEtapa] = useState<EtapaId>(etapaInicial);
    const [vacantes, setVacantes] = useState<VacanteOpcion[] | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState(0);
    const [arrastrando, setArrastrando] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const analisisId = useRef(0);

    // Base de talentos (solo con vacante fija)
    const [disponibles, setDisponibles] = useState<Disponible[] | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [sumando, setSumando] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setModo('cv'); setPaso('elegir'); setArchivo(null); setErrorArchivo(null); setErrorAnalisis(null);
        setResultado(null); setForm(POSTULANTE_VACIO); setErrores({}); setVacancyId(vacante?.id ?? ''); setEtapa(etapaInicial);
        setGuardando(false); setDisponibles(null); setBusqueda('');
        if (!vacante) {
            apiJson<{ vacantes: VacanteOpcion[] }>(`${API}/vacantes`)
                .then(r => setVacantes(r.vacantes.filter(v => v.status !== 'CERRADA')))
                .catch(() => setVacantes([]));
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (paso !== 'analizando') return;
        setMensaje(0);
        const t = setInterval(() => setMensaje(m => Math.min(m + 1, MENSAJES_ANALISIS.length - 1)), 4000);
        return () => clearInterval(t);
    }, [paso]);

    useEffect(() => {
        if (!open || modo !== 'base' || !vacante || disponibles) return;
        apiJson<{ disponibles: Disponible[] }>(`${API}/vacantes/${vacante.id}/postulantes`)
            .then(r => setDisponibles(r.disponibles))
            .catch(e => { showToast(e.message, 'error'); setDisponibles([]); });
    }, [open, modo, vacante, disponibles]);

    const nombreVacante = vacante?.title ?? vacantes?.find(v => v.id === vacancyId)?.title;

    const analizar = async (f: File) => {
        const id = ++analisisId.current;
        setPaso('analizando');
        setErrorAnalisis(null);
        const body = new FormData();
        body.append('archivo', f);
        if (vacancyId) body.append('vacancyId', vacancyId);
        try {
            const r = await apiJson<RespuestaAnalisis>(`${API}/cv/analizar`, { method: 'POST', body });
            if (id !== analisisId.current) return; // se canceló o se eligió otro archivo
            setResultado(r);
            setForm(analisisAFormulario(r.analisis));
            setErrores({});
            setPaso('revisar');
        } catch (e: any) {
            if (id !== analisisId.current) return;
            setErrorAnalisis(e.message);
            setPaso('elegir');
        }
    };

    const elegirArchivo = (f: File | null) => {
        setErrorAnalisis(null);
        if (!f) return;
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setErrorArchivo('Elegí un archivo PDF.'); return; }
        if (f.size > CV_MAX_BYTES) { setErrorArchivo(`El PDF pesa ${formatTamanio(f.size)}; el máximo es ${formatTamanio(CV_MAX_BYTES)}.`); return; }
        setErrorArchivo(null);
        setArchivo(f);
        if (modo === 'cv') analizar(f);
    };

    const cancelarAnalisis = () => {
        analisisId.current++;
        setPaso('elegir');
    };

    const cambiarModo = (m: string) => {
        if (paso === 'analizando') cancelarAnalisis();
        setModo(m as Modo);
        setErrores({});
        if (m === 'manual') setPaso('revisar');
        else if (m === 'cv') setPaso(resultado ? 'revisar' : 'elegir');
    };

    const guardar = async () => {
        const e = validarPostulante(form);
        setErrores(e);
        if (Object.keys(e).length) {
            showToast('Revisá los campos marcados.', 'error');
            return;
        }
        setGuardando(true);
        try {
            const usarAnalisis = modo === 'cv' && resultado;
            const body = new FormData();
            body.append('datos', JSON.stringify({
                ...limpiarPostulante(form),
                vacancyId: vacancyId || null,
                stage: etapa,
                analisis: usarAnalisis ? { datos: resultado.analisis, firma: resultado.firma, vacancyId: resultado.vacancyId } : null,
            }));
            if (archivo) body.append('archivo', archivo);
            const r = await apiJson<{ id: string; cvGuardado: boolean; almacenamiento: boolean }>(`${API}/postulantes`, { method: 'POST', body });
            showToast(archivo && !r.almacenamiento
                ? 'Postulante creado. El PDF no se guardó: falta configurar el almacenamiento de archivos.'
                : 'Postulante creado', archivo && !r.almacenamiento ? 'info' : 'success');
            onGuardado(r.id, 'nuevo');
            onClose();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setGuardando(false);
        }
    };

    const sumarDesdeBase = async (c: Disponible) => {
        if (!vacante) return;
        setSumando(c.id);
        try {
            await apiJson(`${API}/vacantes/${vacante.id}/postulantes`, { method: 'POST', body: JSON.stringify({ candidateId: c.id, stage: etapa }) });
            setDisponibles(d => (d || []).filter(x => x.id !== c.id));
            showToast(`${nombreCompleto(c)} sumado a la vacante`);
            onGuardado(c.id, 'base');
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setSumando(null);
        }
    };

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!disponibles) return [];
        if (!q) return disponibles;
        return disponibles.filter(c => [nombreCompleto(c), c.email, c.city, c.titular, ...c.tags].some(t => t?.toLowerCase().includes(q)));
    }, [disponibles, busqueda]);

    const tabs = [
        { id: 'cv', label: 'Con CV (IA)', icon: <Sparkles /> },
        { id: 'manual', label: 'Carga manual', icon: <PenLine /> },
        ...(vacante ? [{ id: 'base', label: 'Desde la base', icon: <Users /> }] : []),
    ];

    const a = resultado?.analisis;
    const mostrarFormulario = (modo === 'cv' && paso === 'revisar') || modo === 'manual';
    const ocupado = paso === 'analizando' || guardando;

    // ── Selector de vacante y etapa ─────────────────────────────────
    const selectorVacante = (
        <div className="grid sm:grid-cols-2 gap-3">
            {vacante ? (
                <Field label="Vacante">
                    <p className="input flex items-center bg-surface-sunken text-foreground truncate" aria-readonly="true">{vacante.title}</p>
                </Field>
            ) : (
                <Select
                    label="Vacante"
                    value={vacancyId}
                    onChange={e => setVacancyId(e.target.value)}
                    hint={modo === 'cv' && paso === 'elegir' ? 'Opcional. Si elegís una, la IA calcula la compatibilidad.' : resultado?.vacancyId && resultado.vacancyId !== vacancyId ? 'La compatibilidad calculada no se guarda si cambiás de vacante.' : undefined}
                    disabled={!vacantes}
                >
                    <option value="">Solo base de talentos</option>
                    {(vacantes || []).map(v => <option key={v.id} value={v.id}>{v.title}{v.branch ? ` · ${v.branch}` : ''}</option>)}
                </Select>
            )}
            {(vacancyId || vacante) && (
                <Select label="Etapa inicial" value={etapa} onChange={e => setEtapa(e.target.value as EtapaId)}>
                    {ETAPAS_ALTA.map(s => <option key={s.id} value={s.id}>{s.singular}</option>)}
                </Select>
            )}
        </div>
    );

    // ── Pie ─────────────────────────────────────────────────────────
    let footer: React.ReactNode;
    if (modo === 'base') {
        footer = <Button variant="secondary" onClick={onClose}>Cerrar</Button>;
    } else if (mostrarFormulario) {
        footer = (
            <>
                {modo === 'cv' ? (
                    <Button variant="secondary" icon={<RefreshCw />} onClick={() => { setPaso('elegir'); setResultado(null); setArchivo(null); }} disabled={guardando}>
                        Otro CV
                    </Button>
                ) : (
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                )}
                <Button onClick={guardar} isLoading={guardando} icon={<UserPlus />}>Guardar postulante</Button>
            </>
        );
    } else {
        footer = (
            <>
                <Button variant="secondary" onClick={paso === 'analizando' ? cancelarAnalisis : onClose}>
                    {paso === 'analizando' ? 'Detener' : 'Cancelar'}
                </Button>
                <Button icon={<Sparkles />} isLoading={paso === 'analizando'} disabled={!archivo} onClick={() => archivo && analizar(archivo)}>
                    {errorAnalisis ? 'Reintentar' : 'Analizar CV'}
                </Button>
            </>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!ocupado}
            size={mostrarFormulario && modo === 'cv' ? 'full' : mostrarFormulario ? 'lg' : 'md'}
            icon={<UserPlus className="w-[18px] h-[18px]" />}
            title={vacante ? 'Cargar postulante' : 'Nuevo postulante'}
            description={vacante ? `Vacante: ${vacante.title}` : 'Subí el CV y la IA completa la ficha; vos revisás antes de guardar.'}
            footer={footer}
        >
            <Tabs tabs={tabs} value={modo} onChange={cambiarModo} label="Forma de carga" className="-mt-1 mb-4" />

            {/* ── Base de talentos ── */}
            {modo === 'base' && (
                <div className="space-y-3">
                    <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                            <input className="input !pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, perfil, ciudad o etiqueta…" aria-label="Buscar en la base de talentos" />
                        </div>
                        <select className="input w-auto" aria-label="Etapa al sumar" value={etapa} onChange={e => setEtapa(e.target.value as EtapaId)}>
                            {ETAPAS_ALTA.map(s => <option key={s.id} value={s.id}>Sumar como: {s.singular}</option>)}
                        </select>
                    </div>
                    {!disponibles ? (
                        <LoadingState label="Cargando la base de talentos…" />
                    ) : filtrados.length === 0 ? (
                        <EmptyState
                            compact
                            icon={<Users />}
                            title={disponibles.length ? 'Sin resultados' : 'No hay postulantes para sumar'}
                            description={disponibles.length ? 'Probá con otra búsqueda.' : 'Todos los postulantes de la base ya están en esta vacante.'}
                        />
                    ) : (
                        <ul className="divide-y divide-border border border-border rounded-xl max-h-[50vh] overflow-y-auto">
                            {filtrados.map(c => (
                                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                                    <Avatar persona={c} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-medium text-foreground truncate">{nombreCompleto(c)}</p>
                                        <p className="text-xs text-muted-foreground truncate">{[c.titular, c.city, c.email].filter(Boolean).join(' · ') || 'Sin datos de perfil'}</p>
                                    </div>
                                    <EstadoCandidatoBadge estado={c.status} />
                                    <Button size="sm" variant="tonal" icon={<UserPlus />} isLoading={sumando === c.id} onClick={() => sumarDesdeBase(c)}>Sumar</Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* ── Elegir / analizar CV ── */}
            {modo === 'cv' && paso !== 'revisar' && (
                <div className="space-y-4">
                    {selectorVacante}
                    {paso === 'analizando' ? (
                        <div className="rounded-2xl border border-border bg-surface-sunken px-4 py-8 text-center" aria-live="polite">
                            <Spinner className="mx-auto mb-3" label="Analizando" />
                            <p className="text-body font-medium text-foreground">{MENSAJES_ANALISIS[mensaje]}</p>
                            <p className="text-caption text-muted-foreground mt-1">{archivo?.name} · suele tardar entre 10 y 40 segundos.</p>
                        </div>
                    ) : (
                        <Field label="CV del postulante" error={errorArchivo || undefined}>
                            <input
                                ref={inputRef}
                                id="cv-pdf"
                                type="file"
                                accept="application/pdf,.pdf"
                                className="sr-only"
                                onChange={e => { elegirArchivo(e.target.files?.[0] || null); e.target.value = ''; }}
                            />
                            <label
                                htmlFor="cv-pdf"
                                onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
                                onDragLeave={() => setArrastrando(false)}
                                onDrop={e => { e.preventDefault(); setArrastrando(false); elegirArchivo(e.dataTransfer.files?.[0] || null); }}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors duration-150',
                                    arrastrando ? 'border-primary bg-brand-50 dark:bg-brand-950' : 'border-border hover:border-slate-400 hover:bg-surface-sunken',
                                )}
                            >
                                <FileUp className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
                                <span className="text-body font-medium text-foreground">{archivo ? archivo.name : 'Arrastrá el CV en PDF o hacé clic para elegirlo'}</span>
                                <span className="text-caption text-muted-foreground">
                                    {archivo ? formatTamanio(archivo.size) : `Máximo ${formatTamanio(CV_MAX_BYTES)}. La IA completa datos, experiencia, habilidades e índice de veracidad.`}
                                </span>
                            </label>
                        </Field>
                    )}
                    {errorAnalisis && (
                        <div role="alert" className="rounded-xl border border-danger-200 dark:border-danger-900 bg-danger-50 dark:bg-danger-950 p-3 flex gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-danger-600 dark:text-danger-300 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="text-body text-danger-700 dark:text-danger-200">
                                <p className="font-medium">No se pudo analizar el CV.</p>
                                <p>{errorAnalisis}</p>
                                <button type="button" className="underline mt-1" onClick={() => cambiarModo('manual')}>Cargarlo a mano con el PDF adjunto</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Revisión (IA) o carga manual ── */}
            {mostrarFormulario && (
                <div className={cn(modo === 'cv' && a && 'grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start')}>
                    <div className="space-y-4 min-w-0">
                        {resultado && modo === 'cv' && resultado.duplicados.length > 0 && (
                            <div role="alert" className="rounded-xl border border-warning-200 dark:border-warning-900 bg-warning-50 dark:bg-warning-950 p-3 flex gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-warning-700 dark:text-warning-300 shrink-0 mt-0.5" aria-hidden="true" />
                                <div className="text-body text-warning-800 dark:text-warning-200">
                                    <p className="font-medium">Puede que ya esté en la base:</p>
                                    <ul className="mt-1 space-y-0.5">
                                        {resultado.duplicados.map(d => (
                                            <li key={d.id}>
                                                <Link href={`/rrhh/reclutamiento/postulantes/${d.id}`} target="_blank" className="underline">{nombreCompleto(d)}</Link>
                                                {d.email ? ` · ${d.email}` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                        {a && modo === 'cv' && !a.legible && (
                            <p role="alert" className="text-body text-warning-700 dark:text-warning-300 flex gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                El PDF se lee con dificultad: revisá cada dato con el original.
                            </p>
                        )}
                        {selectorVacante}
                        {modo === 'manual' && (
                            <div className="flex items-center gap-2 text-body">
                                <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                {archivo ? (
                                    <>
                                        <span className="truncate">{archivo.name}</span>
                                        <Button size="icon-sm" variant="ghost" aria-label="Quitar el PDF" onClick={() => setArchivo(null)}><X /></Button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-muted-foreground">Sin CV adjunto.</span>
                                        <input id="cv-pdf-manual" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e => { elegirArchivo(e.target.files?.[0] || null); e.target.value = ''; }} />
                                        <label htmlFor="cv-pdf-manual" className="text-primary underline cursor-pointer">Adjuntar PDF</label>
                                    </>
                                )}
                                {errorArchivo && <span className="field-error !mt-0">{errorArchivo}</span>}
                            </div>
                        )}
                        <PostulanteForm value={form} onChange={setForm} errores={errores} idPrefix="nuevo" />
                    </div>

                    {modo === 'cv' && a && (
                        <aside className="space-y-5 lg:sticky lg:top-0 rounded-2xl border border-border bg-surface-sunken p-4 order-first lg:order-none" aria-label="Análisis de la IA">
                            <div>
                                <p className="eyebrow flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Análisis de la IA</p>
                                {a.titular && <p className="text-heading text-foreground mt-1">{a.titular}</p>}
                                {a.resumen && <p className="text-body text-slate-700 dark:text-slate-300 mt-1">{a.resumen}</p>}
                                <div className="mt-3"><PerfilExtra seniority={a.seniority} anios={a.aniosExperiencia} idiomas={a.idiomas} certificaciones={a.certificaciones} /></div>
                            </div>
                            <div className="border-t border-border pt-4"><VeracidadBloque veracidad={a.veracidad} /></div>
                            {a.match && (
                                <div className="border-t border-border pt-4"><MatchBloque match={a.match} vacante={nombreVacante} /></div>
                            )}
                            <div className="border-t border-border pt-4">
                                <EvaluacionBloque className="!grid-cols-1" fortalezas={a.evaluacion.fortalezas} debilidades={a.evaluacion.debilidades} riesgos={a.evaluacion.riesgos} />
                            </div>
                        </aside>
                    )}
                </div>
            )}
        </Dialog>
    );
}
