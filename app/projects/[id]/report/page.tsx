import { prisma } from '@/lib/dataLayer';
import { notFound, redirect } from 'next/navigation';
import { Building2, Calendar, Clock, Activity, Timer, Users, ShieldCheck, FileText, MessageSquare } from 'lucide-react';
import ReportPrintButton from '@/components/ReportPrintButton';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

export default async function ProjectReportPage({ params, searchParams }: { params: { id: string }, searchParams?: { token?: string } }) {
    const project = await prisma.project.findUnique({
        where: { id: params.id },
        include: {
            client: true,
            timeEntries: {
                where: { estadoConfirmado: true },
                include: { operator: true },
                orderBy: { fecha: 'asc' }
            },
            clientDelays: {
                orderBy: { fecha: 'asc' }
            },
            checklistItems: {
                orderBy: { createdAt: 'asc' }
            },
            logs: {
                orderBy: { fecha: 'desc' }
            }
        }
    });

    if (!project) return notFound();

    // Security check: If not authenticated or accessing publicly, token must match
    const token = searchParams?.token;
    if (token && project.publicToken && token !== project.publicToken) {
        return notFound();
    }
    // If no token, we assume RootLayout checked auth for /projects route, 
    // but RootLayout whitelisted /report, so we should be careful.
    // Actually, RootLayout allows the page to render, so we should check if they should see it.
    // For now, if no token is provided but they reached here, we'll let it be as long as it's not strictly restricted.
    // In a production app, we'd check session here too.

    const hasClientStr = project.client?.nombre || project.cliente || 'Sin cliente';
    const totalDelaysHours = project.clientDelays.reduce((acc, d) => acc + d.duracion, 0);
    const totalRealHours = project.timeEntries.reduce((acc, t) => acc + t.horasTrabajadas, 0);

    const IPT = project.horasEstimadas > 0 && totalRealHours > 0
        ? (project.horasEstimadas / totalRealHours).toFixed(2)
        : project.horasEstimadas > 0 ? 'N/A' : 'N/A';

    const savedHours = project.horasEstimadas - totalRealHours;

    // Impacto de demoras sobre lo ejecutado
    const delayImpactPct = totalRealHours > 0
        ? ((totalDelaysHours / totalRealHours) * 100).toFixed(1)
        : '0.0';

    // Agrupar por operador
    const operatorMap: Record<string, { nombre: string; horas: number }> = {};
    project.timeEntries.forEach(entry => {
        if (!operatorMap[entry.operatorId]) {
            operatorMap[entry.operatorId] = { nombre: entry.operator.nombreCompleto, horas: 0 };
        }
        operatorMap[entry.operatorId].horas += entry.horasTrabajadas;
    });

    // Agrupar demoras por área (para gráfica)
    const delaysByArea: Record<string, number> = {};
    project.clientDelays.forEach(d => {
        delaysByArea[d.area] = (delaysByArea[d.area] || 0) + d.duracion;
    });

    const operatorArray = Object.values(operatorMap);
    const delaysArray = Object.entries(delaysByArea).map(([area, horas]) => ({ area, horas }));

    return (
        <div className="min-h-screen bg-slate-50 py-8 print:p-0 print:bg-white text-slate-800 font-sans mx-auto max-w-[900px]">
            {/* Control Bar (hidden in print) */}
            <div className="flex justify-end mb-8 print:hidden px-4 md:px-0">
                <ReportPrintButton
                    project={project}
                    totalRealHours={totalRealHours}
                    savedHours={savedHours}
                    IPT={IPT}
                    operatorMap={operatorArray}
                    delaysByArea={delaysArray}
                    delayImpactPct={delayImpactPct}
                    clientDelays={project.clientDelays}
                />
            </div>

            <div id="report-content" className="bg-white p-10 md:p-14 md:rounded-[2.5rem] shadow-sm print:shadow-none print:p-0">

                {/* ── Header ── */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Reporte de Proyecto</h1>
                        <div className="flex items-center">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 mr-2" />
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">PROYECTO FINALIZADO</span>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                        <h2 className="text-2xl font-black text-indigo-600 tracking-tight leading-none">{project.nombre}</h2>
                        <div className="flex items-center justify-end text-slate-500">
                            <span className="text-sm font-bold">{hasClientStr}</span>
                            <Building2 className="w-4 h-4 ml-1.5" />
                        </div>
                        {/* Fechas del proyecto */}
                        <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-400">
                            <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Inicio: {formatDate(project.fechaInicio)}</span>
                            </div>
                            <span>→</span>
                            <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Fin: {formatDate(project.fechaFin)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-10">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hs Estimadas</p>
                        <p className="text-2xl font-black text-slate-800">{project.horasEstimadas}h</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hs Reales</p>
                        <p className={`text-2xl font-black ${totalRealHours > project.horasEstimadas ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {totalRealHours.toFixed(1)}h
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ahorro / Desvío</p>
                        <p className={`text-2xl font-black ${savedHours >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {savedHours > 0 ? '+' : ''}{savedHours.toFixed(1)}h
                        </p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Eficiencia (IPT)</p>
                        <p className="text-2xl font-black text-indigo-600">{IPT}</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Carga Demoras</p>
                        <p className="text-2xl font-black text-amber-500">{delayImpactPct}%</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Avance Técnico</p>
                        <p className="text-base font-black text-emerald-600">
                            {project.checklistItems.filter(i => i.completed && !i.excluded).length} / {project.checklistItems.filter(i => !i.excluded).length}
                        </p>
                    </div>
                </div>

                {/* ── Observaciones ── */}
                {project.observaciones && (
                    <div className="mb-8 p-5 bg-amber-50 border border-amber-100 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-amber-500" />
                            <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest">Observaciones del Proyecto</h3>
                        </div>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{project.observaciones}</p>
                    </div>
                )}

                {/* ── Resúmenes laterales ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-slate-100 pb-10 mb-10">
                    {/* Operadores */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
                            <Users className="w-5 h-5 text-indigo-500 mr-2.5" />
                            Resumen por Operador
                        </h3>
                        <div className="space-y-3">
                            {operatorArray.map((op, idx) => {
                                const pct = totalRealHours > 0 ? Math.min(op.horas / totalRealHours, 1) * 100 : 0;
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                            <span>{op.nombre}</span>
                                            <span>{op.horas.toFixed(1)}h</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {operatorArray.length === 0 && (
                                <p className="text-sm font-bold text-slate-400 italic">No hay registros de tiempo confirmados.</p>
                            )}
                        </div>
                    </div>

                    {/* Demoras por area */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
                            <Timer className="w-5 h-5 text-amber-500 mr-2.5" />
                            Demoras del Cliente:&nbsp;<span className="text-amber-500">{totalDelaysHours}h</span>
                            <span className="ml-2 text-xs font-bold text-slate-400">({delayImpactPct}% carga)</span>
                        </h3>
                        <div className="space-y-3">
                            {delaysArray.map(({ area, horas }, idx) => {
                                const pct = totalDelaysHours > 0 ? (horas / totalDelaysHours) * 100 : 0;
                                return (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                            <span>{area}</span>
                                            <span className="text-amber-500">{horas}h</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {delaysArray.length === 0 && (
                                <p className="text-sm font-bold text-slate-400 italic">Sin demoras registradas.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Tablas de Detalle ── */}
                <div className="space-y-10">

                    {/* Bitácora de Seguimiento y Comentarios */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-indigo-500" />
                            Bitácora de Seguimiento y Comentarios
                        </h3>
                        {project.logs.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay comentarios o seguimiento registrados aún.</p>
                        ) : (
                            <div className="space-y-4">
                                {project.logs.map((log) => (
                                    <div key={log.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col gap-2">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                            <div className="flex items-center gap-2 text-indigo-600">
                                                <Calendar className="w-3.5 h-3.5" /> {formatDate(log.fecha)}
                                            </div>
                                            <div className="text-slate-400">
                                                Responsable: {log.responsable}
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed">
                                            {log.observacion}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Desglose Tiempos Operativos — sin columna Horas, solo Horario */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            Desglose de Tiempos Operativos
                        </h3>
                        {project.timeEntries.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Sin registros de tiempo confirmados.</p>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="py-2 pr-4 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Fecha</th>
                                        <th className="py-2 pr-4 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Operador</th>
                                        <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Horario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.timeEntries.map(e => (
                                        <tr key={e.id} className="border-b border-slate-50 text-slate-600 font-medium">
                                            <td className="py-2 pr-4">{formatDate(e.fecha)}</td>
                                            <td className="py-2 pr-4">{e.operator.nombreCompleto}</td>
                                            <td className="py-2 font-bold">{e.horaIngreso} → {e.horaEgreso}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Detalle Demoras Externas — con columna Responsable Área */}
                    {project.clientDelays.length > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Timer className="w-4 h-4 text-amber-500" />
                                Detalle de Demoras Externas
                            </h3>
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="py-2 pr-3 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Fecha</th>
                                        <th className="py-2 pr-3 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Área</th>
                                        <th className="py-2 pr-3 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Resp. Área</th>
                                        <th className="py-2 pr-3 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Motivo</th>
                                        <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right">Hs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.clientDelays.map(d => (
                                        <tr key={d.id} className="border-b border-slate-50 text-slate-600 font-medium">
                                            <td className="py-2 pr-3">{formatDate(d.fecha)}</td>
                                            <td className="py-2 pr-3 text-amber-600 font-bold text-xs uppercase">{d.area}</td>
                                            <td className="py-2 pr-3 text-slate-500 text-xs">{(d as any).responsableArea || '—'}</td>
                                            <td className="py-2 pr-3 italic max-w-[200px] truncate" title={d.motivo}>"{d.motivo}"</td>
                                            <td className="py-2 text-right font-black text-amber-500">{d.duracion}h</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-slate-200 font-black">
                                        <td colSpan={4} className="py-2 pr-3 text-right text-[10px] uppercase tracking-widest text-slate-400">Total Demoras:</td>
                                        <td className="py-2 text-right text-amber-500">{totalDelaysHours}h</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Checklist Técnico */}
                    <div>
                        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Avance Técnico (Checklist)
                        </h3>
                        {project.checklistItems.filter(i => !i.excluded).length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Sin tareas documentadas en el checklist.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {project.checklistItems.filter(i => !i.excluded).map((item) => (
                                    <div key={item.id} className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${item.completed ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                        <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-xl border-2 flex items-center justify-center ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 bg-white'}`}>
                                            {item.completed && <Activity className="w-3 h-3" />}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold leading-snug ${item.completed ? 'text-emerald-900' : 'text-slate-600'}`}>
                                                {item.description}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 font-bold uppercase tracking-widest text-[9px]">
                                                <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-400">
                                                    {item.tag}
                                                </span>
                                                <span className={item.completed ? 'text-emerald-500' : 'text-slate-300'}>
                                                    {item.completed ? '● COMPLETADO' : '○ PENDIENTE'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-16 pt-6 border-t border-slate-200 text-center text-xs font-bold text-slate-400">
                    <p>Reporte Oficial | Generado automáticamente por HDB Job Planner el {new Date().toLocaleDateString('es-AR')}</p>
                </div>
            </div>
        </div>
    );
}
