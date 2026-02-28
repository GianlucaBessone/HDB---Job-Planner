import { prisma } from '@/lib/dataLayer';
import { notFound } from 'next/navigation';
import { Building2, Calendar, Clock, Activity, Timer, Users, Download, ShieldCheck } from 'lucide-react';
import ReportPrintButton from '@/components/ReportPrintButton';

export const dynamic = 'force-dynamic';

export default async function ProjectReportPage({ params }: { params: { id: string } }) {
    const project = await prisma.project.findUnique({
        where: { id: params.id },
        include: {
            client: true,
            timeEntries: {
                where: { estadoConfirmado: true }, // we probably only want to report confirmed entries
                include: { operator: true },
                orderBy: { fecha: 'asc' }
            },
            clientDelays: {
                orderBy: { fecha: 'asc' }
            }
        }
    });

    if (!project) return notFound();

    // Calculos rápidos
    const hasClientStr = project.client?.nombre || project.cliente || 'Sin cliente';
    const totalDelaysHours = project.clientDelays.reduce((acc, d) => acc + d.duracion, 0);
    const totalRealHours = project.timeEntries.reduce((acc, t) => acc + t.horasTrabajadas, 0);

    // We display 'horasConsumidas' directly from the project, or the aggregated sum of timeEntries. The aggregated sum is more accurate.
    const IPT = project.horasEstimadas > 0 && totalRealHours > 0
        ? (project.horasEstimadas / totalRealHours).toFixed(2)
        : project.horasEstimadas > 0 ? "Perfect" : "N/A";

    const savedHours = project.horasEstimadas - totalRealHours;

    // Agrupar Tiempos por Operador
    const operatorMap: Record<string, { nombre: string, horas: number }> = {};
    project.timeEntries.forEach(entry => {
        if (!operatorMap[entry.operatorId]) {
            operatorMap[entry.operatorId] = { nombre: entry.operator.nombreCompleto, horas: 0 };
        }
        operatorMap[entry.operatorId].horas += entry.horasTrabajadas;
    });

    // Agrupar Demoras por Área
    const delaysByArea: Record<string, number> = {};
    project.clientDelays.forEach(d => {
        delaysByArea[d.area] = (delaysByArea[d.area] || 0) + d.duracion;
    });

    // Final formatting for the PDF component
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
                />
            </div>

            <div id="report-content" className="bg-white p-10 md:p-14 md:rounded-[2.5rem] shadow-sm print:shadow-none print:p-0">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Reporte de Proyecto</h1>
                        <div className="flex items-center">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 mr-2" />
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">PROYECTO FINALIZADO</span>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <h2 className="text-2xl font-black text-indigo-600 tracking-tight leading-none mb-1">{project.nombre}</h2>
                        <div className="flex items-center justify-end text-slate-500">
                            <span className="text-sm font-bold">{hasClientStr}</span>
                            <Building2 className="w-4 h-4 ml-1.5" />
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="flex justify-between items-stretch gap-4 mb-10">
                    <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center min-h-[100px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Horas Estimadas</p>
                        <p className="text-2xl font-black text-slate-800 text-center">{project.horasEstimadas}h</p>
                    </div>
                    <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center min-h-[100px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Horas Reales</p>
                        <p className={`text-2xl font-black text-center ${totalRealHours > project.horasEstimadas ? 'text-rose-500' : 'text-emerald-500'}`}>{totalRealHours.toFixed(1)}h</p>
                    </div>
                    <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-center min-h-[100px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Ahorro / Desvío</p>
                        <p className={`text-2xl font-black text-center ${savedHours >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {savedHours > 0 ? '+' : ''}{savedHours.toFixed(1)}h
                        </p>
                    </div>
                    <div className="flex-1 bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-center min-h-[100px]">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 text-center">Eficiencia (IPT)</p>
                        <p className="text-2xl font-black text-indigo-600 text-center">{IPT}</p>
                    </div>
                </div>

                {/* Content columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-slate-100 pb-10 mb-10">
                    {/* Left Col */}
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                <Users className="w-5 h-5 text-indigo-500 mr-2.5" />
                                Resumen por Operador
                            </h3>
                            <div className="space-y-3">
                                {Object.values(operatorMap).map((op, idx) => {
                                    const percentage = totalRealHours > 0 ? (Math.min(op.horas / totalRealHours, 1)) * 100 : 0;
                                    return (
                                        <div key={idx} className="bg-white">
                                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                                <span>{op.nombre}</span>
                                                <span>{op.horas.toFixed(1)}h</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {Object.values(operatorMap).length === 0 && <p className="text-sm font-bold text-slate-400 italic">No hay registros de tiempo confirmados.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Right Col */}
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                <Timer className="w-5 h-5 text-amber-500 mr-2.5" />
                                Demoras del Cliente: <span className="text-amber-500 ml-2">{totalDelaysHours}h</span>
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(delaysByArea).map(([area, horas], idx) => {
                                    const percentage = totalDelaysHours > 0 ? (horas / totalDelaysHours) * 100 : 0;
                                    return (
                                        <div key={idx} className="bg-white">
                                            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                                <span>{area}</span>
                                                <span className="text-amber-500">{horas}h</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {Object.keys(delaysByArea).length === 0 && <p className="text-sm font-bold text-slate-400 italic">Sin demoras registradas.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* History Tables */}
                <div className="space-y-10">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Desglose de Tiempos Operativos</h3>
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Fecha</th>
                                    <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Operador</th>
                                    <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Horario</th>
                                    <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right">Horas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {project.timeEntries.map(e => (
                                    <tr key={e.id} className="border-b border-slate-50 text-slate-600 font-medium">
                                        <td className="py-2">{e.fecha}</td>
                                        <td className="py-2">{e.operator.nombreCompleto}</td>
                                        <td className="py-2">{e.horaIngreso} - {e.horaEgreso}</td>
                                        <td className="py-2 text-right font-bold">{e.horasTrabajadas}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {project.clientDelays.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Detalle de Demoras Externas</h3>
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Fecha</th>
                                        <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Área</th>
                                        <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Motivo</th>
                                        <th className="py-2 font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right">Horas Perdidas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.clientDelays.map(d => (
                                        <tr key={d.id} className="border-b border-slate-50 text-slate-600 font-medium">
                                            <td className="py-2">{d.fecha}</td>
                                            <td className="py-2">{d.area}</td>
                                            <td className="py-2 italic max-w-xs truncate" title={d.motivo}>"{d.motivo}"</td>
                                            <td className="py-2 text-right font-bold text-amber-500">{d.duracion}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-16 pt-6 border-t border-slate-200 text-center text-xs font-bold text-slate-400">
                    <p>Reporte Oficial | Generado automáticamente por HDB Job Planner el {new Date().toLocaleDateString('es-AR')}</p>
                </div>
            </div>
        </div>
    );
}
