'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { nivelVeracidad, SENIORITY_LABEL } from '@/lib/rrhh/reclutamiento';
import { cn } from '@/lib/cn';
import { BarraPuntaje, Lista, RecomendacionBadge } from './shared';

export interface VeracidadData {
    puntaje: number;
    resumen: string;
    senales: { tipo: 'positiva' | 'alerta'; descripcion: string }[];
}

/** Índice de veracidad: puntaje, conclusión y señales concretas que lo justifican. */
export function VeracidadBloque({ veracidad, compacto = false }: { veracidad: VeracidadData; compacto?: boolean }) {
    const positivas = veracidad.senales.filter(s => s.tipo === 'positiva');
    const alertas = veracidad.senales.filter(s => s.tipo === 'alerta');
    return (
        <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Índice de veracidad</p>
                    <p className="text-[1.5rem] leading-8 font-semibold tabular-nums text-foreground">
                        {Math.round(veracidad.puntaje)}%
                        <span className="text-body font-medium text-muted-foreground ml-2">{nivelVeracidad(veracidad.puntaje)}</span>
                    </p>
                </div>
            </div>
            <BarraPuntaje valor={veracidad.puntaje} label="Índice de veracidad" />
            {veracidad.resumen && <p className="text-body text-slate-700 dark:text-slate-300">{veracidad.resumen}</p>}
            {!compacto && (alertas.length > 0 || positivas.length > 0) && (
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <p className="text-[13px] font-semibold text-warning-700 dark:text-warning-300 mb-1.5 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" aria-hidden="true" /> A verificar
                        </p>
                        <Lista items={alertas.map(s => s.descripcion)} tono="warning" vacio="Sin alertas." />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-success-700 dark:text-success-300 mb-1.5 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Respaldos
                        </p>
                        <Lista items={positivas.map(s => s.descripcion)} tono="success" vacio="Sin respaldos destacados." />
                    </div>
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                Estimación de la IA sobre la coherencia y verificabilidad del CV. Orienta qué preguntar o validar; no reemplaza la verificación de referencias.
            </p>
        </div>
    );
}

export function EvaluacionBloque({ fortalezas, debilidades, riesgos, className }: { fortalezas: string[]; debilidades: string[]; riesgos: string[]; className?: string }) {
    return (
        <div className={cn('grid gap-4 md:grid-cols-3', className)}>
            <div>
                <p className="text-[13px] font-semibold text-success-700 dark:text-success-300 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Fortalezas
                </p>
                <Lista items={fortalezas} tono="success" />
            </div>
            <div>
                <p className="text-[13px] font-semibold text-warning-700 dark:text-warning-300 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Debilidades
                </p>
                <Lista items={debilidades} tono="warning" />
            </div>
            <div>
                <p className="text-[13px] font-semibold text-danger-700 dark:text-danger-300 mb-1.5 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" aria-hidden="true" /> Riesgos
                </p>
                <Lista items={riesgos} tono="danger" />
            </div>
        </div>
    );
}

export interface MatchData {
    puntaje: number;
    explicacion: string;
    cumple: string[];
    noCumple: string[];
    recomendacion: string | null;
}

export function MatchBloque({ match, vacante }: { match: MatchData; vacante?: string }) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="eyebrow flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Compatibilidad{vacante ? ` · ${vacante}` : ''}</p>
                    <p className="text-[1.5rem] leading-8 font-semibold tabular-nums text-foreground">{Math.round(match.puntaje)}%</p>
                </div>
                <RecomendacionBadge valor={match.recomendacion} />
            </div>
            <BarraPuntaje valor={match.puntaje} label="Compatibilidad con la vacante" />
            {match.explicacion && <p className="text-body text-slate-700 dark:text-slate-300 whitespace-pre-line">{match.explicacion}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <p className="text-[13px] font-semibold text-foreground mb-1.5">Cumple</p>
                    <Lista items={match.cumple} tono="success" vacio="—" />
                </div>
                <div>
                    <p className="text-[13px] font-semibold text-foreground mb-1.5">No cumple o falta verificar</p>
                    <Lista items={match.noCumple} tono="warning" vacio="—" />
                </div>
            </div>
        </div>
    );
}

/** Datos de perfil que la IA extrae y no tienen columna propia. */
export function PerfilExtra({ seniority, anios, idiomas, certificaciones }: {
    seniority?: string | null;
    anios?: number | null;
    idiomas?: { idioma: string; nivel: string | null }[];
    certificaciones?: string[];
}) {
    const filas: [string, React.ReactNode][] = [];
    if (seniority) filas.push(['Seniority', SENIORITY_LABEL[seniority] || seniority]);
    if (anios != null) filas.push(['Experiencia', `${String(anios).replace('.', ',')} ${anios === 1 ? 'año' : 'años'}`]);
    if (idiomas?.length) filas.push(['Idiomas', idiomas.map(i => (i.nivel ? `${i.idioma} (${i.nivel})` : i.idioma)).join(', ')]);
    if (certificaciones?.length) filas.push(['Certificaciones', certificaciones.join(' · ')]);
    if (!filas.length) return null;
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
            {filas.map(([k, v]) => (
                <React.Fragment key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-foreground">{v}</dd>
                </React.Fragment>
            ))}
        </dl>
    );
}
